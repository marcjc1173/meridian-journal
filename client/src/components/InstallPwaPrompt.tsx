import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'midline-pwa-dismissed';

function isStandaloneMode(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosSafari(): boolean {
  const ua = window.navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  const isWebkit = /WebKit/.test(ua);
  const isOtherBrowser = /CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
  return isIos && isWebkit && !isOtherBrowser;
}

export function InstallPwaPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosTip, setShowIosTip] = useState(false);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1');

  useEffect(() => {
    if (isStandaloneMode() || dismissed) return;

    if (isIosSafari()) {
      setShowIosTip(true);
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setShowIosTip(false);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, [dismissed]);

  if (dismissed || (!deferredPrompt && !showIosTip)) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="fixed bottom-20 md:bottom-5 right-4 left-4 md:left-auto z-40 mx-auto max-w-sm">
      <div
        className="flex items-center gap-3 rounded-xl border p-3.5 shadow-xl"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderColor: 'var(--accent)',
        }}
      >
        <img src="/icon.svg" alt="Midline" className="h-10 w-10 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">Install Midline</div>
          {deferredPrompt ? (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Add to your home screen for quick daily check-ins.
            </p>
          ) : (
            <p className="text-xs leading-snug" style={{ color: 'var(--text-muted)' }}>
              Tap <Share className="inline h-3.5 w-3.5 -mt-0.5" /> Share, then{' '}
              <strong>Add to Home Screen</strong>.
            </p>
          )}
        </div>

        {deferredPrompt && (
          <button
            type="button"
            onClick={handleInstall}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-stone-950 transition hover:opacity-90"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            <Download className="h-3.5 w-3.5" />
            Install
          </button>
        )}

        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 rounded-lg p-1 opacity-60 hover:opacity-100"
          aria-label="Dismiss install prompt"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
