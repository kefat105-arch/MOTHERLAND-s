import React, { useEffect, useState } from 'react';
import {
  X,
  Shield,
  Users,
  UserPlus,
  UserCheck,
  MessageSquare,
  Loader2,
  ExternalLink,
  Youtube,
  Play,
  Film,
  Flame,
  AlertCircle,
} from 'lucide-react';
import { api } from '../api';
import type { LongVideo, PlatformSource, Post, ShortVideo, UserProfile } from '../types';
import { useBackHandler } from '../hooks/useBackNavigation';

export interface CreatorProfileTarget {
  userId?: string;
  displayName?: string;
  username?: string;
  avatar?: string;
  source: PlatformSource;
  channelId?: string;
  subscriberCount?: string;
}

interface CreatorProfileModalProps {
  target: CreatorProfileTarget | null;
  currentUser: UserProfile | null;
  onClose: () => void;
  onOpenAuth: () => void;
  onOpenChatWithUser?: (userId: string) => void;
  onPlayVideo?: (video: LongVideo) => void;
  onPlayShort?: (shorts: ShortVideo[], index: number) => void;
  onSupportChanged?: () => void;
}

interface YouTubeChannelDetails {
  id: string;
  source: 'youtube';
  title: string;
  description: string;
  customUrl?: string;
  avatar: string;
  bannerUrl?: string;
  subscriberCount: string;
  rawSubscriberCount: number | null;
  videoCount: number;
  viewCount: number;
  country?: string;
  publishedAt?: string;
  url: string;
}

