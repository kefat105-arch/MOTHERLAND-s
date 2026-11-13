/**
 * MOTHERLAND Social Post Card
 * - Facebook-style 7-reaction selector on long-press (Like, Love, Care, Haha, Wow, Sad, Angry)
 * - Threaded nested comments & replies with edit/delete/like
 * - Proper media rendering: 16:9 horizontal videos, 9:16 vertical shorts, image galleries, and YouTube embeds
 * - Android Native Share Sheet (navigator.share) & Link Copy
 * - Platform identity badge (MOTHERLAND vs YouTube)
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  MoreHorizontal,
  Globe,
  Users,
  Lock,
  Send,
  Trash2,
  Edit2,
  Check,
  CheckCircle2,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  ExternalLink,
  CornerDownRight,
  Sparkles,
  Youtube,
  ThumbsUp,
  RotateCcw,
  AlertCircle,
} from 'lucide-react';
import {
  SocialComment,
  SocialCommentReply,
  SocialPost,
  PostReactionType,
} from '../../types/social';
import {
  addPostComment,
  addCommentReply,
  deleteComment,
  editComment,
  getPostComments,
  fetchCommentsFromBackend,
  setPostReaction,
  toggleCommentLike,
  togglePostLike,
  togglePostSave,
  trackPostShare,
  getStoredCurrentUser,
  recordVideoWatched,
  savePostComments,
} from '../../services/socialService';
import { FIRE_REACTIONS } from '../../data/fireEmojiCatalog';
import { FireEmojiPicker } from '../fire/FireEmojiPicker';
import { FireRichText } from '../fire/FireRichText';
import { FireDraftPreview, FirePickerTrigger } from '../fire/FireComposerBar';
import { BoostIcon, FireLikeIcon, TalkIcon, VaultIcon } from '../fire/MotherlandIcons';

const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80';

interface SocialPostCardProps {
  post: SocialPost;
  onOpenImageLightbox: (url: string, alt?: string) => void;
  onDeletePost?: (postId: string) => void;
}

export const SocialPostCard: React.FC<SocialPostCardProps> = ({
  post,
  onOpenImageLightbox,
  onDeletePost,
}) => {
  const [currentUser] = useState(getStoredCurrentUser());
  const [userReaction, setUserReaction] = useState<PostReactionType | null>(post.userReaction || (post.isLiked ? 'like' : null));
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [reactions, setReactions] = useState(
    post.reactions || { like: post.likesCount, love: 0, care: 0, haha: 0, wow: 0, sad: 0, angry: 0, cool: 0 }
  );
  const [isSaved, setIsSaved] = useState(post.isSaved);

  // Reaction Picker Overlay State
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const longPressTimerRef = useRef<any>(null);

  // Comments & Replies State
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<SocialComment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);
  const [firePickerTarget, setFirePickerTarget] = useState<'comment' | 'reply' | 'edit' | null>(null);

  // Video Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const [isVideoFullscreen, setIsVideoFullscreen] = useState(false);

  // Menu & Share State
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  // Handle Like or Reaction Select
  const handleSelectReaction = (type: PostReactionType) => {
    setShowReactionPicker(false);
    const updated = setPostReaction(post.id, type);
    if (updated) {
      setUserReaction(updated.userReaction || null);
      setLikesCount(updated.likesCount);
      if (updated.reactions) setReactions(updated.reactions);
    } else {
      const nextType = userReaction === type ? null : type;
      setUserReaction(nextType);
      setLikesCount((c) => (userReaction ? (nextType ? c : Math.max(0, c - 1)) : c + 1));
    }
  };

  const handleLikeButtonTap = () => {
    if (showReactionPicker) {
      setShowReactionPicker(false);
      return;
    }
    const updated = togglePostLike(post.id);
    if (updated) {
      setUserReaction(updated.userReaction || null);
      setLikesCount(updated.likesCount);
      if (updated.reactions) setReactions(updated.reactions);
    } else {
      const next = userReaction ? null : 'like';
      setUserReaction(next);
      setLikesCount((c) => (userReaction ? Math.max(0, c - 1) : c + 1));
    }
  };

  // Touch Long-Press detection for Reaction Picker
  const handleLikeTouchStart = () => {
    longPressTimerRef.current = setTimeout(() => {
      setShowReactionPicker(true);
    }, 380);
  };

  const handleLikeTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
  };

  const handleSave = () => {
    const updated = togglePostSave(post.id);
    if (updated) {
      setIsSaved(updated.isSaved);
    } else {
      setIsSaved((prev) => !prev);
    }
  };

  const handleToggleComments = () => {
    if (!showComments) {
      const existing = getPostComments(post.id);
      setComments(existing);
      fetchCommentsFromBackend(post.id).then((fresh) => {
        if (fresh && Array.isArray(fresh) && fresh.length > 0) {
          setComments(fresh);
          savePostComments(post.id, fresh);
        }
      });
    }
    setShowComments(!showComments);
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;
    setCommentError(null);
    try {
      const added = await addPostComment(post.id, newCommentText.trim());
      setComments((prev) => {
        const next = [...prev, added];
        savePostComments(post.id, next);
        return next;
      });
      setNewCommentText('');
    } catch (err: any) {
      setCommentError(err?.message || 'Please sign in to post a comment.');
    }
  };

  const handleAddReply = async (commentId: string) => {
    if (!replyText.trim()) return;
    setCommentError(null);
    try {
      const addedReply = await addCommentReply(post.id, commentId, replyText.trim());
      setComments((prev) => {
        const next = prev.map((c) =>
          c.id === commentId ? { ...c, replies: [...(c.replies || []), addedReply] } : c
        );
        savePostComments(post.id, next);
        return next;
      });
      setReplyText('');
      setReplyingToCommentId(null);
    } catch (err: any) {
      setCommentError(err?.message || 'Please sign in to reply.');
    }
  };

  const handleToggleCommentLike = (commentId: string, replyId?: string) => {
    toggleCommentLike(post.id, commentId, replyId);
    setComments(getPostComments(post.id));
  };

  const handleDeleteComment = (commentId: string, replyId?: string) => {
    deleteComment(post.id, commentId, replyId);
    setComments(getPostComments(post.id));
  };

  const handleSaveEdit = (commentId: string, replyId?: string) => {
    if (!editText.trim()) return;
    editComment(post.id, commentId, editText.trim(), replyId);
    setComments(getPostComments(post.id));
    setEditingCommentId(null);
    setEditingReplyId(null);
    setEditText('');
  };

  // Android Native Share Sheet or Link Copy
  const handleShare = async () => {
    trackPostShare(post.id);
    const shareUrl = post.originalVideoUrl || `${window.location.origin}/#post_${post.id}`;
    const shareTitle = `${post.author.name} on MOTHERLAND`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: post.content.slice(0, 100),
          url: shareUrl,
        });
        return;
      } catch (e) {
        // Fallback to clipboard if user dismissed
      }
    }

    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Fullscreen video toggle
  const toggleVideoFullscreen = async () => {
    const el = videoContainerRef.current;
    if (!el) return;

    if (!document.fullscreenElement) {
      try {
        if (el.requestFullscreen) await el.requestFullscreen();
        else if ((el as any).webkitRequestFullscreen) await (el as any).webkitRequestFullscreen();
        setIsVideoFullscreen(true);
      } catch (e) {
        console.warn('Fullscreen request failed:', e);
      }
    } else {
      try {
        if (document.exitFullscreen) await document.exitFullscreen();
        setIsVideoFullscreen(false);
      } catch (e) {
        console.warn('Fullscreen exit failed:', e);
      }
    }
  };

  // Render media: Video vs Photo vs YouTube Embed
  const renderMedia = () => {
    // 1. YouTube Mixed Feed Video Post
    if (post.platform === 'youtube' && post.youtubeVideoId) {
      return (
        <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden mt-3 border border-white/10 shadow-lg">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${post.youtubeVideoId}?enablejsapi=1`}
            title={post.content}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      );
    }

    const media = post.media;
    if (!media || media.length === 0) return null;

    // 2. MOTHERLAND Native Video Post (16:9 Landscape or 9:16 Vertical Short)
    if (media.length === 1 && media[0].type === 'video') {
      const isShort = media[0].aspectRatio === '9:16';
      const fallbackPoster =
        media[0].thumbnailUrl ||
        'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=800&auto=format&fit=crop&q=80';

      const handleRetry = () => {
        setVideoError(false);
        setRetryKey((prev) => prev + 1);
        if (videoRef.current) {
          videoRef.current.load();
        }
      };

      const handlePlayTap = () => {
        if (!videoRef.current) return;
        if (isPlaying) {
          videoRef.current.pause();
        } else {
          setVideoError(false);
          videoRef.current.play().catch((err) => {
            console.warn('Video play error:', err);
            setVideoError(true);
          });
        }
      };

      return (
        <div
          ref={videoContainerRef}
          className={`relative w-full mt-3 rounded-2xl overflow-hidden bg-[#0a0e17] border border-white/10 shadow-xl group ${
            isShort ? 'aspect-[9/16] w-full max-h-[82vh]' : 'aspect-video w-full'
          }`}
        >
          {/* Fallback & Poster Container (Eliminates empty black void) */}
          {!isPlaying && !videoError && (
            <div
              onClick={handlePlayTap}
              className="absolute inset-0 z-10 flex flex-col items-center justify-center cursor-pointer group/poster overflow-hidden"
            >
              <img
                src={fallbackPoster}
                alt="Video Preview"
                className="w-full h-full object-cover group-hover/poster:scale-105 transition-transform duration-500 opacity-80"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/40" />

              {/* Centered Glowing Play Button */}
              <div className="relative z-10 w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center shadow-2xl shadow-emerald-950/80 group-hover/poster:scale-110 active:scale-95 transition-all border-2 border-white/30">
                <Play className="w-6 h-6 fill-white ml-1" />
              </div>

              {/* Bottom Title & Badge Overlay */}
              <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between text-white text-xs">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-600/90 font-bold text-[10px] backdrop-blur-xs">
                  {isShort ? 'MOTHERLAND Short' : 'HD Native Video'}
                </span>
                <span className="text-[11px] text-slate-300 font-medium bg-black/50 px-2 py-0.5 rounded-md">
                  Tap to Play
                </span>
              </div>
            </div>
          )}

          {/* Video Element */}
          <video
            key={retryKey}
            ref={videoRef}
            src={media[0].url}
            poster={fallbackPoster}
            playsInline
            preload="metadata"
            muted={isMuted}
            loop
            onPlay={() => {
              setIsPlaying(true);
              recordVideoWatched(post.id);
            }}
            onPause={() => setIsPlaying(false)}
            onError={() => {
              setVideoError(true);
              setIsPlaying(false);
            }}
            className="w-full h-full object-cover"
          />

          {/* Error & Retry Affordance */}
          {videoError && (
            <div className="absolute inset-0 z-20 bg-black/95 flex flex-col items-center justify-center p-4 text-center">
              <AlertCircle className="w-8 h-8 text-rose-500 mb-2" />
              <p className="text-xs text-slate-200 font-semibold mb-3">
                Unable to play video preview. Connection interrupted.
              </p>
              <button
                onClick={handleRetry}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all active:scale-95 shadow-lg"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry Playback</span>
              </button>
            </div>
          )}

          {/* Floating Controls Overlay (Visible when playing) */}
          {isPlaying && (
            <div className="absolute inset-0 z-10 flex flex-col justify-between p-3 bg-gradient-to-t from-black/70 via-transparent to-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex items-center justify-between text-white text-xs">
                <span className="px-2 py-0.5 rounded-full bg-emerald-600/80 font-bold text-[10px]">
                  {isShort ? 'MOTHERLAND Short' : 'HD Native Video'}
                </span>
                <button
                  onClick={toggleVideoFullscreen}
                  className="p-1.5 rounded-full bg-black/60 hover:bg-black text-white"
                  title="Toggle Fullscreen"
                >
                  {isVideoFullscreen ? <Minimize className="w-3.5 h-3.5 text-amber-400" /> : <Maximize className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    if (videoRef.current) {
                      videoRef.current.pause();
                    }
                  }}
                  className="w-10 h-10 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center shadow-lg transition-transform active:scale-90"
                >
                  <Pause className="w-5 h-5 fill-white" />
                </button>

                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="p-2 rounded-full bg-black/60 hover:bg-black text-white"
                >
                  {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }

    // 3. Single Photo
    if (media.length === 1 && media[0].type === 'photo') {
      return (
        <div
          onClick={() => onOpenImageLightbox(media[0].url, media[0].alt)}
          className="relative w-full max-h-[540px] rounded-2xl overflow-hidden mt-3 bg-slate-950 border border-white/5 cursor-pointer group"
        >
          <img
            src={media[0].url}
            alt={media[0].alt || 'Post photo'}
            className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
            loading="lazy"
          />
        </div>
      );
    }

    // 4. Double photo grid
    if (media.length === 2) {
      return (
        <div className="grid grid-cols-2 gap-1.5 mt-3 rounded-2xl overflow-hidden border border-white/5">
          {media.map((m, idx) => (
            <div
              key={m.id || idx}
              onClick={() => onOpenImageLightbox(m.url, m.alt)}
              className="relative aspect-square bg-slate-950 overflow-hidden cursor-pointer group"
            >
              <img
                src={m.url}
                alt={m.alt || 'Post photo'}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      );
    }

    // 5. 3 or more photos grid
    return (
      <div className="grid grid-cols-2 gap-1.5 mt-3 rounded-2xl overflow-hidden border border-white/5">
        {media.slice(0, 4).map((m, idx) => {
          const isFourth = idx === 3 && media.length > 4;
          const remaining = media.length - 4;
          return (
            <div
              key={m.id || idx}
              onClick={() => onOpenImageLightbox(m.url, m.alt)}
              className="relative aspect-square bg-slate-950 overflow-hidden cursor-pointer group"
            >
              <img
                src={m.url}
                alt={m.alt || 'Post photo'}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                loading="lazy"
              />
              {isFourth && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center text-white font-extrabold text-xl">
                  +{remaining + 1}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const currentReactionConfig = FIRE_REACTIONS.find((r) => r.type === userReaction);

  return (
    <article className="w-full rounded-2xl sm:rounded-3xl bg-[#0f1422] border border-white/10 p-3 sm:p-5 shadow-xl shadow-black/30 transition-all hover:border-white/15">
      {/* Header: Author + Source Platform Badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <img
            src={post.author.avatar}
            alt={post.author.name}
            className="w-10 h-10 rounded-full object-cover border border-emerald-500/30"
          />
          <div>
            <div className="flex items-center gap-1.5 leading-tight flex-wrap">
              <span className="font-bold text-sm sm:text-base text-white hover:underline cursor-pointer">
                {post.author.name}
              </span>
              {post.author.isVerified && (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400/20" />
              )}

              {/* Source Platform Badge */}
              {post.platform === 'youtube' ? (
                <span className="px-2 py-0.5 rounded-full bg-red-600/20 text-red-400 border border-red-500/30 text-[10px] font-bold flex items-center gap-1">
                  <Youtube className="w-3 h-3 fill-current" />
                  <span>YouTube</span>
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>MOTHERLAND</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
              <span>{post.createdAt}</span>
              <span>•</span>
              {post.location && (
                <>
                  <span className="text-slate-300 truncate max-w-[140px]">{post.location}</span>
                  <span>•</span>
                </>
              )}
              <Globe className="w-3 h-3 text-slate-400" />
            </div>
          </div>
        </div>

        {/* Menu Options */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-8 z-30 w-44 rounded-2xl bg-[#141b2c] border border-white/10 shadow-2xl py-1.5 text-xs text-slate-300">
              <button
                onClick={() => {
                  handleSave();
                  setShowMenu(false);
                }}
                className="w-full px-3.5 py-2 text-left hover:bg-white/5 flex items-center gap-2"
              >
                <VaultIcon className="w-4 h-4 text-amber-400" active={isSaved} />
                <span>{isSaved ? 'Remove from Vault' : 'Save to Vault'}</span>
              </button>

              <button
                onClick={() => {
                  handleShare();
                  setShowMenu(false);
                }}
                className="w-full px-3.5 py-2 text-left hover:bg-white/5 flex items-center gap-2"
              >
                <BoostIcon className="w-4 h-4 text-orange-400" />
                <span>Boost Post</span>
              </button>

              {post.isOwnPost && onDeletePost && (
                <button
                  onClick={() => {
                    onDeletePost(post.id);
                    setShowMenu(false);
                  }}
                  className="w-full px-3.5 py-2 text-left text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Post</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Post Text Content */}
      <div className="mt-3 text-xs sm:text-sm text-slate-200 leading-relaxed font-normal">
        <FireRichText text={post.content} emojiSize="sm" />
      </div>

      {/* Media: Photos, Native Video, or YouTube Embed */}
      {renderMedia()}

      {/* Engagement Counters */}
      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-1.5">
          {likesCount > 0 && (
            <span className="flex items-center gap-1.5 font-mono">
              <img
                src={currentReactionConfig?.assetUrl || FIRE_REACTIONS[0].assetUrl}
                alt={currentReactionConfig?.label || 'Fire Like'}
                className="w-4 h-4 object-contain"
              />
              <span className="font-bold text-white">{likesCount}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 font-mono text-[11px]">
          {post.commentsCount > 0 && (
            <span onClick={handleToggleComments} className="hover:underline cursor-pointer">
              {post.commentsCount} talks
            </span>
          )}
          {post.sharesCount > 0 && <span>{post.sharesCount} boosts</span>}
        </div>
      </div>

      {/* ACTION BAR WITH COMPACT 8-REACTION FIRE PICKER & CUSTOM MOTHERLAND ICONS */}
      <div className="relative mt-2 pt-2 border-t border-white/5 grid grid-cols-4 gap-1 text-xs font-semibold text-slate-300">
        {/* Compact 8-Reaction Fire Picker on Long Press / Context Menu */}
        {showReactionPicker && (
          <div
            onMouseLeave={() => setShowReactionPicker(false)}
            className="absolute -top-14 left-0 z-40 bg-[#121a2d] border border-orange-500/35 rounded-full px-2.5 py-1.5 shadow-2xl shadow-orange-950/60 flex items-center gap-1 sm:gap-1.5 animate-in zoom-in-75 duration-150"
          >
            {FIRE_REACTIONS.map((r) => (
              <button
                key={r.type}
                type="button"
                onClick={() => handleSelectReaction(r.type)}
                className="group relative p-1 rounded-full hover:bg-white/10 hover:scale-125 transition-transform active:scale-95 cursor-pointer"
                title={r.label}
              >
                <img
                  src={r.assetUrl}
                  alt={r.label}
                  className="w-7 h-7 sm:w-8 sm:h-8 object-contain drop-shadow-[0_2px_6px_rgba(255,110,0,0.45)]"
                />
                <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity absolute -top-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-black/90 text-[9px] text-amber-300 font-bold whitespace-nowrap">
                  {r.label}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* 1. Fire Like / Reaction Button */}
        <button
          type="button"
          onClick={handleLikeButtonTap}
          onTouchStart={handleLikeTouchStart}
          onTouchEnd={handleLikeTouchEnd}
          onContextMenu={(e) => {
            e.preventDefault();
            setShowReactionPicker(true);
          }}
          title="Tap to Fire Like • Press & hold or right-click for 8 Fire Reactions"
          className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all select-none ${
            currentReactionConfig
              ? `${currentReactionConfig.ringColor} border font-bold`
              : 'hover:bg-white/5 text-slate-300'
          }`}
        >
          {currentReactionConfig ? (
            <span className="flex items-center gap-1.5">
              <img
                src={currentReactionConfig.assetUrl}
                alt={currentReactionConfig.label}
                className="w-5 h-5 object-contain"
              />
              <span className={currentReactionConfig.color}>{currentReactionConfig.label}</span>
            </span>
          ) : (
            <>
              <FireLikeIcon className="w-5 h-5" />
              <span>Fire Like</span>
            </>
          )}
        </button>

        {/* 2. Talk Button (Replaces Comment) */}
        <button
          type="button"
          onClick={handleToggleComments}
          className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors ${
            showComments ? 'text-amber-400 bg-orange-500/15' : 'hover:bg-white/5 text-slate-300'
          }`}
        >
          <TalkIcon className="w-5 h-5" active={showComments} />
          <span>Talk</span>
        </button>

        {/* 3. Boost Button (Replaces Share) */}
        <button
          type="button"
          onClick={handleShare}
          className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors ${
            copied ? 'text-emerald-400 bg-emerald-500/10' : 'hover:bg-white/5 text-slate-300'
          }`}
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <BoostIcon className="w-5 h-5" />}
          <span>{copied ? 'Boosted' : 'Boost'}</span>
        </button>

        {/* 4. Vault Button (Replaces Save) */}
        <button
          type="button"
          onClick={handleSave}
          className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors ${
            isSaved ? 'text-amber-400 bg-amber-500/15' : 'hover:bg-white/5 text-slate-300'
          }`}
        >
          <VaultIcon className="w-5 h-5" active={isSaved} />
          <span>Vault</span>
        </button>
      </div>

      {/* THREADED NESTED TALKS & REPLIES SECTION */}
      {showComments && (
        <div className="mt-3 pt-3 border-t border-white/5 space-y-3">
          {commentError && (
            <div className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px]">
              {commentError}
            </div>
          )}
          {/* Main Comment Input + Fire Emoji Picker */}
          <form onSubmit={handleAddComment} className="space-y-1.5">
            <FireDraftPreview value={newCommentText} />
            <div className="flex items-center gap-2">
              <img
                src={currentUser?.avatar || DEFAULT_AVATAR}
                alt={currentUser?.name || 'Guest'}
                className="w-7 h-7 rounded-full object-cover"
              />
              <FirePickerTrigger
                size="sm"
                onClick={() => setFirePickerTarget('comment')}
                active={firePickerTarget === 'comment'}
                title="Add Fire Emoji to Talk"
              />
              <input
                type="text"
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="Write a talk..."
                className="flex-1 px-3.5 py-2 rounded-xl bg-[#090d16] border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500/50"
              />
              <button
                type="submit"
                disabled={!newCommentText.trim()}
                className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white transition-all shadow-md"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>

          {/* Comments & Nested Replies List */}
          <div className="space-y-3 pt-1 max-h-72 overflow-y-auto pr-1">
            {comments.map((c) => (
              <div key={c.id} className="space-y-2">
                {/* Parent Comment */}
                <div className="flex items-start gap-2.5 text-xs">
                  <img
                    src={c.author.avatar}
                    alt={c.author.name}
                    className="w-7 h-7 rounded-full object-cover mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="bg-[#12192a] p-3 rounded-2xl border border-white/5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-[11px]">{c.author.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{c.createdAt}</span>
                      </div>

                      {editingCommentId === c.id ? (
                        <div className="space-y-1.5 pt-1">
                          <FireDraftPreview value={editText} />
                          <div className="flex items-center gap-2">
                            <FirePickerTrigger
                              size="sm"
                              onClick={() => setFirePickerTarget('edit')}
                              active={firePickerTarget === 'edit'}
                            />
                            <input
                              type="text"
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              className="flex-1 px-2 py-1 rounded-lg bg-black text-xs text-white border border-white/10"
                            />
                            <button
                              onClick={() => handleSaveEdit(c.id)}
                              className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-bold"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-slate-300 text-xs leading-relaxed">
                          <FireRichText text={c.text} emojiSize="sm" />
                        </p>
                      )}
                    </div>

                    {/* Comment Sub-actions: Like, Reply, Edit, Delete */}
                    <div className="flex items-center gap-3 text-[10px] font-semibold text-slate-400 mt-1 pl-2">
                      <button
                        onClick={() => handleToggleCommentLike(c.id)}
                        className={`hover:underline ${c.isLiked ? 'text-red-400 font-bold' : ''}`}
                      >
                        Like {c.likesCount > 0 ? `(${c.likesCount})` : ''}
                      </button>

                      <button
                        onClick={() => {
                          setReplyingToCommentId(replyingToCommentId === c.id ? null : c.id);
                          setReplyText('');
                        }}
                        className="hover:underline text-emerald-400"
                      >
                        Reply
                      </button>

                      {currentUser?.id && c.author.id === currentUser.id && (
                        <>
                          <button
                            onClick={() => {
                              setEditingCommentId(c.id);
                              setEditText(c.text);
                            }}
                            className="hover:underline text-slate-400"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteComment(c.id)}
                            className="hover:underline text-red-400"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>

                    {/* Nested Replies List */}
                    {c.replies && c.replies.length > 0 && (
                      <div className="mt-2 space-y-2 pl-4 border-l-2 border-emerald-500/20">
                        {c.replies.map((rep) => (
                          <div key={rep.id} className="flex items-start gap-2 text-xs">
                            <img
                              src={rep.author.avatar}
                              alt={rep.author.name}
                              className="w-6 h-6 rounded-full object-cover mt-0.5"
                            />
                            <div className="flex-1">
                              <div className="bg-[#141d33] p-2.5 rounded-2xl border border-white/5 space-y-0.5">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-white text-[11px]">{rep.author.name}</span>
                                  <span className="text-[10px] text-slate-500 font-mono">{rep.createdAt}</span>
                                </div>
                                <p className="text-slate-200 text-xs leading-relaxed">
                                  <FireRichText text={rep.text} emojiSize="sm" />
                                </p>
                              </div>

                              <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-0.5 pl-2">
                                <button
                                  onClick={() => handleToggleCommentLike(c.id, rep.id)}
                                  className={`hover:underline ${rep.isLiked ? 'text-red-400 font-bold' : ''}`}
                                >
                                  Fire Like {rep.likesCount > 0 ? `(${rep.likesCount})` : ''}
                                </button>
                                {currentUser?.id && rep.author.id === currentUser.id && (
                                  <button
                                    onClick={() => handleDeleteComment(c.id, rep.id)}
                                    className="hover:underline text-red-400"
                                  >
                                    Delete
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Inline Reply Composer */}
                    {replyingToCommentId === c.id && (
                      <div className="mt-2 pl-4 space-y-1.5">
                        <FireDraftPreview value={replyText} />
                        <div className="flex items-center gap-2">
                          <CornerDownRight className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          <FirePickerTrigger
                            size="sm"
                            onClick={() => setFirePickerTarget('reply')}
                            active={firePickerTarget === 'reply'}
                          />
                          <input
                            type="text"
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder={`Reply to ${c.author.name}...`}
                            className="flex-1 px-3 py-1.5 rounded-xl bg-black border border-white/10 text-xs text-white focus:outline-none focus:border-emerald-500"
                          />
                          <button
                            onClick={() => handleAddReply(c.id)}
                            disabled={!replyText.trim()}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs"
                          >
                            Reply
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {comments.length === 0 && (
              <p className="text-[11px] text-slate-500 italic py-1 text-center">
                Be the first to start a Talk on this MOTHERLAND post!
              </p>
            )}
          </div>
        </div>
      )}

      <FireEmojiPicker
        isOpen={firePickerTarget !== null}
        onClose={() => setFirePickerTarget(null)}
        onSelect={(emoji) => {
          const appendToken = (prev: string) =>
            `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}${emoji.token} `;
          if (firePickerTarget === 'comment') setNewCommentText(appendToken);
          else if (firePickerTarget === 'reply') setReplyText(appendToken);
          else if (firePickerTarget === 'edit') setEditText(appendToken);
        }}
      />
    </article>
  );
};
