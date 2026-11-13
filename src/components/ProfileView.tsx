import React, { useState, useEffect } from 'react';
import {
  Shield,
  Edit3,
  MapPin,
  Briefcase,
  Globe,
  Calendar,
  Grid,
  Film,
  Flame,
  Bookmark,
  Users,
  Activity,
  SlidersHorizontal,
  Loader2,
  Crown,
  LogOut,
  LogIn,
  UserPlus,
  X,
  Camera,
  Bell,
  Play,
} from 'lucide-react';
import { api } from '../api';
import type { UserProfile, Post, ShortVideo, LongVideo, SavedVideoItem, UserPrivacySettings, NotificationPreferences } from '../types';
import { PostCard } from './PostCard';
import { useBackHandler } from '../hooks/useBackNavigation';

interface ProfileViewProps {
  currentUser: UserProfile | null;
  userPosts: Post[];
  userShorts: ShortVideo[];
  userLongVideos: LongVideo[];
  onProfileUpdated: (updatedUser: UserProfile) => void;
  onOpenPlatformHub: () => void;
  onOpenComments: (postId: string, youtubeVideoId?: string) => void;
  onReact: (postId: string, reaction: any) => void;
  onToggleSave: (postId: string) => void;
  onSharePost?: (postId: string) => Promise<void> | void;
  onDeletePost: (postId: string) => void;
  onOpenAuthModal?: () => void;
  onLogout?: () => void;
  onSwitchAccount?: (account: UserProfile) => void;
  onPlaySavedVideo?: (video: SavedVideoItem) => void;
}

type ProfileTab =
  | 'posts'
  | 'about'
  | 'photos'
  | 'videos'
  | 'shorts'
  | 'friends'
  | 'followers'
  | 'following'
  | 'saved'
  | 'activity'
  | 'settings';

