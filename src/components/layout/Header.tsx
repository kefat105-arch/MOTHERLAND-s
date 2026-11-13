import {
  Sparkles,
  MessageSquare,
  Search,
  Smartphone,
  Monitor,
  User,
  Server,
  ShieldCheck,
  Youtube,
  Video as VideoIcon,
  Facebook,
  Instagram,
  Flag,
  Plus,
  LogIn,
} from 'lucide-react';
import { MotherlandLogo } from './MotherlandLogo';
import { PulseIcon } from '../fire/MotherlandIcons';
import { YouTubeApiDiagnostic } from '../../services/youtubeService';
import { CurrentUserProfile } from '../../types/social';

export type ActiveGlobalView =
  | 'motherland_home'
  | 'all_videos'
  | 'youtube'
  | 'tiktok'
  | 'facebook'
  | 'instagram'
  | 'bangladesh_services';

interface HeaderProps {
  activeView: ActiveGlobalView;
  onSelectView: (view: ActiveGlobalView) => void;
  onOpenMessenger: () => void;
  onOpenProfile: () => void;
  onOpenServerManager: () => void;
  onOpenDiagnostics: () => void;
  onToggleSearch: () => void;
  searchOpen: boolean;
  isMobileDeviceView: boolean;
  onToggleDeviceView: () => void;
  ytDiagnostic: YouTubeApiDiagnostic;
  currentUser?: CurrentUserProfile | null;
  unreadNotificationCount?: number;
  onOpenCreateMenu?: () => void;
  onOpenNotifications?: () => void;
  onOpenAuth?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeView,
  onSelectView,
  onOpenMessenger,
  onOpenProfile,
  onOpenServerManager,
  onOpenDiagnostics,
  onToggleSearch,
  searchOpen,
  isMobileDeviceView,
  onToggleDeviceView,
  ytDiagnostic,
  currentUser,
  unreadNotificationCount = 0,
  onOpenCreateMenu,
  onOpenNotifications,
  onOpenAuth,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-white/10 px-2 sm:px-5 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-1.5 sm:gap-3">
        {/* Top-Left Section 3 Navigation: MOTHERLAND Logo, YouTube, TikTok, Facebook, Instagram, Bangladesh Services */}
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar py-0.5">
          {/* 1. MOTHERLAND Bangladesh-themed Logo */}
          <button
            onClick={() => onSelectView('motherland_home')}
            className={`flex items-center gap-2 p-1.5 sm:px-2.5 sm:py-1.5 rounded-2xl transition-all duration-200 select-none flex-shrink-0 ${
              activeView === 'motherland_home'
                ? 'bg-gradient-to-r from-emerald-600/30 to-teal-500/20 border border-emerald-500/50 shadow-md shadow-emerald-950/40'
                : 'hover:bg-white/5 border border-transparent'
            }`}
            title="Return to MOTHERLAND Home Feed"
          >
            <MotherlandLogo size={36} showText={true} />
          </button>

          {/* Divider */}
          <div className="h-6 w-px bg-white/10 hidden sm:block mx-0.5 flex-shrink-0" />

          {/* 2. YouTube Icon */}
          <button
            onClick={() => onSelectView('youtube')}
            className={`p-2 rounded-xl transition-all flex items-center gap-1 text-xs font-semibold flex-shrink-0 ${
              activeView === 'youtube'
                ? 'bg-red-600/30 text-red-300 border border-red-500/50 shadow-md shadow-red-950/40'
                : 'text-slate-400 hover:text-red-400 hover:bg-white/5'
            }`}
            title="Open YouTube Experience"
          >
            <Youtube className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-red-400" />
            <span className="hidden md:inline">YouTube</span>
          </button>

          {/* 3. Shorts Vertical Swipe Feed (Section 2 Requirement) */}
          <button
            onClick={() => onSelectView('tiktok')}
            className={`p-2 rounded-xl transition-all flex items-center gap-1.5 text-xs font-semibold flex-shrink-0 ${
              activeView === 'tiktok'
                ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/50 shadow-md shadow-cyan-950/40'
                : 'text-slate-400 hover:text-cyan-400 hover:bg-white/5'
            }`}
            title="Open MOTHERLAND Shorts — 9:16 Vertical Swipe Feed"
          >
            <VideoIcon className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-cyan-400" />
            <span className="hidden sm:inline font-bold">Shorts</span>
          </button>

          {/* 4. Facebook Icon */}
          <button
            onClick={() => onSelectView('facebook')}
            className={`p-2 rounded-xl transition-all flex items-center gap-1 text-xs font-semibold flex-shrink-0 ${
              activeView === 'facebook'
                ? 'bg-blue-600/30 text-blue-300 border border-blue-500/50 shadow-md shadow-blue-950/40'
                : 'text-slate-400 hover:text-blue-400 hover:bg-white/5'
            }`}
            title="Open Facebook Experience"
          >
            <Facebook className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-blue-400" />
            <span className="hidden md:inline">Facebook</span>
          </button>

