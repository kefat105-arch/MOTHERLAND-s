import React, { useState, useRef } from 'react';
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Shield,
  Youtube,
  MoreHorizontal,
  Flame,
  Smile,
  Volume2,
  VolumeX,
  Trash2,
  Check,
  ChevronLeft,
  ChevronRight,
  X,
  Repeat2,
} from 'lucide-react';
import type { Post, ReactionType, UserProfile } from '../types';
import { useBackHandler } from '../hooks/useBackNavigation';
import { FIRE_REACTIONS } from '../data/fireEmojiCatalog';
import { FireLikeIcon } from './fire/MotherlandIcons';
import { FireRichText } from './fire/FireRichText';

interface PostCardProps {
  post: Post;
  currentUser: UserProfile | null;
  onReact: (postId: string, reaction: ReactionType) => void;
  onOpenComments: (postId: string, youtubeVideoId?: string) => void;
  onToggleSave: (postId: string) => void;
  onSharePost?: (postId: string) => Promise<void> | void;
  onDeletePost?: (postId: string) => void;
}

export const PostCard: React.FC<PostCardProps> = ({
  post,
  currentUser,
  onReact,
  onOpenComments,
  onToggleSave,
  onSharePost,
  onDeletePost,
}) => {
  const [showReactionsPicker, setShowReactionsPicker] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [sharedFeedback, setSharedFeedback] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxDragY, setLightboxDragY] = useState(0);

  const carouselStartXRef = useRef<number | null>(null);
  const lightboxStartYRef = useRef<number | null>(null);

  useBackHandler(
    `post-lightbox-${post.id}`,
    lightboxIndex !== null,
    () => setLightboxIndex(null),
    75
  );

  const isLiked = post.userInteractions?.isLiked;
  const currentReaction = post.userInteractions?.reaction || 'like';
  const activeReactionOption =
    FIRE_REACTIONS.find((r) => r.type === currentReaction) || FIRE_REACTIONS[0];
  const isSaved = post.userInteractions?.isSaved;
  const isAuthor = Boolean(currentUser?.id && post.author.id === currentUser.id);

  const postImages =
    post.images && post.images.length > 0
      ? post.images
      : post.mediaType !== 'video' && post.mediaUrl && post.source !== 'youtube'
      ? [post.mediaUrl]
      : [];

  const handleCopyLink = () => {
    const url = post.originalUrl || window.location.href;
    navigator.clipboard?.writeText(url);
    setCopiedLink(true);
    setShareMenuOpen(false);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleRepost = async () => {
    setShareMenuOpen(false);
    if (onSharePost) {
      await onSharePost(post.id);
      setSharedFeedback(true);
      setTimeout(() => setSharedFeedback(false), 2000);
    }
  };

  const handleCarouselTouchStart = (e: React.TouchEvent) => {
    carouselStartXRef.current = e.touches[0].clientX;
  };

  const handleCarouselTouchEnd = (e: React.TouchEvent, total: number) => {
    if (carouselStartXRef.current === null || total <= 1) return;
    const dx = e.changedTouches[0].clientX - carouselStartXRef.current;
    carouselStartXRef.current = null;
    if (Math.abs(dx) > 40) {
      if (dx < 0 && activeImageIndex < total - 1) setActiveImageIndex((i) => i + 1);
      else if (dx > 0 && activeImageIndex > 0) setActiveImageIndex((i) => i - 1);
    }
  };

  return (
    <>
      <article className="ml-glass rounded-2xl overflow-hidden transition-colors mb-4">
        {/* Post Header */}
        <div className="p-3.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={post.author.avatar}
              alt={post.author.displayName}
              className="w-10 h-10 rounded-xl object-cover border border-[var(--border-subtle)] flex-shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-sm text-[var(--text-primary)] truncate">
                  {post.author.displayName}
                </span>
                {post.author.isVerified && (
                  <span className="w-3.5 h-3.5 rounded-full bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)] flex items-center justify-center text-[8px] font-bold flex-shrink-0">
                    ✓
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
                <span>@{post.author.username}</span>
                <span>·</span>
                <span>{new Date(post.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                <span>·</span>
                <span className="inline-flex items-center gap-1 font-semibold">
                  {post.source === 'youtube' ? (
                    <>
                      <Youtube className="w-3 h-3 text-red-500" /> YouTube
                    </>
                  ) : (
                    <>
                      <Shield className="w-3 h-3 text-[var(--accent-primary)]" /> MOTHERLAND
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Options Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setMenuOpen((o) => !o);
                setConfirmDeleteOpen(false);
              }}
              className="w-9 h-9 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)] flex items-center justify-center"
              aria-label="Post options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-10 z-30 w-44 ml-glass-elevated rounded-xl shadow-xl py-1 text-xs text-[var(--text-primary)]">
                <button
                  type="button"
                  onClick={() => {
                    onToggleSave(post.id);
                    setMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2.5 hover:bg-[var(--bg-surface-alt)] flex items-center gap-2"
                >
                  <Bookmark className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
                  <span>{isSaved ? 'Unsave Post' : 'Save Post'}</span>
                </button>
                {isAuthor && onDeletePost && !confirmDeleteOpen && (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteOpen(true)}
                    className="w-full text-left px-3 py-2.5 text-[var(--danger)] hover:bg-[var(--danger-soft)] flex items-center gap-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Post</span>
                  </button>
                )}
                {isAuthor && onDeletePost && confirmDeleteOpen && (
                  <div className="px-3 py-2 bg-[var(--danger-soft)] space-y-1.5">
                    <p className="text-[11px] font-bold text-[var(--danger)]">Delete permanently?</p>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          onDeletePost(post.id);
                          setMenuOpen(false);
                          setConfirmDeleteOpen(false);
                        }}
                        className="flex-1 py-1 rounded-lg bg-[var(--danger)] text-white font-bold text-[11px]"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteOpen(false)}
                        className="flex-1 py-1 rounded-lg bg-[var(--bg-surface)] text-[var(--text-secondary)] font-semibold text-[11px]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Post Text */}
        {post.content && (
          <div className="px-4 pb-3">
            <div className="text-[var(--text-primary)] text-sm leading-relaxed">
              <FireRichText text={post.content} emojiSize="sm" />
            </div>
            {post.hashtags && post.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {post.hashtags.map((tag, idx) => (
                  <span key={idx} className="text-xs text-[var(--accent-primary)] font-semibold">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Shared Post Card */}
        {post.sharedPost && (
          <div className="mx-3.5 mb-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface-alt)] overflow-hidden">
            <div className="p-3 flex items-center gap-2.5">
              <img
                src={post.sharedPost.author.avatar}
                alt={post.sharedPost.author.displayName}
                className="w-8 h-8 rounded-lg object-cover"
              />
              <div>
                <span className="text-xs font-bold text-[var(--text-primary)] block">
                  {post.sharedPost.author.displayName}
                </span>
                <span className="text-[10px] text-[var(--text-secondary)]">
                  @{post.sharedPost.author.username} · {new Date(post.sharedPost.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
            {post.sharedPost.content && (
              <div className="px-3 pb-2.5 text-xs text-[var(--text-secondary)] leading-relaxed">
                <FireRichText text={post.sharedPost.content} emojiSize="xs" />
              </div>
            )}
            {post.sharedPost.mediaUrl && post.sharedPost.mediaType !== 'video' && (
              <img src={post.sharedPost.mediaUrl} alt="Shared media" className="w-full max-h-72 object-cover" />
            )}
          </div>
        )}

        {/* Media Display: YouTube / Video / Multi-Image Swipe Carousel */}
        {post.source === 'youtube' && post.externalId ? (
          <div className="relative aspect-video w-full bg-black overflow-hidden">
            <iframe
              src={`https://www.youtube.com/embed/${post.externalId}?modestbranding=1&rel=0&playsinline=1`}
              title={post.content || 'YouTube Video'}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full border-0"
            />
          </div>
        ) : post.mediaType === 'video' && post.mediaUrl ? (
          <div className="relative aspect-video w-full bg-black overflow-hidden">
            <video
              src={post.mediaUrl}
              poster={post.thumbnailUrl}
              playsInline
              loop
              muted={isMuted}
              controls
              className="w-full h-full object-contain"
            />
            <button
              type="button"
              onClick={() => setIsMuted((m) => !m)}
              className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/60 text-white"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        ) : postImages.length > 0 ? (
          <div
            className="relative w-full bg-black/90 overflow-hidden select-none"
            data-no-edge-back={postImages.length > 1 ? 'true' : undefined}
            onTouchStart={handleCarouselTouchStart}
            onTouchEnd={(e) => handleCarouselTouchEnd(e, postImages.length)}
          >
            <img
              src={postImages[activeImageIndex] || postImages[0]}
              alt="Post attachment"
              onClick={() => setLightboxIndex(activeImageIndex)}
              className="w-full max-h-[520px] object-cover cursor-zoom-in"
              loading="lazy"
            />

            {postImages.length > 1 && (
              <>
                <span className="absolute top-3 right-3 px-2 py-0.5 rounded-lg bg-black/70 text-white text-[11px] font-mono tabular-nums">
                  {activeImageIndex + 1}/{postImages.length}
                </span>
                {activeImageIndex > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveImageIndex((i) => i - 1)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}
                {activeImageIndex < postImages.length - 1 && (
                  <button
                    type="button"
                    onClick={() => setActiveImageIndex((i) => i + 1)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
                <div className="absolute bottom-2.5 inset-x-0 flex justify-center gap-1.5">
                  {postImages.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveImageIndex(idx)}
                      className={`h-1.5 rounded-full transition-all ${
                        idx === activeImageIndex ? 'w-4 bg-[var(--accent-gold)]' : 'w-1.5 bg-white/50'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        ) : null}

        {/* Metrics Summary */}
        <div className="px-4 py-2.5 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs text-[var(--text-secondary)] tabular-nums">
          <span className="inline-flex items-center gap-1.5">
            {post.stats.likes > 0 && (
              <img
                src={activeReactionOption.assetUrl}
                alt={activeReactionOption.label}
                className="w-4 h-4 object-contain"
              />
            )}
            <span>{post.stats.likes.toLocaleString()} {post.stats.likes === 1 ? 'Fire Like' : 'Fire Likes'}</span>
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="hover:underline"
              onClick={() => onOpenComments(post.id, post.source === 'youtube' ? post.externalId : undefined)}
            >
              {post.stats.comments.toLocaleString()} comments
            </button>
            <span>·</span>
            <span>{post.stats.shares.toLocaleString()} shares</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-2 py-1 border-t border-[var(--border-subtle)] flex items-center justify-between relative">
          {/* Fire Like & 8 Fire Reactions */}
          <div className="relative flex items-center">
            <button
              type="button"
              onClick={() => onReact(post.id, isLiked ? currentReaction : 'like')}
              onMouseEnter={() => setShowReactionsPicker(true)}
              onContextMenu={(e) => {
                e.preventDefault();
                setShowReactionsPicker((s) => !s);
              }}
              className={`min-h-[40px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-colors ${
                isLiked
                  ? 'text-orange-400 font-bold bg-orange-500/10 border border-orange-500/25'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-alt)] hover:text-[var(--text-primary)]'
              }`}
            >
              {isLiked ? (
                <img
                  src={activeReactionOption.assetUrl}
                  alt={activeReactionOption.label}
                  className="w-4.5 h-4.5 object-contain drop-shadow-[0_0_6px_rgba(255,140,0,0.65)]"
                />
              ) : (
                <FireLikeIcon size={18} active={false} />
              )}
              <span>{isLiked ? activeReactionOption.label : 'Like'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowReactionsPicker((s) => !s)}
              aria-label="Choose fire reaction"
              title="Choose Fire Reaction"
              className="min-h-[40px] px-1.5 rounded-xl text-[var(--text-muted)] hover:text-orange-400 hover:bg-[var(--bg-surface-alt)] text-[10px] font-bold"
            >
              ▾
            </button>

            {showReactionsPicker && (
              <div
                onMouseLeave={() => setShowReactionsPicker(false)}
                className="absolute bottom-11 left-0 z-30 flex items-center gap-1 p-1.5 bg-[var(--bg-elevated)] border border-orange-500/30 rounded-2xl shadow-xl"
              >
                {FIRE_REACTIONS.map((r) => (
                  <button
                    key={r.type}
                    type="button"
                    title={r.label}
                    onClick={() => {
                      onReact(post.id, r.type);
                      setShowReactionsPicker(false);
                    }}
                    className={`p-1 rounded-xl hover:scale-125 transition-transform flex flex-col items-center ${
                      isLiked && currentReaction === r.type ? 'bg-orange-500/20 ring-1 ring-orange-400/50' : ''
                    }`}
                  >
                    <img src={r.assetUrl} alt={r.label} className="w-7 h-7 object-contain" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Comment */}
          <button
            type="button"
            onClick={() => onOpenComments(post.id, post.source === 'youtube' ? post.externalId : undefined)}
            className="min-h-[40px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-surface-alt)] hover:text-[var(--text-primary)]"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Comment</span>
          </button>

          {/* Share */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShareMenuOpen((s) => !s)}
              className="min-h-[40px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-surface-alt)] hover:text-[var(--text-primary)]"
            >
              {copiedLink || sharedFeedback ? (
                <Check className="w-4 h-4 text-[var(--accent-primary)]" />
              ) : (
                <Share2 className="w-4 h-4" />
              )}
              <span>{sharedFeedback ? 'Shared' : copiedLink ? 'Copied' : 'Share'}</span>
            </button>

            {shareMenuOpen && (
              <div className="absolute right-0 bottom-11 z-30 w-44 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl shadow-xl py-1 text-xs text-[var(--text-primary)]">
                {onSharePost && post.source === 'motherland' && (
                  <button
                    type="button"
                    onClick={handleRepost}
                    className="w-full text-left px-3 py-2.5 hover:bg-[var(--bg-surface-alt)] flex items-center gap-2 font-semibold"
                  >
                    <Repeat2 className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    <span>Share to Feed</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="w-full text-left px-3 py-2.5 hover:bg-[var(--bg-surface-alt)] flex items-center gap-2"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Copy Link</span>
                </button>
              </div>
            )}
          </div>

          {/* Save */}
          <button
            type="button"
            onClick={() => onToggleSave(post.id)}
            className={`min-h-[40px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs ${
              isSaved
                ? 'text-[var(--accent-gold)] font-semibold'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-alt)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
            <span>{isSaved ? 'Saved' : 'Save'}</span>
          </button>
        </div>
      </article>

      {/* Full-Screen Multi-Image Lightbox with Swipe Down & Edge Back */}
      {lightboxIndex !== null && postImages.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-[#050A14]/95 flex items-center justify-center p-4"
          onClick={() => setLightboxIndex(null)}
          onTouchStart={(e) => {
            lightboxStartYRef.current = e.touches[0].clientY;
          }}
          onTouchMove={(e) => {
            if (lightboxStartYRef.current === null) return;
            const dy = e.touches[0].clientY - lightboxStartYRef.current;
            if (dy > 0) setLightboxDragY(Math.min(200, dy * 0.7));
          }}
          onTouchEnd={(e) => {
            const dy = lightboxStartYRef.current !== null ? e.changedTouches[0].clientY - lightboxStartYRef.current : 0;
            lightboxStartYRef.current = null;
            setLightboxDragY(0);
            if (dy > 85) setLightboxIndex(null);
          }}
        >
          <button
            type="button"
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 text-white flex items-center justify-center"
            aria-label="Close image"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={postImages[lightboxIndex]}
            alt="Full screen view"
            style={{ transform: lightboxDragY ? `translateY(${lightboxDragY}px)` : undefined }}
            className="max-w-full max-h-[88dvh] object-contain rounded-xl transition-transform"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};
