import React from 'react';
import { Sparkles, Youtube, Video, Instagram, Facebook } from 'lucide-react';
import { PlatformType } from '../../types/video';

interface PlatformNavProps {
  activePlatform: PlatformType | 'all';
  onSelectPlatform: (platform: PlatformType | 'all') => void;
  counts: Record<PlatformType | 'all', number>;
}

interface NavItem {
  id: PlatformType | 'all';
  name: string;
  tag: string;
  icon: React.ReactNode;
  activeBg: string;
  glowClass: string;
  accentBorder: string;
  textColor: string;
  badgeBg: string;
}

export const PlatformNav: React.FC<PlatformNavProps> = ({
  activePlatform,
  onSelectPlatform,
  counts,
}) => {
  const items: NavItem[] = [
    {
      id: 'all',
      name: 'ALL VIDEOS',
      tag: 'Universal',
      icon: <Sparkles className="w-4 h-4" />,
      activeBg: 'from-emerald-500/25 to-teal-500/15 text-emerald-300',
      glowClass: 'shadow-lg shadow-emerald-500/20 border-emerald-500/50',
      accentBorder: 'border-emerald-500/50',
      textColor: 'text-emerald-400',
      badgeBg: 'bg-emerald-500/20 text-emerald-300',
    },
    {
      id: 'youtube',
      name: 'YouTube',
      tag: 'Data v3',
      icon: <Youtube className="w-4 h-4" />,
      activeBg: 'from-red-600/30 to-rose-600/15 text-red-300',
      glowClass: 'shadow-lg shadow-red-500/20 border-red-500/50',
      accentBorder: 'border-red-500/50',
      textColor: 'text-red-400',
      badgeBg: 'bg-red-500/20 text-red-300',
    },
    {
      id: 'tiktok',
      name: 'TikTok',
      tag: 'Player v1',
      icon: <Video className="w-4 h-4" />,
      activeBg: 'from-cyan-500/30 to-blue-500/15 text-cyan-300',
      glowClass: 'shadow-lg shadow-cyan-500/20 border-cyan-500/50',
      accentBorder: 'border-cyan-500/50',
      textColor: 'text-cyan-400',
      badgeBg: 'bg-cyan-500/20 text-cyan-300',
    },
    {
      id: 'instagram',
      name: 'Instagram',
      tag: 'Reels',
      icon: <Instagram className="w-4 h-4" />,
      activeBg: 'from-pink-600/30 to-purple-600/15 text-pink-300',
      glowClass: 'shadow-lg shadow-pink-500/20 border-pink-500/50',
      accentBorder: 'border-pink-500/50',
      textColor: 'text-pink-400',
      badgeBg: 'bg-pink-500/20 text-pink-300',
    },
    {
      id: 'facebook',
      name: 'Facebook',
      tag: 'Watch',
      icon: <Facebook className="w-4 h-4" />,
      activeBg: 'from-blue-600/30 to-sky-600/15 text-blue-300',
      glowClass: 'shadow-lg shadow-blue-500/20 border-blue-500/50',
      accentBorder: 'border-blue-500/50',
      textColor: 'text-blue-400',
      badgeBg: 'bg-blue-500/20 text-blue-300',
    },
  ];

  return (
    <div className="w-full py-2.5 px-3 sm:px-4 bg-[#0a0e17]/80 backdrop-blur-md border-b border-white/5 sticky top-[57px] z-30">
      <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth py-1">
        {items.map((item) => {
          const isActive = activePlatform === item.id;
          const count = counts[item.id] || 0;

          return (
            <button
              key={item.id}
              onClick={() => onSelectPlatform(item.id)}
              className={`flex-shrink-0 flex items-center gap-2.5 px-3.5 py-2 rounded-2xl font-medium text-xs sm:text-sm transition-all duration-200 border select-none ${
                isActive
                  ? `bg-gradient-to-r ${item.activeBg} ${item.glowClass} font-semibold`
                  : 'bg-[#111726]/70 hover:bg-[#182035] text-slate-300 border-white/5 hover:border-white/10'
              }`}
            >
              <span className={`p-1 rounded-lg ${isActive ? item.textColor : 'text-slate-400'}`}>
                {item.icon}
              </span>

              <div className="flex flex-col text-left leading-none">
                <span className={isActive ? 'text-white' : 'text-slate-200'}>
                  {item.name}
                </span>
                <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                  {item.tag}
                </span>
              </div>

              <span
                className={`ml-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full ${
                  isActive ? item.badgeBg : 'bg-slate-800 text-slate-400'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