          {/* 5. Instagram Icon */}
          <button
            onClick={() => onSelectView('instagram')}
            className={`p-2 rounded-xl transition-all flex items-center gap-1 text-xs font-semibold flex-shrink-0 ${
              activeView === 'instagram'
                ? 'bg-pink-600/30 text-pink-300 border border-pink-500/50 shadow-md shadow-pink-950/40'
                : 'text-slate-400 hover:text-pink-400 hover:bg-white/5'
            }`}
            title="Open Instagram Experience"
          >
            <Instagram className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-pink-400" />
            <span className="hidden md:inline">Instagram</span>
          </button>

          {/* BANGLADESH SERVICES Icon (Section 3 Requirement) */}
          <button
            onClick={() => onSelectView('bangladesh_services')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex-shrink-0 border ${
              activeView === 'bangladesh_services'
                ? 'bg-gradient-to-r from-[#006a4e] to-[#044c38] text-white border-emerald-400 shadow-lg shadow-emerald-950/50'
                : 'bg-[#101b16] hover:bg-[#162720] text-emerald-300 border-emerald-500/30'
            }`}
            title="Open BANGLADESH SERVICES — বাংলাদেশের ডিজিটাল সেবা"
          >
            <span className="w-3 h-3 rounded-full bg-[#f42a41] border border-white flex-shrink-0 shadow-xs" />
            <span className="font-extrabold tracking-wide">বাংলাদেশ</span>
            <span className="hidden lg:inline text-[10px] opacity-80 font-normal">সেবা</span>
          </button>
        </div>

        {/* Top-Right Controls: Universal Search, Plus (+) Action, Notifications, Messenger, Profile/Sign In, Server, Specs, Device frame */}
        <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
          {/* Universal Search Bar Trigger */}
          <button
            onClick={onToggleSearch}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs transition-all ${
              searchOpen
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5'
            }`}
            title="Open Universal Search (YouTube, Videos, Shorts, Posts, People)"
          >
            <Search className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline text-[11px] text-slate-400">Search...</span>
          </button>

          {/* Prominent PLUS (+) Button (Requirement 11) */}
          <button
            onClick={onOpenCreateMenu}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs shadow-md shadow-emerald-950/40 border border-emerald-400/40 active:scale-95 transition-all"
            title="Create (+) Post, Photo, Video, Shorts, Story, Link"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span className="hidden md:inline">Create</span>
          </button>

          {/* Unified Notification Center Pulse (MOTHERLAND Custom Icon) */}
          <button
            onClick={onOpenNotifications}
            className="relative p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5 transition-colors"
            title="Pulse Notifications & Alerts"
          >
            <PulseIcon className="w-4 h-4 text-amber-400" active={unreadNotificationCount > 0} />
            {unreadNotificationCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center animate-pulse border-2 border-[#05070c]">
                {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
              </span>
            )}
          </button>

          {/* Messenger Hub Launcher */}
          <button
            onClick={onOpenMessenger}
            className="relative p-2 sm:px-2.5 sm:py-2 rounded-xl bg-[#131b2e] hover:bg-[#1a253f] border border-blue-500/30 text-blue-400 transition-all flex items-center gap-1.5 active:scale-95"
            title="MOTHERLAND Messenger Hub"
          >
            <MessageSquare className="w-4 h-4" />
            <span className="hidden xl:inline text-xs font-semibold text-slate-200">
              Chat
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </button>

          {/* User Account / Profile / Sign In */}
          {currentUser ? (
            <button
              onClick={onOpenProfile}
              className="p-1 sm:px-2 sm:py-1 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 flex items-center gap-1.5 border border-white/5 transition-colors"
              title={`Logged in as ${currentUser.name}`}
            >
              <img
                src={currentUser.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'}
                alt={currentUser.name}
                className="w-5 h-5 rounded-full object-cover border border-emerald-400"
              />
              <span className="hidden lg:inline text-xs font-medium max-w-[80px] truncate">
                {currentUser.name.split(' ')[0]}
              </span>
            </button>
          ) : (
            <button
              onClick={onOpenAuth}
              className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition-all flex items-center gap-1"
              title="Sign in or Create Account"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Sign In</span>
            </button>
          )}

          {/* Multi-Server Registry Trigger */}
          <button
            onClick={onOpenServerManager}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-indigo-400 hover:text-indigo-300 border border-white/5 transition-colors hidden sm:flex"
            title="Multi-Server Manager & Backend Registry"
          >
            <Server className="w-4 h-4" />
          </button>

          {/* Master Verification Specs Report */}
          <button
            onClick={onOpenDiagnostics}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-emerald-400 border border-white/5 transition-colors hidden md:flex"
            title="Master Implementation Verification Matrix"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </button>

          {/* Device Frame Toggle */}
          <button
            onClick={onToggleDeviceView}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 border border-white/5 transition-colors hidden xl:flex"
            title={isMobileDeviceView ? 'Switch to Full Screen' : 'Preview in Android Phone Frame'}
          >
            {isMobileDeviceView ? <Monitor className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
};
