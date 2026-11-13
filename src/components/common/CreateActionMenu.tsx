import React from 'react';
import {
  X,
  FileText,
  Image as ImageIcon,
  Video,
  Flame,
  Clock,
  Link2,
  Sparkles,
} from 'lucide-react';

export type CreateActionType = 'text' | 'photo' | 'video' | 'shorts' | 'story' | 'link';

interface CreateActionMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectOption: (option: CreateActionType) => void;
}

export const CreateActionMenu: React.FC<CreateActionMenuProps> = ({
  isOpen,
  onClose,
  onSelectOption,
}) => {
  if (!isOpen) return null;

  const items = [
    {
      id: 'text' as const,
      title: 'Create Text Post',
      desc: 'Share thoughts, updates, and news with the community',
      icon: FileText,
      color: 'from-blue-600 to-indigo-600',
      badge: 'MOTHERLAND Feed',
    },
    {
      id: 'photo' as const,
      title: 'Upload Photo',
      desc: 'Share high-resolution images or photo albums',
      icon: ImageIcon,
      color: 'from-emerald-600 to-teal-600',
      badge: 'Gallery',
    },
    {
      id: 'video' as const,
      title: 'Upload Long Video',
      desc: '16:9 widescreen videos, natok, documentaries & vlogs',
      icon: Video,
      color: 'from-purple-600 to-pink-600',
      badge: 'Videos Section',
    },
    {
      id: 'shorts' as const,
      title: 'Create Shorts Video',
      desc: 'Vertical 9:16 reels, clips & viral moments',
      icon: Flame,
      color: 'from-rose-600 to-amber-600',
      badge: 'Shorts Section',
    },
    {
      id: 'story' as const,
      title: 'Create 24-Hour Story',
      desc: 'Disappears automatically after exactly 24 hours',
      icon: Clock,
      color: 'from-amber-500 to-orange-600',
      badge: '24h Expiration',
    },
    {
      id: 'link' as const,
      title: 'Share Link / YouTube',
      desc: 'Embed YouTube or external verified video links',
      icon: Link2,
      color: 'from-red-600 to-rose-700',
      badge: 'External Media',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-[#0e1423] border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl text-slate-100 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-md">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-white">Create &amp; Publish</h3>
              <p className="text-[11px] text-slate-400">Select what you would like to share</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Options Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-4 overflow-y-auto flex-1 pr-1">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectOption(item.id);
                  onClose();
                }}
                className="group p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-emerald-500/30 text-left transition-all duration-200 flex items-start gap-3 active:scale-98"
              >
                <div
                  className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center text-white flex-shrink-0 shadow-md group-hover:scale-105 transition-transform`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="font-bold text-xs sm:text-sm text-white group-hover:text-emerald-300 transition-colors">
                      {item.title}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                    {item.desc}
                  </p>
                  <span className="inline-block mt-1.5 px-2 py-0.5 rounded-md bg-white/5 text-[9px] font-mono text-slate-400 border border-white/5">
                    {item.badge}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
