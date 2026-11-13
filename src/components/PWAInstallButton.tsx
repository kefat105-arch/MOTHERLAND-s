import React, { useState } from 'react';
import { Download, Smartphone, X, Shield } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useBackHandler } from '../hooks/useBackNavigation';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'header' | 'button' | 'banner';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'button',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useBackHandler('pwa-ios-guide', showIOSGuide, () => setShowIOSGuide(false), 70);

  // If already installed, hide
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    if (variant === 'header') {
      return (
        <button
          onClick={install}
          className={`flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 rounded-full bg-[var(--accent-primary-soft)] border border-[var(--accent-primary-border)] text-[var(--accent-primary)] hover:opacity-90 transition-all text-xs font-semibold shadow-sm ${className}`}
          title="Install MOTHERLAND as App"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Install App</span>
        </button>
      );
    }

    return (
      <button
        onClick={install}
        className={`flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-primary-contrast)] font-bold text-xs shadow-md active:scale-95 transition-all ${className}`}
      >
        <Smartphone className="w-4 h-4" />
        <span>Install MOTHERLAND (Android/PWA)</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 rounded-full bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all text-xs font-semibold ${className}`}
        >
          <Download className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          <span>Install PWA</span>
        </button>

        {showIOSGuide && (
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowIOSGuide(false);
            }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in"
          >
            <div className="w-full max-w-sm rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-6 shadow-2xl relative">
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                aria-label="Close guide"
                className="absolute top-3 right-3 w-10 h-10 flex items-center justify-center rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)]"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="w-12 h-12 rounded-xl bg-[var(--accent-primary-soft)] border border-[var(--accent-primary-border)] flex items-center justify-center text-[var(--accent-primary)] mb-4">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">Install MOTHERLAND on iOS</h3>
              <p className="mt-2 text-xs text-[var(--text-secondary)] leading-relaxed space-y-2">
                <span>1. Tap the <strong>Share</strong> button (box with upward arrow) at the bottom of Safari.</span>
                <br />
                <span>2. Scroll down and tap <strong>Add to Home Screen</strong>.</span>
                <br />
                <span>3. Tap <strong>Add</strong> in the top right to complete installation.</span>
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full min-h-[44px] rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] py-2.5 text-xs font-bold text-[var(--accent-primary-contrast)] transition-colors"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
