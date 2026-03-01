import { Monitor, Apple, Download, ExternalLink } from 'lucide-react';

interface Platform {
  name: string;
  icon: React.ReactNode;
  description: string;
  filename: string;
  ext: string;
  note?: string;
}

const PLATFORMS: Platform[] = [
  {
    name: 'Windows',
    icon: <Monitor size={28} />,
    description: 'Windows 10 / 11 (64-bit)',
    filename: 'Obliview-Setup',
    ext: '.exe',
    note: 'Requires WebView2 (included with Windows 10 1803+ or Edge Chromium)',
  },
  {
    name: 'macOS',
    icon: <Apple size={28} />,
    description: 'macOS 12 Monterey or later',
    filename: 'Obliview',
    ext: '.dmg',
    note: 'Universal binary — supports Intel and Apple Silicon',
  },
];

/** Base URL for release assets. Set VITE_DESKTOP_RELEASE_URL in .env to override. */
const RELEASE_BASE = (import.meta.env.VITE_DESKTOP_RELEASE_URL as string | undefined) ?? '';

export function DownloadPage() {
  const hasReleases = RELEASE_BASE !== '';

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      {/* Header */}
      <div className="mb-10 text-center">
        <div className="mb-4 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Download size={32} />
          </div>
        </div>
        <h1 className="mb-2 text-3xl font-bold text-text-primary">Obliview Desktop</h1>
        <p className="text-text-secondary">
          A lightweight native wrapper for your Obliview instance.
          Get system-level sound notifications and a distraction-free monitoring experience.
        </p>
      </div>

      {/* Feature pills */}
      <div className="mb-10 flex flex-wrap justify-center gap-2">
        {[
          'Sound alerts for probe down / recovery',
          'Agent threshold notifications',
          'No browser overhead',
          'Remembers your server URL',
          'Always up-to-date — no rebuilds needed',
        ].map((f) => (
          <span
            key={f}
            className="rounded-full border border-border bg-bg-secondary px-3 py-1 text-xs text-text-secondary"
          >
            {f}
          </span>
        ))}
      </div>

      {/* Download cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {PLATFORMS.map((p) => {
          const href = hasReleases ? `${RELEASE_BASE}/${p.filename}${p.ext}` : undefined;
          return (
            <div
              key={p.name}
              className="flex flex-col rounded-xl border border-border bg-bg-secondary p-6"
            >
              <div className="mb-4 flex items-center gap-3 text-text-primary">
                <span className="text-text-secondary">{p.icon}</span>
                <div>
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-xs text-text-muted">{p.description}</div>
                </div>
              </div>

              {p.note && (
                <p className="mb-4 text-xs text-text-muted leading-relaxed">{p.note}</p>
              )}

              <div className="mt-auto">
                {href ? (
                  <a
                    href={href}
                    download
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
                  >
                    <Download size={14} />
                    Download {p.filename}{p.ext}
                  </a>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="rounded-lg border border-border bg-bg-tertiary px-4 py-2.5 text-center text-sm text-text-muted">
                      Coming soon
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Build-it-yourself note */}
      <div className="mt-8 rounded-xl border border-border bg-bg-secondary p-5">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-text-primary">
          <ExternalLink size={14} />
          Build from source
        </div>
        <p className="text-sm text-text-secondary leading-relaxed">
          The desktop app lives in the <code className="rounded bg-bg-tertiary px-1.5 py-0.5 text-xs font-mono text-text-primary">desktop-app/</code> directory of the Obliview repository.
          It is a Go application using the native OS webview (WebView2 on Windows, WKWebView on macOS).
          Run <code className="rounded bg-bg-tertiary px-1.5 py-0.5 text-xs font-mono text-text-primary">go build -o obliview .</code> inside that directory to compile it locally.
        </p>
      </div>

      {/* How it works */}
      <div className="mt-6 rounded-xl border border-border bg-bg-secondary p-5">
        <div className="mb-3 text-sm font-semibold text-text-primary">How it works</div>
        <ul className="space-y-2 text-sm text-text-secondary">
          <li className="flex gap-2">
            <span className="mt-0.5 shrink-0 text-primary">1.</span>
            On first launch, enter your Obliview server URL. It is saved locally.
          </li>
          <li className="flex gap-2">
            <span className="mt-0.5 shrink-0 text-primary">2.</span>
            The app opens your Obliview in a native window — no browser tabs, no address bar.
          </li>
          <li className="flex gap-2">
            <span className="mt-0.5 shrink-0 text-primary">3.</span>
            Sound notifications play when a probe goes down/up or an agent threshold is breached/cleared.
          </li>
          <li className="flex gap-2">
            <span className="mt-0.5 shrink-0 text-primary">4.</span>
            Click the ⚙ gear icon (bottom-right corner) to change the server URL at any time.
          </li>
          <li className="flex gap-2">
            <span className="mt-0.5 shrink-0 text-primary">5.</span>
            No rebuild is needed after Obliview updates — the app always loads the latest web UI.
          </li>
        </ul>
      </div>
    </div>
  );
}
