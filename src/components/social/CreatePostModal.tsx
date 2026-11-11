import React, { useState, useRef } from 'react';
import {
  X,
  Image as ImageIcon,
  Video as VideoIcon,
  MapPin,
  Globe,
  Users,
  Lock,
  Sparkles,
  Loader2,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { createNewPost, getStoredCurrentUser } from '../../services/socialService';
import { PostMedia, PostPrivacy, SocialPost } from '../../types/social';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated: (post: SocialPost) => void;
  initialType?: 'text' | 'photo' | 'video';
}

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  isOpen,
  onClose,
  onPostCreated,
  initialType = 'text',
}) => {
  const currentUser = getStoredCurrentUser();
  const [content, setContent] = useState('');
  const [privacy, setPrivacy] = useState<PostPrivacy>('public');
  const [location, setLocation] = useState('');
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [mediaList, setMediaList] = useState<PostMedia[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setError(null);
    setUploadProgress(20);

    Array.from(files).forEach((file, index) => {
      const isVideo = file.type.startsWith('video/');
      const reader = new FileReader();

      reader.onload = (event) => {
        if (event.target?.result) {
          const newMedia: PostMedia = {
            id: `media_${Date.now()}_${index}`,
            type: isVideo ? 'video' : 'photo',
            url: event.target.result as string,
            alt: file.name,
            aspectRatio: isVideo ? '16:9' : '4:5',
          };
          setMediaList((prev) => [...prev, newMedia]);
        }
      };
      reader.readAsDataURL(file);
    });

    setTimeout(() => {
      setUploadProgress(100);
      setTimeout(() => setUploadProgress(null), 600);
    }, 400);
  };

  const handleRemoveMedia = (id: string) => {
    setMediaList((prev) => prev.filter((m) => m.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && mediaList.length === 0) {
      setError('Please enter some text or add a photo/video.');
      return;
    }

    setIsSubmitting(true);
    try {
      const post = createNewPost(
        content.trim(),
        mediaList,
        privacy,
        location.trim() || undefined
      );
      onPostCreated(post);
      onClose();
      setContent('');
      setMediaList([]);
      setLocation('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl bg-[#0e1423] border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl text-slate-200 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-base text-white">Create MOTHERLAND Post</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4 overflow-y-auto flex-1 pr-1">
          {/* User info & Privacy row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-10 h-10 rounded-full object-cover border border-emerald-500/40"
              />
              <div>
                <span className="font-bold text-sm text-white block leading-tight">
                  {currentUser.name}
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <select
                    value={privacy}
                    onChange={(e) => setPrivacy(e.target.value as PostPrivacy)}
                    className="bg-[#141d30] border border-white/10 rounded-lg px-2 py-0.5 text-[11px] text-slate-300 font-mono focus:outline-none"
                  >
                    <option value="public">🌐 Public</option>
                    <option value="friends">👥 Friends</option>
                    <option value="only_me">🔒 Only Me</option>
                  </select>
                </div>
              </div>
            </div>

            {location && (
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                <span>{location}</span>
              </span>
            )}
          </div>

          {/* Text Area */}
          <textarea
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's on your mind? Share news, photos, thoughts with MOTHERLAND..."
            className="w-full p-3.5 rounded-2xl bg-[#090d16] border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500/50 resize-none leading-relaxed"
            autoFocus
          />

          {/* Upload Progress Bar if active */}
          {uploadProgress !== null && (
            <div className="w-full bg-[#141b2c] rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}

          {/* Selected Media Previews (Photo grid / Video) */}
          {mediaList.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Selected Media ({mediaList.length})</span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add More</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto p-1 bg-[#090d16] rounded-2xl border border-white/5">
                {mediaList.map((m) => (
                  <div key={m.id} className="relative aspect-square rounded-xl overflow-hidden bg-black border border-white/10 group">
                    {m.type === 'video' ? (
                      <video src={m.url} className="w-full h-full object-cover" />
                    ) : (
                      <img src={m.url} alt="Post attachment" className="w-full h-full object-cover" />
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveMedia(m.id)}
                      className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/80 hover:bg-red-600 text-white transition-colors"
                      title="Remove"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Location input row if toggled */}
          {showLocationInput && (
            <div className="flex items-center gap-2 p-2 rounded-xl bg-[#131b2e] border border-white/10">
              <MapPin className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Where are you? (e.g. Dhaka, Cox's Bazar, Sylhet)"
                className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  setLocation('');
                  setShowLocationInput(false);
                }}
                className="text-slate-400 hover:text-white text-xs"
              >
                Clear
              </button>
            </div>
          )}

          {/* Quick Attachment Triggers Bar */}
          <div className="p-3 rounded-2xl bg-[#111828] border border-white/10 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">Add to your post:</span>

            <div className="flex items-center gap-1">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={handleFileChange}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors flex items-center gap-1.5 text-xs font-medium"
                title="Select photos or videos from device"
              >
                <ImageIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Photo/Video</span>
              </button>

              <button
                type="button"
                onClick={() => setShowLocationInput(!showLocationInput)}
                className="p-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-colors flex items-center gap-1.5 text-xs font-medium"
                title="Add location"
              >
                <MapPin className="w-4 h-4" />
                <span className="hidden sm:inline">Location</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-white/5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (!content.trim() && mediaList.length === 0)}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-900/40 transition-all active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Publishing...</span>
                </>
              ) : (
                <span>Post to Motherland</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
