import React from 'react';
import {
  Sparkles,
  Film,
  MessageSquare,
  User,
  Flag,
  Flame,
} from 'lucide-react';
import { MotherlandLogo } from './MotherlandLogo';
import { ActiveGlobalView } from './Header';

interface BottomNavProps {
  activeView: ActiveGlobalView;
  onSelectView: (view: ActiveGlobalView) => void;
  onOpenMessenger: () => void;
  onOpenProfile: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeView,
  onSelectView,
  onOpenMessenger,
  onOpenProfile,
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#090d16]/95 backdrop-blur-xl border-t border-white/10 px-1 py-1 sm:hidden">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {/* Motherland Social Home */}
        <button
          onClick={() => onSelectView('motherland_home')}
          className={`flex flex-col items-center justify-center p-1 transition-colors ${
            activeView === 'motherland_home' ? 'text-emerald-400 font-bold' : 'text-slate-400'
          }`}
          title="MOTHERLAND Social Feed"
        >
          <Sparkles className="w-4.5 h-4.5" />
          <span className="text-[9px] mt-0.5">Home</span>
        </button>

        {/* 2. Dedicated Shorts Section (Section 2 Requirement) */}
        <button
          onClick={() => onSelectView('tiktok')}
          className={`flex flex-col items-center justify-center p-1 transition-colors ${
            activeView === 'tiktok' ? 'text-cyan-400 font-bold' : 'text-slate-400'
          }`}
          title="MOTHERLAND Fullscreen Shorts"
        >
          <Flame className="w-4.5 h-4.5" />
          <span className="text-[9px] mt-0.5">Shorts</span>
        </button>

        {/* 3. Dedicated Long Videos Section (Section 3 Requirement) */}
        <button
          onClick={() => onSelectView('all_videos')}
          className={`flex flex-col items-center justify-center p-1 transition-colors ${
            activeView === 'all_videos' ? 'text-emerald-400 font-bold' : 'text-slate-400'
          }`}
          title="MOTHERLAND Long Videos"
        >
          <Film className="w-4.5 h-4.5" />
          <span className="text-[9px] mt-0.5">Videos</span>
        </button>

        {/* Center Bangladesh Services Button */}
        <button
          onClick={() => onSelectView('bangladesh_services')}
          className={`flex flex-col items-center justify-center -mt-3.5 p-1.5 rounded-2xl shadow-lg transition-transform active:scale-95 ${
            activeView === 'bangladesh_services'
              ? 'bg-gradient-to-tr from-[#006a4e] to-[#044c38] text-white border-2 border-emerald-400 shadow-emerald-950/60'
              : 'bg-gradient-to-tr from-[#006a4e] to-[#052b20] text-emerald-200 border border-emerald-500/40 shadow-emerald-950/40'
          }`}
        >
          <MotherlandLogo size={28} showText={false} />
          <span className="text-[9px] font-extrabold text-white mt-0.5">বাংলাদেশ</span>
        </button>

        {/* Messenger Hub */}
        <button
          onClick={onOpenMessenger}
          className="relative flex flex-col items-center justify-center p-1.5 text-blue-400"
        >
          <MessageSquare className="w-5 h-5" />
          <span className="text-[10px] font-semibold mt-0.5">Chat</span>
          <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </button>

        {/* User Profile */}
        <button
          onClick={onOpenProfile}
          className="flex flex-col items-center justify-center p-1.5 text-slate-400 hover:text-slate-200"
        >
          <User className="w-5 h-5" />
          <span className="text-[10px] font-semibold mt-0.5">Profile</span>
        </button>
      </div>
    </nav>
  );
};
