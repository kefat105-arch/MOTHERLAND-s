import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Edit3,
  MapPin,
  Calendar,
  Users,
  CheckCircle2,
  Sparkles,
  Camera,
  Bookmark,
  Grid,
  LogOut,
  Shield,
  Upload,
  Globe,
  LogIn,
} from 'lucide-react';
import {
  CurrentUserProfile,
  SocialPost,
} from '../../types/social';
import {
  getStoredCurrentUser,
  getStoredPosts,
  saveStoredCurrentUser,
  updateUserProfileApi,
  claimOwnerApi,
  logoutUser,
  uploadMediaFile,
} from '../../services/socialService';
import { SocialPostCard } from './SocialPostCard';
import { FireRichText } from '../fire/FireRichText';
import { VaultIcon } from '../fire/MotherlandIcons';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenImageLightbox: (url: string, alt?: string) => void;
  onLogout?: () => void;
  onOpenAuth?: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  onOpenImageLightbox,
  onLogout,
  onOpenAuth,
}) => {
  const [profile, setProfile] = useState<CurrentUserProfile | null>(getStoredCurrentUser());
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(profile?.name || '');
  const [editBio, setEditBio] = useState(profile?.bio || '');
  const [editLocation, setEditLocation] = useState(profile?.location || '');
  const [editWebsite, setEditWebsite] = useState(profile?.website || '');
  const [activeTab, setActiveTab] = useState<'posts' | 'saved'>('posts');
  const [ownerKeyInput, setOwnerKeyInput] = useState('');
  const [showOwnerClaim, setShowOwnerClaim] = useState(false);
  const [claimStatus, setClaimStatus] = useState<string | null>(null);

  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      const latest = getStoredCurrentUser();
      setProfile(latest);
      if (latest) {
        setEditName(latest.name || '');
        setEditBio(latest.bio || '');
        setEditLocation(latest.location || '');
        setEditWebsite(latest.website || '');
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  if (!profile) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
        <div className="relative w-full max-w-md bg-[#0b101c] border border-white/10 rounded-3xl p-6 shadow-2xl text-center space-y-4">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-white/5 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <LogIn className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-extrabold text-white">Sign in to MOTHERLAND</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Create your individual MOTHERLAND account or sign in to customize your profile, upload photos, manage your posts, and claim verified badges.
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold"
            >
              Close
            </button>
            {onOpenAuth && (
              <button
                onClick={() => {
                  onClose();
                  onOpenAuth();
                }}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg"
              >
                Sign In / Create Account
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const allPosts = getStoredPosts();
  const ownPosts = allPosts.filter((p) => p.isOwnPost || p.author.handle === profile.handle);
  const savedPosts = allPosts.filter((p) => p.isSaved);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = await updateUserProfileApi(profile.id, {
        name: editName.trim() || profile.name,
        bio: editBio.trim() || profile.bio,
        location: editLocation.trim() || profile.location,
        website: editWebsite.trim() || undefined,
      });
      setProfile(updated);
      setIsEditing(false);
    } catch {
      // Fallback local save
      const updatedLocal: CurrentUserProfile = {
        ...profile,
        name: editName.trim() || profile.name,
        bio: editBio.trim() || profile.bio,
        location: editLocation.trim() || profile.location,
      };
      saveStoredCurrentUser(updatedLocal);
      setProfile(updatedLocal);
      setIsEditing(false);
    }
  };

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadMediaFile(file);
      const updated = await updateUserProfileApi(profile.id, { avatar: url });
      setProfile(updated);
    } catch (err) {
      console.warn('Avatar upload failed:', err);
    }
  };

  const handleCoverFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadMediaFile(file);
      const updated = await updateUserProfileApi(profile.id, { coverPhoto: url });
      setProfile(updated);
    } catch (err) {
      console.warn('Cover upload failed:', err);
    }
  };

  const handleClaimOwner = async () => {
    if (!ownerKeyInput.trim()) return;
    try {
      const res = await claimOwnerApi(ownerKeyInput.trim());
      if (res.success) {
        setClaimStatus('Owner privileges granted! 🇧🇩');
        setProfile((prev) => (prev ? { ...prev, isOwner: true, isVerified: true } : prev));
      }
    } catch (err: any) {
      setClaimStatus(err.message || 'Claim failed');
    }
  };

  const handleDoLogout = async () => {
    await logoutUser();
    if (onLogout) onLogout();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-[#0b101c] border border-white/10 rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-200">
        {/* Hidden File Inputs for Cover and Avatar */}
        <input
          type="file"
          ref={coverInputRef}
          onChange={handleCoverFile}
          accept="image/*"
          className="hidden"
        />
        <input
          type="file"
          ref={avatarInputRef}
          onChange={handleAvatarFile}
          accept="image/*"
          className="hidden"
        />

        {/* Cover Photo */}
        <div className="relative h-36 sm:h-48 w-full bg-slate-900 overflow-hidden group/cover">
          <img
            src={profile.coverPhoto}
            alt="Cover"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b101c] via-transparent to-black/40" />

          {/* Change Cover Button */}
          <button
            onClick={() => coverInputRef.current?.click()}
            className="absolute bottom-3 right-3 px-2.5 py-1.5 rounded-xl bg-black/60 hover:bg-black/80 text-white text-xs font-semibold flex items-center gap-1.5 backdrop-blur-xs border border-white/20 transition-all"
            title="Upload New Cover Photo"
          >
            <Camera className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Change Cover</span>
          </button>

          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 text-white hover:bg-black transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Profile Info Header */}
        <div className="px-5 sm:px-6 pb-4 border-b border-white/5 relative -mt-14 sm:-mt-16">
          <div className="flex items-end justify-between gap-3">
            <div className="relative group/avatar">
              <img
                src={profile.avatar}
                alt={profile.name}
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover border-4 border-[#0b101c] shadow-xl"
              />
              <button
                onClick={() => avatarInputRef.current?.click()}
                className="absolute bottom-0 right-0 p-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white border-2 border-[#0b101c] shadow-md transition-transform active:scale-95"
                title="Change Avatar"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isEditing ? 'Cancel' : 'Edit Profile'}</span>
              </button>

              <button
                onClick={handleDoLogout}
                className="px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="Sign Out of MOTHERLAND"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>

          {/* Profile Name & Stats */}
          {!isEditing ? (
            <div className="mt-3">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg sm:text-xl font-extrabold text-white">{profile.name}</h3>
                {profile.isVerified && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 fill-emerald-400/20" />
                )}
                {profile.isOwner && (
                  <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/30 to-amber-600/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold flex items-center gap-1">
                    <Shield className="w-3 h-3 text-amber-400" />
                    <span>Founder / Owner</span>
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-400 font-mono">{profile.handle}</span>

              <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
                <FireRichText text={profile.bio || 'Citizen of MOTHERLAND.'} emojiSize="sm" />
              </p>

              <div className="mt-3 flex items-center gap-4 text-xs text-slate-400 flex-wrap">
                {profile.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{profile.location}</span>
                  </span>
                )}
                {profile.website && (
                  <span className="flex items-center gap-1 text-cyan-400">
                    <Globe className="w-3.5 h-3.5" />
                    <a href={profile.website} target="_blank" rel="noreferrer" className="hover:underline">
                      {profile.website}
                    </a>
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>{profile.joinDate}</span>
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                  <span>
                    <strong className="text-white font-mono">{profile.friendsCount || 0}</strong> Friends •{' '}
                    <strong className="text-white font-mono">{profile.followersCount}</strong> Supporters
                  </span>
                </span>
              </div>

              {/* Owner Claim Accordion */}
              {!profile.isOwner && (
                <div className="mt-3 pt-3 border-t border-white/5">
                  {!showOwnerClaim ? (
                    <button
                      onClick={() => setShowOwnerClaim(true)}
                      className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1"
                    >
                      <Shield className="w-3.5 h-3.5" />
                      <span>Are you the platform founder? Claim Owner Account</span>
                    </button>
                  ) : (
                    <div className="p-3 rounded-2xl bg-amber-950/20 border border-amber-500/30 space-y-2">
                      <p className="text-[11px] text-amber-200">
                        Enter founder administration key to claim official Owner badge for this account:
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={ownerKeyInput}
                          onChange={(e) => setOwnerKeyInput(e.target.value)}
                          placeholder="Administration Passkey"
                          className="flex-1 px-3 py-1.5 rounded-xl bg-black border border-white/10 text-white text-xs"
                        />
                        <button
                          onClick={handleClaimOwner}
                          className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold"
                        >
                          Claim
                        </button>
                      </div>
                      {claimStatus && (
                        <p className="text-[10px] text-amber-300 font-mono">{claimStatus}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Inline Edit Form */
            <form onSubmit={handleSaveProfile} className="mt-3 space-y-3 p-3 bg-[#131b2e] rounded-2xl border border-white/5">
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-[#090d16] border border-white/10 text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">Bio</label>
                <textarea
                  rows={2}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-[#090d16] border border-white/10 text-white text-xs resize-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">Location</label>
                <input
                  type="text"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-[#090d16] border border-white/10 text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">Website URL</label>
                <input
                  type="url"
                  value={editWebsite}
                  onChange={(e) => setEditWebsite(e.target.value)}
                  placeholder="https://yourwebsite.com"
                  className="w-full px-3 py-1.5 rounded-xl bg-[#090d16] border border-white/10 text-white text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 rounded-lg bg-white/5 text-xs text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                >
                  Save Profile
                </button>
              </div>
            </form>
          )}

          {/* Profile Tabs */}
          <div className="mt-4 flex border-b border-white/5 gap-4 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('posts')}
              className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition-colors ${
                activeTab === 'posts'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Your Posts ({ownPosts.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('saved')}
              className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition-colors ${
                activeTab === 'saved'
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <VaultIcon className="w-3.5 h-3.5" active={activeTab === 'saved'} />
              <span>Vault ({savedPosts.length})</span>
            </button>
          </div>
        </div>

        {/* Content Stream in Profile */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'posts' && (
            ownPosts.length > 0 ? (
              ownPosts.map((p) => (
                <SocialPostCard
                  key={p.id}
                  post={p}
                  onOpenImageLightbox={onOpenImageLightbox}
                />
              ))
            ) : (
              <p className="text-xs text-slate-400 italic text-center py-8">
                You haven&apos;t published any posts yet. Use the Create Post composer on the home feed!
              </p>
            )
          )}

          {activeTab === 'saved' && (
            savedPosts.length > 0 ? (
              savedPosts.map((p) => (
                <SocialPostCard
                  key={p.id}
                  post={p}
                  onOpenImageLightbox={onOpenImageLightbox}
                />
              ))
            ) : (
              <p className="text-xs text-slate-400 italic text-center py-8">
                No vaulted posts yet. Tap &quot;Vault&quot; on any post in the feed to store it here privately.
              </p>
            )
          )}
        </div>
      </div>
    </div>
  );
};
