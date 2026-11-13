import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Plus,
  Image as ImageIcon,
  Film,
  Flame,
  Sparkles,
  Globe,
  Users,
  Lock,
  Loader2,
  Upload,
  Trash2,
  ArrowLeft,
  Camera,
  Save,
} from 'lucide-react';
import { api } from '../api';
import type { DraftPost, UserProfile } from '../types';
import { useBackHandler } from '../hooks/useBackNavigation';
import { FireEmojiPicker } from './fire/FireEmojiPicker';
import { FireDraftPreview, FirePickerTrigger } from './fire/FireComposerBar';

export type CreateEntryMode = 'menu' | 'post' | 'story' | 'short';

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  initialMode?: CreateEntryMode;
  onOpenVideoPublish: () => void;
  onPostCreated: () => void;
  onStoryCreated: () => void;
  onShortCreated: () => void;
}

export const CreateModal: React.FC<CreateModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  initialMode = 'menu',
  onOpenVideoPublish,
  onPostCreated,
  onStoryCreated,
  onShortCreated,
}) => {
  const [mode, setMode] = useState<CreateEntryMode>(initialMode);
  const [caption, setCaption] = useState('');
  const [shortTitle, setShortTitle] = useState('');
  const [hashtagsInput, setHashtagsInput] = useState('');
  const [audience, setAudience] = useState<'public' | 'friends' | 'only_me'>('public');

  // Device file attachments
  const [photoFiles, setPhotoFiles] = useState<{ file: File; preview: string }[]>([]);
  const [singleMediaFile, setSingleMediaFile] = useState<{ file: File; preview: string; isVideo: boolean } | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [drafts, setDrafts] = useState<DraftPost[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | undefined>(undefined);
  const [draftSavedNotice, setDraftSavedNotice] = useState('');
  const [firePickerOpen, setFirePickerOpen] = useState(false);

  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const storyInputRef = useRef<HTMLInputElement | null>(null);
  const shortInputRef = useRef<HTMLInputElement | null>(null);
  const [dragY, setDragY] = useState(0);
  const dragStartYRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setErrorMsg('');
      setUploadProgress(0);
      setDragY(0);
      setDraftSavedNotice('');
      api
        .getDrafts()
        .then((res) => setDrafts(res.drafts || []))
        .catch(() => {});
    }
  }, [isOpen, initialMode]);

  const resetForm = () => {
    setCaption('');
    setShortTitle('');
    setHashtagsInput('');
    photoFiles.forEach((p) => URL.revokeObjectURL(p.preview));
    setPhotoFiles([]);
    if (singleMediaFile) URL.revokeObjectURL(singleMediaFile.preview);
    setSingleMediaFile(null);
    setUploadProgress(0);
    setErrorMsg('');
    setActiveDraftId(undefined);
    setDraftSavedNotice('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  useBackHandler(
    'create-modal',
    isOpen,
    () => {
      if (mode !== 'menu') {
        resetForm();
        setMode('menu');
      } else {
        handleClose();
      }
    },
    65
  );

  if (!isOpen) return null;

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
      handleClose();
      return;
    }
    setDragY(0);
    dragStartYRef.current = null;
  };

  const handlePhotosPicked = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const next: { file: File; preview: string }[] = [];
    for (let i = 0; i < Math.min(files.length, 6 - photoFiles.length); i++) {
      const f = files[i];
      next.push({ file: f, preview: URL.createObjectURL(f) });
    }
    setPhotoFiles((prev) => [...prev, ...next]);
    setErrorMsg('');
  };

  const handleSingleFilePicked = (file?: File) => {
    if (!file) return;
    if (singleMediaFile) URL.revokeObjectURL(singleMediaFile.preview);
    setSingleMediaFile({
      file,
      preview: URL.createObjectURL(file),
      isVideo: file.type.startsWith('video/'),
    });
    setErrorMsg('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    const tags = hashtagsInput
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter(Boolean);

    try {
      if (mode === 'story') {
        if (!singleMediaFile) {
          setErrorMsg('Please select a photo or video from your device for your story.');
          setIsSubmitting(false);
          return;
        }
        const uploaded = await api.uploadMediaFile(singleMediaFile.file, setUploadProgress);
        await api.createStory({
          mediaUrl: uploaded.url,
          mediaType: singleMediaFile.isVideo ? 'video' : 'image',
          caption: caption.trim(),
        });
        onStoryCreated();
        handleClose();
        return;
      }

      if (mode === 'short') {
        if (!singleMediaFile || !singleMediaFile.isVideo) {
          setErrorMsg('Please select a vertical video clip from your device.');
          setIsSubmitting(false);
          return;
        }
        const uploaded = await api.uploadMediaFile(singleMediaFile.file, setUploadProgress);
        await api.createShort({
          videoUrl: uploaded.url,
          title: shortTitle.trim() || caption.trim() || 'MOTHERLAND Short',
          caption: caption.trim(),
          hashtags: tags,
        });
        onShortCreated();
        handleClose();
        return;
      }

      // Create Post (text and/or multi-image)
      if (!caption.trim() && photoFiles.length === 0) {
        setErrorMsg('Write something or attach at least one photo.');
        setIsSubmitting(false);
        return;
      }

      const uploadedUrls: string[] = [];
      for (let i = 0; i < photoFiles.length; i++) {
        const res = await api.uploadMediaFile(photoFiles[i].file, (p) => {
          setUploadProgress(Math.round(((i + p / 100) / photoFiles.length) * 100));
        });
        uploadedUrls.push(res.url);
      }

      await api.createPost({
        content: caption.trim(),
        mediaType: uploadedUrls.length > 0 ? 'image' : 'none',
        mediaUrl: uploadedUrls[0],
        images: uploadedUrls.length > 0 ? uploadedUrls : undefined,
        hashtags: tags,
        audience,
        platforms: ['motherland'],
      });

      if (activeDraftId) {
        api.deleteDraft(activeDraftId).catch(() => {});
      }

      onPostCreated();
      handleClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to publish right now.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[92dvh] flex flex-col transition-transform"
        style={{ transform: dragY > 0 ? `translateY(${dragY}px)` : undefined }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle + Modal Header */}
        <div
          className="pt-2 px-4 pb-3 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] touch-none"
          onTouchStart={handleHeaderTouchStart}
          onTouchMove={handleHeaderTouchMove}
          onTouchEnd={handleHeaderTouchEnd}
        >
          <div className="w-10 h-1 rounded-full bg-[var(--border-strong)] mx-auto mb-2.5 sm:hidden" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {mode !== 'menu' && (
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setMode('menu');
                  }}
                  className="w-10 h-10 rounded-xl bg-[var(--bg-surface-alt)] flex items-center justify-center text-[var(--text-primary)]"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <div>
                <h3 className="font-bold text-sm sm:text-base text-[var(--text-primary)]">
                  {mode === 'menu'
                    ? 'Create on MOTHERLAND'
                    : mode === 'post'
                    ? 'Create Post'
                    : mode === 'story'
                    ? 'Add Story'
                    : 'Create Short'}
                </h3>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  {mode === 'menu'
                    ? 'Choose what you want to share'
                    : 'Publishes directly to your MOTHERLAND account'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="w-10 h-10 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)] flex items-center justify-center"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {mode === 'menu' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* 1. Create Post */}
              <button
                type="button"
                onClick={() => setMode('post')}
                className="p-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface-alt)] hover:border-[var(--accent-primary)] text-left flex items-start gap-3 transition-colors min-h-[78px]"
              >
                <div className="w-10 h-10 rounded-xl bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] flex items-center justify-center flex-shrink-0">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-sm text-[var(--text-primary)] block">Create Post</span>
                  <span className="text-[11px] text-[var(--text-secondary)]">
                    Text, single or multiple photos
                  </span>
                </div>
              </button>

              {/* 2. Add Story */}
              <button
                type="button"
                onClick={() => setMode('story')}
                className="p-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface-alt)] hover:border-[var(--accent-gold)] text-left flex items-start gap-3 transition-colors min-h-[78px]"
              >
                <div className="w-10 h-10 rounded-xl bg-[var(--accent-gold-soft)] text-[var(--accent-gold)] flex items-center justify-center flex-shrink-0">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-sm text-[var(--text-primary)] block">Add Story</span>
                  <span className="text-[11px] text-[var(--text-secondary)]">
                    24-hour photo or clip update
                  </span>
                </div>
              </button>

              {/* 3. Upload Video -> Opens Dual Video Publishing System */}
              <button
                type="button"
                onClick={() => {
                  handleClose();
                  onOpenVideoPublish();
                }}
                className="p-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface-alt)] hover:border-[#FF0000] text-left flex items-start gap-3 transition-colors min-h-[78px]"
              >
                <div className="w-10 h-10 rounded-xl bg-[#FF0000]/12 text-[#FF0000] flex items-center justify-center flex-shrink-0">
                  <Film className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-sm text-[var(--text-primary)] block">Upload Video</span>
                  <span className="text-[11px] text-[var(--text-secondary)]">
                    Publish to MOTHERLAND or YouTube
                  </span>
                </div>
              </button>

              {/* 4. Create Short */}
              <button
                type="button"
                onClick={() => setMode('short')}
                className="p-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface-alt)] hover:border-[var(--accent-gold)] text-left flex items-start gap-3 transition-colors min-h-[78px]"
              >
                <div className="w-10 h-10 rounded-xl bg-[var(--accent-gold-soft)] text-[var(--accent-gold)] flex items-center justify-center flex-shrink-0">
                  <Flame className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-sm text-[var(--text-primary)] block">Create Short</span>
                  <span className="text-[11px] text-[var(--text-secondary)]">
                    9:16 vertical short-form reel
                  </span>
                </div>
              </button>

              {/* Saved Drafts Resume List */}
              {drafts.length > 0 && (
                <div className="col-span-1 sm:col-span-2 pt-3 border-t border-[var(--border-subtle)] space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                    Saved Drafts ({drafts.length})
                  </p>
                  <div className="space-y-1.5 max-h-44 overflow-y-auto">
                    {drafts.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)]"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setActiveDraftId(d.id);
                            setMode(d.mode || 'post');
                            setCaption(d.content || '');
                            setShortTitle(d.shortTitle || '');
                            setHashtagsInput((d.hashtags || []).join(', '));
                            setAudience(d.audience || 'public');
                          }}
                          className="flex-1 min-w-0 text-left cursor-pointer"
                        >
                          <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                            {d.content || d.shortTitle || 'Untitled draft'}
                          </p>
                          <p className="text-[10px] text-[var(--text-muted)] capitalize">
                            {d.mode} draft · Updated {new Date(d.updatedAt).toLocaleDateString()}
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await api.deleteDraft(d.id).catch(() => {});
                            setDrafts((prev) => prev.filter((item) => item.id !== d.id));
                          }}
                          aria-label="Delete draft"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--danger)] hover:bg-[var(--danger-soft)] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Author & Audience */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.displayName}
                    className="w-9 h-9 rounded-xl object-cover border border-[var(--border-subtle)]"
                  />
                  <div>
                    <span className="font-bold text-xs text-[var(--text-primary)] block">
                      {currentUser.displayName}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)]">@{currentUser.username}</span>
                  </div>
                </div>

                {mode === 'post' && (
                  <div className="flex items-center gap-1 bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] rounded-xl p-1 text-xs">
                    {[
                      { id: 'public', label: 'Public', icon: Globe },
                      { id: 'friends', label: 'Friends', icon: Users },
                      { id: 'only_me', label: 'Only Me', icon: Lock },
                    ].map((opt) => {
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setAudience(opt.id as any)}
                          className={`px-2 py-1 rounded-lg flex items-center gap-1 text-[10px] font-semibold ${
                            audience === opt.id
                              ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)]'
                              : 'text-[var(--text-secondary)]'
                          }`}
                        >
                          <Icon className="w-3 h-3" />
                          <span>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {mode === 'short' && (
                <div>
                  <label className="text-xs font-semibold text-[var(--text-secondary)] block mb-1">
                    Short Title
                  </label>
                  <input
                    type="text"
                    required
                    value={shortTitle}
                    onChange={(e) => setShortTitle(e.target.value)}
                    placeholder="Title your Short..."
                    className="w-full rounded-xl px-3 py-2.5 text-xs bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>
              )}

              <div className="space-y-2">
                <div className="relative">
                  <textarea
                    rows={3}
                    placeholder={
                      mode === 'story'
                        ? 'Add a caption to your story...'
                        : mode === 'short'
                        ? 'Write a short description...'
                        : `What's on your mind, ${currentUser.displayName.split(' ')[0]}?`
                    }
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    className="w-full rounded-xl p-3 pr-12 text-xs sm:text-sm bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] resize-none"
                  />
                  <div className="absolute right-2.5 bottom-2.5">
                    <FirePickerTrigger
                      size="sm"
                      active={firePickerOpen}
                      onClick={() => setFirePickerOpen(true)}
                      title="Insert Fire Emoji"
                    />
                  </div>
                </div>
                <FireDraftPreview value={caption} />
              </div>

              {/* Multi-Photo Uploader for Posts */}
              {mode === 'post' && (
                <div className="space-y-2">
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handlePhotosPicked(e.target.files)}
                  />
                  {photoFiles.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {photoFiles.map((item, idx) => (
                        <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-[var(--border-subtle)]">
                          <img src={item.preview} alt="Selected" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => {
                              URL.revokeObjectURL(item.preview);
                              setPhotoFiles((prev) => prev.filter((_, i) => i !== idx));
                            }}
                            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="min-h-[42px] px-3.5 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-alt)] hover:border-[var(--accent-primary)] text-xs font-semibold text-[var(--text-primary)] flex items-center gap-2"
                    >
                      <ImageIcon className="w-4 h-4 text-[var(--accent-primary)]" />
                      <span>Add Photos ({photoFiles.length}/6)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleClose();
                        onOpenVideoPublish();
                      }}
                      className="min-h-[42px] px-3.5 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-alt)] hover:border-[#FF0000] text-xs font-semibold text-[var(--text-primary)] flex items-center gap-2"
                    >
                      <Film className="w-4 h-4 text-[#FF0000]" />
                      <span>Upload Video Instead</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Story or Short Single Media Picker */}
              {(mode === 'story' || mode === 'short') && (
                <div>
                  <input
                    ref={mode === 'story' ? storyInputRef : shortInputRef}
                    type="file"
                    accept={mode === 'story' ? 'image/*,video/*' : 'video/*'}
                    className="hidden"
                    onChange={(e) => handleSingleFilePicked(e.target.files?.[0])}
                  />
                  {singleMediaFile ? (
                    <div className="relative rounded-2xl overflow-hidden border border-[var(--border-subtle)] bg-black">
                      {singleMediaFile.isVideo ? (
                        <video src={singleMediaFile.preview} controls playsInline className="w-full max-h-60 object-contain" />
                      ) : (
                        <img src={singleMediaFile.preview} alt="Preview" className="w-full max-h-60 object-contain" />
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          URL.revokeObjectURL(singleMediaFile.preview);
                          setSingleMediaFile(null);
                        }}
                        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/70 text-white flex items-center justify-center"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => (mode === 'story' ? storyInputRef.current?.click() : shortInputRef.current?.click())}
                      className="w-full py-7 px-4 rounded-2xl border-2 border-dashed border-[var(--border-strong)] hover:border-[var(--accent-primary)] bg-[var(--bg-surface-alt)] flex flex-col items-center justify-center gap-2 text-[var(--text-primary)]"
                    >
                      <Upload className="w-6 h-6 text-[var(--accent-primary)]" />
                      <span className="text-xs font-bold">
                        {mode === 'story' ? 'Select photo or video from device' : 'Select vertical video clip'}
                      </span>
                    </button>
                  )}
                </div>
              )}

              {mode !== 'story' && (
                <input
                  type="text"
                  placeholder="Hashtags (comma-separated, e.g. Motherland, Dhaka)"
                  value={hashtagsInput}
                  onChange={(e) => setHashtagsInput(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-xs bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
                />
              )}

              {errorMsg && (
                <p className="text-xs text-[var(--danger)] font-medium">{errorMsg}</p>
              )}

              {isSubmitting && uploadProgress > 0 && uploadProgress < 100 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-semibold text-[var(--accent-primary)]">
                    <span>Uploading media...</span>
                    <span className="tabular-nums">{uploadProgress}%</span>
                  </div>
                  <div className="h-1.5 bg-[var(--bg-surface-alt)] rounded-full overflow-hidden">
                    <div className="h-full bg-[var(--accent-primary)]" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              )}

              {draftSavedNotice && (
                <p className="text-xs text-[var(--accent-primary)] font-semibold">{draftSavedNotice}</p>
              )}

              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={async () => {
                    const tags = hashtagsInput
                      .split(',')
                      .map((t) => t.trim().replace(/^#/, ''))
                      .filter(Boolean);
                    const saved = await api.saveDraft({
                      id: activeDraftId,
                      mode,
                      content: caption,
                      shortTitle,
                      hashtags: tags,
                      audience,
                    });
                    setActiveDraftId(saved.draft.id);
                    setDrafts((prev) => [saved.draft, ...prev.filter((d) => d.id !== saved.draft.id)]);
                    setDraftSavedNotice('Draft saved to your account.');
                  }}
                  disabled={!caption.trim() && !shortTitle.trim()}
                  className="min-h-[42px] px-3.5 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-alt)] text-xs font-semibold text-[var(--text-primary)] inline-flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span>Save Draft</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="min-h-[42px] px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="min-h-[42px] px-5 py-2 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] disabled:opacity-40 text-[var(--accent-primary-contrast)] font-bold text-xs flex items-center gap-2"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    <span>Publish</span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>

      <FireEmojiPicker
        isOpen={firePickerOpen}
        onClose={() => setFirePickerOpen(false)}
        onSelect={(emoji) => {
          setCaption((prev) => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}${emoji.token} `);
        }}
      />
    </div>
  );
};
