import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Bell,
  Heart,
  MessageCircle,
  UserPlus,
  Shield,
  Youtube,
  Trash2,
  CheckCheck,
  PhoneMissed,
  Users,
} from 'lucide-react';
import type { NotificationItem } from '../types';
import { api } from '../api';
import { useBackHandler } from '../hooks/useBackNavigation';

interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onMarkAllRead: () => void;
  onRefreshNotifications?: () => void;
}

type NotificationCategory = 'all' | 'motherland' | 'wave' | 'youtube' | 'google' | 'social';

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAllRead,
  onRefreshNotifications,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<NotificationCategory>('all');
  const [dragY, setDragY] = useState(0);
  const dragStartYRef = useRef<number | null>(null);

  useBackHandler('notifications-drawer', isOpen, onClose, 65);

  useEffect(() => {
    if (isOpen) setDragY(0);
  }, [isOpen]);

  if (!isOpen) return null;

  const getIcon = (type: string, category?: string) => {
    if (category === 'youtube') {
      return <Youtube className="w-3.5 h-3.5 text-[#FF0000] fill-current" />;
    }
    switch (type) {
      case 'like':
        return <Heart className="w-3.5 h-3.5 text-[var(--danger)] fill-current" />;
      case 'comment':
      case 'wave_message':
      case 'message_request':
        return <MessageCircle className="w-3.5 h-3.5 text-[var(--accent-primary)]" />;
      case 'call_missed':
        return <PhoneMissed className="w-3.5 h-3.5 text-[var(--danger)]" />;
      case 'group_invite':
        return <Users className="w-3.5 h-3.5 text-[var(--accent-primary)]" />;
      case 'friend_request':
      case 'friend_accept':
      case 'follow':
        return <UserPlus className="w-3.5 h-3.5 text-[var(--accent-primary)]" />;
      default:
        return <Shield className="w-3.5 h-3.5 text-[var(--accent-gold)]" />;
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'social') {
      return n.category === 'facebook' || n.category === 'instagram';
    }
    return n.category === selectedCategory;
  });

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.deleteNotification(id);
      if (onRefreshNotifications) onRefreshNotifications();
    } catch (err) {
      console.error('Delete notification error:', err);
    }
  };

  const handleHeaderTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    dragStartYRef.current = e.touches[0].clientY;
  };

  const handleHeaderTouchMove = (e: React.TouchEvent) => {
    if (dragStartYRef.current === null || e.touches.length !== 1) return;
    const dy = e.touches[0].clientY - dragStartYRef.current;
    if (dy > 0) setDragY(dy);
  };

  const handleHeaderTouchEnd = () => {
    if (dragY > 85) {
      setDragY(0);
      dragStartYRef.current = null;
      onClose();
      return;
    }
    setDragY(0);
    dragStartYRef.current = null;
  };

  const categories: { key: NotificationCategory; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: notifications.length },
    { key: 'motherland', label: 'Motherland', count: notifications.filter((n) => n.category === 'motherland' || !n.category).length },
    { key: 'wave', label: 'Wave', count: notifications.filter((n) => n.category === 'wave').length },
    { key: 'youtube', label: 'YouTube', count: notifications.filter((n) => n.category === 'youtube').length },
    { key: 'google', label: 'Google', count: notifications.filter((n) => n.category === 'google').length },
    { key: 'social', label: 'Social', count: notifications.filter((n) => n.category === 'facebook' || n.category === 'instagram').length },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md ml-glass-elevated rounded-t-3xl sm:rounded-3xl h-[82dvh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200 transition-transform"
        style={{ transform: dragY > 0 ? `translateY(${dragY}px)` : undefined }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle + Header */}
        <div
          className="pt-2 px-4 pb-3 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] touch-none"
          onTouchStart={handleHeaderTouchStart}
          onTouchMove={handleHeaderTouchMove}
          onTouchEnd={handleHeaderTouchEnd}
        >
          <div className="w-10 h-1 rounded-full bg-[var(--border-strong)] mx-auto mb-2.5 sm:hidden" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] flex items-center justify-center">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-[var(--text-primary)]">Notifications Center</h3>
                <p className="text-[10px] text-[var(--text-secondary)]">Motherland, YouTube &amp; Unified Hub</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onMarkAllRead}
                className="min-h-[38px] px-2.5 py-1 rounded-lg bg-[var(--accent-primary-soft)] hover:bg-[var(--accent-primary)] text-[11px] text-[var(--accent-primary)] hover:text-[var(--accent-primary-contrast)] font-semibold flex items-center gap-1 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark read
              </button>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)] transition-colors"
                aria-label="Close notifications"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* 5 Categories Navigation */}
        <div className="flex items-center gap-1.5 p-2 bg-[var(--bg-surface-alt)] border-b border-[var(--border-subtle)] overflow-x-auto no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setSelectedCategory(cat.key)}
              className={`min-h-[36px] px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                selectedCategory === cat.key
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)] shadow-sm font-bold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
              }`}
            >
              <span>{cat.label}</span>
              {cat.count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    selectedCategory === cat.key
                      ? 'bg-black/20 text-[var(--accent-primary-contrast)]'
                      : 'bg-[var(--bg-surface)] text-[var(--text-secondary)]'
                  }`}
                >
                  {cat.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {filteredNotifications.length === 0 ? (
            <div className="py-16 text-center text-xs text-[var(--text-secondary)] space-y-2">
              <Bell className="w-8 h-8 text-[var(--text-muted)] mx-auto stroke-1" />
              <p>No notifications in this category.</p>
              <p className="text-[10px] text-[var(--text-muted)]">You are completely up to date!</p>
            </div>
          ) : (
            filteredNotifications.map((n) => (
              <div
                key={n.id}
                className={`p-3 rounded-2xl border transition-all flex items-start gap-3 relative group ${
                  n.isRead
                    ? 'bg-[var(--bg-surface-alt)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                    : 'bg-[var(--accent-primary-soft)] border-[var(--accent-primary-border)] text-[var(--text-primary)]'
                }`}
              >
                <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0 border border-[var(--border-subtle)] relative">
                  <img src={n.sender.avatar} alt={n.sender.displayName} className="w-full h-full object-cover" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[var(--bg-surface)] flex items-center justify-center shadow-sm">
                    {getIcon(n.type, n.category)}
                  </div>
                </div>

                <div className="flex-1 min-w-0 pr-8">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs text-[var(--text-primary)] truncate">{n.title}</span>
                    <span className="text-[10px] text-[var(--text-muted)] flex-shrink-0">
                      {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed">{n.body}</p>
                  {n.category && (
                    <span className="inline-block mt-1 text-[9px] font-bold uppercase tracking-wider text-[var(--accent-primary)] bg-[var(--accent-primary-soft)] px-1.5 py-0.5 rounded">
                      {n.category}
                    </span>
                  )}
                </div>

                {/* Individual Delete Action */}
                <button
                  onClick={(e) => handleDelete(n.id, e)}
                  title="Delete notification"
                  className="absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-soft)] transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
