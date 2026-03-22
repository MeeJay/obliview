import { Router } from 'express';
import { db } from '../db';
import { obligateService } from '../services/obligate.service';
import { tenantService } from '../services/tenant.service';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /auth/callback?code=xxx&state=xxx
 * Called by Obligate after successful authentication.
 * Exchanges the code for user info, auto-provisions, creates session, redirects.
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query as { code?: string; state?: string };
    if (!code) {
      res.status(400).json({ success: false, error: 'Missing code' });
      return;
    }

    // Build the redirect_uri that was used in the authorize request
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const redirectUri = `${protocol}://${host}/auth/callback`;

    // Exchange code with Obligate
    const assertion = await obligateService.exchangeCode(code, redirectUri);
    if (!assertion) {
      res.status(401).json({ success: false, error: 'Invalid or expired authorization code' });
      return;
    }

    // Find or create local user
    let localUserId: number;

    if (assertion.linkedLocalUserId) {
      // Obligate already knows our local user ID (previously linked)
      localUserId = assertion.linkedLocalUserId;
      // Sync role/email from Obligate assertion
      await db('users').where({ id: localUserId }).update({
        role: assertion.role === 'admin' ? 'admin' : 'user',
        email: assertion.email,
        display_name: assertion.displayName,
        updated_at: new Date(),
      });
    } else {
      // Check sso_foreign_users for existing link
      const existingLink = await db('sso_foreign_users')
        .where({ foreign_source: 'obligate', foreign_user_id: assertion.obligateUserId })
        .first() as { local_user_id: number } | undefined;

      if (existingLink) {
        localUserId = existingLink.local_user_id;
        await db('users').where({ id: localUserId }).update({
          role: assertion.role === 'admin' ? 'admin' : 'user',
          email: assertion.email,
          display_name: assertion.displayName,
          updated_at: new Date(),
        });
      } else {
        // Create new local user (foreign_source='obligate', no password)
        const [newUser] = await db('users')
          .insert({
            username: `obligate_${assertion.obligateUserId}`,
            display_name: assertion.displayName || assertion.username,
            email: assertion.email,
            role: assertion.role === 'admin' ? 'admin' : 'user',
            is_active: true,
            foreign_source: 'obligate',
            foreign_id: assertion.obligateUserId,
          })
          .returning('id') as Array<{ id: number }>;
        localUserId = newUser.id;

        // Record in sso_foreign_users
        await db('sso_foreign_users').insert({
          foreign_source: 'obligate',
          foreign_user_id: assertion.obligateUserId,
          local_user_id: localUserId,
        });

        // Auto-assign to tenants based on Obligate assertion
        for (const t of assertion.tenants) {
          const tenant = await db('tenants').where({ slug: t.slug }).first() as { id: number } | undefined;
          if (tenant) {
            await db('user_tenants')
              .insert({ user_id: localUserId, tenant_id: tenant.id, role: t.role === 'admin' ? 'admin' : 'member' })
              .onConflict(['user_id', 'tenant_id'])
              .merge({ role: t.role === 'admin' ? 'admin' : 'member' });
          }
        }

        // Report back to Obligate
        obligateService.reportProvision(assertion.obligateUserId, localUserId).catch(() => {});
      }
    }

    // Establish session
    req.session.userId = localUserId;
    const user = await db('users').where({ id: localUserId }).first() as { username: string; role: string } | undefined;
    if (user) {
      req.session.username = user.username;
      req.session.role = user.role;
    }

    // Set tenant
    const tenant = await tenantService.getFirstTenantForUser(localUserId);
    req.session.currentTenantId = tenant?.id ?? 1;

    logger.info(`Obligate SSO: user ${assertion.username} (obligate #${assertion.obligateUserId}) → local #${localUserId}`);

    // Redirect to app
    res.redirect('/');
  } catch (err) {
    logger.error(err, 'Obligate callback error');
    res.status(500).json({ success: false, error: 'SSO callback failed' });
  }
});

/**
 * GET /auth/sso-redirect
 * Server-side redirect to Obligate authorize endpoint (browser redirect).
 * The server knows the API key — the client never sees it.
 */
router.get('/sso-redirect', async (req, res) => {
  try {
    const raw = await (await import('../services/appConfig.service')).appConfigService.getObligateRaw();
    if (!raw.url || !raw.apiKey) {
      res.redirect('/login');
      return;
    }
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const redirectUri = `${protocol}://${host}/auth/callback`;
    const obligateUrl = `${raw.url}/authorize?client_id=${encodeURIComponent(raw.apiKey)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    res.redirect(obligateUrl);
  } catch {
    res.redirect('/login');
  }
});

/**
 * GET /api/auth/sso-config
 * Returns Obligate SSO config for the LoginPage (public, no auth required).
 */
router.get('/sso-config', async (_req, res) => {
  try {
    const config = await obligateService.getSsoConfig();
    res.json({ success: true, data: config });
  } catch (err) {
    res.json({ success: true, data: { obligateUrl: null, obligateReachable: false, obligateEnabled: false } });
  }
});

/**
 * GET /api/auth/connected-apps
 * Returns list of connected apps from Obligate (for cross-app nav buttons).
 */
router.get('/connected-apps', async (req, res) => {
  try {
    if (!req.session?.userId) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }
    const apps = await obligateService.getConnectedApps();
    res.json({ success: true, data: apps });
  } catch (err) {
    res.json({ success: true, data: [] });
  }
});

export default router;
