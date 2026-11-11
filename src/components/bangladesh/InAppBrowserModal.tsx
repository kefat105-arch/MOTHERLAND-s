import React, { useState } from 'react';
import {
  X,
  Lock,
  ExternalLink,
  ShieldAlert,
  ArrowLeft,
  RotateCcw,
  AlertCircle,
  Building,
} from 'lucide-react';
import { BangladeshServiceEntry } from '../../types/bangladeshServices';

interface InAppBrowserModalProps {
  service: BangladeshServiceEntry | null;
  onClose: () => void;
}

export const InAppBrowserModal: React.FC<InAppBrowserModalProps> = ({
  service,
  onClose,
}) => {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  if (!service) return null;

  const handleRefresh = () => {
    setIframeLoaded(false);
    setIframeError(false);
    setRefreshKey((k) => k + 1);
  };

  const handleOpenExternal = () => {
    window.open(service.officialUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-5xl h-[92vh] bg-[#090d16] border border-white/10 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Browser Top Navigation Bar */}
        <div className="p-3 bg-[#0d1424] border-b border-white/10 flex items-center justify-between gap-2">
          {/* Controls & Domain Badge */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all flex items-center gap-1 text-xs"
              title="Return to MOTHERLAND"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back</span>
            </button>

            <button
              onClick={handleRefresh}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
              title="Reload Page"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Address Bar Container */}
            <div className="flex-1 min-w-0 max-w-xl flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#070b13] border border-emerald-500/30 text-xs text-slate-300">
              <Lock className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span className="font-mono text-emerald-400 text-[11px] truncate">
                https://{service.officialDomain}
              </span>
              <span className="text-slate-600 hidden md:inline">|</span>
              <span className="text-slate-400 truncate text-[11px] hidden md:inline">
                {service.authority}
              </span>
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleOpenExternal}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md transition-all active:scale-95"
              title="Open directly on official website"
            >
              <span className="hidden sm:inline">Official Site</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Legal & Age Safeguard Banner */}
        <div className="px-4 py-2 bg-[#121a2d] border-b border-white/5 flex items-center justify-between text-[11px] text-slate-300 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Building className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <span className="font-semibold text-white">{service.name}</span>
            <span className="text-slate-500 font-mono">({service.bengaliName})</span>
          </div>

          <div className="flex items-center gap-2 text-slate-400 text-[10px]">
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
              VERIFIED OFFICIAL DOMAIN
            </span>
            <span>Fee: {service.feeDetails}</span>
          </div>
        </div>

        {/* Under-18 Restriction Notice if applicable */}
        {service.ageRestricted && (
          <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2 text-xs text-amber-300">
            <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>
              <strong>Age-Appropriate Safeguard (Section 17):</strong> Financial borrowing / loan applications are strictly restricted to eligible adults 18+. Unlicensed lending is illegal under Bangladesh law.
            </span>
          </div>
        )}

        {/* Browser Content Area / Iframe Viewport */}
        <div className="relative flex-1 w-full bg-white overflow-hidden">
          {!iframeLoaded && !iframeError && (
            <div className="absolute inset-0 bg-[#090d16] flex flex-col items-center justify-center text-slate-300 z-10 space-y-3">
              <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-mono text-slate-400">
                Securely connecting to official portal: {service.officialDomain}...
              </p>
            </div>
          )}

          {/* Iframe */}
          <iframe
            key={refreshKey}
            src={service.officialUrl}
            title={service.name}
            className="w-full h-full border-0 bg-white"
            onLoad={() => setIframeLoaded(true)}
            onError={() => setIframeError(true)}
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
          />

          {/* Fallback Overlay if portal blocks iframe embedding (CSP/X-Frame-Options) */}
          <div className="absolute bottom-4 left-4 right-4 z-20 p-3 rounded-2xl bg-[#0c1220]/95 backdrop-blur-md border border-white/10 shadow-2xl flex items-center justify-between text-xs text-slate-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span className="text-[11px] sm:text-xs">
                If the portal displays a blank screen or connection refusal due to government security policies, click to open directly in your browser.
              </span>
            </div>
            <button
              onClick={handleOpenExternal}
              className="ml-2 flex-shrink-0 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-all"
            >
              <span>Launch External</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Footer Mandatory Legal Disclaimer (Section 16) */}
        <div className="px-4 py-2 bg-[#090d16] border-t border-white/5 text-[11px] text-slate-500 flex items-center justify-between">
          <span>
            MOTHERLAND is an independent platform. Services are provided by {service.authority}. MOTHERLAND does not represent or impersonate those organizations.
          </span>
          <span className="font-mono text-[10px] text-slate-600 hidden sm:inline">
            Verified: {service.lastVerified}
          </span>
        </div>
      </div>
    </div>
  );
};