export const CreatorProfileModal: React.FC<CreatorProfileModalProps> = ({
  target,
  currentUser,
  onClose,
  onOpenAuth,
  onOpenChatWithUser,
  onPlayVideo,
  onPlayShort,
  onSupportChanged,
}) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);

  const [ytChannel, setYtChannel] = useState<YouTubeChannelDetails | null>(null);
  const [ytVideos, setYtVideos] = useState<(LongVideo & { isShort?: boolean })[]>([]);
  const [ytSmallVideos, setYtSmallVideos] = useState<(LongVideo & { isShort?: boolean })[]>([]);
  const [ytSubscribed, setYtSubscribed] = useState(false);
  const [ytActiveTab, setYtActiveTab] = useState<'videos' | 'small'>('videos');
  const [ytNotice, setYtNotice] = useState('');

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [togglingSupport, setTogglingSupport] = useState(false);

  useBackHandler('creator-profile-modal', Boolean(target), onClose, 64);

  useEffect(() => {
    if (!target) {
      setProfile(null);
      setPosts([]);
      setIsFollowing(false);
      setYtChannel(null);
      setYtVideos([]);
      setYtSmallVideos([]);
      setYtSubscribed(false);
      setYtNotice('');
      setLoadError('');
      return;
    }

    let active = true;
    setLoading(true);
    setLoadError('');
    setYtNotice('');

    if (target.source === 'youtube') {
      const channelId = target.channelId || target.userId || '';
      if (!channelId) {
        setLoading(false);
        setLoadError('YouTube channel ID is unavailable.');
        return;
      }
      setProfile(null);
      setPosts([]);
      setYtActiveTab('videos');

      Promise.all([
        api.getYouTubeChannel(channelId),
        api.getYouTubeSubscriptionStatus(channelId).catch(() => ({
          connected: false,
          hasScope: false,
          subscribed: false,
          subscriptionId: null,
        })),
      ])
        .then(([channelRes, subStatus]) => {
          if (!active) return;
          setYtChannel(channelRes.channel);
          setYtVideos(channelRes.videos || []);
          setYtSmallVideos(channelRes.smallVideos || []);
          setYtSubscribed(Boolean(subStatus.subscribed));
        })
        .catch((err: any) => {
          if (!active) return;
          setYtChannel(null);
          setLoadError(err?.message || 'Unable to load YouTube channel details.');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    } else if (target.userId) {
      setYtChannel(null);
      setYtVideos([]);
      setYtSmallVideos([]);
      api
        .getUserById(target.userId)
        .then((res) => {
          if (!active) return;
          setProfile(res.user);
          setPosts(res.posts || []);
          setIsFollowing(Boolean(res.isFollowing));
        })
        .catch((err: any) => {
          if (active) {
            setProfile(null);
            setLoadError(err?.message || 'Unable to load MOTHERLAND profile.');
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    } else {
      setLoading(false);
    }

    return () => {
      active = false;
    };
  }, [target?.userId, target?.channelId, target?.source]);

  if (!target) return null;

  const isMotherland = target.source === 'motherland';
  const displayName = isMotherland
    ? profile?.displayName || target.displayName || 'Creator'
    : ytChannel?.title || target.displayName || 'YouTube Channel';
  const avatar = isMotherland ? profile?.avatar || target.avatar || '' : ytChannel?.avatar || target.avatar || '';
  const username = isMotherland ? profile?.username || target.username || '' : ytChannel?.customUrl || '';
  const isSelf = Boolean(currentUser && profile && currentUser.id === profile.id);

  const handleToggleMotherlandSupport = async () => {
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
              followersCount:
                typeof res.targetFollowersCount === 'number'
                  ? res.targetFollowersCount
                  : Math.max(0, prev.followersCount + (res.isFollowing ? 1 : -1)),
            }
          : prev
      );
      onSupportChanged?.();
    } catch {
      // ignore
    } finally {
      setTogglingSupport(false);
    }
  };

  const handleToggleYouTubeSupport = async () => {
    const channelId = ytChannel?.id || target.channelId;
    if (!channelId || togglingSupport) return;
    if (!currentUser) {
      onOpenAuth();
      return;
    }
    setTogglingSupport(true);
    setYtNotice('');
    try {
      const res = await api.subscribeYouTubeChannel(channelId, ytSubscribed ? 'unsubscribe' : 'subscribe');
      if (res.success) {
        setYtSubscribed(Boolean(res.subscribed));
      }
    } catch (err: any) {
      setYtNotice(
        err?.message ||
          'YouTube subscription requires Google OAuth with YouTube authorization scope. Open the channel on YouTube below to subscribe directly.'
      );
    } finally {
      setTogglingSupport(false);
    }
  };

  const toShortVideo = (v: LongVideo & { durationSeconds?: number }): ShortVideo => ({
    id: v.id,
    source: 'youtube',
    youtubeId: v.youtubeId,
    videoUrl: '',
    thumbnailUrl: v.thumbnailUrl,
    title: v.title,
    caption: v.description,
    durationSeconds: v.durationSeconds || 60,
    aspectRatio: '9:16',
    hashtags: ['SmallVideo'],
    creator: {
      id: ytChannel?.id || target.channelId || v.channel.id,
      name: ytChannel?.title || v.channel.title,
      username: (ytChannel?.customUrl || v.channel.title || 'creator').replace(/^@/, ''),
      avatar: ytChannel?.avatar || v.channel.avatar,
      isVerified: true,
      isFollowing: ytSubscribed,
    },
    stats: {
      likes: v.stats?.likes || 0,
      comments: v.stats?.comments || 0,
      shares: 0,
      views: v.stats?.views || 0,
    },
    createdAt: v.publishedAt || 'Recently',
  });

  const activeYouTubeList = ytActiveTab === 'small' ? ytSmallVideos : ytVideos;

  return (
    <div
      data-testid="creator-profile-modal"
      className="fixed inset-0 z-[92] bg-black/65 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[88dvh] rounded-t-3xl sm:rounded-3xl ml-glass-elevated border border-[var(--border-subtle)] shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {isMotherland ? (
              <Shield className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
            ) : (
              <Youtube className="w-4 h-4 text-red-500 shrink-0" />
            )}
            <span className="text-sm font-extrabold text-[var(--text-primary)] truncate">
              {isMotherland ? 'MOTHERLAND Creator' : 'YouTube Channel'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close creator profile"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)] shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-[var(--accent-primary)]" />
              <span className="text-xs text-[var(--text-secondary)]">
                {isMotherland ? 'Loading MOTHERLAND profile...' : 'Loading live YouTube channel...'}
              </span>
            </div>
          ) : (
            <>
              {/* Channel Banner for YouTube */}
              {!isMotherland && ytChannel?.bannerUrl && (
                <div className="h-24 sm:h-28 w-full rounded-2xl overflow-hidden bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)]">
                  <img src={ytChannel.bannerUrl} alt={displayName} className="w-full h-full object-cover" />
                </div>
              )}

              {/* Identity Header */}
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
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-extrabold text-base text-[var(--text-primary)] truncate">
                      {displayName}
                    </h3>
                    {profile?.isVerified && (
                      <span className="w-4 h-4 rounded-full bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)] flex items-center justify-center text-[9px] font-bold">
                        ✓
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    {username && (
                      <span className="text-xs text-[var(--text-secondary)] truncate">
                        {username.startsWith('@') ? username : `@${username}`}
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                        isMotherland
                          ? 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] border-[var(--accent-primary-border)]'
                          : 'bg-red-500/10 text-red-400 border-red-500/30'
                      }`}
                    >
                      {isMotherland ? 'MOTHERLAND Creator' : 'YouTube Channel · External Creator'}
                    </span>
                  </div>

                  {isMotherland && profile ? (
                    <p className="text-xs text-[var(--text-muted)] mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                        {profile.followersCount.toLocaleString()} Supporters
                      </span>
                      <span>·</span>
                      <span>{profile.followingCount.toLocaleString()} Supporting</span>
                      <span>·</span>
                      <span>{profile.friendsCount.toLocaleString()} Friends</span>
                    </p>
                  ) : (
                    <p className="text-xs text-[var(--text-muted)] mt-1.5 tabular-nums">
                      {ytChannel?.subscriberCount || target.subscriberCount || 'YouTube Creator'}
                      {ytChannel?.videoCount ? ` · ${ytChannel.videoCount.toLocaleString()} videos` : ''}
                    </p>
                  )}
                </div>
              </div>

              {loadError && (
                <div className="p-3 rounded-2xl bg-[var(--danger-soft)] border border-[var(--danger)]/30 text-xs text-[var(--danger)] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{loadError}</span>
                </div>
              )}

              {(isMotherland ? profile?.bio : ytChannel?.description) && (
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed p-3 rounded-2xl bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] whitespace-pre-wrap line-clamp-4">
                  {isMotherland ? profile?.bio : ytChannel?.description}
                </p>
              )}

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2">
                {isMotherland && !isSelf && target.userId && (
                  <>
                    <button
                      type="button"
                      onClick={handleToggleMotherlandSupport}
                      disabled={togglingSupport}
                      className={`flex-1 min-h-[42px] px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                        isFollowing
                          ? 'ml-flame-box-active'
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

                {!isMotherland && (ytChannel?.id || target.channelId) && (
                  <>
                    <button
                      type="button"
                      onClick={handleToggleYouTubeSupport}
                      disabled={togglingSupport}
                      className={`flex-1 min-h-[42px] px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                        ytSubscribed
                          ? 'ml-flame-box-active'
                          : 'bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-primary-contrast)]'
                      }`}
                    >
                      {togglingSupport ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : ytSubscribed ? (
                        <UserCheck className="w-4 h-4" />
                      ) : (
                        <UserPlus className="w-4 h-4" />
                      )}
                      <span>{ytSubscribed ? 'Supporting on YouTube' : 'Support'}</span>
                    </button>

                    <a
                      href={
                        ytChannel?.url ||
                        `https://www.youtube.com/channel/${encodeURIComponent(ytChannel?.id || target.channelId || '')}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[42px] px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>YouTube</span>
                    </a>
                  </>
                )}
              </div>

              {ytNotice && (
                <div className="p-3 rounded-2xl bg-[var(--accent-gold-soft)] border border-[var(--accent-gold-border)] text-xs text-[var(--accent-gold)] space-y-1.5">
                  <p>{ytNotice}</p>
                </div>
              )}

              {/* MOTHERLAND Creator Stats & Posts */}
              {isMotherland && profile && (
                <>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2.5 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)]">
                      <span className="text-sm font-extrabold text-[var(--text-primary)] block tabular-nums">
                        {(profile.postsCount ?? posts.length).toLocaleString()}
                      </span>
                      <span className="text-[10px] text-[var(--text-secondary)]">Posts</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)]">
                      <span className="text-sm font-extrabold text-[var(--text-primary)] block tabular-nums">
                        {(profile.videosCount ?? 0).toLocaleString()}
                      </span>
                      <span className="text-[10px] text-[var(--text-secondary)]">Videos</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)]">
                      <span className="text-sm font-extrabold text-[var(--text-primary)] block tabular-nums">
                        {(profile.smallVideosCount ?? 0).toLocaleString()}
                      </span>
                      <span className="text-[10px] text-[var(--text-secondary)]">Small Videos</span>
                    </div>
                  </div>

                  {posts.length > 0 && (
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

              {/* YouTube Channel Videos & Small Video Tabs */}
              {!isMotherland && ytChannel && (
                <div className="space-y-3 pt-2 border-t border-[var(--border-subtle)]">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setYtActiveTab('videos')}
                      className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-colors ${
                        ytActiveTab === 'videos'
                          ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)] border-transparent'
                          : 'bg-[var(--bg-surface-alt)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
                      }`}
                    >
                      <Film className="w-3.5 h-3.5" />
                      <span>Videos ({ytVideos.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setYtActiveTab('small')}
                      className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-colors ${
                        ytActiveTab === 'small'
                          ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)] border-transparent'
                          : 'bg-[var(--bg-surface-alt)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
                      }`}
                    >
                      <Flame className="w-3.5 h-3.5" />
                      <span>Small Video ({ytSmallVideos.length})</span>
                    </button>
                  </div>

                  {activeYouTubeList.length === 0 ? (
                    <div className="p-6 text-center text-xs text-[var(--text-secondary)] rounded-2xl bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)]">
                      No public {ytActiveTab === 'small' ? 'Small Videos' : 'videos'} returned for this channel.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {activeYouTubeList.map((vid, idx) => (
                        <button
                          key={vid.id}
                          type="button"
                          onClick={() => {
                            if (ytActiveTab === 'small' && onPlayShort) {
                              const shortsList = ytSmallVideos.map(toShortVideo);
                              onClose();
                              onPlayShort(shortsList, idx);
                            } else if (onPlayVideo) {
                              onClose();
                              onPlayVideo(vid);
                            }
                          }}
                          className="w-full text-left flex gap-3 p-2 rounded-2xl bg-[var(--bg-surface-alt)] hover:border-[var(--accent-primary-border)] border border-[var(--border-subtle)] transition-colors cursor-pointer group"
                        >
                          <div className="relative w-32 aspect-video rounded-xl overflow-hidden bg-black shrink-0">
                            {vid.thumbnailUrl ? (
                              <img
                                src={vid.thumbnailUrl}
                                alt={vid.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                            ) : null}
                            <div className="absolute inset-0 bg-black/25 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                              <Play className="w-5 h-5 text-white fill-current" />
                            </div>
                            <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-[10px] text-white font-mono tabular-nums">
                              {vid.duration}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0 py-0.5">
                            <h5 className="text-xs font-bold text-[var(--text-primary)] line-clamp-2 leading-snug group-hover:text-[var(--accent-primary)]">
                              {vid.title}
                            </h5>
                            <p className="text-[11px] text-[var(--text-muted)] mt-1 tabular-nums">
                              {(vid.stats?.views || 0).toLocaleString()} views · {vid.publishedAt}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
