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
} from '../../services/socialService';

interface SocialPostCardProps {
  post: SocialPost;
  onOpenImageLightbox: (url: string, alt?: string) => void;
  onDeletePost?: (postId: string) => void;
}

const REACTIONS_CONFIG: Array<{ type: PostReactionType; emoji: string; label: string; color: string }> = [
  { type: 'like', emoji: '👍', label: 'Like', color: 'text-blue-400' },
  { type: 'love', emoji: '❤️', label: 'Love', color: 'text-red-500' },
  { type: 'care', emoji: '🥰', label: 'Care', color: 'text-amber-400' },
  { type: 'haha', emoji: '😆', label: 'Haha', color: 'text-yellow-400' },
  { type: 'wow', emoji: '😮', label: 'Wow', color: 'text-amber-300' },
  { type: 'sad', emoji: '😢', label: 'Sad', color: 'text-sky-400' },
  { type: 'angry', emoji: '😡', label: 'Angry', color: 'text-rose-600' },
];

export const SocialPostCard: React.FC<SocialPostCardProps> = ({
  post,
  onOpenImageLightbox,
  onDeletePost,
}) => {
  const [currentUser] = useState(getStoredCurrentUser());
  const [userReaction, setUserReaction] = useState<PostReactionType | null>(post.userReaction || (post.isLiked ? 'like' : null));
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [reactions, setReactions] = useState(post.reactions || { like: post.likesCount, love: 0, care: 0, haha: 0, wow: 0, sad: 0, angry: 0 });
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

  // Video Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
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
    }
  };

  const handleToggleComments = () => {
    if (!showComments) {
      const existing = getPostComments(post.id);
      setComments(existing);
      fetchCommentsFromBackend(post.id).then((fresh) => {
        if (fresh && Array.isArray(fresh)) {
          setComments(fresh);
        }
      });
    }
    setShowComments(!showComments);
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    const added = addPostComment(post.id, newCommentText.trim());
    setComments((prev) => [...prev, added]);
    setNewCommentText('');
  };

  const handleAddReply = (commentId: string) => {
    if (!replyText.trim()) return;
    const addedReply = addCommentReply(post.id, commentId, replyText.trim());

    setComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, replies: [...(c.replies || []), addedReply] } : c))
    );

    setReplyText('');
    setReplyingToCommentId(null);
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
      return (
        <div
          ref={videoContainerRef}
          className={`relative w-full mt-3 rounded-2xl overflow-hidden bg-black border border-white/10 shadow-xl group ${
            isShort ? 'aspect-[9/16] w-full max-h-[82vh]' : 'aspect-video w-full'
          }`}
        >
          <video
            ref={videoRef}
            src={media[0].url}
            poster={media[0].thumbnailUrl}
            playsInline
            muted={isMuted}
            loop
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            className="w-full h-full object-cover"
          />

          {/* Floating Controls Overlay */}
          <div className="absolute inset-0 z-10 flex flex-col justify-between p-3 bg-gradient-to-t from-black/60 via-transparent to-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
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
                    if (isPlaying) videoRef.current.pause();
                    else videoRef.current.play();
                  }
                }}
                className="w-10 h-10 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center shadow-lg transition-transform active:scale-90"
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
              </button>

              <button
                onClick={() => setIsMuted(!isMuted)}
                className="p-2 rounded-full bg-black/60 hover:bg-black text-white"
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
              </button>
            </div>
          </div>
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

  const currentReactionConfig = REACTIONS_CONFIG.find((r) => r.type === userReaction);

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
                <Bookmark className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isSaved ? 'Unsave Post' : 'Save Post'}</span>
              </button>

              <button
                onClick={() => {
                  handleShare();
                  setShowMenu(false);
                }}
                className="w-full px-3.5 py-2 text-left hover:bg-white/5 flex items-center gap-2"
              >
                <Share2 className="w-3.5 h-3.5 text-blue-400" />
                <span>Share Post</span>
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
      <div className="mt-3 text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line font-normal">
        {post.content}
      </div>

      {/* Media: Photos, Native Video, or YouTube Embed */}
      {renderMedia()}

      {/* Engagement Counters */}
      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-1.5">
          {likesCount > 0 && (
            <span className="flex items-center gap-1 font-mono">
              <span className="text-sm">{currentReactionConfig?.emoji || '❤️'}</span>
              <span className="font-bold text-white">{likesCount}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 font-mono text-[11px]">
          {post.commentsCount > 0 && (
            <span onClick={handleToggleComments} className="hover:underline cursor-pointer">
              {post.commentsCount} comments
            </span>
          )}
          {post.sharesCount > 0 && <span>{post.sharesCount} shares</span>}
        </div>
      </div>

      {/* ACTION BAR WITH FACEBOOK-STYLE REACTION PICKER */}
      <div className="relative mt-2 pt-2 border-t border-white/5 grid grid-cols-4 gap-1 text-xs font-semibold text-slate-300">
        {/* Floating Facebook Reaction Selector on Long Press */}
        {showReactionPicker && (
          <div
            onMouseLeave={() => setShowReactionPicker(false)}
            className="absolute -top-12 left-0 z-40 bg-[#162138] border border-white/15 rounded-full px-3 py-1.5 shadow-2xl flex items-center gap-2 animate-in zoom-in-75 duration-150"
          >
            {REACTIONS_CONFIG.map((r) => (
              <button
                key={r.type}
                onClick={() => handleSelectReaction(r.type)}
                className="text-xl sm:text-2xl hover:scale-130 transition-transform active:scale-95 p-1 cursor-pointer"
                title={r.label}
              >
                {r.emoji}
              </button>
            ))}
          </div>
        )}

        {/* 1. Like / Reaction Button */}
        <button
          onClick={handleLikeButtonTap}
          onTouchStart={handleLikeTouchStart}
          onTouchEnd={handleLikeTouchEnd}
          onContextMenu={(e) => {
            e.preventDefault();
            setShowReactionPicker(true);
          }}
          className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all select-none ${
            userReaction ? 'bg-white/10 font-bold' : 'hover:bg-white/5 text-slate-300'
          }`}
        >
          {currentReactionConfig ? (
            <span className="flex items-center gap-1">
              <span className="text-base">{currentReactionConfig.emoji}</span>
              <span className={currentReactionConfig.color}>{currentReactionConfig.label}</span>
            </span>
          ) : (
            <>
              <Heart className="w-4 h-4 text-slate-300" />
              <span>Like</span>
            </>
          )}
        </button>

        {/* 2. Comment Button */}
        <button
          onClick={handleToggleComments}
          className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors ${
            showComments ? 'text-emerald-400 bg-emerald-500/10' : 'hover:bg-white/5 text-slate-300'
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          <span>Comment</span>
        </button>

        {/* 3. Share Button */}
        <button
          onClick={handleShare}
          className="py-2 rounded-xl hover:bg-white/5 flex items-center justify-center gap-1.5 transition-colors text-slate-300"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
          <span>{copied ? 'Copied' : 'Share'}</span>
        </button>

        {/* 4. Save Button */}
        <button
          onClick={handleSave}
          className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors ${
            isSaved ? 'text-amber-400 bg-amber-500/10' : 'hover:bg-white/5 text-slate-300'
          }`}
        >
          <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
          <span>Save</span>
        </button>
      </div>

      {/* THREADED NESTED COMMENTS & REPLIES SECTION */}
      {showComments && (
        <div className="mt-3 pt-3 border-t border-white/5 space-y-3">
          {/* Main Comment Input */}
          <form onSubmit={handleAddComment} className="flex items-center gap-2">
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-7 h-7 rounded-full object-cover"
            />
            <input
              type="text"
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              placeholder="Write a comment..."
              className="flex-1 px-3.5 py-2 rounded-xl bg-[#090d16] border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500/50"
            />
            <button
              type="submit"
              disabled={!newCommentText.trim()}
              className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white transition-all shadow-md"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
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
                        <div className="flex items-center gap-2 pt-1">
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
                      ) : (
                        <p className="text-slate-300 text-xs leading-relaxed">{c.text}</p>
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

                      {c.author.id === currentUser.id && (
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
                                <p className="text-slate-200 text-xs leading-relaxed">{rep.text}</p>
                              </div>

                              <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-0.5 pl-2">
                                <button
                                  onClick={() => handleToggleCommentLike(c.id, rep.id)}
                                  className={`hover:underline ${rep.isLiked ? 'text-red-400 font-bold' : ''}`}
                                >
                                  Like {rep.likesCount > 0 ? `(${rep.likesCount})` : ''}
                                </button>
                                {rep.author.id === currentUser.id && (
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
                      <div className="mt-2 pl-4 flex items-center gap-2">
                        <CornerDownRight className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
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
                    )}
                  </div>
                </div>
              </div>
            ))}

            {comments.length === 0 && (
              <p className="text-[11px] text-slate-500 italic py-1 text-center">
                Be the first to comment on this MOTHERLAND post!
              </p>
            )}
          </div>
        </div>
      )}
    </article>
  );
};