export const ProfileView: React.FC<ProfileViewProps> = ({
  currentUser,
  userPosts,
  userShorts,
  userLongVideos,
  onProfileUpdated,
  onOpenPlatformHub,
  onOpenComments,
  onReact,
  onToggleSave,
  onSharePost,
  onDeletePost,
  onOpenAuthModal,
  onLogout,
  onSwitchAccount,
  onPlaySavedVideo,
}) => {
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [isEditing, setIsEditing] = useState(false);
  const [ownerSecretInput, setOwnerSecretInput] = useState('');
  const [ownerClaimNotice, setOwnerClaimNotice] = useState('');
  const [isClaimingOwner, setIsClaimingOwner] = useState(false);
  const [accountNotice, setAccountNotice] = useState('');

  // Paginated profile posts backed directly by /api/users/:id/posts
  const [profilePosts, setProfilePosts] = useState<Post[]>([]);
  const [profilePostsPage, setProfilePostsPage] = useState(1);
  const [hasMoreProfilePosts, setHasMoreProfilePosts] = useState(false);
  const [isLoadingProfilePosts, setIsLoadingProfilePosts] = useState(false);

  useBackHandler('profile-edit-modal', isEditing, () => setIsEditing(false), 60);

  // Edit Profile Form State
  const [editDisplayName, setEditDisplayName] = useState(currentUser?.displayName || '');
  const [editBio, setEditBio] = useState(currentUser?.bio || '');
  const [editLocation, setEditLocation] = useState(currentUser?.location || '');
  const [editWebsite, setEditWebsite] = useState(currentUser?.website || '');
  const [editWork, setEditWork] = useState(currentUser?.work || '');
  const [editEducation, setEditEducation] = useState(currentUser?.education || '');
  const [editAvatar, setEditAvatar] = useState(currentUser?.avatar || '');
  const [editCover, setEditCover] = useState(currentUser?.coverImage || '');
  const [editVisibility, setEditVisibility] = useState<'public' | 'friends' | 'private'>(
    currentUser?.privacy?.profileVisibility || 'public'
  );
  const [editError, setEditError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [savedVideos, setSavedVideos] = useState<SavedVideoItem[]>([]);
  const [savedPostsList, setSavedPostsList] = useState<Post[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [prefsNotice, setPrefsNotice] = useState('');

  // Sync edit fields when currentUser changes
  useEffect(() => {
    if (!currentUser) return;
    setEditDisplayName(currentUser.displayName);
    setEditBio(currentUser.bio);
    setEditLocation(currentUser.location || '');
    setEditWebsite(currentUser.website || '');
    setEditWork(currentUser.work || '');
    setEditEducation(currentUser.education || '');
    setEditAvatar(currentUser.avatar);
    setEditCover(currentUser.coverImage);
    setEditVisibility(currentUser.privacy.profileVisibility);
  }, [currentUser?.id]);

  // Load paginated own profile posts
  useEffect(() => {
    if (!currentUser) return;
    let mounted = true;
    setIsLoadingProfilePosts(true);
    api
      .getUserPosts(currentUser.id, 1, 12)
      .then((res) => {
        if (!mounted) return;
        setProfilePosts(res.posts || []);
        setProfilePostsPage(1);
        setHasMoreProfilePosts(Boolean(res.hasMore));
      })
      .catch(() => {
        if (!mounted) return;
        setProfilePosts(userPosts.filter((p) => p.author.id === currentUser.id));
      })
      .finally(() => {
        if (mounted) setIsLoadingProfilePosts(false);
      });
    return () => {
      mounted = false;
    };
  }, [currentUser?.id, userPosts.length]);

  useEffect(() => {
    if (!currentUser || activeTab !== 'saved') return;
    let mounted = true;
    setLoadingSaved(true);
    api
      .getSavedCollection()
      .then((res) => {
        if (!mounted) return;
        setSavedVideos(res.videos || []);
        setSavedPostsList(res.posts || []);
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoadingSaved(false);
      });
    return () => {
      mounted = false;
    };
  }, [currentUser?.id, activeTab]);

  const loadOlderProfilePosts = async () => {
    if (!currentUser || isLoadingProfilePosts || !hasMoreProfilePosts) return;
    setIsLoadingProfilePosts(true);
    try {
      const nextPage = profilePostsPage + 1;
      const res = await api.getUserPosts(currentUser.id, nextPage, 12);
      setProfilePosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...(res.posts || []).filter((p) => !seen.has(p.id))];
      });
      setProfilePostsPage(nextPage);
      setHasMoreProfilePosts(Boolean(res.hasMore));
    } catch (err) {
      console.error('Failed to load older profile posts:', err);
    } finally {
      setIsLoadingProfilePosts(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="w-full max-w-2xl mx-auto p-4 mt-4">
        <div className="ml-glass rounded-3xl p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[var(--accent-primary-soft)] border border-[var(--accent-primary-border)] text-[var(--accent-primary)] flex items-center justify-center mx-auto">
            <Shield className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-extrabold text-[var(--text-primary)]">
            Your MOTHERLAND Profile
          </h2>
          <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto leading-relaxed">
            Sign in with your account or register in seconds to publish posts, save videos, manage your friends, and customize your profile.
          </p>
          {onOpenAuthModal && (
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-primary-contrast)] text-xs font-bold inline-flex items-center gap-2 shadow-sm"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In or Create Account</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setEditError('');
    try {
      const res = await api.updateProfile({
        displayName: editDisplayName,
        bio: editBio,
        location: editLocation,
        website: editWebsite,
        work: editWork,
        education: editEducation,
        avatar: editAvatar,
        coverImage: editCover,
        privacy: {
          ...currentUser.privacy,
          profileVisibility: editVisibility,
        },
      });
      if (res.success && res.user) {
        onProfileUpdated(res.user);
        setIsEditing(false);
      }
    } catch (err: any) {
      setEditError(err?.message || 'Profile update failed.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClaimOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsClaimingOwner(true);
    setOwnerClaimNotice('');
    try {
      const res = await api.claimOwner(ownerSecretInput);
      if (res.success && res.user) {
        setOwnerClaimNotice('Official Founder & Owner role successfully activated!');
        onProfileUpdated(res.user);
      } else {
        setOwnerClaimNotice(res.message || 'Secret did not match');
      }
    } catch (err: any) {
      setOwnerClaimNotice(err.message || 'Claim error');
    } finally {
      setIsClaimingOwner(false);
    }
  };

  const tabs: { key: ProfileTab; label: string; icon: any }[] = [
    { key: 'posts', label: 'Posts', icon: Grid },
    { key: 'about', label: 'About', icon: Shield },
    { key: 'photos', label: 'Photos', icon: Grid },
    { key: 'videos', label: 'Videos', icon: Film },
    { key: 'shorts', label: 'Shorts', icon: Flame },
    { key: 'friends', label: 'Friends', icon: Users },
    { key: 'followers', label: 'Supporters', icon: Users },
    { key: 'following', label: 'Supporting', icon: Users },
    { key: 'saved', label: 'Saved', icon: Bookmark },
    { key: 'activity', label: 'Activity', icon: Activity },
    { key: 'settings', label: 'Settings', icon: SlidersHorizontal },
  ];

  const myOwnShorts = userShorts.filter((s) => s.creator.id === currentUser.id);
  const myOwnLongVideos = userLongVideos.filter((v) => v.channel.id === currentUser.id);

  return (
    <div className="w-full max-w-4xl mx-auto pb-12">
      {/* Cover Image & Avatar Header */}
      <div className="relative">
        <div className="h-44 sm:h-64 w-full bg-[var(--bg-surface-alt)] overflow-hidden rounded-b-3xl relative">
          <img
            src={currentUser.coverImage}
            alt="Cover"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-canvas)] via-transparent to-black/25" />
        </div>

        {/* Profile Card Overlay */}
        <div className="px-4 sm:px-6 relative -mt-16 sm:-mt-20 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="flex items-end gap-3.5">
            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-3xl p-1 bg-gradient-to-tr from-[var(--accent-primary)] via-[var(--accent-royal)] to-[var(--accent-gold)] shadow-xl flex-shrink-0">
              <img
                src={currentUser.avatar}
                alt={currentUser.displayName}
                className="w-full h-full object-cover rounded-[22px] bg-[var(--bg-surface-solid)]"
              />
            </div>
            <div className="mb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-extrabold text-[var(--text-primary)]">
                  {currentUser.displayName}
                </h1>
                {currentUser.isVerified && (
                  <span className="w-4 h-4 rounded-full bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)] flex items-center justify-center text-[10px] font-bold">
                    ✓
                  </span>
                )}
                {currentUser.role === 'owner' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[var(--accent-gold-soft)] text-[var(--accent-gold)] text-[10px] font-black uppercase tracking-wider border border-[var(--accent-gold-border)]">
                    <Crown className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
                    Founder &amp; Owner
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] font-mono font-bold border border-[var(--accent-primary-border)]">
                    MOTHERLAND
                  </span>
                )}
              </div>
              <span className="text-xs text-[var(--text-secondary)] font-medium">
                @{currentUser.username}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="min-h-[44px] px-4 py-2 rounded-xl ml-glass hover:opacity-90 text-[var(--text-primary)] text-xs font-bold transition-colors flex items-center gap-1.5"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Profile</span>
            </button>
            <button
              type="button"
              onClick={onOpenPlatformHub}
              className="w-11 h-11 rounded-xl ml-glass hover:opacity-90 text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors"
              title="Platform Settings"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Profile Bio & Metadata */}
      <div className="px-4 sm:px-6 mt-4 space-y-3">
        <p className="text-xs sm:text-sm text-[var(--text-primary)] leading-relaxed max-w-2xl">
          {currentUser.bio}
        </p>

        <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-[var(--text-secondary)]">
          {currentUser.location && (
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>{currentUser.location}</span>
            </div>
          )}
          {currentUser.work && (
            <div className="flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
              <span>{currentUser.work}</span>
            </div>
          )}
          {currentUser.website && (
            <a
              href={currentUser.website}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-[var(--accent-primary)] hover:underline"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{currentUser.website.replace('https://', '')}</span>
            </a>
          )}
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span>Joined {currentUser.joinedDate}</span>
          </div>
        </div>

        <div className="flex items-center gap-6 pt-3 border-t border-[var(--border-subtle)] text-xs">
          <div className="cursor-pointer" onClick={() => setActiveTab('friends')}>
            <span className="font-extrabold text-sm text-[var(--text-primary)] block tabular-nums">
              {currentUser.friendsCount.toLocaleString()}
            </span>
            <span className="text-[var(--text-secondary)]">Friends</span>
          </div>
          <div className="cursor-pointer" onClick={() => setActiveTab('followers')}>
            <span className="font-extrabold text-sm text-[var(--text-primary)] block tabular-nums">
              {currentUser.followersCount.toLocaleString()}
            </span>
            <span className="text-[var(--text-secondary)]">Supporters</span>
          </div>
          <div className="cursor-pointer" onClick={() => setActiveTab('following')}>
            <span className="font-extrabold text-sm text-[var(--text-primary)] block tabular-nums">
              {currentUser.followingCount.toLocaleString()}
            </span>
            <span className="text-[var(--text-secondary)]">Supporting</span>
          </div>
        </div>
      </div>

      {/* Profile Tabs Bar */}
      <div className="mt-6 border-b border-[var(--border-subtle)] px-4 sm:px-6 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1 min-w-max">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 py-3 px-3 text-xs font-bold border-b-2 transition-all ${
                  isActive
                    ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Contents */}
      <div className="px-4 sm:px-6 mt-4">
        {/* Tab 1: Paginated User Posts */}
        {activeTab === 'posts' && (
          <div className="space-y-4">
            {isLoadingProfilePosts && profilePosts.length === 0 ? (
              <div className="py-10 flex justify-center text-[var(--accent-primary)]">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : profilePosts.length === 0 ? (
              <div className="p-12 text-center text-xs text-[var(--text-secondary)] ml-glass rounded-2xl">
                No posts published yet. Use the Create (+) button to share your first post!
              </div>
            ) : (
              <>
                {profilePosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    currentUser={currentUser}
                    onReact={onReact}
                    onOpenComments={onOpenComments}
                    onToggleSave={onToggleSave}
                    onSharePost={onSharePost}
                    onDeletePost={(id) => {
                      onDeletePost(id);
                      setProfilePosts((prev) => prev.filter((p) => p.id !== id));
                    }}
                  />
                ))}
                {hasMoreProfilePosts && (
                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={loadOlderProfilePosts}
                      disabled={isLoadingProfilePosts}
                      className="min-h-[42px] px-5 py-2 rounded-xl ml-glass text-xs font-bold text-[var(--text-primary)] inline-flex items-center gap-2"
                    >
                      {isLoadingProfilePosts && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Load Older Posts</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Tab 2: About */}
        {activeTab === 'about' && (
          <div className="ml-glass rounded-2xl p-5 space-y-4 text-xs text-[var(--text-primary)]">
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2">
              About {currentUser.displayName}
            </h3>
            <div>
              <span className="font-semibold text-[var(--text-secondary)] block mb-1">Introduction</span>
              <p className="leading-relaxed">{currentUser.bio}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-[var(--border-subtle)]">
              <div>
                <span className="font-semibold text-[var(--text-secondary)] block mb-1">Work &amp; Occupation</span>
                <p>{currentUser.work || 'Independent Creator'}</p>
              </div>
              <div>
                <span className="font-semibold text-[var(--text-secondary)] block mb-1">Education</span>
                <p>{currentUser.education || 'Not specified'}</p>
              </div>
              <div>
                <span className="font-semibold text-[var(--text-secondary)] block mb-1">Location</span>
                <p>{currentUser.location || 'Dhaka, Bangladesh'}</p>
              </div>
              <div>
                <span className="font-semibold text-[var(--text-secondary)] block mb-1">Privacy Level</span>
                <p className="capitalize text-[var(--accent-primary)] font-semibold">
                  {currentUser.privacy.profileVisibility}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Photos */}
        {activeTab === 'photos' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {profilePosts
              .filter((p) => p.mediaUrl && p.mediaType !== 'video')
              .map((p) => (
                <div
                  key={p.id}
                  className="aspect-square rounded-2xl overflow-hidden bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)]"
                >
                  <img
                    src={p.mediaUrl}
                    alt="Upload"
                    className="w-full h-full object-cover hover:scale-105 transition-transform"
                  />
                </div>
              ))}
          </div>
        )}

        {/* Tab 4: Videos */}
        {activeTab === 'videos' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(myOwnLongVideos.length > 0 ? myOwnLongVideos : userLongVideos).map((video) => (
              <div key={video.id} className="rounded-2xl overflow-hidden ml-glass">
                <div className="aspect-video w-full relative">
                  <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover" />
                  <span className="absolute bottom-2 right-2 bg-black/80 px-1.5 py-0.5 rounded text-[10px] text-white font-mono">
                    {video.duration}
                  </span>
                </div>
                <div className="p-3">
                  <h4 className="font-bold text-xs text-[var(--text-primary)] line-clamp-1">{video.title}</h4>
                  <span className="text-[10px] text-[var(--text-secondary)]">
                    {video.stats.views.toLocaleString()} views
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 5: Shorts */}
        {activeTab === 'shorts' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {(myOwnShorts.length > 0 ? myOwnShorts : userShorts).map((short) => (
              <div
                key={short.id}
                className="aspect-[9/16] rounded-2xl overflow-hidden bg-black border border-[var(--border-subtle)] relative"
              >
                <img src={short.thumbnailUrl} alt={short.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent flex items-end p-2.5">
                  <span className="text-[11px] font-bold text-white line-clamp-2">{short.title}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 6-8: Network */}
        {activeTab === 'friends' && (
          <div className="p-6 text-center text-xs text-[var(--text-secondary)] ml-glass rounded-2xl">
            Confirmed connections: {currentUser.friendsCount.toLocaleString()} friends across MOTHERLAND.
          </div>
        )}
        {activeTab === 'followers' && (
          <div className="p-6 text-center text-xs text-[var(--text-secondary)] ml-glass rounded-2xl">
            Audience: {currentUser.followersCount.toLocaleString()} supporters receiving your updates.
          </div>
        )}
        {activeTab === 'following' && (
          <div className="p-6 text-center text-xs text-[var(--text-secondary)] ml-glass rounded-2xl">
            Supporting {currentUser.followingCount.toLocaleString()} creators and channels.
          </div>
        )}

        {/* Tab 9: Saved (Posts + Videos) */}
        {activeTab === 'saved' && (
          <div className="space-y-5">
            {loadingSaved ? (
              <div className="py-10 flex justify-center text-[var(--accent-primary)]">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : (
              <>
                {savedVideos.length > 0 && (
                  <div className="space-y-2.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                      Saved Videos &amp; Shorts ({savedVideos.length})
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {savedVideos.map((vid) => (
                        <div
                          key={vid.id}
                          className="ml-glass rounded-2xl overflow-hidden flex items-center gap-3 p-2.5"
                        >
                          <button
                            type="button"
                            onClick={() => onPlaySavedVideo?.(vid)}
                            className="relative w-28 aspect-video rounded-xl overflow-hidden bg-black shrink-0 group cursor-pointer"
                          >
                            <img src={vid.thumbnailUrl} alt={vid.title} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/35 flex items-center justify-center group-hover:bg-black/50 transition">
                              <Play className="w-5 h-5 text-white fill-current" />
                            </div>
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-[var(--text-primary)] line-clamp-2">{vid.title}</p>
                            <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">{vid.channelTitle}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <button
                                type="button"
                                onClick={async () => {
                                  const res = await api.toggleSaveVideo({
                                    videoId: vid.videoId,
                                    videoType: vid.videoType,
                                    source: vid.source,
                                    title: vid.title,
                                  });
                                  if (!res.isSaved) {
                                    setSavedVideos((prev) => prev.filter((item) => item.videoId !== vid.videoId));
                                  }
                                }}
                                className="text-[11px] font-semibold text-[var(--danger)] hover:underline cursor-pointer"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(() => {
                  const postsToShow =
                    savedPostsList.length > 0
                      ? savedPostsList
                      : userPosts.filter((p) => p.userInteractions?.isSaved);
                  if (postsToShow.length === 0 && savedVideos.length === 0) {
                    return (
                      <div className="p-12 text-center text-xs text-[var(--text-secondary)] ml-glass rounded-2xl">
                        No saved posts or videos yet. Tap the bookmark icon on any post or video to save it here.
                      </div>
                    );
                  }
                  return postsToShow.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      currentUser={currentUser}
                      onReact={onReact}
                      onOpenComments={onOpenComments}
                      onToggleSave={(id) => {
                        onToggleSave(id);
                        setSavedPostsList((prev) => prev.filter((p) => p.id !== id));
                      }}
                      onDeletePost={onDeletePost}
                    />
                  ));
                })()}
              </>
            )}
          </div>
        )}

        {/* Tab 10: Activity */}
        {activeTab === 'activity' && (
          <div className="ml-glass rounded-2xl p-4 space-y-3 text-xs">
            <h3 className="font-bold text-[var(--text-primary)] mb-2">Recent Timeline Activity</h3>
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[var(--bg-surface-alt)]">
              <span className="text-[var(--accent-primary)] font-bold">●</span>
              <span className="text-[var(--text-primary)]">Signed in to MOTHERLAND personal profile</span>
              <span className="text-[10px] text-[var(--text-muted)] ml-auto">Active</span>
            </div>
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[var(--bg-surface-alt)]">
              <span className="text-[var(--accent-gold)] font-bold">●</span>
              <span className="text-[var(--text-primary)]">
                Your Posts loaded: {profilePosts.length}
              </span>
              <span className="text-[10px] text-[var(--text-muted)] ml-auto">History</span>
            </div>
          </div>
        )}

        {/* Tab 11: Settings */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            <div className="ml-glass rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Shield className="w-4 h-4 text-[var(--accent-primary)]" />
                Account Identity
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-[var(--bg-surface-alt)] rounded-xl border border-[var(--border-subtle)]">
                  <span className="text-[var(--text-secondary)] block text-[10px] uppercase font-bold">Unique User ID</span>
                  <span className="font-mono text-[var(--accent-primary)] break-all">{currentUser.id}</span>
                </div>
                <div className="p-3 bg-[var(--bg-surface-alt)] rounded-xl border border-[var(--border-subtle)]">
                  <span className="text-[var(--text-secondary)] block text-[10px] uppercase font-bold">Account Role</span>
                  <span className="font-bold capitalize text-[var(--text-primary)] flex items-center gap-1.5 mt-0.5">
                    {currentUser.role === 'owner' ? (
                      <span className="text-[var(--accent-gold)] flex items-center gap-1">
                        <Crown className="w-3.5 h-3.5" /> Official Owner
                      </span>
                    ) : (
                      'Citizen / Creator'
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Wave, Privacy, Notification & Data Saver Controls */}
            <div className="ml-glass rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <Bell className="w-4 h-4 text-[var(--accent-primary)]" />
                  Wave Privacy, Notifications &amp; Data Saver
                </h3>
                {prefsNotice && (
                  <span className="text-[11px] font-semibold text-[var(--accent-primary)]">{prefsNotice}</span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
                    Who can message you on Wave
                  </label>
                  <select
                    value={currentUser.privacy.allowDirectMessages || 'everyone'}
                    onChange={async (e) => {
                      const res = await api.updatePreferences({
                        privacy: { allowDirectMessages: e.target.value as UserPrivacySettings['allowDirectMessages'] },
                      });
                      onProfileUpdated(res.user);
                      setPrefsNotice('Saved');
                    }}
                    className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] rounded-xl px-3 py-2 text-[var(--text-primary)]"
                  >
                    <option value="everyone">Everyone (Requests for non-friends)</option>
                    <option value="friends">Friends Only</option>
                    <option value="none">No One</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
                    Who can call you on Wave
                  </label>
                  <select
                    value={currentUser.privacy.allowCalls || 'everyone'}
                    onChange={async (e) => {
                      const res = await api.updatePreferences({
                        privacy: { allowCalls: e.target.value as UserPrivacySettings['allowCalls'] },
                      });
                      onProfileUpdated(res.user);
                      setPrefsNotice('Saved');
                    }}
                    className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] rounded-xl px-3 py-2 text-[var(--text-primary)]"
                  >
                    <option value="everyone">Everyone</option>
                    <option value="friends">Friends Only</option>
                    <option value="none">No One</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs pt-1">
                {[
                  {
                    label: 'Show Online Status',
                    value: currentUser.privacy.showOnlineStatus !== false,
                    toggle: () =>
                      api.updatePreferences({
                        privacy: { showOnlineStatus: currentUser.privacy.showOnlineStatus === false },
                      }),
                  },
                  {
                    label: 'Show Last Seen',
                    value: currentUser.privacy.showLastSeen !== false,
                    toggle: () =>
                      api.updatePreferences({
                        privacy: { showLastSeen: currentUser.privacy.showLastSeen === false },
                      }),
                  },
                  {
                    label: 'Send Read Receipts',
                    value: currentUser.privacy.showReadReceipts !== false,
                    toggle: () =>
                      api.updatePreferences({
                        privacy: { showReadReceipts: currentUser.privacy.showReadReceipts === false },
                      }),
                  },
                  {
                    label: 'Data Saver Mode',
                    value: Boolean(currentUser.dataSaver),
                    toggle: () => api.updatePreferences({ dataSaver: !currentUser.dataSaver }),
                  },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={async () => {
                      const res = await item.toggle();
                      onProfileUpdated(res.user);
                      setPrefsNotice('Saved');
                    }}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] cursor-pointer"
                  >
                    <span className="font-semibold text-[var(--text-primary)]">{item.label}</span>
                    <span
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                        item.value
                          ? 'bg-[var(--accent-primary)] text-white'
                          : 'bg-[var(--bg-surface)] text-[var(--text-muted)]'
                      }`}
                    >
                      {item.value ? 'ON' : 'OFF'}
                    </span>
                  </button>
                ))}
              </div>

              <div className="pt-2 border-t border-[var(--border-subtle)]">
                <p className="text-[11px] font-bold text-[var(--text-secondary)] mb-2">Notification Controls</p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ['messages', 'Wave Messages'],
                      ['calls', 'Calls'],
                      ['friends', 'Friends'],
                      ['posts', 'Posts'],
                      ['videos', 'Videos'],
                      ['groups', 'Groups'],
                    ] as [keyof NotificationPreferences, string][]
                  ).map(([key, label]) => {
                    const enabled = currentUser.notificationPrefs?.[key] !== false;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={async () => {
                          const res = await api.updatePreferences({
                            notificationPrefs: { [key]: !enabled },
                          });
                          onProfileUpdated(res.user);
                          setPrefsNotice('Saved');
                        }}
                        className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition cursor-pointer ${
                          enabled
                            ? 'bg-[var(--accent-primary-soft)] border-[var(--accent-primary-border)] text-[var(--accent-primary)]'
                            : 'bg-[var(--bg-surface-alt)] border-[var(--border-subtle)] text-[var(--text-muted)]'
                        }`}
                      >
                        {label}: {enabled ? 'On' : 'Off'}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {currentUser.role !== 'owner' && (
              <div className="bg-[var(--accent-gold-soft)] border border-[var(--accent-gold-border)] rounded-2xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <Crown className="w-4 h-4 text-[var(--accent-gold)]" />
                  Claim MOTHERLAND Founder &amp; Owner Account
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  Enter your authorization secret key to activate the official Owner role and badge.
                </p>
                <form onSubmit={handleClaimOwner} className="flex gap-2">
                  <input
                    type="password"
                    value={ownerSecretInput}
                    onChange={(e) => setOwnerSecretInput(e.target.value)}
                    placeholder="Enter Owner Authorization Secret"
                    required
                    className="flex-1 bg-[var(--bg-surface)] border border-[var(--accent-gold-border)] rounded-xl px-4 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-gold)]"
                  />
                  <button
                    type="submit"
                    disabled={isClaimingOwner}
                    className="px-4 py-2 bg-[var(--accent-gold)] text-[#111827] font-bold text-xs rounded-xl hover:opacity-90 transition-all cursor-pointer whitespace-nowrap"
                  >
                    {isClaimingOwner ? 'Verifying...' : 'Claim Owner Badge'}
                  </button>
                </form>
                {ownerClaimNotice && (
                  <p className="text-xs font-semibold text-[var(--accent-gold)]">{ownerClaimNotice}</p>
                )}
              </div>
            )}

            <div className="ml-glass rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <Users className="w-4 h-4 text-[var(--accent-primary)]" />
                  Account Switching &amp; Sessions
                </h3>
                {onOpenAuthModal && (
                  <button
                    type="button"
                    onClick={onOpenAuthModal}
                    className="px-3 py-1.5 rounded-xl bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] border border-[var(--accent-primary-border)] text-xs font-bold hover:bg-[var(--accent-primary)] hover:text-[var(--accent-primary-contrast)] transition-colors flex items-center gap-1.5"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Add / Switch Account
                  </button>
                )}
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                Signed in as <strong className="text-[var(--text-primary)]">{currentUser.displayName}</strong>. All reactions, comments, friends, and messages are isolated to your account.
              </p>

              {accountNotice && (
                <p className="text-xs text-[var(--danger)] font-medium">{accountNotice}</p>
              )}

              {api.getSavedAccounts().length > 0 && (
                <div className="space-y-2 pt-2">
                  <span className="text-[11px] font-semibold text-[var(--text-secondary)] block">
                    Saved Accounts on Device:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {api.getSavedAccounts().map((acc) => (
                      <div
                        key={acc.id}
                        className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                          acc.id === currentUser.id
                            ? 'bg-[var(--accent-primary-soft)] border-[var(--accent-primary-border)] text-[var(--accent-primary)]'
                            : 'bg-[var(--bg-surface-alt)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <img src={acc.avatar} alt="" className="w-7 h-7 rounded-lg object-cover" />
                          <div className="overflow-hidden">
                            <p className="text-xs font-bold text-[var(--text-primary)] truncate">{acc.displayName}</p>
                            <p className="text-[10px] text-[var(--text-secondary)]">@{acc.username}</p>
                          </div>
                        </div>
                        {acc.id === currentUser.id ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)]">
                            Active
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={async () => {
                              setAccountNotice('');
                              api.setToken(acc.token);
                              const res = await api.getCurrentUser();
                              if (res.user && onSwitchAccount) {
                                onSwitchAccount(res.user);
                              } else {
                                api.removeSavedAccount(acc.id);
                                setAccountNotice('Session expired for that saved account. Please sign in again.');
                                onOpenAuthModal?.();
                              }
                            }}
                            className="text-[10px] font-bold px-2.5 py-1 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--accent-primary-border)]"
                          >
                            Switch
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="ml-glass rounded-2xl p-5 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-[var(--text-primary)]">Log Out of MOTHERLAND</h4>
                <p className="text-xs text-[var(--text-secondary)]">Safely end this session</p>
              </div>
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="px-4 py-2 bg-[var(--danger-soft)] text-[var(--danger)] border border-[var(--danger)]/30 hover:opacity-90 font-bold rounded-xl text-xs flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      {isEditing && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setIsEditing(false)}
        >
          <div
            className="w-full max-w-lg ml-glass-elevated rounded-3xl shadow-2xl p-5 my-auto animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <h3 className="font-bold text-[var(--text-primary)] text-base">Edit MOTHERLAND Profile</h3>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="text-[var(--text-secondary)] block mb-1 font-semibold">Display Name</label>
                <input
                  type="text"
                  required
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] rounded-xl px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>

              <div>
                <label className="text-[var(--text-secondary)] block mb-1 font-semibold">Bio</label>
                <textarea
                  rows={3}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] rounded-xl p-3 text-[var(--text-primary)] resize-none focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[var(--text-secondary)] block mb-1 font-semibold">Location</label>
                  <input
                    type="text"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] rounded-xl px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>
                <div>
                  <label className="text-[var(--text-secondary)] block mb-1 font-semibold">Website</label>
                  <input
                    type="url"
                    value={editWebsite}
                    onChange={(e) => setEditWebsite(e.target.value)}
                    className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] rounded-xl px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[var(--text-secondary)] block mb-1 font-semibold">Work / Role</label>
                  <input
                    type="text"
                    value={editWork}
                    onChange={(e) => setEditWork(e.target.value)}
                    className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] rounded-xl px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>
                <div>
                  <label className="text-[var(--text-secondary)] block mb-1 font-semibold">Education</label>
                  <input
                    type="text"
                    value={editEducation}
                    onChange={(e) => setEditEducation(e.target.value)}
                    className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] rounded-xl px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[var(--text-secondary)] block mb-1 font-semibold">Avatar Image (Upload from Device or Paste URL)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editAvatar}
                    onChange={(e) => setEditAvatar(e.target.value)}
                    placeholder="https://... or upload from device"
                    className="flex-1 bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] rounded-xl px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                  <label className="px-3 py-2 rounded-xl bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] border border-[var(--accent-primary-border)] font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0">
                    {uploadingAvatar ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                    <span>{uploadingAvatar ? 'Uploading' : 'Upload'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploadingAvatar(true);
                        setEditError('');
                        try {
                          const up = await api.uploadMediaFile(file);
                          setEditAvatar(up.url);
                        } catch (err: any) {
                          setEditError(err?.message || 'Avatar upload failed');
                        } finally {
                          setUploadingAvatar(false);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="text-[var(--text-secondary)] block mb-1 font-semibold">Cover Image (Upload from Device or Paste URL)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editCover}
                    onChange={(e) => setEditCover(e.target.value)}
                    placeholder="https://... or upload from device"
                    className="flex-1 bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] rounded-xl px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                  <label className="px-3 py-2 rounded-xl bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] border border-[var(--accent-primary-border)] font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0">
                    {uploadingCover ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                    <span>{uploadingCover ? 'Uploading' : 'Upload'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploadingCover(true);
                        setEditError('');
                        try {
                          const up = await api.uploadMediaFile(file);
                          setEditCover(up.url);
                        } catch (err: any) {
                          setEditError(err?.message || 'Cover upload failed');
                        } finally {
                          setUploadingCover(false);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="text-[var(--text-secondary)] block mb-1 font-semibold">Profile Privacy</label>
                <select
                  value={editVisibility}
                  onChange={(e: any) => setEditVisibility(e.target.value)}
                  className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] rounded-xl px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                >
                  <option value="public">Public (Visible to everyone)</option>
                  <option value="friends">Friends Only</option>
                  <option value="private">Private (Only you)</option>
                </select>
              </div>

              {editError && (
                <p className="text-xs text-[var(--danger)] font-semibold">{editError}</p>
              )}

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="min-h-[42px] px-4 py-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="min-h-[42px] px-6 py-2 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-primary-contrast)] font-extrabold flex items-center gap-2"
                >
                  {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
