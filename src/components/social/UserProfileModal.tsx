import React, { useState } from 'react';
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
} from 'lucide-react';
import {
  CurrentUserProfile,
  SocialPost,
} from '../../types/social';
import {
  getStoredCurrentUser,
  getStoredPosts,
  saveCurrentUser,
} from '../../services/socialService';
import { SocialPostCard } from './SocialPostCard';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenImageLightbox: (url: string, alt?: string) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  onOpenImageLightbox,
}) => {
  const [profile, setProfile] = useState<CurrentUserProfile>(getStoredCurrentUser());
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(profile.name);
  const [editBio, setEditBio] = useState(profile.bio);
  const [editLocation, setEditLocation] = useState(profile.location);
  const [activeTab, setActiveTab] = useState<'posts' | 'saved'>('posts');

  if (!isOpen) return null;

  const allPosts = getStoredPosts();
  const ownPosts = allPosts.filter((p) => p.isOwnPost || p.author.handle === profile.handle);
  const savedPosts = allPosts.filter((p) => p.isSaved);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: CurrentUserProfile = {
      ...profile,
      name: editName.trim() || profile.name,
      bio: editBio.trim() || profile.bio,
      location: editLocation.trim() || profile.location,
    };
    saveCurrentUser(updated);
    setProfile(updated);
    setIsEditing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-[#0b101c] border border-white/10 rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-200">
        {/* Cover Photo */}
        <div className="relative h-36 sm:h-48 w-full bg-slate-900 overflow-hidden">
          <img
            src={profile.coverPhoto}
            alt="Cover"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b101c] via-transparent to-black/40" />

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
            <div className="relative">
              <img
                src={profile.avatar}
                alt={profile.name}
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover border-4 border-[#0b101c] shadow-xl"
              />
              <span className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-[#0b101c]" />
            </div>

            <button
              onClick={() => setIsEditing(!isEditing)}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors mb-2"
            >
              <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isEditing ? 'Cancel Edit' : 'Edit Profile'}</span>
            </button>
          </div>

          {/* Profile Name & Stats */}
          {!isEditing ? (
            <div className="mt-3">
              <div className="flex items-center gap-1.5">
                <h3 className="text-lg sm:text-xl font-extrabold text-white">{profile.name}</h3>
                {profile.isVerified && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 fill-emerald-400/20" />
                )}
              </div>
              <span className="text-xs text-slate-400 font-mono">{profile.handle}</span>

              <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
                {profile.bio}
              </p>

              <div className="mt-3 flex items-center gap-4 text-xs text-slate-400 flex-wrap">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{profile.location}</span>
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>{profile.joinDate}</span>
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                  <span>
                    <strong className="text-white font-mono">{profile.followersCount}</strong> Followers •{' '}
                    <strong className="text-white font-mono">{profile.followingCount}</strong> Following
                  </span>
                </span>
              </div>

              {/* Connected Google & YouTube Channel Status (Section 5.2 Requirement) */}
              <div className="mt-4 p-3.5 rounded-2xl bg-[#141d30] border border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-bold text-xs text-white">Google & YouTube Integration</span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30">
                    Active Identity
                  </span>
                </div>

                <p className="text-[11px] text-slate-300">
                  {profile.name} ({profile.handle})
                </p>

                <p className="text-[10px] text-slate-400">
                  Authenticated for MOTHERLAND multi-platform social feeds, creator uploads & community discussions.
                </p>
              </div>
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
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>Saved Posts ({savedPosts.length})</span>
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
                No saved posts yet. Tap &quot;Save&quot; on any post in the feed to store it here privately.
              </p>
            )
          )}
        </div>
      </div>
    </div>
  );
};
