import {
  Sparkles,
  Film,
  MessageSquare,
  User,
  Flag,
  Flame,
  Plus,
} from 'lucide-react';
import { MotherlandLogo } from './MotherlandLogo';
import { ActiveGlobalView } from './Header';

interface BottomNavProps {
  activeView: ActiveGlobalView;
  onSelectView: (view: ActiveGlobalView) => void;
  onOpenMessenger: () => void;
  onOpenProfile: () => void;
  onOpenCreateMenu?: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeView,
  onSelectView,
  onOpenMessenger,
  onOpenProfile,
  onOpenCreateMenu,
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

        {/* Central Prominent PLUS (+) Button (Requirement 11) */}
        <button
          onClick={onOpenCreateMenu}
          className="flex flex-col items-center justify-center -mt-4 p-2 rounded-full bg-gradient-to-tr from-emerald-500 via-teal-400 to-[#f42a41] text-white shadow-xl shadow-emerald-950/80 border-2 border-white/20 active:scale-90 transition-transform"
          title="Create (+) Post, Photo, Video, Shorts, Story, Link"
        >
          <Plus className="w-5 h-5 stroke-[2.8]" />
        </button>

        {/* Bangladesh Services */}
        <button
          onClick={() => onSelectView('bangladesh_services')}
          className={`flex flex-col items-center justify-center p-1 transition-colors ${
            activeView === 'bangladesh_services' ? 'text-emerald-400 font-bold' : 'text-slate-400'
          }`}
          title="BANGLADESH SERVICES"
        >
          <span className="w-3.5 h-3.5 rounded-full bg-[#f42a41] border border-white flex-shrink-0 mb-0.5" />
          <span className="text-[9px] font-bold">বাংলাদেশ</span>
        </button>

        {/* Messenger Hub */}
        <button
          onClick={onOpenMessenger}
          className="relative flex flex-col items-center justify-center p-1 text-blue-400"
          title="Chat"
        >
          <MessageSquare className="w-4.5 h-4.5" />
          <span className="text-[9px] font-semibold mt-0.5">Chat</span>
          <span className="absolute top-1 right-2 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </button>

        {/* User Profile */}
        <button
          onClick={onOpenProfile}
          className="flex flex-col items-center justify-center p-1 text-slate-400 hover:text-slate-200"
          title="Profile"
        >
          <User className="w-4.5 h-4.5" />
          <span className="text-[9px] font-semibold mt-0.5">Profile</span>
        </button>
      </div>
    </nav>
  );
};
