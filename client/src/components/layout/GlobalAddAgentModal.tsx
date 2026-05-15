import { useState, useEffect, useMemo } from 'react';
import { Key, Copy, Check, Monitor, Terminal, Apple, Download, ChevronDown } from 'lucide-react';
import type { AgentApiKey } from '@obliview/shared';
import { agentApi } from '@/api/agent.api';
import { Button } from '@/components/common/Button';
import { useUiStore } from '@/store/uiStore';

type OsTab = 'windows' | 'linux' | 'macos' | 'freebsd';
type WindowsVariant = 'modern' | 'oldtls' | 'legacy' | 'manual';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="shrink-0 p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
      title="Copy"
    >
      {copied ? <Check size={14} className="text-status-up" /> : <Copy size={14} />}
    </button>
  );
}

function CommandBlock({ command }: { command: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md bg-bg-tertiary p-3">
      <code className="flex-1 text-xs font-mono text-text-primary break-all leading-relaxed whitespace-pre-wrap">{command}</code>
      <CopyButton text={command} />
    </div>
  );
}

export function GlobalAddAgentModal() {
  const { addAgentModalOpen, closeAddAgentModal } = useUiStore();
  const [keys, setKeys] = useState<AgentApiKey[]>([]);
  const [agentVersion, setAgentVersion] = useState('1.0.0');
  const [selectedKeyId, setSelectedKeyId] = useState<number | null>(null);
  const [osTab, setOsTab] = useState<OsTab>('windows');
  const [winVariant, setWinVariant] = useState<WindowsVariant>('modern');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    if (!addAgentModalOpen) return;
    Promise.all([
      agentApi.listKeys(),
      agentApi.getVersion().catch(() => ({ version: '1.0.0', downloadUrl: '' })),
    ]).then(([k, v]) => {
      setKeys(k);
      setAgentVersion(v.version);
      if (k.length > 0 && selectedKeyId === null) setSelectedKeyId(k[0].id);
    });
  }, [addAgentModalOpen]);

  const selectedKey = useMemo(
    () => keys.find((k) => k.id === selectedKeyId) ?? null,
    [keys, selectedKeyId],
  );

  if (!addAgentModalOpen) return null;

  const origin = window.location.origin;
  const msiUrl = `${origin}/api/agent/installer/windows.msi`;
  const legacyExeUrl = `${origin}/api/agent/download/obliview-agent.exe`;
  const apiKey = selectedKey?.key ?? '';
  const encKey = encodeURIComponent(apiKey);

  // ── Command templates ──
  const linuxCmd = `curl -fsSL "${origin}/api/agent/installer/linux?key=${encKey}" | bash`;
  const macosCmd = `sudo bash -c "$(curl -fsSL '${origin}/api/agent/installer/macos?key=${encKey}')"`;
  const freebsdCmd = `fetch -qo - "${origin}/api/agent/installer/freebsd?key=${encKey}" | sh`;

  const winModernCmd = `$m="$env:TEMP\\obliview-agent.msi"; Invoke-WebRequest "${msiUrl}" -OutFile $m -UseBasicParsing; Start-Process msiexec -ArgumentList "/i \`"$m\`" SERVERURL=\`"${origin}\`" APIKEY=\`"${apiKey}\`" /quiet" -Wait -Verb RunAs; Remove-Item $m`;

  const winOldTlsCmd = `$m="$env:TEMP\\obliview-agent.msi"; Import-Module BitsTransfer; Start-BitsTransfer -Source "${msiUrl}" -Destination $m; Start-Process msiexec -ArgumentList "/i \`"$m\`" SERVERURL=\`"${origin}\`" APIKEY=\`"${apiKey}\`" /quiet" -Wait -Verb RunAs; Remove-Item $m`;

  const winLegacyCmd = `$d="C:\\Program Files\\ObliviewAgent"; New-Item -ItemType Directory -Force -Path $d | Out-Null; Import-Module BitsTransfer; Start-BitsTransfer -Source "${legacyExeUrl}" -Destination "$d\\obliview-agent.exe"; New-Service -Name ObliviewAgent -BinaryPathName "\`"$d\\obliview-agent.exe\`" --url ${origin} --key ${apiKey}" -StartupType Automatic -DisplayName "Obliview Monitoring Agent"; Start-Service ObliviewAgent`;

  const wizardUrl = selectedKey
    ? `${origin}/api/agent/installer/wizard.exe?keyId=${selectedKey.id}`
    : '';

  const noKeys = keys.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-xl border border-border bg-bg-primary shadow-2xl overflow-y-auto max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-text-primary">Add Agent</h2>
            <p className="text-xs text-text-muted mt-0.5">Agent version: {agentVersion}</p>
          </div>
          <button onClick={closeAddAgentModal} className="text-text-muted hover:text-text-primary text-xl leading-none">×</button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {noKeys ? (
            <div className="text-center py-8">
              <Key size={28} className="mx-auto mb-2 text-text-muted" />
              <p className="text-sm text-text-muted">Create an API Key first in the Agents page</p>
            </div>
          ) : (
            <>
              {/* API key picker */}
              <div>
                <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">
                  API Key
                </label>
                <div className="relative">
                  <button
                    onClick={() => setDropdownOpen((v) => !v)}
                    className="w-full flex items-center justify-between gap-2 rounded-md border border-border bg-bg-secondary px-3 py-2 text-left hover:border-border-light transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Key size={14} className="text-accent shrink-0" />
                      <span className="text-sm text-text-primary truncate">
                        {selectedKey?.name ?? 'Choose a key'}
                      </span>
                      {selectedKey && (
                        <span className="text-xs font-mono text-text-muted shrink-0">
                          {selectedKey.key.slice(0, 8)}…{selectedKey.key.slice(-4)}
                        </span>
                      )}
                    </div>
                    <ChevronDown size={14} className="text-text-muted shrink-0" />
                  </button>
                  {dropdownOpen && (
                    <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-bg-secondary shadow-lg max-h-60 overflow-y-auto">
                      {keys.map((k) => (
                        <button
                          key={k.id}
                          onClick={() => { setSelectedKeyId(k.id); setDropdownOpen(false); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-bg-hover transition-colors"
                        >
                          <Key size={14} className="text-accent shrink-0" />
                          <span className="text-sm text-text-primary flex-1 truncate">{k.name}</span>
                          <span className="text-xs font-mono text-text-muted shrink-0">
                            {k.key.slice(0, 8)}…{k.key.slice(-4)}
                          </span>
                          {k.deviceCount !== undefined && (
                            <span className="text-xs text-text-muted shrink-0">
                              {k.deviceCount} dev.
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* OS tabs */}
              <div className="flex items-center gap-1 rounded-md bg-bg-secondary p-1 border border-border">
                {([
                  { id: 'windows', label: 'Windows', icon: Monitor },
                  { id: 'linux', label: 'Linux', icon: Terminal },
                  { id: 'macos', label: 'macOS', icon: Apple },
                  { id: 'freebsd', label: 'FreeBSD', icon: Terminal },
                ] as const).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setOsTab(tab.id)}
                    className={
                      'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ' +
                      (osTab === tab.id
                        ? 'bg-accent/15 text-accent border border-accent/30'
                        : 'text-text-muted hover:text-text-primary')
                    }
                  >
                    <tab.icon size={13} />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Per-OS body */}
              <div className="space-y-3">
                {osTab === 'windows' && (
                  <>
                    {/* Windows variant pills */}
                    <div className="flex items-center gap-1 flex-wrap">
                      {([
                        { id: 'modern',  label: 'Windows 10+' },
                        { id: 'oldtls',  label: 'Server 2012/2016' },
                        { id: 'legacy',  label: 'Server 2008 R2' },
                        { id: 'manual',  label: 'Manual / Wizard' },
                      ] as const).map((v) => (
                        <button
                          key={v.id}
                          onClick={() => setWinVariant(v.id)}
                          className={
                            'px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors border ' +
                            (winVariant === v.id
                              ? 'bg-accent/15 text-accent border-accent/30'
                              : 'bg-bg-tertiary text-text-muted border-border hover:border-border-light')
                          }
                        >
                          {v.label}
                        </button>
                      ))}
                    </div>

                    {winVariant === 'modern' && (
                      <>
                        <p className="text-xs text-text-muted">
                          PowerShell as Administrator on Windows 10, 11, Server 2019 and newer.
                        </p>
                        <CommandBlock command={winModernCmd} />
                      </>
                    )}
                    {winVariant === 'oldtls' && (
                      <>
                        <p className="text-xs text-text-muted">
                          Uses BitsTransfer for hosts without modern TLS in <code>Invoke-WebRequest</code>.
                        </p>
                        <CommandBlock command={winOldTlsCmd} />
                      </>
                    )}
                    {winVariant === 'legacy' && (
                      <>
                        <p className="text-xs text-text-muted">
                          Server 2008 R2 cannot run the MSI. Installs the bare <code>.exe</code> as a service.
                        </p>
                        <CommandBlock command={winLegacyCmd} />
                      </>
                    )}
                    {winVariant === 'manual' && (
                      <div className="rounded-md border border-border bg-bg-secondary p-4">
                        <div className="flex items-start gap-3">
                          <Download size={20} className="text-accent shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-text-primary">Obliview Install Wizard</p>
                            <p className="text-xs text-text-muted mt-1">
                              Self-contained <code>.exe</code> bundling the MSI, pre-filled with this key and server URL.
                              Run on the target host — no PowerShell required.
                            </p>
                            <a
                              href={wizardUrl || '#'}
                              download={wizardUrl ? 'obliview-install-wizard.exe' : undefined}
                              className={
                                'inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ' +
                                (wizardUrl
                                  ? 'bg-accent text-bg-primary hover:bg-accent-hover'
                                  : 'bg-bg-tertiary text-text-muted cursor-not-allowed')
                              }
                              onClick={(e) => { if (!wizardUrl) e.preventDefault(); }}
                            >
                              <Download size={13} />
                              Download wizard
                            </a>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {osTab === 'linux' && (
                  <>
                    <p className="text-xs text-text-muted">
                      Requires <code>curl</code>, <code>systemd</code> and root.
                    </p>
                    <CommandBlock command={linuxCmd} />
                  </>
                )}

                {osTab === 'macos' && (
                  <>
                    <p className="text-xs text-text-muted">
                      Installs the launchd service. Works on Intel and Apple Silicon.
                    </p>
                    <CommandBlock command={macosCmd} />
                  </>
                )}

                {osTab === 'freebsd' && (
                  <>
                    <p className="text-xs text-text-muted">
                      Installs as an rc.d service. Requires root.
                    </p>
                    <CommandBlock command={freebsdCmd} />
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <div className="px-6 pb-6">
          <Button variant="secondary" onClick={closeAddAgentModal} className="w-full">Close</Button>
        </div>
      </div>
    </div>
  );
}
