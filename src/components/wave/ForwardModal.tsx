import React, { useState } from 'react';
import { X, Forward, Search, Check } from 'lucide-react';
import type { ChatMessage, Conversation, UserProfile } from '../../types';

interface ForwardModalProps {
  isOpen: boolean;
  message: ChatMessage | null;
  conversations: Conversation[];
  currentUserId: string;
  onClose: () => void;
  onForwardToConversation: (conversationId: string, msg: ChatMessage) => Promise<void>;
}

export const ForwardModal: React.FC<ForwardModalProps> = ({
  isOpen,
  message,
  conversations,
  currentUserId,
  onClose,
  onForwardToConversation,
}) => {
  const [query, setQuery] = useState('');
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Record<string, boolean>>({});

  if (!isOpen || !message) return null;

  const getConvLabel = (c: Conversation): { title: string; avatar: string; peer?: UserProfile } => {
    if (c.isGroup) {
      return {
        title: c.name || 'Wave Group',
        avatar: c.photo || c.participants[0]?.avatar || '',
      };
    }
    const peer = c.participants.find((p) => p.id !== currentUserId) || c.participants[0];
    return {
      title: peer?.displayName || 'Wave User',
      avatar: peer?.avatar || '',
      peer,
    };
  };

  const filtered = conversations.filter((c) => {
    if (c.isRequest && c.requestStatus === 'declined') return false;
    const label = getConvLabel(c).title.toLowerCase();
    return !query.trim() || label.includes(query.trim().toLowerCase());
  });

  const handleSend = async (convId: string) => {
    if (sendingId || sentIds[convId]) return;
    setSendingId(convId);
    try {
      await onForwardToConversation(convId, message);
      setSentIds((prev) => ({ ...prev, [convId]: true }));
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-[var(--ml-surface)] border border-[var(--ml-border)] shadow-2xl overflow-hidden flex flex-col max-h-[82vh]"
      >
        <div className="px-4 py-3.5 border-b border-[var(--ml-border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Forward className="w-4 h-4 text-[var(--ml-accent-teal)]" />
            <h3 className="font-display font-bold text-base text-[var(--ml-text-primary)]">Forward via Wave</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close forward modal"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[var(--ml-text-secondary)] hover:bg-[var(--ml-surface-soft)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 border-b border-[var(--ml-border)]">
          <div className="relative">
            <Search className="w-4 h-4 text-[var(--ml-text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Wave chats or groups..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-[var(--ml-surface-soft)] border border-[var(--ml-border)] text-sm text-[var(--ml-text-primary)] focus:outline-none focus:border-[var(--ml-accent-teal)]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-[var(--ml-text-muted)] py-8">No matching Wave conversations</p>
          ) : (
            filtered.map((conv) => {
              const info = getConvLabel(conv);
              const sent = sentIds[conv.id];
              return (
                <div
                  key={conv.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--ml-surface-soft)] transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {info.avatar ? (
                      <img src={info.avatar} alt={info.title} className="w-10 h-10 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-[var(--ml-accent-teal)]/20 text-[var(--ml-accent-teal)] flex items-center justify-center font-bold text-sm shrink-0">
                        {info.title.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--ml-text-primary)] truncate">{info.title}</p>
                      <p className="text-xs text-[var(--ml-text-muted)] truncate">
                        {conv.isGroup ? `${conv.participants.length} members` : `@${info.peer?.username || 'wave'}`}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSend(conv.id)}
                    disabled={sendingId === conv.id || sent}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition shrink-0 inline-flex items-center gap-1 cursor-pointer ${
                      sent
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-[var(--ml-accent-teal)] text-white hover:opacity-90'
                    }`}
                  >
                    {sent ? (
                      <>
                        <Check className="w-3.5 h-3.5" /> Sent
                      </>
                    ) : sendingId === conv.id ? (
                      'Sending...'
                    ) : (
                      'Forward'
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
