import React, { useEffect, useState } from 'react';
import { X, Shield, Users, UserPlus, UserCheck, MessageSquare, Loader2, ExternalLink } from 'lucide-react';
import { api } from '../../api';
import type { Post, UserProfile } from '../../types';
import { useBackHandler } from '../../hooks/useBackNavigation';

export interface CreatorProfileTarget {
  userId?: string;
  displayName?: string;
  username?: string;
  avatar?: string;
  source: 'motherland' | 'youtube';
  channelId?: string;
  subscriberCount?: string;
}

interface CreatorProfileModalProps {
  target: CreatorProfileTarget | null;
  currentUser: UserProfile | null;
  onClose: () => void;
  onOpenAuth: () => void;
  onOpenChatWithUser?: (userId: string) => void;
}

export const CreatorProfileModal: React.FC<CreatorProfileModalProps> = ({
  target,
  currentUser,
  onClose,
  onOpenAuth,
  onOpenChatWithUser,
}) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [togglingSupport, setTogglingSupport] = useState(false);

  useBackHandler('creator-profile-modal', Boolean(target), onClose, 64);

  useEffect(() => {
    if (!target || target.source !== 'motherland' || !target.userId) {
      setProfile(null);
      setPosts([]);
      setIsFollowing(false);
      return;
    }
    let active = true;
    setLoading(true);
    api
      .getUserById(target.userId)
      .then((res) => {
        if (!active) return;
        setProfile(res.user);
        setPosts(res.posts || []);
        setIsFollowing(Boolean(res.isFollowing));
      })
      .catch(() => {
        if (active) setProfile(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [target?.userId, target?.source]);

  if (!target) return null;

  const isMotherland = target.source === 'motherland';
  const displayName = profile?.displayName || target.displayName || 'Unavailable';
  const avatar = profile?.avatar || target.avatar || '';
  const username = profile?.username || target.username || '';
  const isSelf = Boolean(currentUser && profile && currentUser.id === profile.id);

  const handleToggleSupport = async () => {
    if (!currentUser) {
      onOpenAuth();
      return;
    }
    if (!isMotherland || !target.userId || togglingSupport) return;
    setTogglingSupport(true);
    try {
      const res = await api.toggleFollow(target.userId);
      setIsFollowing(Boolean(res.isFollowing));
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              followersCount: Math.max(0, prev.followersCount + (res.isFollowing ? 1 : -1)),
            }
          : prev
      );
    } catch {
      // ignore
    } finally {
      setTogglingSupport(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[92] bg-black/65 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[85vh] rounded-t-3xl sm:rounded-3xl ml-glass-elevated border border-[var(--border-subtle)] shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[var(--accent-primary)]" />
            <span className="text-sm font-extrabold text-[var(--text-primary)]">Creator Profile</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close creator profile"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-[var(--accent-primary)]" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3.5">
                {avatar ? (
                  <img
                    src={avatar}
                    alt={displayName}
                    className="w-16 h-16 rounded-2xl object-cover border border-[var(--border-subtle)] flex-shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] flex items-center justify-center text-lg font-extrabold text-[var(--text-primary)] flex-shrink-0">
                    {displayName.slice(0, 1).toUpperCase()}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-extrabold text-base text-[var(--text-primary)] truncate">
                      {displayName}
                    </h3>
                    {profile?.isVerified && (
                      <span className="w-4 h-4 rounded-full bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)] flex items-center justify-center text-[9px] font-bold">
                        ✓
                      </span>
                    )}
                  </div>
                  {username && (
                    <p className="text-xs text-[var(--text-secondary)] truncate">@{username}</p>
                  )}
                  {isMotherland && profile ? (
                    <p className="text-xs text-[var(--text-muted)] mt-1 flex items-center gap-3 tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                        {profile.followersCount.toLocaleString()} Supporters
                      </span>
                      <span>·</span>
                      <span>{profile.friendsCount.toLocaleString()} Friends</span>
                    </p>
                  ) : target.subscriberCount ? (
                    <p className="text-xs text-[var(--text-muted)] mt-1">{target.subscriberCount}</p>
                  ) : null}
                </div>
              </div>

              {profile?.bio && (
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed p-3 rounded-2xl bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)]">
                  {profile.bio}
                </p>
              )}

              <div className="flex items-center gap-2">
                {isMotherland && !isSelf && target.userId && (
                  <>
                    <button
                      type="button"
                      onClick={handleToggleSupport}
                      disabled={togglingSupport}
                      className={`flex-1 min-h-[42px] px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                        isFollowing
                          ? 'bg-[var(--bg-surface-alt)] text-[var(--text-primary)] border border-[var(--border-subtle)]'
                          : 'bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-primary-contrast)]'
                      }`}
                    >
                      {isFollowing ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                      <span>{isFollowing ? 'Supporting' : 'Support'}</span>
                    </button>

                    {onOpenChatWithUser && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenChatWithUser(target.userId!);
                        }}
                        className="min-h-[42px] px-4 rounded-xl ml-glass text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5"
                      >
                        <MessageSquare className="w-4 h-4 text-[var(--accent-primary)]" />
                        <span>Message</span>
                      </button>
                    )}
                  </>
                )}

                {!isMotherland && target.channelId && (
                  <a
                    href={`https://www.youtube.com/channel/${encodeURIComponent(target.channelId)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 min-h-[42px] px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>View Channel on YouTube</span>
                  </a>
                )}
              </div>

              {isMotherland && posts.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
                  <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                    Recent Posts ({posts.length})
                  </h4>
                  <div className="space-y-2">
                    {posts.slice(0, 6).map((p) => (
                      <div
                        key={p.id}
                        className="p-3 rounded-2xl bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] space-y-1.5"
                      >
                        <p className="text-xs text-[var(--text-primary)] line-clamp-3">
                          {p.content || 'Media post'}
                        </p>
                        <p className="text-[10px] text-[var(--text-muted)]">
                          {new Date(p.createdAt).toLocaleDateString()} · {p.stats.likes} reactions
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
