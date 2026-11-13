import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, Trash2, Heart, Send } from 'lucide-react';
import type { Story, UserProfile } from '../types';
import { useBackHandler } from '../hooks/useBackNavigation';

interface StoriesBarProps {
  currentUser: UserProfile | null;
  stories: Story[];
  onCreateStory: () => void;
  onStoryViewed: (storyId: string) => void;
  onDeleteStory: (storyId: string) => void;
}

export const StoriesBar: React.FC<StoriesBarProps> = ({
  currentUser,
  stories,
  onCreateStory,
  onStoryViewed,
  onDeleteStory,
}) => {
  const [selectedStoryIndex, setSelectedStoryIndex] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replySentNotice, setReplySentNotice] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [dragDownY, setDragDownY] = useState(0);

  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  useBackHandler(
    'stories-viewer',
    selectedStoryIndex !== null,
    () => setSelectedStoryIndex(null),
    68
  );

  const ownStory = currentUser ? stories.find((s) => s.userId === currentUser.id) : undefined;
  const otherStories = currentUser ? stories.filter((s) => s.userId !== currentUser.id) : stories;
  const viewerStories = stories;
  const currentStory = selectedStoryIndex !== null ? viewerStories[selectedStoryIndex] : null;

  useEffect(() => {
    if (selectedStoryIndex === null || isPaused) return;
    const current = viewerStories[selectedStoryIndex];
    if (current && !current.isViewed) {
      onStoryViewed(current.id);
    }

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          if (selectedStoryIndex < viewerStories.length - 1) {
            setSelectedStoryIndex(selectedStoryIndex + 1);
            return 0;
          } else {
            setSelectedStoryIndex(null);
            return 0;
          }
        }
        return prev + 2;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [selectedStoryIndex, isPaused, viewerStories.length]);

  const handleNext = () => {
    if (selectedStoryIndex !== null && selectedStoryIndex < viewerStories.length - 1) {
      setSelectedStoryIndex(selectedStoryIndex + 1);
      setProgress(0);
    } else {
      setSelectedStoryIndex(null);
    }
  };

  const handlePrev = () => {
    if (selectedStoryIndex !== null && selectedStoryIndex > 0) {
      setSelectedStoryIndex(selectedStoryIndex - 1);
      setProgress(0);
    }
  };

  const handleViewerTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    setIsPaused(true);
  };

  const handleViewerTouchMove = (e: React.TouchEvent) => {
    if (touchStartYRef.current === null) return;
    const dy = e.touches[0].clientY - touchStartYRef.current;
    if (dy > 12) setDragDownY(Math.min(200, dy * 0.65));
  };

  const handleViewerTouchEnd = (e: React.TouchEvent) => {
    setIsPaused(false);
    setDragDownY(0);
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartXRef.current;
    const dy = e.changedTouches[0].clientY - touchStartYRef.current;
    touchStartXRef.current = null;
    touchStartYRef.current = null;

    if (dy > 85 && Math.abs(dy) > Math.abs(dx)) {
      setSelectedStoryIndex(null);
      return;
    }
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) handleNext();
      else handlePrev();
    }
  };

  return (
    <>
      {/* Horizontal Stories Tray */}
      <div className="w-full overflow-x-auto py-2 px-1 no-scrollbar touch-pan-x flex items-center gap-3">
        {/* Own Story / Add Story */}
        <div className="flex-shrink-0 flex flex-col items-center gap-1.5">
          <div className="relative w-16 h-16">
            <button
              type="button"
              onClick={() => {
                if (ownStory) {
                  const idx = viewerStories.findIndex((s) => s.id === ownStory.id);
                  setSelectedStoryIndex(idx !== -1 ? idx : 0);
                  setProgress(0);
                } else {
                  onCreateStory();
                }
              }}
              className="w-16 h-16 rounded-2xl overflow-hidden block focus:outline-none"
            >
              {ownStory ? (
                <div className="w-full h-full rounded-2xl p-[2px] bg-gradient-to-tr from-[var(--accent-primary)] to-[var(--accent-gold)]">
                  <img
                    src={ownStory.mediaUrl || currentUser?.avatar || ''}
                    alt={currentUser?.displayName || 'Your story'}
                    className="w-full h-full object-cover rounded-[13px]"
                  />
                </div>
              ) : (
                <div className="w-full h-full rounded-2xl p-[2px] border-2 border-dashed border-[var(--accent-primary-border)] bg-[var(--bg-surface-alt)] flex items-center justify-center">
                  {currentUser?.avatar ? (
                    <img
                      src={currentUser.avatar}
                      alt={currentUser.displayName}
                      className="w-full h-full object-cover rounded-[12px] opacity-85"
                    />
                  ) : (
                    <Plus className="w-6 h-6 text-[var(--accent-primary)]" />
                  )}
                </div>
              )}
            </button>

            <button
              type="button"
              onClick={onCreateStory}
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)] flex items-center justify-center shadow-md border-2 border-[var(--bg-surface)]"
              title="Add Story"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3px]" />
            </button>
          </div>
          <span className="text-[11px] font-medium text-[var(--text-secondary)] truncate max-w-[68px]">
            {ownStory ? 'Your Story' : 'Add Story'}
          </span>
        </div>

        {/* Other Users' Stories */}
        {otherStories.map((story) => (
          <button
            key={story.id}
            type="button"
            onClick={() => {
              const idx = viewerStories.findIndex((s) => s.id === story.id);
              setSelectedStoryIndex(idx !== -1 ? idx : 0);
              setProgress(0);
            }}
            className="flex-shrink-0 flex flex-col items-center gap-1.5 group focus:outline-none"
          >
            <div
              className={`w-16 h-16 rounded-2xl p-[2px] transition-transform group-hover:scale-105 ${
                story.isViewed
                  ? 'border border-[var(--border-strong)]'
                  : 'bg-gradient-to-tr from-[var(--accent-primary)] to-[var(--accent-gold)]'
              }`}
            >
              <div className="w-full h-full bg-[var(--bg-surface)] rounded-[13px] p-0.5 overflow-hidden">
                <img
                  src={story.userAvatar}
                  alt={story.userDisplayName}
                  className="w-full h-full object-cover rounded-[11px]"
                />
              </div>
            </div>
            <span className="text-[11px] font-medium text-[var(--text-secondary)] truncate max-w-[68px]">
              {story.userDisplayName.split(' ')[0]}
            </span>
          </button>
        ))}
      </div>

      {/* Full-Screen Stories Viewer */}
      {selectedStoryIndex !== null && currentStory && (
        <div className="fixed inset-0 z-50 bg-[#050A14] flex items-center justify-center">
          <div
            className="relative w-full max-w-md h-full md:h-[90dvh] md:max-h-[840px] md:rounded-3xl overflow-hidden bg-[#081020] flex flex-col"
            style={{
              transform: dragDownY > 0 ? `translateY(${dragDownY}px)` : undefined,
              transition: dragDownY === 0 ? 'transform 0.18s ease' : 'none',
            }}
            onTouchStart={handleViewerTouchStart}
            onTouchMove={handleViewerTouchMove}
            onTouchEnd={handleViewerTouchEnd}
          >
            {/* Progress Bars */}
            <div className="absolute top-3 left-3 right-3 z-30 flex items-center gap-1.5 pt-[env(safe-area-inset-top)]">
              {viewerStories.map((s, idx) => (
                <div key={s.id} className="flex-1 h-1 bg-white/25 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#D0AF72] transition-all duration-100 ease-linear"
                    style={{
                      width:
                        idx < selectedStoryIndex
                          ? '100%'
                          : idx === selectedStoryIndex
                          ? `${progress}%`
                          : '0%',
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Header */}
            <div className="absolute top-7 left-3 right-3 z-30 flex items-center justify-between text-white">
              <div className="flex items-center gap-2.5">
                <img
                  src={currentStory.userAvatar}
                  alt={currentStory.userDisplayName}
                  className="w-9 h-9 rounded-xl object-cover border border-[#D0AF72]/50"
                />
                <div>
                  <span className="font-bold text-sm block leading-tight">{currentStory.userDisplayName}</span>
                  <span className="text-[10px] text-[#9CB0CA]">
                    {new Date(currentStory.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {currentUser && currentStory.userId === currentUser.id && (
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteStory(currentStory.id);
                      setSelectedStoryIndex(null);
                    }}
                    className="w-9 h-9 rounded-lg bg-black/45 text-red-400 flex items-center justify-center"
                    title="Delete Story"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedStoryIndex(null)}
                  className="w-9 h-9 rounded-lg bg-black/45 text-white flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div
              className="relative flex-1 bg-black flex items-center justify-center overflow-hidden"
              onMouseDown={() => setIsPaused(true)}
              onMouseUp={() => setIsPaused(false)}
            >
              {currentStory.mediaType === 'video' ? (
                <video
                  src={currentStory.mediaUrl}
                  autoPlay
                  playsInline
                  loop
                  muted
                  className="w-full h-full object-contain"
                />
              ) : (
                <img
                  src={currentStory.mediaUrl}
                  alt="Story"
                  className="w-full h-full object-cover select-none"
                />
              )}

              {/* Tap Navigation Zones */}
              <div className="absolute inset-y-0 left-0 w-1/3 z-20 cursor-pointer" onClick={handlePrev} />
              <div className="absolute inset-y-0 right-0 w-1/3 z-20 cursor-pointer" onClick={handleNext} />

              {currentStory.caption && (
                <div className="absolute bottom-6 left-4 right-4 z-25 bg-[#0A1324]/75 backdrop-blur-md border border-white/10 p-3 rounded-2xl text-white text-xs sm:text-sm">
                  {currentStory.caption}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-[#0A1324] border-t border-[#1E3354] flex items-center gap-2 z-30">
              <input
                type="text"
                placeholder={replySentNotice ? 'Reply sent!' : `Reply to ${currentStory.userDisplayName}...`}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="flex-1 bg-[#101E36] border border-[#1E3354] rounded-xl px-3 py-2 text-xs text-[#F6F2E9] placeholder-[#6E84A2] focus:outline-none focus:border-[#2B8A86]"
              />
              <button
                type="button"
                onClick={() => {
                  if (replyText.trim()) {
                    setReplyText('');
                    setReplySentNotice(true);
                    setTimeout(() => setReplySentNotice(false), 1800);
                  }
                }}
                className="w-9 h-9 rounded-xl bg-[#2B8A86] text-[#F8F4EC] flex items-center justify-center"
              >
                <Send className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsLiked((l) => !l)}
                className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  isLiked ? 'text-[#E05858] bg-red-500/15' : 'text-white/80 bg-[#162846]'
                }`}
              >
                <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
