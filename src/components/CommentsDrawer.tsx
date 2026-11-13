import React, { useState, useEffect, useRef } from 'react';
import { X, Send, ThumbsUp, MessageSquare, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../api';
import type { PostComment, YouTubeCommentThread, UserProfile } from '../types';
import { useBackHandler } from '../hooks/useBackNavigation';
import { FireRichText } from './fire/FireRichText';
import { FireEmojiPicker } from './fire/FireEmojiPicker';
import { FireDraftPreview, FirePickerTrigger } from './fire/FireComposerBar';

interface CommentsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  postId?: string;
  youtubeVideoId?: string;
  title?: string;
  currentUser: UserProfile | null;
  onOpenAuth?: () => void;
}

export const CommentsDrawer: React.FC<CommentsDrawerProps> = ({
  isOpen,
  onClose,
  postId,
  youtubeVideoId,
  title,
  currentUser,
  onOpenAuth,
}) => {
  const [motherlandComments, setMotherlandComments] = useState<PostComment[]>([]);
  const [youtubeComments, setYoutubeComments] = useState<YouTubeCommentThread[]>([]);
  const [commentsDisabled, setCommentsDisabled] = useState(false);
  const [disabledMessage, setDisabledMessage] = useState('');
  const [noticeMsg, setNoticeMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [inputComment, setInputComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [dragY, setDragY] = useState(0);
  const [firePickerOpen, setFirePickerOpen] = useState(false);
  const dragStartYRef = useRef<number | null>(null);

  const isYouTube = Boolean(youtubeVideoId);

  useBackHandler('comments-drawer', isOpen, onClose, 65);

  useEffect(() => {
    if (!isOpen) return;
    setNoticeMsg('');
    setDragY(0);

    if (isYouTube && youtubeVideoId) {
      loadYouTubeComments(youtubeVideoId);
    } else if (postId) {
      loadMotherlandComments(postId);
    }
  }, [isOpen, postId, youtubeVideoId]);

  const loadMotherlandComments = async (id: string) => {
    setIsLoading(true);
    try {
      const data = await api.getPostComments(id);
      setMotherlandComments(data.comments || []);
    } catch (err) {
      console.error('Failed to load post comments:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadYouTubeComments = async (videoId: string, pageToken = '') => {
    setIsLoading(true);
    try {
      const res = await api.getYouTubeComments(videoId, pageToken);
      if (res.commentsDisabled) {
        setCommentsDisabled(true);
        setDisabledMessage(res.message || 'Comments are disabled on this YouTube video.');
        setYoutubeComments([]);
      } else {
        setCommentsDisabled(false);
        if (pageToken) {
          setYoutubeComments((prev) => [...prev, ...(res.items || [])]);
        } else {
          setYoutubeComments(res.items || []);
        }
        setNextPageToken(res.nextPageToken || null);
      }
    } catch (err: any) {
      console.error('Failed to load YouTube comments:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendComment = async () => {
    if (!inputComment.trim()) return;

    if (postId) {
      setIsSubmitting(true);
      try {
        const res = await api.addPostComment(postId, inputComment);
        if (res.comment) {
          setMotherlandComments((prev) => [...prev, res.comment]);
          setInputComment('');
        }
      } catch (err) {
        console.error('Failed to submit comment:', err);
      } finally {
        setIsSubmitting(false);
      }
    } else if (isYouTube) {
      setNoticeMsg('Posting comments to YouTube requires Google OAuth authorization.');
    }
  };

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
      onClose();
      return;
    }
    setDragY(0);
    dragStartYRef.current = null;
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg ml-glass-elevated rounded-t-3xl sm:rounded-3xl max-h-[85dvh] h-[85dvh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200 transition-transform"
        style={{ transform: dragY > 0 ? `translateY(${dragY}px)` : undefined }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle + Header */}
        <div
          className="pt-2 px-4 pb-3 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] touch-none"
          onTouchStart={handleHeaderTouchStart}
          onTouchMove={handleHeaderTouchMove}
          onTouchEnd={handleHeaderTouchEnd}
        >
          <div className="w-10 h-1 rounded-full bg-[var(--border-strong)] mx-auto mb-2.5 sm:hidden" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <MessageSquare className="w-4 h-4 text-[var(--accent-primary)] flex-shrink-0" />
              <h3 className="font-bold text-sm text-[var(--text-primary)] whitespace-nowrap">
                {isYouTube ? 'YouTube Comments' : 'Comments'}
              </h3>
              {title && (
                <span className="text-xs text-[var(--text-secondary)] truncate max-w-[200px]">
                  • {title}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)] transition-colors flex-shrink-0"
              aria-label="Close comments"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {noticeMsg && (
            <div className="p-2.5 rounded-xl bg-[var(--accent-gold-soft)] border border-[var(--accent-gold-border)] text-xs text-[var(--accent-gold)]">
              {noticeMsg}
            </div>
          )}

          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-[var(--text-secondary)] gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-[var(--accent-primary)]" />
              <span className="text-xs">
                {isYouTube ? 'Loading real comments from YouTube API...' : 'Loading comments...'}
              </span>
            </div>
          ) : commentsDisabled ? (
            <div className="py-12 flex flex-col items-center justify-center text-center px-4">
              <AlertCircle className="w-8 h-8 text-[var(--accent-gold)] mb-2" />
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                {disabledMessage || 'Comments are disabled on this YouTube video.'}
              </p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                The video creator has turned off comments on YouTube.
              </p>
            </div>
          ) : isYouTube ? (
            /* YouTube Real Comments */
            youtubeComments.length === 0 ? (
              <div className="py-12 text-center text-xs text-[var(--text-secondary)]">
                No comments found on this YouTube video or API key needed.
              </div>
            ) : (
              <>
                {youtubeComments.map((cmt) => (
                  <div key={cmt.id} className="flex gap-3">
                    <img
                      src={cmt.authorProfileImageUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${cmt.authorDisplayName}`}
                      alt={cmt.authorDisplayName}
                      className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-[var(--border-subtle)]"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[var(--text-primary)]">{cmt.authorDisplayName}</span>
                        <span className="text-[10px] text-[var(--text-muted)]">
                          {new Date(cmt.publishedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div
                        className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed break-words"
                        dangerouslySetInnerHTML={{ __html: cmt.textDisplay }}
                      />
                      <div className="flex items-center gap-4 mt-2 text-[11px] text-[var(--text-muted)]">
                        <span className="flex items-center gap-1">
                          <ThumbsUp className="w-3 h-3" />
                          {cmt.likeCount.toLocaleString()}
                        </span>
                        {cmt.totalReplyCount > 0 && (
                          <span className="text-[var(--accent-primary)] font-medium">
                            {cmt.totalReplyCount} {cmt.totalReplyCount === 1 ? 'reply' : 'replies'}
                          </span>
                        )}
                      </div>

                      {/* Comment Replies */}
                      {cmt.replies && cmt.replies.length > 0 && (
                        <div className="mt-3 pl-3 border-l border-[var(--border-subtle)] space-y-2.5">
                          {cmt.replies.map((reply) => (
                            <div key={reply.id} className="flex gap-2">
                              <img
                                src={reply.authorProfileImageUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${reply.authorDisplayName}`}
                                alt={reply.authorDisplayName}
                                className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                              />
                              <div>
                                <span className="text-[11px] font-bold text-[var(--text-primary)]">
                                  {reply.authorDisplayName}
                                </span>
                                <div
                                  className="text-[11px] text-[var(--text-secondary)] mt-0.5"
                                  dangerouslySetInnerHTML={{ __html: reply.textDisplay }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {nextPageToken && (
                  <div className="text-center pt-2">
                    <button
                      onClick={() => youtubeVideoId && loadYouTubeComments(youtubeVideoId, nextPageToken)}
                      className="min-h-[40px] px-4 py-1.5 rounded-xl bg-[var(--accent-primary-soft)] hover:bg-[var(--accent-primary)] text-[var(--accent-primary)] hover:text-[var(--accent-primary-contrast)] text-xs font-semibold border border-[var(--accent-primary-border)] transition-colors"
                    >
                      Load More Comments
                    </button>
                  </div>
                )}
              </>
            )
          ) : (
            /* MOTHERLAND Comments */
            motherlandComments.length === 0 ? (
              <div className="py-12 text-center text-xs text-[var(--text-secondary)]">
                Be the first to comment on this MOTHERLAND post!
              </div>
            ) : (
              motherlandComments.map((cmt) => (
                <div key={cmt.id} className="flex gap-3">
                  <img
                    src={cmt.userAvatar}
                    alt={cmt.userDisplayName}
                    className="w-8 h-8 rounded-xl object-cover flex-shrink-0 border border-[var(--border-subtle)]"
                  />
                  <div className="flex-1 bg-[var(--bg-surface-alt)] p-3 rounded-2xl border border-[var(--border-subtle)]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[var(--text-primary)]">{cmt.userDisplayName}</span>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {new Date(cmt.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                      <FireRichText text={cmt.text} emojiSize="sm" />
                    </div>
                  </div>
                </div>
              ))
            )
          )}
        </div>

        {/* Comment Input Footer */}
        {!commentsDisabled && (
          <div className="p-3 bg-[var(--bg-elevated)] border-t border-[var(--border-subtle)] space-y-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            {currentUser && !isYouTube && <FireDraftPreview value={inputComment} />}
            <div className="flex items-center gap-2">
              {currentUser ? (
                <>
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.displayName}
                    className="w-8 h-8 rounded-xl object-cover border border-[var(--border-subtle)] flex-shrink-0"
                  />
                  {!isYouTube && (
                    <FirePickerTrigger
                      size="sm"
                      active={firePickerOpen}
                      onClick={() => setFirePickerOpen(true)}
                      title="Insert Fire Emoji"
                    />
                  )}
                  <input
                    type="text"
                    placeholder={
                      isYouTube
                        ? 'Google sign-in required to comment on YouTube'
                        : 'Write a comment on MOTHERLAND...'
                    }
                    disabled={isYouTube}
                    value={inputComment}
                    onChange={(e) => setInputComment(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendComment()}
                    className="flex-1 bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] disabled:opacity-50"
                  />
                  <button
                    onClick={handleSendComment}
                    disabled={isSubmitting || !inputComment.trim() || isYouTube}
                    className="w-10 h-10 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-primary-contrast)] disabled:opacity-40 transition-colors flex items-center justify-center flex-shrink-0"
                    aria-label="Send comment"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </>
              ) : (
                <div className="w-full flex items-center justify-between gap-2">
                  <span className="text-xs text-[var(--text-secondary)]">
                    Sign in to post a comment
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAuth?.();
                    }}
                    className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)] text-xs font-bold"
                  >
                    Sign In
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <FireEmojiPicker
        isOpen={firePickerOpen}
        onClose={() => setFirePickerOpen(false)}
        onSelect={(emoji) => {
          setInputComment((prev) => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}${emoji.token} `);
        }}
      />
    </div>
  );
};
