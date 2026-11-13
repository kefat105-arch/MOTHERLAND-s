import React from 'react';
import type { ChatMessage, Conversation, UserProfile } from '../types';
import { useBackHandler } from '../hooks/useBackNavigation';
import { WaveWorkspace } from './wave/WaveWorkspace';

interface MessagesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  targetUserId?: string | null;
  onClearTargetUser?: () => void;
  onUnreadCountChange?: (totalUnread: number) => void;
  realtimeSignal?: number;
  incomingRealtimeMessage?: { conversationId: string; message: ChatMessage } | null;
  onlineUsersMap?: Record<string, boolean>;
  typingMap?: Record<string, { userId: string; userName: string; expiresAt: number }>;
  onOpenAuth?: () => void;
  sendWsEvent?: (event: string, payload: Record<string, any>) => boolean;
  onStartCall?: (conv: Conversation, callType: 'audio' | 'video') => void;
}

export const MessagesDrawer: React.FC<MessagesDrawerProps> = ({
  isOpen,
  onClose,
  currentUser,
  targetUserId = null,
  onClearTargetUser,
  onUnreadCountChange,
  realtimeSignal = 0,
  incomingRealtimeMessage = null,
  onlineUsersMap = {},
  typingMap = {},
  onOpenAuth,
  sendWsEvent,
  onStartCall,
}) => {
  useBackHandler('wave-workspace-drawer', isOpen, onClose, 65);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[95] bg-black/65 backdrop-blur-sm flex items-center justify-center sm:p-4 lg:p-6"
      role="dialog"
      aria-label="MOTHERLAND WAVE"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full h-full sm:max-w-5xl sm:h-[88vh] sm:rounded-3xl overflow-hidden border border-[var(--ml-border)] shadow-2xl bg-[var(--ml-surface)]"
      >
        <WaveWorkspace
          onClose={onClose}
          currentUser={currentUser}
          targetUserId={targetUserId}
          onClearTargetUser={onClearTargetUser}
          onUnreadCountChange={onUnreadCountChange}
          realtimeSignal={realtimeSignal}
          incomingRealtimeMessage={incomingRealtimeMessage}
          onlineUsersMap={onlineUsersMap}
          typingMap={typingMap}
          onOpenAuth={onOpenAuth}
          sendWsEvent={sendWsEvent}
          onStartCall={onStartCall}
        />
      </div>
    </div>
  );
};
