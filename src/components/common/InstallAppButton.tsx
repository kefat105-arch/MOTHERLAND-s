import React from 'react';
import { Download, CheckCircle2, Smartphone, X, ExternalLink, Share, PlusSquare } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface InstallAppButtonProps {
  className?: string;
  variant?: 'compact' | 'badge';
}

export const InstallAppButton: React.FC<InstallAppButtonProps> = ({
  className = '',
  variant = 'compact',
}) => {
  const {
    isInstalled,
    isIOS,
    isAndroid,
    showGuideModal,
    setShowGuideModal,
    triggerInstall,
  } = usePWAInstall();

  // If already installed in standalone mode, display a quiet, verified badge
  if (isInstalled) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[11px] font-semibold text-emerald-400 select-none ${className}`}
        title="MOTHERLAND is running as an installed app"
      >
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Installed</span>
      </span>
    );
  }

  return (
    <>
      {/* Small Top-Right Install Button (Section 1 requirement) */}
      <button
        onClick={triggerInstall}
        className={`relative inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-950/40 border border-emerald-400/40 transition-all transform active:scale-95 group ${className}`}
        title="Install MOTHERLAND App on your Android device (Optional)"
      >
        <Download className="w-3.5 h-3.5 text-emerald-100 group-hover:translate-y-0.5 transition-transform" />
        <span>Install</span>
      </button>

      {/* Non-intrusive Android / iOS Installation Guide Modal */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm bg-[#0e1423] border border-white/10 rounded-3xl p-5 shadow-2xl text-slate-100">
            {/* Close Button */}
            <button
              onClick={() => setShowGuideModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#006a4e] to-[#044c38] border border-emerald-400/40 flex items-center justify-center shadow-lg">
                <Smartphone className="w-6 h-6 text-emerald-300" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm sm:text-base text-white">
                  Install MOTHERLAND
                </h4>
                <p className="text-[11px] text-slate-400">
                  {isAndroid ? 'Android Web App' : isIOS ? 'Apple iOS Web App' : 'Desktop / Browser App'}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              আপনি ইনস্টল না করেও ওয়েবসাইট থেকে পুরো MOTHERLAND অনায়াসে ব্যবহার করতে পারেন। ফোনে অ্যাপ হিসেবে পেতে নিচের সহজ ধাপ অনুসরণ করুন:
            </p>

            {/* Platform Instructions */}
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2.5 text-xs">
              {isAndroid ? (
                <>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                      1
                    </span>
                    <span>Chrome ব্রাউজারের উপরে ডান কোণায় তিনটি ডট (⋮) মেনুতে চাপুন।</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                      2
                    </span>
                    <span className="font-medium text-emerald-300">
                      &quot;Install app&quot; বা &quot;Add to Home screen&quot; অপশনে ট্যাপ করুন।
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                      3
                    </span>
                    <span>MOTHERLAND আপনার ফোনে একটি নেটিভ অ্যাপের মতো ইনস্টল হয়ে যাবে!</span>
                  </div>
                </>
              ) : isIOS ? (
                <>
                  <div className="flex items-start gap-2.5">
                    <Share className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                    <span>Safari ব্রাউজারের নিচে <strong>Share (শেয়ার)</strong> আইকনে চাপুন।</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <PlusSquare className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span>তালিকা থেকে <strong>&quot;Add to Home Screen&quot;</strong> সিলেক্ট করুন।</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span>উপরে &quot;Add&quot; চাপলেই হোমস্ক্রিনে অ্যাপ যোগ হবে।</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-2.5">
                    <Download className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span>ব্রাউজারের অ্যাড্রেস বারের ডান পাশে থাকা Install আইকনে ক্লিক করুন।</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <ExternalLink className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                    <span>বা Chrome মেনু (⋮) &gt; &quot;Install MOTHERLAND...&quot; চাপুন।</span>
                  </div>
                </>
              )}
            </div>

            {/* Note & Dismiss */}
            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
              <span className="text-[10px] text-slate-400">
                কোনো বাধ্যবাধকতা নেই • ওয়েবে সম্পূর্ণ মুক্ত
              </span>
              <button
                onClick={() => setShowGuideModal(false)}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition-colors"
              >
                ঠিক আছে
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
