import React, { useState } from 'react';
import {
  X,
  Compass,
  ArrowRight,
  ExternalLink,
  Shield,
  Layers,
  Info,
  Youtube,
} from 'lucide-react';
import { SOCIAL_PLATFORMS } from './platformData';
import { SocialAppsViewer } from './SocialAppsViewer';
import { useBackHandler } from '../../hooks/useBackNavigation';
import type { SocialPlatformId, SocialPlatformInfo } from './types';

interface SocialAppsHubProps {
  isOpen: boolean;
  onClose: () => void;
  initialPlatform?: SocialPlatformId | null;
}

export const SocialAppsHub: React.FC<SocialAppsHubProps> = ({
  isOpen,
  onClose,
  initialPlatform = null,
}) => {
  const [selectedPlatform, setSelectedPlatform] = useState<SocialPlatformInfo | null>(
    initialPlatform ? SOCIAL_PLATFORMS[initialPlatform] || null : null
  );

  useBackHandler('social-apps-hub', isOpen && !selectedPlatform, onClose, 60);

  if (!isOpen) return null;

  // In-app viewer with working in-app Back button returning to Marketplace inside MOTHERLAND
  if (selectedPlatform) {
    return (
      <SocialAppsViewer
        initialPlatform={selectedPlatform}
        onBack={() => setSelectedPlatform(null)}
        onCloseAll={() => {
          setSelectedPlatform(null);
          onClose();
        }}
      />
    );
  }

  const renderIcon = (id: SocialPlatformId) => {
    switch (id) {
      case 'youtube':
        return (
          <div className="w-12 h-12 rounded-2xl bg-red-600/15 text-red-500 border border-red-500/30 flex items-center justify-center group-hover:scale-105 transition-transform">
            <Youtube className="w-7 h-7 fill-current" />
          </div>
        );
      case 'facebook':
        return (
          <div className="w-12 h-12 rounded-2xl bg-blue-600/15 text-blue-500 border border-blue-500/30 flex items-center justify-center group-hover:scale-105 transition-transform">
            <span className="font-black text-2xl tracking-tighter">f</span>
          </div>
        );
      case 'tiktok':
        return (
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 flex items-center justify-center group-hover:scale-105 transition-transform">
            <span className="font-black text-xl tracking-tighter">TT</span>
          </div>
        );
      case 'instagram':
        return (
          <div className="w-12 h-12 rounded-2xl bg-pink-500/15 text-pink-500 border border-pink-500/30 flex items-center justify-center group-hover:scale-105 transition-transform">
            <span className="font-black text-xl tracking-tighter">IG</span>
          </div>
        );
      default:
        return <Layers className="w-7 h-7 text-[var(--accent-primary)]" />;
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
    >
      <div
        data-testid="marketplace-hub-modal"
        className="w-full max-w-4xl ml-glass-elevated rounded-t-3xl sm:rounded-3xl max-h-[92vh] sm:max-h-[88vh] flex flex-col shadow-2xl overflow-hidden text-[var(--text-primary)] pb-[env(safe-area-inset-bottom)]"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-glass-strong)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--accent-primary-soft)] border border-[var(--accent-primary-border)] flex items-center justify-center text-[var(--accent-primary)]">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-base text-[var(--text-primary)] tracking-wide">
                  Marketplace · Social Apps
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--accent-gold-soft)] text-[var(--accent-gold)] border border-[var(--accent-gold-border)] font-bold uppercase">
                  Official Embeds
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                Open YouTube, Facebook, TikTok &amp; Instagram official tools inside MOTHERLAND
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 rounded-xl bg-[var(--bg-surface-alt)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            title="Close Marketplace"
            aria-label="Close Marketplace"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Neutral Ecosystem Architecture Notice */}
          <div className="p-3.5 rounded-2xl bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] flex items-start gap-3 text-xs text-[var(--text-secondary)]">
            <Info className="w-4 h-4 text-[var(--accent-primary)] flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-[var(--text-primary)]">
                Independent Ecosystem Notice
              </p>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                MOTHERLAND is an independent platform and is not affiliated with Google (YouTube), Meta (Facebook/Instagram), or ByteDance (TikTok). Each app runs using official embed standards and never collects third-party passwords.
              </p>
            </div>
          </div>

          {/* 4 Social Platforms Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.values(SOCIAL_PLATFORMS).map((p) => (
              <div
                key={p.id}
                onClick={() => setSelectedPlatform(p)}
                data-testid={`marketplace-card-${p.id}`}
                className="p-4 rounded-2xl border border-[var(--border-subtle)] hover:border-[var(--accent-primary-border)] bg-[var(--bg-surface)] transition-all cursor-pointer group flex flex-col justify-between relative overflow-hidden shadow-sm"
              >
                <div
                  className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-10 pointer-events-none"
                  style={{ backgroundColor: p.brandColor }}
                />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    {renderIcon(p.id)}
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--bg-surface-alt)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                      {p.badgeText}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-extrabold text-base text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors">
                      {p.name}
                    </h4>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">{p.tagline}</p>
                    <p className="text-[11px] text-[var(--text-muted)] mt-2 line-clamp-2 leading-relaxed">
                      {p.description}
                    </p>
                  </div>
                </div>

                <div className="pt-4 mt-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs">
                  <span className="text-[var(--accent-primary)] font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    <span>Open In MOTHERLAND</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>

                  <a
                    href={p.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1 text-[11px] py-1"
                    title={`Open ${p.name} in external browser`}
                  >
                    <span>External</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* Transparent Platform Security Policy */}
          <div className="p-4 rounded-2xl bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] space-y-2.5 text-xs">
            <h5 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Shield className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>PWA &amp; Platform Embed Transparency</span>
            </h5>
            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
              YouTube supports full in-app search, playback, and live comment reading via official APIs. Facebook, TikTok, and Instagram allow individual public video/post embeds when pasted into the URL bar, while restricting full home-feed framing (`X-Frame-Options`) for user account security.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
