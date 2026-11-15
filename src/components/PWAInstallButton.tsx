import React, { useState } from 'react';
import { Download, Smartphone, X, CheckCircle2, Share2, MoreVertical } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useBackHandler } from '../hooks/useBackNavigation';
import { MotherlandLogo } from './layout/MotherlandLogo';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'header' | 'button' | 'menu';
  showAlways?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'button',
  showAlways = false,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  useBackHandler('pwa-install-guide', showGuide, () => setShowGuide(false), 70);

  const handleTriggerInstall = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (!accepted) {
        setShowGuide(true);
      }
      return;
    }
    setShowGuide(true);
  };

  if (isInstalled) {
    if (!showAlways) return null;
    return (
      <span
        data-testid="pwa-installed-badge"
        className={`inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-500 text-xs font-bold ${className}`}
      >
        <CheckCircle2 className="w-4 h-4" />
        <span>Installed</span>
      </span>
    );
  }

  if (!showAlways && !isInstallable && !isIOS) {
    return null;
  }

  const renderTriggerButton = () => {
    if (variant === 'header') {
      return (
        <button
          type="button"
          onClick={handleTriggerInstall}
          data-testid="header-install-btn"
          className={`flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 rounded-xl bg-[var(--accent-primary-soft)] border border-[var(--accent-primary-border)] text-[var(--accent-primary)] hover:opacity-90 transition-all text-xs font-semibold shadow-sm ${className}`}
          title="Install MOTHERLAND App"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Install App</span>
        </button>
      );
    }

    if (variant === 'menu') {
      return (
        <button
          type="button"
          onClick={handleTriggerInstall}
          data-testid="menu-install-app-btn"
          className={`flex items-center justify-center gap-1.5 min-h-[42px] px-3.5 py-2 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-primary-contrast)] font-bold text-xs shadow-sm active:scale-95 transition-all whitespace-nowrap ${className}`}
        >
          <Download className="w-4 h-4 shrink-0" />
          <span>Install App</span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={handleTriggerInstall}
        data-testid="install-app-btn"
        className={`flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-primary-contrast)] font-bold text-xs shadow-md active:scale-95 transition-all ${className}`}
      >
        <Smartphone className="w-4 h-4" />
        <span>Install App</span>
      </button>
    );
  };

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isFirefox = /Firefox/i.test(ua);
  const isSamsung = /SamsungBrowser/i.test(ua);

  return (
    <>
      {renderTriggerButton()}

      {showGuide && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowGuide(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in"
          data-testid="pwa-install-guide-modal"
        >
          <div className="w-full max-w-sm rounded-2xl bg-[var(--bg-surface-solid)] border border-[var(--border-subtle)] p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              aria-label="Close install instructions"
              className="absolute top-3 right-3 w-10 h-10 flex items-center justify-center rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)]"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="mb-4 flex items-center gap-3">
              <MotherlandLogo size={44} showText={false} />
              <div>
                <h3 className="text-base font-extrabold text-[var(--text-primary)]">
                  Install MOTHERLAND
                </h3>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  Home-screen app shortcut (PWA)
                </p>
              </div>
            </div>

            {isIOS ? (
              <div className="space-y-2.5 text-xs text-[var(--text-secondary)] leading-relaxed">
                <p className="flex items-start gap-2">
                  <Share2 className="w-4 h-4 text-[var(--accent-primary)] shrink-0 mt-0.5" />
                  <span>
                    1. Tap the <strong>Share</strong> button at the bottom of Safari.
                  </span>
                </p>
                <p>
                  2. Scroll down and tap <strong>Add to Home Screen</strong>.
                </p>
                <p>
                  3. Tap <strong>Add</strong> in the top-right corner to install the MOTHERLAND icon.
                </p>
              </div>
            ) : isFirefox ? (
              <div className="space-y-2 text-xs text-[var(--text-secondary)] leading-relaxed">
                <p className="flex items-start gap-2">
                  <MoreVertical className="w-4 h-4 text-[var(--accent-primary)] shrink-0 mt-0.5" />
                  <span>
                    1. Open the browser menu (three dots) in Firefox.
                  </span>
                </p>
                <p>
                  2. Select <strong>Install</strong> or <strong>Add to Home screen</strong>.
                </p>
              </div>
            ) : (
              <div className="space-y-2 text-xs text-[var(--text-secondary)] leading-relaxed">
                <p className="flex items-start gap-2">
                  <MoreVertical className="w-4 h-4 text-[var(--accent-primary)] shrink-0 mt-0.5" />
                  <span>
                    1. Open your browser menu (<strong>⋮</strong> in {isSamsung ? 'Samsung Internet' : 'Chrome / Edge'}).
                  </span>
                </p>
                <p>
                  2. Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                </p>
                <p className="text-[11px] text-[var(--text-muted)] pt-1">
                  Note: Your browser did not expose an automatic one-tap install prompt in this tab (for example if opened in an embedded frame or private window). Installing through the browser menu adds the MOTHERLAND app icon to your device.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-5 w-full min-h-[44px] rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] py-2.5 text-xs font-bold text-[var(--accent-primary-contrast)] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
};
