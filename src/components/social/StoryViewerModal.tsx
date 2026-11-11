import React, { useState, useEffect } from 'react';
import { X, Trash2, ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react';
import { SocialStory } from '../../types/social';

interface StoryViewerModalProps {
  stories: SocialStory[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onDeleteStory?: (storyId: string) => void;
}

export const StoryViewerModal: React.FC<StoryViewerModalProps> = ({
  stories,
  initialIndex,
  isOpen,
  onClose,
  onDeleteStory,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setCurrentIndex(initialIndex);
    setProgress(0);
  }, [initialIndex, isOpen]);

  // Story timer (5 seconds per story)
  useEffect(() => {
    if (!isOpen || isPaused || stories.length === 0) return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          if (currentIndex < stories.length - 1) {
            setCurrentIndex((c) => c + 1);
            return 0;
          } else {
            onClose();
            return 100;
          }
        }
        return prev + 2; // 100% in ~2.5-3 seconds
      });
    }, 60);

    return () => clearInterval(interval);
  }, [isOpen, isPaused, currentIndex, stories.length, onClose]);

  if (!isOpen || stories.length === 0) return null;

  const currentStory = stories[currentIndex];

  const handleNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex((c) => c + 1);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((c) => c - 1);
      setProgress(0);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/95 backdrop-blur-xl animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md h-full sm:h-[88vh] sm:max-h-[780px] bg-[#070b13] sm:rounded-3xl border sm:border-white/10 flex flex-col justify-between overflow-hidden shadow-2xl select-none"
      >
        {/* Progress Bars Row */}
        <div className="absolute top-0 left-0 right-0 z-30 p-3 pt-4 sm:pt-3 flex items-center gap-1.5 bg-gradient-to-b from-black/80 to-transparent">
          {stories.map((story, idx) => (
            <div
              key={story.id}
              className="flex-1 h-1 rounded-full bg-white/20 overflow-hidden"
            >
              <div
                className="h-full bg-emerald-400 transition-all duration-75"
                style={{
                  width:
                    idx < currentIndex
                      ? '100%'
                      : idx === currentIndex
                      ? `${progress}%`
                      : '0%',
                }}
              />
            </div>
          ))}
        </div>

        {/* Story Header (Author Info & Close) */}
        <div className="absolute top-6 left-0 right-0 z-30 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img
              src={currentStory.author.avatar}
              alt={currentStory.author.name}
              className="w-9 h-9 rounded-full object-cover border-2 border-emerald-400"
            />
            <div>
              <div className="flex items-center gap-1.5 leading-none">
                <span className="font-bold text-white text-xs sm:text-sm">
                  {currentStory.author.name}
                </span>
                <span className="text-[10px] text-slate-300 font-mono">
                  • {currentStory.createdAt}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                {currentStory.author.handle}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsPaused(!isPaused)}
              className="p-1.5 rounded-full bg-black/40 text-white hover:bg-black/60 transition-all"
            >
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>

            {currentStory.isOwnStory && onDeleteStory && (
              <button
                onClick={() => {
                  onDeleteStory(currentStory.id);
                  onClose();
                }}
                className="p-1.5 rounded-full bg-red-600/60 hover:bg-red-600 text-white transition-all"
                title="Delete your Story"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-black/40 text-white hover:bg-black/60 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Media Container & Tap navigation */}
        <div className="relative flex-1 w-full bg-black flex items-center justify-center overflow-hidden">
          {currentStory.mediaType === 'video' ? (
            <video
              src={currentStory.mediaUrl}
              autoPlay
              playsInline
              muted
              loop
              className="w-full h-full object-contain"
            />
          ) : (
            <img
              src={currentStory.mediaUrl}
              alt={currentStory.caption || 'Story'}
              className="w-full h-full object-contain"
            />
          )}

          {/* Left tap area for prev */}
          <div
            onClick={handlePrev}
            className="absolute top-16 bottom-16 left-0 w-1/3 cursor-pointer z-20 flex items-center justify-start pl-2 opacity-0 hover:opacity-75 transition-opacity"
          >
            <span className="p-2 rounded-full bg-black/50 text-white">
              <ChevronLeft className="w-6 h-6" />
            </span>
          </div>

          {/* Right tap area for next */}
          <div
            onClick={handleNext}
            className="absolute top-16 bottom-16 right-0 w-1/3 cursor-pointer z-20 flex items-center justify-end pr-2 opacity-0 hover:opacity-75 transition-opacity"
          >
            <span className="p-2 rounded-full bg-black/50 text-white">
              <ChevronRight className="w-6 h-6" />
            </span>
          </div>
        </div>

        {/* Caption Overlay */}
        {currentStory.caption && (
          <div className="absolute bottom-4 left-3 right-3 z-30 p-3 rounded-2xl bg-black/75 backdrop-blur-md border border-white/10 text-white text-xs leading-relaxed text-center">
            {currentStory.caption}
          </div>
        )}
      </div>
    </div>
  );
};
