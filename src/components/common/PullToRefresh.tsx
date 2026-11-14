import React, { useRef, useState } from 'react';
import { Loader2, ArrowDown, RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  disabled?: boolean;
  children: React.ReactNode;
}

const TRIGGER_THRESHOLD_PX = 68;
const MAX_PULL_PX = 104;

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  disabled = false,
  children,
}) => {
  const [pullPx, setPullPx] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const startYRef = useRef<number | null>(null);
  const startXRef = useRef<number | null>(null);
  const isPullingRef = useRef(false);
  const isRefreshingRef = useRef(false);
  const gestureTriggeredRef = useRef(false);

  const shouldIgnoreTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) return false;
    if (
      target.closest('video, iframe, input, textarea, select, [data-no-pull-refresh="true"], [data-no-edge-back="true"]')
    ) {
      return true;
    }
    // Check if nested inside a scrolled inner element
    let cur: HTMLElement | null = target;
    while (cur && cur !== document.body) {
      const style = window.getComputedStyle(cur);
      if (
        (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
        cur.scrollTop > 2
      ) {
        return true;
      }
      cur = cur.parentElement;
    }
    return false;
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (disabled || isRefreshingRef.current) return;
    if (typeof window !== 'undefined' && window.scrollY > 3) return;
    if (e.touches.length !== 1) return;
    if (shouldIgnoreTarget(e.target)) return;

    startYRef.current = e.touches[0].clientY;
    startXRef.current = e.touches[0].clientX;
    isPullingRef.current = false;
    gestureTriggeredRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (disabled || isRefreshingRef.current || startYRef.current === null || startXRef.current === null) {
      return;
    }
    if (typeof window !== 'undefined' && window.scrollY > 3) {
      startYRef.current = null;
      setPullPx(0);
      return;
    }

    const touch = e.touches[0];
    const dy = touch.clientY - startYRef.current;
    const dx = Math.abs(touch.clientX - startXRef.current);

    if (!isPullingRef.current) {
      // Require vertical downward dominance so horizontal swipes / scrolling work untouched
      if (dy > 10 && dy > dx * 1.4) {
        isPullingRef.current = true;
      } else if (dx > 12 || dy < -8) {
        startYRef.current = null;
        startXRef.current = null;
        return;
      }
    }

    if (isPullingRef.current && dy > 0) {
      const damped = Math.min(MAX_PULL_PX, Math.round(dy * 0.48));
      setPullPx(damped);
    }
  };

  const handleTouchEnd = async () => {
    const shouldRefresh =
      !disabled &&
      !isRefreshingRef.current &&
      !gestureTriggeredRef.current &&
      isPullingRef.current &&
      pullPx >= TRIGGER_THRESHOLD_PX;

    startYRef.current = null;
    startXRef.current = null;
    isPullingRef.current = false;

    if (!shouldRefresh) {
      setPullPx(0);
      return;
    }

    gestureTriggeredRef.current = true;
    isRefreshingRef.current = true;
    setIsRefreshing(true);
    setPullPx(54);

    try {
      await onRefresh();
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
      setPullPx(0);
    }
  };

  const readyToTrigger = pullPx >= TRIGGER_THRESHOLD_PX;

  return (
    <div
      data-testid="pull-to-refresh-container"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => {
        startYRef.current = null;
        startXRef.current = null;
        isPullingRef.current = false;
        if (!isRefreshingRef.current) setPullPx(0);
      }}
      className="relative"
    >
      {(pullPx > 8 || isRefreshing) && (
        <div
          data-testid="pull-to-refresh-indicator"
          style={{ height: `${Math.max(pullPx, isRefreshing ? 52 : 0)}px` }}
          className="flex items-center justify-center overflow-hidden transition-[height] duration-150 select-none"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl ml-glass-elevated border border-orange-500/30 text-xs font-bold text-[var(--text-primary)] shadow-sm">
            {isRefreshing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
                <span>Refreshing fresh videos...</span>
              </>
            ) : readyToTrigger ? (
              <>
                <RefreshCw className="w-4 h-4 text-orange-400 rotate-180 transition-transform" />
                <span>Release to refresh</span>
              </>
            ) : (
              <>
                <ArrowDown className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>Pull down to refresh</span>
              </>
            )}
          </div>
        </div>
      )}
      {children}
    </div>
  );
};
