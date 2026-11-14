import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ArrowLeft,
  Shield,
  Youtube,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Globe,
  Users,
  Lock,
  EyeOff,
  ExternalLink,
  RefreshCw,
  LogOut,
  Image as ImageIcon,
  Film,
  Copy,
  Check,
} from 'lucide-react';
import { api } from '../api';
import { useBackHandler } from '../hooks/useBackNavigation';
import type { UserProfile, YouTubeOAuthStatus, YouTubeUploadResult } from '../types';
import { getStoredGoogleAuth, type GoogleAuthUser } from '../services/youtubeAuthService';
import { YouTubeAccountModal } from './video/YouTubeAccountModal';

interface VideoPublishFlowProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  initialDestination?: 'select' | 'motherland' | 'youtube';
  onMotherlandVideoCreated: () => void;
  onMotherlandPostCreated?: () => void;
  onYouTubeConnectionChanged?: () => void;
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatSeconds(sec: number): string {
  if (!isFinite(sec) || sec <= 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export const VideoPublishFlow: React.FC<VideoPublishFlowProps> = ({
  isOpen,
  onClose,
  currentUser,
  initialDestination = 'select',
  onMotherlandVideoCreated,
  onMotherlandPostCreated,
  onYouTubeConnectionChanged,
}) => {
  const [step, setStep] = useState<'select' | 'motherland' | 'youtube'>(initialDestination);

  // MOTHERLAND Upload State
  const [mlVideoFile, setMlVideoFile] = useState<File | null>(null);
  const [mlPreviewUrl, setMlPreviewUrl] = useState('');
  const [mlDuration, setMlDuration] = useState('0:00');
  const [mlThumbFile, setMlThumbFile] = useState<File | null>(null);
  const [mlThumbPreview, setMlThumbPreview] = useState('');
  const [mlTitle, setMlTitle] = useState('');
  const [mlDescription, setMlDescription] = useState('');
  const [mlTags, setMlTags] = useState('');
  const [mlAudience, setMlAudience] = useState<'public' | 'friends' | 'only_me'>('public');
  const [mlFormat, setMlFormat] = useState<'long' | 'post'>('long');
  const [mlUploading, setMlUploading] = useState(false);
  const [mlProgress, setMlProgress] = useState(0);
  const [mlError, setMlError] = useState('');
  const [mlSuccess, setMlSuccess] = useState(false);

  // YouTube OAuth & Upload State
  const [ytStatus, setYtStatus] = useState<YouTubeOAuthStatus | null>(null);
  const [ytStatusLoading, setYtStatusLoading] = useState(false);
  const [ytOAuthError, setYtOAuthError] = useState('');
  const [ytConnecting, setYtConnecting] = useState(false);
  const [copiedCallback, setCopiedCallback] = useState<'origin' | 'callback' | null>(null);
  const [googleAuth, setGoogleAuth] = useState<GoogleAuthUser | null>(() => getStoredGoogleAuth());
  const [ytAccountModalOpen, setYtAccountModalOpen] = useState(false);

  const [ytVideoFile, setYtVideoFile] = useState<File | null>(null);
  const [ytPreviewUrl, setYtPreviewUrl] = useState('');
  const [ytDuration, setYtDuration] = useState('0:00');
  const [ytThumbFile, setYtThumbFile] = useState<File | null>(null);
  const [ytThumbPreview, setYtThumbPreview] = useState('');
  const [ytTitle, setYtTitle] = useState('');
  const [ytDescription, setYtDescription] = useState('');
  const [ytPrivacy, setYtPrivacy] = useState<'public' | 'unlisted' | 'private'>('private');
  const [ytMadeForKids, setYtMadeForKids] = useState(false);
  const [ytTags, setYtTags] = useState('');
  const [ytUploading, setYtUploading] = useState(false);
  const [ytProgress, setYtProgress] = useState(0);
  const [ytUploadError, setYtUploadError] = useState('');
  const [ytUploadResult, setYtUploadResult] = useState<YouTubeUploadResult | null>(null);

  const mlVideoInputRef = useRef<HTMLInputElement | null>(null);
  const mlThumbInputRef = useRef<HTMLInputElement | null>(null);
  const ytVideoInputRef = useRef<HTMLInputElement | null>(null);
  const ytThumbInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStep(initialDestination);
      setMlSuccess(false);
      setMlError('');
      setYtUploadError('');
      setYtUploadResult(null);
      setYtOAuthError('');
      if (initialDestination === 'youtube') {
        loadYouTubeStatus();
      }
    }
  }, [isOpen, initialDestination]);

  useEffect(() => {
    if (!isOpen || step !== 'youtube') return;
    loadYouTubeStatus();

    const onMessage = (event: MessageEvent) => {
      if (!event?.data || typeof event.data !== 'object') return;
      if (event.data.type === 'YOUTUBE_OAUTH_SUCCESS') {
        setYtConnecting(false);
        setYtOAuthError('');
        loadYouTubeStatus();
        onYouTubeConnectionChanged?.();
      } else if (event.data.type === 'YOUTUBE_OAUTH_ERROR') {
        setYtConnecting(false);
        setYtOAuthError(event.data.error || 'Google OAuth authorization was not completed.');
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [isOpen, step]);

  // Revoke object URLs on unmount
  useEffect(() => {
    return () => {
      if (mlPreviewUrl) URL.revokeObjectURL(mlPreviewUrl);
      if (mlThumbPreview) URL.revokeObjectURL(mlThumbPreview);
      if (ytPreviewUrl) URL.revokeObjectURL(ytPreviewUrl);
      if (ytThumbPreview) URL.revokeObjectURL(ytThumbPreview);
    };
  }, [mlPreviewUrl, mlThumbPreview, ytPreviewUrl, ytThumbPreview]);

  useBackHandler(
    'video-publish-flow',
    isOpen,
    () => {
      if (mlUploading || ytUploading) return;
      if (step !== 'select') {
        setStep('select');
        return;
      }
      onClose();
    },
    65
  );

  if (!isOpen) return null;

  const loadYouTubeStatus = async () => {
    setYtStatusLoading(true);
    try {
      const data = await api.getYouTubeOAuthStatus();
      setYtStatus(data);
    } catch (err: any) {
      setYtOAuthError(err.message || 'Unable to verify YouTube connection status.');
    } finally {
      setYtStatusLoading(false);
    }
  };

  const handleOpenGoogleOAuth = async () => {
    setYtOAuthError('');
    setYtConnecting(true);
    try {
      const res = await api.getYouTubeOAuthUrl();
      if (!res.authUrl) {
        setYtConnecting(false);
        setYtOAuthError(res.message || 'OAuth client configuration is missing.');
        return;
      }

      const width = 520;
      const height = 660;
      const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
      const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);
      const popup = window.open(
        res.authUrl,
        'motherland_youtube_oauth',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
      );

      if (!popup) {
        setYtConnecting(false);
        setYtOAuthError('Popup was blocked by your browser. Please allow popups for Google sign-in.');
        return;
      }

      const checkClosed = window.setInterval(() => {
        if (popup.closed) {
          window.clearInterval(checkClosed);
          setYtConnecting(false);
          loadYouTubeStatus();
        }
      }, 700);
    } catch (err: any) {
      setYtConnecting(false);
      setYtOAuthError(err.message || 'Failed to launch Google authorization.');
    }
  };

  const handleDisconnectYouTube = async () => {
    try {
      await api.disconnectYouTubeOAuth();
      await loadYouTubeStatus();
      onYouTubeConnectionChanged?.();
    } catch (err: any) {
      setYtOAuthError(err.message || 'Disconnect failed.');
    }
  };

  const handleMotherlandVideoSelect = (file?: File) => {
    if (!file) return;
    if (mlPreviewUrl) URL.revokeObjectURL(mlPreviewUrl);
    setMlVideoFile(file);
    setMlPreviewUrl(URL.createObjectURL(file));
    if (!mlTitle) {
      setMlTitle(file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' '));
    }
    setMlError('');
  };

  const handleMotherlandThumbSelect = (file?: File) => {
    if (!file) return;
    if (mlThumbPreview) URL.revokeObjectURL(mlThumbPreview);
    setMlThumbFile(file);
    setMlThumbPreview(URL.createObjectURL(file));
  };

  const handleMotherlandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mlVideoFile) {
      setMlError('Please select a video file from your device.');
      return;
    }
    if (!mlTitle.trim()) {
      setMlError('Please enter a video title.');
      return;
    }

    setMlUploading(true);
    setMlError('');
    setMlProgress(5);

    try {
      const uploadedVideo = await api.uploadMediaFile(mlVideoFile, (p) => {
        setMlProgress(mlThumbFile ? Math.round(p * 0.8) : p);
      });

      let uploadedThumbUrl = '';
      if (mlThumbFile) {
        const thumbRes = await api.uploadMediaFile(mlThumbFile, (p) => {
          setMlProgress(80 + Math.round(p * 0.2));
        });
        uploadedThumbUrl = thumbRes.url;
      }

      const tags = mlTags
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean);

      if (mlFormat === 'long') {
        await api.createLongVideo({
          videoUrl: uploadedVideo.url,
          thumbnailUrl: uploadedThumbUrl || undefined,
          title: mlTitle.trim(),
          description: mlDescription.trim(),
          duration: mlDuration !== '0:00' ? mlDuration : '1:00',
          tags,
        });
        onMotherlandVideoCreated();
      } else {
        await api.createPost({
          content: mlDescription.trim() ? `${mlTitle.trim()}\n\n${mlDescription.trim()}` : mlTitle.trim(),
          mediaType: 'video',
          mediaUrl: uploadedVideo.url,
          thumbnailUrl: uploadedThumbUrl || undefined,
          mediaAspectRatio: '16:9',
          hashtags: tags,
          audience: mlAudience,
          platforms: ['motherland'],
        });
        onMotherlandPostCreated?.();
      }

      setMlProgress(100);
      setMlSuccess(true);
    } catch (err: any) {
      setMlError(err.message || 'Upload to MOTHERLAND failed.');
    } finally {
      setMlUploading(false);
    }
  };

  const handleYouTubeVideoSelect = (file?: File) => {
    if (!file) return;
    if (ytPreviewUrl) URL.revokeObjectURL(ytPreviewUrl);
    setYtVideoFile(file);
    setYtPreviewUrl(URL.createObjectURL(file));
    if (!ytTitle) {
      setYtTitle(file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 100));
    }
    setYtUploadError('');
  };

  const handleYouTubeThumbSelect = (file?: File) => {
    if (!file) return;
    if (ytThumbPreview) URL.revokeObjectURL(ytThumbPreview);
    setYtThumbFile(file);
    setYtThumbPreview(URL.createObjectURL(file));
  };

  const handleYouTubeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ytVideoFile) {
      setYtUploadError('Please select a video file from your device.');
      return;
    }
    if (!ytTitle.trim()) {
      setYtUploadError('Video title is required.');
      return;
    }

    setYtUploading(true);
    setYtUploadError('');
    setYtProgress(2);

    try {
      const tags = ytTags
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean);

      const res = await api.uploadVideoToYouTube({
        file: ytVideoFile,
        thumbnailFile: ytThumbFile,
        title: ytTitle.trim(),
        description: ytDescription.trim(),
        privacyStatus: ytPrivacy,
        madeForKids: ytMadeForKids,
        tags,
        onProgress: setYtProgress,
      });

      if (res.success && res.videoId) {
        setYtUploadResult(res);
      } else {
        setYtUploadError(res.message || 'YouTube upload did not complete.');
      }
    } catch (err: any) {
      setYtUploadError(err.message || 'Unexpected error during YouTube upload.');
    } finally {
      setYtUploading(false);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !mlUploading && !ytUploading) onClose();
      }}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
    >
      <div className="w-full max-w-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[94dvh] flex flex-col overflow-hidden text-[var(--text-primary)] pb-[env(safe-area-inset-bottom)]">
        {/* Top Modal Header */}
        <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {step !== 'select' && (
              <button
                type="button"
                onClick={() => setStep('select')}
                className="w-11 h-11 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] flex items-center justify-center text-[var(--text-primary)] flex-shrink-0"
                title="Choose another destination"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="min-w-0">
              <h2 className="font-bold text-sm sm:text-base text-[var(--text-primary)] truncate">
                {step === 'select'
                  ? 'Where would you like to publish your video?'
                  : step === 'motherland'
                  ? 'Upload Video to MOTHERLAND'
                  : 'Publish Directly to YouTube'}
              </h2>
              <p className="text-[11px] text-[var(--text-secondary)] truncate">
                {step === 'select'
                  ? 'Each destination operates independently with its own upload pipeline.'
                  : step === 'motherland'
                  ? 'Hosted on MOTHERLAND media server & published to your library.'
                  : 'Authorized via official Google OAuth 2.0 & YouTube Data API v3.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)] flex items-center justify-center flex-shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {/* ===================================================== */}
          {/* SCREEN 1: DUAL DESTINATION PICKER                     */}
          {/* ===================================================== */}
          {step === 'select' && (
            <div className="space-y-3 py-1">
              <button
                type="button"
                onClick={() => setStep('motherland')}
                className="w-full text-left p-4 rounded-2xl border border-[var(--border-subtle)] hover:border-[var(--accent-primary-border)] bg-[var(--bg-surface-alt)] hover:bg-[var(--accent-primary-soft)] transition-all flex items-start gap-4 group"
              >
                <div className="w-12 h-12 rounded-2xl bg-[var(--accent-primary-soft)] border border-[var(--accent-primary-border)] flex items-center justify-center flex-shrink-0 text-[var(--accent-primary)]">
                  <Shield className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm sm:text-base text-[var(--text-primary)]">
                      MOTHERLAND
                    </span>
                    <span className="text-[11px] font-semibold text-[var(--accent-primary)]">
                      Instant Upload →
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                    Publish directly to MOTHERLAND feed &amp; video library. Supports device file upload, custom thumbnails, and audience privacy.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStep('youtube')}
                className="w-full text-left p-4 rounded-2xl border border-[var(--border-subtle)] hover:border-[#FF0000]/50 bg-[var(--bg-surface-alt)] hover:bg-red-500/[0.06] transition-all flex items-start gap-4 group"
              >
                <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center flex-shrink-0 text-[#FF0000]">
                  <Youtube className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                      YOUTUBE
                    </span>
                    <span className="text-[11px] font-semibold text-red-600 dark:text-red-400">
                      Official OAuth →
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                    Connect your YouTube account and upload directly to YouTube via official Google OAuth 2.0 consent. No duplicate MOTHERLAND post created.
                  </p>
                </div>
              </button>
            </div>
          )}

          {/* ===================================================== */}
          {/* OPTION 1: MOTHERLAND VIDEO UPLOAD FLOW                */}
          {/* ===================================================== */}
          {step === 'motherland' && (
            <>
              {mlSuccess ? (
                <div className="py-8 text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-[var(--accent-primary-soft)] border border-[var(--accent-primary-border)] text-[var(--accent-primary)] mx-auto flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-[var(--text-primary)]">
                      Published to MOTHERLAND
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">
                      Your video &ldquo;{mlTitle}&rdquo; is saved and live on MOTHERLAND.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-primary-contrast)] font-bold text-xs"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <form onSubmit={handleMotherlandSubmit} className="space-y-4">
                  {/* Video Picker */}
                  <div>
                    <input
                      ref={mlVideoInputRef}
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={(e) => handleMotherlandVideoSelect(e.target.files?.[0])}
                    />
                    {mlPreviewUrl ? (
                      <div className="rounded-2xl overflow-hidden border border-[var(--border-subtle)] bg-black">
                        <video
                          src={mlPreviewUrl}
                          controls
                          playsInline
                          onLoadedMetadata={(e) => setMlDuration(formatSeconds(e.currentTarget.duration))}
                          className="w-full max-h-56 object-contain"
                        />
                        <div className="px-3 py-2 bg-[#0A1324] text-[#F8F4EC] text-xs flex items-center justify-between gap-2">
                          <span className="truncate font-medium">
                            {mlVideoFile?.name} · {formatBytes(mlVideoFile?.size || 0)} · {mlDuration}
                          </span>
                          <button
                            type="button"
                            onClick={() => mlVideoInputRef.current?.click()}
                            className="text-[var(--accent-gold)] font-semibold flex-shrink-0 hover:underline"
                          >
                            Change
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => mlVideoInputRef.current?.click()}
                        className="w-full py-8 px-4 rounded-2xl border-2 border-dashed border-[var(--border-strong)] hover:border-[var(--accent-primary)] bg-[var(--bg-surface-alt)] flex flex-col items-center justify-center gap-2 text-[var(--text-secondary)] transition-colors"
                      >
                        <Upload className="w-7 h-7 text-[var(--accent-primary)]" />
                        <span className="text-xs font-bold text-[var(--text-primary)]">Select video from device</span>
                        <span className="text-[11px] text-[var(--text-muted)]">MP4, MOV, WebM up to 250 MB</span>
                      </button>
                    )}
                  </div>

                  {/* Destination inside MOTHERLAND */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setMlFormat('long')}
                      className={`min-h-[42px] p-2.5 rounded-xl border font-semibold flex items-center justify-center gap-1.5 ${
                        mlFormat === 'long'
                          ? 'border-[var(--accent-primary-border)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                          : 'border-[var(--border-subtle)] text-[var(--text-secondary)]'
                      }`}
                    >
                      <Film className="w-4 h-4" />
                      <span>Video Library (16:9)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMlFormat('post')}
                      className={`min-h-[42px] p-2.5 rounded-xl border font-semibold flex items-center justify-center gap-1.5 ${
                        mlFormat === 'post'
                          ? 'border-[var(--accent-primary-border)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                          : 'border-[var(--border-subtle)] text-[var(--text-secondary)]'
                      }`}
                    >
                      <Shield className="w-4 h-4" />
                      <span>Social Feed Post</span>
                    </button>
                  </div>

                  {/* Title */}
                  <div>
                    <label className="text-xs font-semibold text-[var(--text-secondary)] block mb-1">
                      Video Title
                    </label>
                    <input
                      type="text"
                      required
                      value={mlTitle}
                      onChange={(e) => setMlTitle(e.target.value)}
                      placeholder="Give your video a clear title..."
                      className="w-full rounded-xl px-3 py-2.5 text-xs bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="text-xs font-semibold text-[var(--text-secondary)] block mb-1">
                      Description
                    </label>
                    <textarea
                      rows={3}
                      value={mlDescription}
                      onChange={(e) => setMlDescription(e.target.value)}
                      placeholder="Tell viewers about this video..."
                      className="w-full rounded-xl p-3 text-xs bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] resize-none"
                    />
                  </div>

                  {/* Custom Thumbnail & Visibility */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-[var(--text-secondary)] block mb-1">
                        Thumbnail (Optional)
                      </label>
                      <input
                        ref={mlThumbInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleMotherlandThumbSelect(e.target.files?.[0])}
                      />
                      <button
                        type="button"
                        onClick={() => mlThumbInputRef.current?.click()}
                        className="w-full h-11 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-alt)] text-xs text-[var(--text-primary)] flex items-center gap-2 hover:border-[var(--accent-primary-border)]"
                      >
                        <ImageIcon className="w-4 h-4 text-[var(--accent-primary)]" />
                        <span className="truncate">{mlThumbFile ? mlThumbFile.name : 'Choose Thumbnail'}</span>
                      </button>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-[var(--text-secondary)] block mb-1">
                        Audience Visibility
                      </label>
                      <div className="grid grid-cols-3 gap-1 bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] rounded-xl p-1 h-11">
                        {[
                          { id: 'public', label: 'Public', icon: Globe },
                          { id: 'friends', label: 'Friends', icon: Users },
                          { id: 'only_me', label: 'Private', icon: Lock },
                        ].map((opt) => {
                          const Icon = opt.icon;
                          const active = mlAudience === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setMlAudience(opt.id as any)}
                              className={`rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 ${
                                active
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
                    </div>
                  </div>

                  {/* Tags */}
                  <div>
                    <label className="text-xs font-semibold text-[var(--text-secondary)] block mb-1">
                      Tags (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={mlTags}
                      onChange={(e) => setMlTags(e.target.value)}
                      placeholder="Motherland, Travel, Vlog"
                      className="w-full rounded-xl px-3 py-2.5 text-xs bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                    />
                  </div>

                  {mlError && (
                    <div className="p-3 rounded-xl bg-[var(--danger-soft)] border border-[var(--danger)]/35 text-xs text-[var(--danger)] flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{mlError}</span>
                    </div>
                  )}

                  {mlUploading && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold text-[var(--accent-primary)]">
                        <span>Uploading to MOTHERLAND...</span>
                        <span className="tabular-nums">{mlProgress}%</span>
                      </div>
                      <div className="h-2 w-full bg-[var(--bg-surface-alt)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--accent-primary)] transition-all duration-150"
                          style={{ width: `${mlProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={mlUploading || !mlVideoFile}
                      className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] disabled:opacity-40 text-[var(--accent-primary-contrast)] font-bold text-xs flex items-center gap-2 shadow-md"
                    >
                      {mlUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      <span>Publish to MOTHERLAND</span>
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          {/* ===================================================== */}
          {/* OPTION 2: OFFICIAL YOUTUBE OAUTH & UPLOAD FLOW        */}
          {/* ===================================================== */}
          {step === 'youtube' && (
            <div className="space-y-4">
              {ytStatusLoading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-[var(--text-secondary)]">
                  <Loader2 className="w-6 h-6 animate-spin text-[#FF0000]" />
                  <span>Checking official YouTube authorization...</span>
                </div>
              ) : !ytStatus?.connected && !googleAuth?.accessToken ? (
                /* Connect Your YouTube Account Screen (Official Google Consent Flow + Client OAuth Modal) */
                <div className="p-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface-alt)] text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-red-500/15 text-[#FF0000] mx-auto flex items-center justify-center">
                    <Youtube className="w-8 h-8" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-base font-extrabold text-[var(--text-primary)]">
                      Connect Your YouTube Account
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto leading-relaxed">
                      Authorize MOTHERLAND with your Google account to upload, edit, and manage videos directly on your YouTube channel.
                    </p>
                  </div>

                  <div className="text-left p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)] space-y-1">
                    <div className="font-semibold text-[var(--text-primary)]">Permissions Requested:</div>
                    <div>• View &amp; manage your YouTube channel (`youtube`)</div>
                    <div>• Upload videos directly to YouTube (`youtube.upload`)</div>
                  </div>

                  {ytOAuthError && (
                    <div className="p-3 rounded-xl bg-[var(--danger-soft)] border border-[var(--danger)]/35 text-xs text-[var(--danger)] text-left flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{ytOAuthError}</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    {ytStatus?.oauthConfigured && (
                      <button
                        type="button"
                        onClick={handleOpenGoogleOAuth}
                        disabled={ytConnecting}
                        className="w-full min-h-[44px] py-3 px-4 rounded-xl bg-[var(--text-primary)] text-[var(--bg-surface)] font-bold text-xs flex items-center justify-center gap-2.5 hover:opacity-90 disabled:opacity-50 transition-opacity shadow-md"
                      >
                        {ytConnecting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Youtube className="w-4 h-4 text-[#FF0000]" />
                        )}
                        <span>{ytConnecting ? 'Waiting for Google Consent...' : 'Continue with Google (Server OAuth)'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setYtAccountModalOpen(true)}
                      className="w-full min-h-[44px] py-3 px-4 rounded-xl bg-[#FF0000] hover:bg-red-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-colors"
                    >
                      <Youtube className="w-4 h-4" />
                      <span>Sign In with Google Account / Client OAuth</span>
                    </button>
                  </div>

                  {ytStatus && !ytStatus.oauthConfigured && (
                    <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-left text-[11px] space-y-2">
                      <div className="font-semibold text-[var(--text-primary)]">
                        Google Cloud Console URLs for this App:
                      </div>
                      <div className="space-y-1">
                        <div className="text-[10px] text-[var(--text-muted)]">Authorized JavaScript Origin:</div>
                        <div className="flex items-center justify-between gap-2 bg-[var(--bg-surface-alt)] px-2.5 py-1.5 rounded-lg">
                          <span className="font-mono text-[10px] text-[var(--text-secondary)] break-all">
                            {typeof window !== 'undefined' ? window.location.origin : ''}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(window.location.origin);
                              setCopiedCallback('origin');
                              setTimeout(() => setCopiedCallback(null), 1800);
                            }}
                            className="p-1 text-[var(--text-secondary)] hover:text-[var(--accent-primary)] flex-shrink-0"
                            title="Copy Origin URL"
                          >
                            {copiedCallback === 'origin' ? <Check className="w-3.5 h-3.5 text-[var(--accent-primary)]" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="text-[10px] text-[var(--text-muted)]">Authorized Redirect URI:</div>
                        <div className="flex items-center justify-between gap-2 bg-[var(--bg-surface-alt)] px-2.5 py-1.5 rounded-lg">
                          <span className="font-mono text-[10px] text-[var(--text-secondary)] break-all">
                            {ytStatus.callbackUrl}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(ytStatus.callbackUrl);
                              setCopiedCallback('callback');
                              setTimeout(() => setCopiedCallback(null), 1800);
                            }}
                            className="p-1 text-[var(--text-secondary)] hover:text-[var(--accent-primary)] flex-shrink-0"
                            title="Copy Callback URI"
                          >
                            {copiedCallback === 'callback' ? <Check className="w-3.5 h-3.5 text-[var(--accent-primary)]" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : ytUploadResult?.success ? (
                /* Post-Upload Confirmation with Real Video ID & Link */
                <div className="py-6 text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-[var(--accent-primary-soft)] border border-[var(--accent-primary-border)] text-[var(--accent-primary)] mx-auto flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-[var(--text-primary)]">
                      Uploaded to YouTube
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">
                      Video ID: <span className="font-mono font-bold">{ytUploadResult.videoId}</span> · Visibility:{' '}
                      <span className="capitalize font-semibold">{ytUploadResult.privacyStatus}</span>
                    </p>
                  </div>
                  {ytUploadResult.url && (
                    <a
                      href={ytUploadResult.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-[#FF0000] hover:bg-red-600 text-white text-xs font-bold"
                    >
                      <Youtube className="w-4 h-4" />
                      <span>Open on YouTube</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        setYtUploadResult(null);
                        setYtVideoFile(null);
                        setYtPreviewUrl('');
                        setYtTitle('');
                        setYtDescription('');
                      }}
                      className="text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] py-2"
                    >
                      Upload another video
                    </button>
                  </div>
                </div>
              ) : (
                /* Connected Channel + Official YouTube Upload Form */
                <form onSubmit={handleYouTubeSubmit} className="space-y-4">
                  {/* Connected Channel Bar */}
                  {(ytStatus?.channel || googleAuth) && (
                    <div className="p-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface-alt)] flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={ytStatus?.channel?.avatar || googleAuth?.avatarUrl || ''}
                          alt={ytStatus?.channel?.title || googleAuth?.channelTitle || googleAuth?.name || 'YouTube'}
                          className="w-10 h-10 rounded-full object-cover border border-red-500/30"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[var(--text-primary)] truncate">
                            {ytStatus?.channel?.title || googleAuth?.channelTitle || googleAuth?.name || 'YouTube Channel'}
                          </div>
                          <div className="text-[11px] text-[var(--accent-primary)] font-medium">
                            Connected · {ytStatus?.channel?.subscriberCount || googleAuth?.subscriberCount || 'YouTube'} subscribers
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            ytStatus?.oauthConfigured ? handleOpenGoogleOAuth() : setYtAccountModalOpen(true)
                          }
                          className="min-h-[38px] px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--border-strong)] flex items-center gap-1"
                          title="Switch Google Account"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span className="hidden sm:inline">Switch</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleDisconnectYouTube}
                          className="min-h-[38px] px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-[var(--danger-soft)] text-[var(--danger)] hover:opacity-90 flex items-center gap-1"
                          title="Disconnect YouTube"
                        >
                          <LogOut className="w-3 h-3" />
                          <span className="hidden sm:inline">Disconnect</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Video File Picker */}
                  <div>
                    <input
                      ref={ytVideoInputRef}
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={(e) => handleYouTubeVideoSelect(e.target.files?.[0])}
                    />
                    {ytPreviewUrl ? (
                      <div className="rounded-2xl overflow-hidden border border-[var(--border-subtle)] bg-black">
                        <video
                          src={ytPreviewUrl}
                          controls
                          playsInline
                          onLoadedMetadata={(e) => setYtDuration(formatSeconds(e.currentTarget.duration))}
                          className="w-full max-h-52 object-contain"
                        />
                        <div className="px-3 py-2 bg-[#0A1324] text-[#F8F4EC] text-xs flex items-center justify-between gap-2">
                          <span className="truncate font-medium">
                            {ytVideoFile?.name} · {formatBytes(ytVideoFile?.size || 0)} · {ytDuration}
                          </span>
                          <button
                            type="button"
                            onClick={() => ytVideoInputRef.current?.click()}
                            className="text-red-400 font-semibold flex-shrink-0 hover:underline"
                          >
                            Replace
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => ytVideoInputRef.current?.click()}
                        className="w-full py-7 px-4 rounded-2xl border-2 border-dashed border-[var(--border-strong)] hover:border-[#FF0000]/60 bg-[var(--bg-surface-alt)] flex flex-col items-center justify-center gap-2 text-[var(--text-secondary)] transition-colors"
                      >
                        <Upload className="w-7 h-7 text-[#FF0000]" />
                        <span className="text-xs font-bold text-[var(--text-primary)]">Select video file for YouTube</span>
                        <span className="text-[11px] text-[var(--text-muted)]">MP4, MOV, WebM up to 250 MB</span>
                      </button>
                    )}
                  </div>

                  {/* YouTube Metadata */}
                  <div>
                    <label className="text-xs font-semibold text-[var(--text-secondary)] block mb-1">
                      Title (Required, max 100 chars)
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={100}
                      value={ytTitle}
                      onChange={(e) => setYtTitle(e.target.value)}
                      placeholder="Enter YouTube video title..."
                      className="w-full rounded-xl px-3 py-2.5 text-xs bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-[var(--text-secondary)] block mb-1">
                      Description
                    </label>
                    <textarea
                      rows={3}
                      value={ytDescription}
                      onChange={(e) => setYtDescription(e.target.value)}
                      placeholder="Describe your YouTube video..."
                      className="w-full rounded-xl p-3 text-xs bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-red-500 resize-none"
                    />
                  </div>

                  {/* Thumbnail + Visibility */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-[var(--text-secondary)] block mb-1">
                        Custom Thumbnail
                      </label>
                      <input
                        ref={ytThumbInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleYouTubeThumbSelect(e.target.files?.[0])}
                      />
                      <button
                        type="button"
                        onClick={() => ytThumbInputRef.current?.click()}
                        className="w-full h-11 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-alt)] text-xs text-[var(--text-primary)] flex items-center gap-2"
                      >
                        <ImageIcon className="w-4 h-4 text-[#FF0000]" />
                        <span className="truncate">{ytThumbFile ? ytThumbFile.name : 'Choose Image'}</span>
                      </button>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-[var(--text-secondary)] block mb-1">
                        Visibility
                      </label>
                      <div className="grid grid-cols-3 gap-1 bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] rounded-xl p-1 h-11">
                        {[
                          { id: 'public', label: 'Public', icon: Globe },
                          { id: 'unlisted', label: 'Unlisted', icon: EyeOff },
                          { id: 'private', label: 'Private', icon: Lock },
                        ].map((opt) => {
                          const Icon = opt.icon;
                          const active = ytPrivacy === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setYtPrivacy(opt.id as any)}
                              className={`rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 ${
                                active ? 'bg-[#FF0000] text-white' : 'text-[var(--text-secondary)]'
                              }`}
                            >
                              <Icon className="w-3 h-3" />
                              <span>{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Audience Setting */}
                  <div className="flex items-center justify-between p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-alt)] text-xs">
                    <span className="font-semibold text-[var(--text-secondary)]">
                      Audience (COPPA)
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setYtMadeForKids(false)}
                        className={`px-2.5 py-1.5 rounded-lg font-semibold ${
                          !ytMadeForKids
                            ? 'bg-[var(--text-primary)] text-[var(--bg-surface)]'
                            : 'text-[var(--text-muted)]'
                        }`}
                      >
                        Not for kids
                      </button>
                      <button
                        type="button"
                        onClick={() => setYtMadeForKids(true)}
                        className={`px-2.5 py-1.5 rounded-lg font-semibold ${
                          ytMadeForKids
                            ? 'bg-[var(--text-primary)] text-[var(--bg-surface)]'
                            : 'text-[var(--text-muted)]'
                        }`}
                      >
                        Made for kids
                      </button>
                    </div>
                  </div>

                  {/* Tags */}
                  <div>
                    <label className="text-xs font-semibold text-[var(--text-secondary)] block mb-1">
                      Tags (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={ytTags}
                      onChange={(e) => setYtTags(e.target.value)}
                      placeholder="Vlog, Music, Bangladesh"
                      className="w-full rounded-xl px-3 py-2.5 text-xs bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-red-500"
                    />
                  </div>

                  {ytUploadError && (
                    <div className="p-3 rounded-xl bg-[var(--danger-soft)] border border-[var(--danger)]/35 text-xs text-[var(--danger)] flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{ytUploadError}</span>
                    </div>
                  )}

                  {ytUploading && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold text-[#FF0000]">
                        <span>Uploading to YouTube Data API v3...</span>
                        <span className="tabular-nums">{ytProgress}%</span>
                      </div>
                      <div className="h-2 w-full bg-[var(--bg-surface-alt)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#FF0000] transition-all duration-150"
                          style={{ width: `${ytProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={ytUploading || !ytVideoFile || !ytTitle.trim()}
                    className="w-full min-h-[44px] py-3 rounded-xl bg-[#FF0000] hover:bg-red-600 disabled:opacity-40 text-white font-extrabold text-xs tracking-wide flex items-center justify-center gap-2 transition-colors shadow-md"
                  >
                    {ytUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Youtube className="w-4 h-4" />}
                    <span>UPLOAD TO YOUTUBE</span>
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      <YouTubeAccountModal
        isOpen={ytAccountModalOpen}
        onClose={() => setYtAccountModalOpen(false)}
        currentAuth={googleAuth}
        onAuthUpdated={(auth) => {
          setGoogleAuth(auth);
          loadYouTubeStatus();
          onYouTubeConnectionChanged?.();
        }}
      />
    </div>
  );
};
