import React, { useState, useRef } from 'react';
import { X, Image, Video, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { createNewStory } from '../../services/socialService';
import { SocialStory } from '../../types/social';
import { FireEmojiPicker } from '../fire/FireEmojiPicker';
import { FireDraftPreview, FirePickerTrigger } from '../fire/FireComposerBar';

interface CreateStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStoryCreated: (story: SocialStory) => void;
}

export const CreateStoryModal: React.FC<CreateStoryModalProps> = ({
  isOpen,
  onClose,
  onStoryCreated,
}) => {
  const [mediaUrl, setMediaUrl] = useState<string>('');
  const [mediaType, setMediaType] = useState<'photo' | 'video'>('photo');
  const [caption, setCaption] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firePickerOpen, setFirePickerOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    const isVid = file.type.startsWith('video/');
    setMediaType(isVid ? 'video' : 'photo');

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setMediaUrl(event.target.result as string);
      }
    };
    reader.onerror = () => {
      setError('Failed to read media file from device gallery.');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mediaUrl) {
      setError('Please select a photo or video for your story.');
      return;
    }

    setIsSubmitting(true);
    try {
      const story = await createNewStory({
        mediaUrl,
        type: mediaType,
        caption: caption.trim() || undefined,
      });
      onStoryCreated(story);
      onClose();
      setMediaUrl('');
      setCaption('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePresetPhoto = (url: string) => {
    setMediaUrl(url);
    setMediaType('photo');
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-[#0e1423] border border-white/10 rounded-3xl p-6 shadow-2xl text-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-base text-white">Create MOTHERLAND Story</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* File Picker Affordance */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleFileChange}
            className="hidden"
          />

          {!mediaUrl ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full aspect-[4/3] rounded-2xl border-2 border-dashed border-white/15 hover:border-emerald-500/50 bg-[#090d16] flex flex-col items-center justify-center cursor-pointer p-6 text-center transition-all group"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Image className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-sm text-white">Select Photo or Video from Device</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Supports real gallery photos and short video clips for your 24-hour Story.
              </p>
            </div>
          ) : (
            <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-black border border-white/10 flex items-center justify-center">
              {mediaType === 'video' ? (
                <video src={mediaUrl} controls autoPlay className="w-full h-full object-contain" />
              ) : (
                <img src={mediaUrl} alt="Preview" className="w-full h-full object-contain" />
              )}
              <button
                type="button"
                onClick={() => setMediaUrl('')}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white hover:bg-black"
                title="Change media"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Quick presets if user doesn't have local media */}
          {!mediaUrl && (
            <div>
              <span className="text-[11px] font-mono text-slate-400 block mb-1">
                Or quick test with Bangladesh photography:
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handlePresetPhoto(
                      'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800&auto=format&fit=crop&q=80'
                    )
                  }
                  className="flex-1 py-1 px-2 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-slate-300 truncate"
                >
                  🌿 Sundarbans Dawn
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handlePresetPhoto(
                      'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=800&auto=format&fit=crop&q=80'
                    )
                  }
                  className="flex-1 py-1 px-2 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-slate-300 truncate"
                >
                  🇧🇩 Sangsad Bhaban
                </button>
              </div>
            </div>
          )}

          {/* Caption input */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Story Text Caption / Description
            </label>
            <div className="flex items-center gap-2">
              <FirePickerTrigger
                onClick={() => setFirePickerOpen(true)}
                active={firePickerOpen}
                title="Insert MOTHERLAND Fire Emoji"
              />
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Add a caption to your story..."
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#090d16] border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <FireDraftPreview value={caption} />
          </div>

          <FireEmojiPicker
            isOpen={firePickerOpen}
            onClose={() => setFirePickerOpen(false)}
            onSelect={(emoji) => {
              setCaption((prev) => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}${emoji.token} `);
            }}
          />

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-slate-500">Visible to community for 24h</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !mediaUrl}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-emerald-900/40"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Publishing...</span>
                  </>
                ) : (
                  <span>Publish Story</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
