import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  Trash2,
  CheckCheck,
  Sparkles,
  Youtube,
  Facebook,
  Instagram,
  UserPlus,
  Heart,
  MessageCircle,
  Share2,
  Loader2,
} from 'lucide-react';
import { MotherlandNotification } from '../../types/social';
import { PulseIcon } from '../fire/MotherlandIcons';
import { FireRichText } from '../fire/FireRichText';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  getStoredCurrentUser,
} from '../../services/socialService';

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSignIn?: () => void;
}

export type NotificationCategory = 'all' | 'motherland' | 'youtube' | 'google' | 'facebook' | 'instagram';

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  isOpen,
  onClose,
  onOpenSignIn,
}) => {
  const currentUser = getStoredCurrentUser();
  const [activeCategory, setActiveCategory] = useState<NotificationCategory>('all');
  const [notifications, setNotifications] = useState<MotherlandNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const loadNotifications = async (cat: NotificationCategory) => {
    setIsLoading(true);
    const data = await fetchNotifications(cat);
    setNotifications(data.notifications || []);
    setUnreadCount(data.unreadCount || 0);
    setIsLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadNotifications(activeCategory);
    }
  }, [isOpen, activeCategory]);

  const handleMarkAsRead = async (id: string) => {
    await markNotificationRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const handleDelete = async (id: string) => {
    await deleteNotification(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const getNotificationIcon = (type: MotherlandNotification['type'], category: string) => {
    if (category === 'youtube') return <Youtube className="w-4 h-4 text-red-400" />;
    if (category === 'facebook') return <Facebook className="w-4 h-4 text-blue-400" />;
    if (category === 'instagram') return <Instagram className="w-4 h-4 text-pink-400" />;

    switch (type) {
      case 'friend_request':
      case 'friend_accept':
      case 'follow':
        return <UserPlus className="w-4 h-4 text-emerald-400" />;
      case 'like':
      case 'reaction':
        return <Heart className="w-4 h-4 text-rose-400" />;
      case 'comment':
      case 'reply':
        return <MessageCircle className="w-4 h-4 text-cyan-400" />;
      case 'share':
        return <Share2 className="w-4 h-4 text-blue-400" />;
      default:
        return <Sparkles className="w-4 h-4 text-amber-400" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-[#0e1423] border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl text-slate-100 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center shadow-lg">
              <PulseIcon className="w-5 h-5 text-white" active={unreadCount > 0} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-white">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Unified alerts across MOTHERLAND &amp; connected networks
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-emerald-400 hover:text-emerald-300 text-xs font-semibold flex items-center gap-1 transition-colors"
                title="Mark all as read"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Mark all read</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Categories Tab Bar (Section 10 Requirement) */}
        <div className="flex items-center gap-1.5 py-3 overflow-x-auto no-scrollbar border-b border-white/5">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'motherland', label: 'MOTHERLAND' },
              { id: 'youtube', label: 'YouTube' },
              { id: 'google', label: 'Google' },
              { id: 'facebook', label: 'Facebook' },
              { id: 'instagram', label: 'Instagram' },
            ] as const
          ).map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeCategory === cat.id
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Notifications List */}
        <div className="overflow-y-auto flex-1 mt-3 space-y-2 pr-1">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-2">
              <Loader2 className="w-7 h-7 text-emerald-400 animate-spin" />
              <span className="text-xs text-slate-400">Loading notifications...</span>
            </div>
          ) : !currentUser ? (
            <div className="py-16 text-center space-y-3">
              <PulseIcon className="w-10 h-10 text-slate-500 mx-auto opacity-50" />
              <p className="text-xs text-slate-300">
                Sign in to view your personalized MOTHERLAND notifications.
              </p>
              {onOpenSignIn && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenSignIn();
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md"
                >
                  Sign In
                </button>
              )}
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <PulseIcon className="w-10 h-10 text-slate-600 mx-auto opacity-40" />
              <p className="text-xs text-slate-300 font-semibold">
                No notifications in {activeCategory.toUpperCase()}
              </p>
              <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                {activeCategory === 'youtube'
                  ? 'Connect your Google account in YouTube Settings to receive authentic channel subscriber and video alerts.'
                  : activeCategory === 'facebook' || activeCategory === 'instagram'
                  ? 'External account notifications require official platform authorization in Settings.'
                  : 'You are all caught up! New reactions, comments, and friend requests will appear here.'}
              </p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-3 rounded-2xl border transition-all flex items-start justify-between gap-3 ${
                  notif.read
                    ? 'bg-white/5 border-white/5 opacity-80'
                    : 'bg-[#141d30] border-emerald-500/30 shadow-md'
                }`}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="relative w-10 h-10 rounded-full bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center overflow-hidden flex-shrink-0 text-white font-bold text-xs">
                    {notif.actor?.avatar ? (
                      <img
                        src={notif.actor.avatar}
                        alt={notif.actor.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{notif.actor?.name?.slice(0, 1) || 'M'}</span>
                    )}
                    <span className="absolute bottom-0 right-0 p-0.5 bg-black rounded-full">
                      {getNotificationIcon(notif.type, notif.category)}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs text-white">
                        {notif.title}
                      </span>
                      {!notif.read && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      )}
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                      <FireRichText text={notif.message} emojiSize="xs" />
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-500 font-mono">
                      <span>{new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span>•</span>
                      <span className="capitalize">{notif.category}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {!notif.read && (
                    <button
                      onClick={() => handleMarkAsRead(notif.id)}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-emerald-400"
                      title="Mark as read"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(notif.id)}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-500 hover:text-red-400"
                    title="Delete notification"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
