import { useEffect } from 'react';

interface BackEntry {
  id: string;
  priority: number;
  handler: () => void;
}

const backStack: BackEntry[] = [];
let globalListenersAttached = false;
let historyDepth = 0;

function getTopEntry(): BackEntry | null {
  if (backStack.length === 0) return null;
  // Highest priority wins; ties break by most recently registered
  let best = backStack[backStack.length - 1];
  for (let i = backStack.length - 1; i >= 0; i--) {
    if (backStack[i].priority > best.priority) {
      best = backStack[i];
    }
  }
  return best;
}

export function triggerTopBackAction(): boolean {
  const top = getTopEntry();
  if (!top) return false;
  top.handler();
  return true;
}

type ProgressListener = (progressPx: number) => void;
const progressListeners = new Set<ProgressListener>();

export function subscribeEdgeSwipeProgress(cb: ProgressListener): () => void {
  progressListeners.add(cb);
  return () => {
    progressListeners.delete(cb);
  };
}

function notifyEdgeProgress(px: number) {
  progressListeners.forEach((cb) => cb(px));
}

function ensureGlobalBackListeners() {
  if (globalListenersAttached || typeof window === 'undefined') return;
  globalListenersAttached = true;

  let startX = 0;
  let startY = 0;
  let trackingEdge = false;

  const isBlockedTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) return false;
    if (target.closest('input, textarea, select, [data-no-edge-back="true"]')) {
      return true;
    }
    // Avoid hijacking horizontal scroll trays that are currently scrolled right
    let el: HTMLElement | null = target;
    while (el && el !== document.body) {
      if (el.scrollWidth > el.clientWidth + 4 && el.scrollLeft > 4) {
        return true;
      }
      el = el.parentElement;
    }
    return false;
  };

  window.addEventListener(
    'touchstart',
    (e: TouchEvent) => {
      if (e.touches.length !== 1 || backStack.length === 0) return;
      const t = e.touches[0];
      if (t.clientX <= 28 && !isBlockedTarget(e.target)) {
        trackingEdge = true;
        startX = t.clientX;
        startY = t.clientY;
      } else {
        trackingEdge = false;
      }
    },
    { passive: true }
  );

  window.addEventListener(
    'touchmove',
    (e: TouchEvent) => {
      if (!trackingEdge || e.touches.length !== 1) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = Math.abs(t.clientY - startY);
      if (dy > 65 && dx < 45) {
        trackingEdge = false;
        notifyEdgeProgress(0);
        return;
      }
      if (dx > 12) {
        notifyEdgeProgress(Math.min(96, dx));
      }
    },
    { passive: true }
  );

  const finishEdge = (e: TouchEvent) => {
    if (!trackingEdge) return;
    trackingEdge = false;
    const t = e.changedTouches[0];
    const dx = t ? t.clientX - startX : 0;
    const dy = t ? Math.abs(t.clientY - startY) : 999;
    notifyEdgeProgress(0);

    if (dx >= 68 && dy < 65) {
      triggerTopBackAction();
    }
  };

  window.addEventListener('touchend', finishEdge, { passive: true });
  window.addEventListener('touchcancel', () => {
    trackingEdge = false;
    notifyEdgeProgress(0);
  });

  // Sync Android/browser hardware Back button via history stack
  window.addEventListener('popstate', () => {
    const handled = triggerTopBackAction();
    if (handled) {
      historyDepth = Math.max(0, historyDepth - 1);
      // Keep a guard entry if more stacked views exist
      if (backStack.length > 1 && historyDepth === 0) {
        try {
          window.history.pushState({ mlBack: true }, '');
          historyDepth++;
        } catch {
          // Ignore sandbox history limits
        }
      }
    }
  });
}

/**
 * Registers an active modal, drawer, watch player, or sub-tab onto the global
 * back stack for left-edge swipe right + hardware/browser back support.
 */
export function useBackHandler(
  id: string,
  enabled: boolean,
  onBack: () => void,
  priority = 10
) {
  useEffect(() => {
    ensureGlobalBackListeners();
    if (!enabled) return;

    const entry: BackEntry = { id, priority, handler: onBack };
    backStack.push(entry);

    if (historyDepth < 1) {
      try {
        window.history.pushState({ mlBack: id }, '');
        historyDepth++;
      } catch {
        // Ignore history restrictions
      }
    }

    return () => {
      const idx = backStack.indexOf(entry);
      if (idx !== -1) backStack.splice(idx, 1);
    };
  }, [id, enabled, priority, onBack]);
}
