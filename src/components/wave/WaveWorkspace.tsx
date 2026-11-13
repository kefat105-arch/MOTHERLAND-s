import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Send,
  Search,
  ArrowLeft,
  UserPlus,
  Users,
  Phone,
  Video,
  Info,
  Mic,
  Paperclip,
  Pin,
  BellOff,
  Reply,
  Forward,
  Edit3,
  Trash2,
  Copy,
  Check,
  CheckCheck,
  Clock,
  FileText,
  Download,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  ChevronUp,
  RotateCcw,
  LogIn,
  Smile,
  ShieldCheck,
  MoreHorizontal,
} from 'lucide-react';
import { api } from '../../api';
import type {
  CallRecord,
  ChatAttachment,
  ChatMessage,
  Conversation,
  UserProfile,
} from '../../types';
import { WaveLogo } from './WaveLogo';
import { AudioBubblePlayer } from './AudioBubblePlayer';
import { VoiceRecorderBar } from './VoiceRecorderBar';
import { CreateGroupModal } from './CreateGroupModal';
import { GroupInfoDrawer } from './GroupInfoDrawer';
import { ForwardModal } from './ForwardModal';
import { FireRichText } from '../fire/FireRichText';
import { FireEmojiPicker } from '../fire/FireEmojiPicker';
import { FireDraftPreview, FirePickerTrigger } from '../fire/FireComposerBar';
import { FIRE_REACTIONS } from '../../data/fireEmojiCatalog';

const QUICK_EMOJIS = FIRE_REACTIONS.slice(0, 6);

interface PendingAttachment {
  id: string;
  file: File;
  mediaType: 'image' | 'video' | 'audio' | 'file';
  previewUrl?: string;
  uploadedUrl?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  progress: number;
  status: 'uploading' | 'ready' | 'error';
  error?: string;
}

export interface WaveWorkspaceProps {
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

function formatShortTime(iso: string): string {
  try {
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    if (diffMs < 60_000) return 'now';
    if (diffMs < 3600_000) return `${Math.floor(diffMs / 60_000)}m`;
    if (diffMs < 86_400_000) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatCallDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function inferMediaType(mime: string): 'image' | 'video' | 'audio' | 'file' {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'file';
}

export const WaveWorkspace: React.FC<WaveWorkspaceProps> = ({
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
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Left navigation tabs & filters
  const [mainTab, setMainTab] = useState<'chats' | 'groups' | 'requests' | 'calls'>('chats');
  const [subFilter, setSubFilter] = useState<'all' | 'unread' | 'pinned' | 'archived'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchedPeople, setSearchedPeople] = useState<UserProfile[]>([]);
  const [isSearchingPeople, setIsSearchingPeople] = useState(false);
  const [callsHistory, setCallsHistory] = useState<CallRecord[]>([]);
  const [mobileShowThread, setMobileShowThread] = useState(false);

  // Composer & Rich Interactions
  const [inputText, setInputText] = useState('');
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingMsg, setEditingMsg] = useState<ChatMessage | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [firePickerOpen, setFirePickerOpen] = useState(false);

  // Message menu, Forward, Group, Info, In-Chat Search
  const [openMenuMsgId, setOpenMenuMsgId] = useState<string | null>(null);
  const [deleteConfirmMsg, setDeleteConfirmMsg] = useState<ChatMessage | null>(null);
  const [forwardMsg, setForwardMsg] = useState<ChatMessage | null>(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showInfoDrawer, setShowInfoDrawer] = useState(false);
  const [showInChatSearch, setShowInChatSearch] = useState(false);
  const [inChatQuery, setInChatQuery] = useState('');
  const [inChatResults, setInChatResults] = useState<ChatMessage[]>([]);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const activeConvIdRef = useRef<string | null>(null);
  const lastTypingSentAtRef = useRef<number>(0);

  activeConvIdRef.current = activeConversation?.id || null;

  const getConvTitle = useCallback(
    (c: Conversation) => {
      if (c.isGroup) return c.name || 'Wave Group';
      const peer = c.participants.find((p) => p.id !== currentUser?.id) || c.participants[0];
      return peer?.displayName || 'Wave Member';
    },
    [currentUser?.id]
  );

  const getConvAvatar = useCallback(
    (c: Conversation) => {
      if (c.isGroup) return c.photo || c.participants[0]?.avatar || '';
      const peer = c.participants.find((p) => p.id !== currentUser?.id) || c.participants[0];
      return peer?.avatar || '';
    },
    [currentUser?.id]
  );

  const getPeer = useCallback(
    (c: Conversation): UserProfile | undefined => {
      if (c.isGroup) return undefined;
      return c.participants.find((p) => p.id !== currentUser?.id) || c.participants[0];
    },
    [currentUser?.id]
  );

  const isPeerOnline = useCallback(
    (peer?: UserProfile) => {
      if (!peer) return false;
      if (peer.privacy?.showOnlineStatus === false) return false;
      if (typeof onlineUsersMap[peer.id] === 'boolean') return onlineUsersMap[peer.id];
      return Boolean(peer.isOnline);
    },
    [onlineUsersMap]
  );

  const computeTotalUnread = useCallback((list: Conversation[]) => {
    const total = list.reduce((acc, c) => acc + (c.isMuted ? 0 : c.unreadCount || 0), 0);
    onUnreadCountChange?.(total);
  }, [onUnreadCountChange]);

  const loadConversations = useCallback(async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      const data = await api.getConversations();
      const list = data.conversations || [];
      setConversations(list);
      computeTotalUnread(list);
      if (activeConvIdRef.current) {
        const refreshed = list.find((c) => c.id === activeConvIdRef.current);
        if (refreshed) setActiveConversation(refreshed);
      }
    } catch {
      // ignore transient fetch failure
    } finally {
      setIsLoading(false);
    }
  }, [computeTotalUnread, currentUser]);

  const openThread = useCallback(
    async (conv: Conversation) => {
      setActiveConversation(conv);
      setMobileShowThread(true);
      setShowInChatSearch(false);
      setInChatQuery('');
      setInChatResults([]);
      setReplyingTo(null);
      setEditingMsg(null);
      setOpenMenuMsgId(null);
      setSendError('');
      try {
        const res = await api.getMessages(conv.id, undefined, 40, true);
        setMessages(res.messages || []);
        setHasMoreOlder(Boolean(res.hasMore));
        setConversations((prev) => {
          const next = prev.map((c) => (c.id === conv.id ? { ...c, unreadCount: 0 } : c));
          computeTotalUnread(next);
          return next;
        });
        window.setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
        }, 60);
      } catch {
        setMessages([]);
      }
    },
    [computeTotalUnread]
  );

  // Initial load + target user auto-open
  useEffect(() => {
    if (!currentUser) return;
    loadConversations();
    api
      .getCallHistory()
      .then((res) => setCallsHistory(res.calls || []))
      .catch(() => {});
  }, [currentUser, loadConversations]);

  useEffect(() => {
    if (!currentUser || !targetUserId) return;
    api
      .createDirectConversation(targetUserId)
      .then((res) => {
        if (res.conversation) {
          setConversations((prev) => {
            const exists = prev.some((c) => c.id === res.conversation.id);
            return exists ? prev : [res.conversation, ...prev];
          });
          openThread(res.conversation);
        }
      })
      .catch((err: any) => {
        setSendError(err?.message || 'Unable to start Wave conversation.');
      })
      .finally(() => {
        onClearTargetUser?.();
      });
  }, [currentUser, targetUserId, openThread, onClearTargetUser]);

  // Realtime refreshes (read receipts, updates, deletes, call log changes)
  useEffect(() => {
    if (!currentUser || realtimeSignal === 0) return;
    loadConversations();
    if (mainTab === 'calls') {
      api
        .getCallHistory()
        .then((res) => setCallsHistory(res.calls || []))
        .catch(() => {});
    }
    if (activeConvIdRef.current) {
      api
        .getMessages(activeConvIdRef.current, undefined, 40, false)
        .then((res) => {
          setMessages(res.messages || []);
          setHasMoreOlder(Boolean(res.hasMore));
        })
        .catch(() => {});
    }
  }, [realtimeSignal, currentUser, loadConversations, mainTab]);

  // Incoming realtime message fast append
  useEffect(() => {
    if (!incomingRealtimeMessage) return;
    const { conversationId, message } = incomingRealtimeMessage;
    if (activeConvIdRef.current === conversationId) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
      if (message.senderId !== currentUser?.id) {
        api.markConversationRead(conversationId).catch(() => {});
      }
      window.setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 40);
    }
  }, [incomingRealtimeMessage, currentUser?.id]);

  // Search directory users when typing in sidebar
  useEffect(() => {
    if (!currentUser) return;
    const q = searchQuery.trim();
    if (!q) {
      setSearchedPeople([]);
      return;
    }
    let cancelled = false;
    setIsSearchingPeople(true);
    const t = window.setTimeout(() => {
      api
        .searchUsers(q)
        .then((res) => {
          if (!cancelled) {
            setSearchedPeople((res.users || []).filter((u) => u.id !== currentUser.id));
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setIsSearchingPeople(false);
        });
    }, 240);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [searchQuery, currentUser]);

  // In-chat search debounced
  useEffect(() => {
    if (!showInChatSearch || !activeConversation) return;
    const q = inChatQuery.trim();
    if (!q) {
      setInChatResults([]);
      return;
    }
    const t = window.setTimeout(() => {
      api
        .searchChatMessages(activeConversation.id, q)
        .then((res) => setInChatResults(res.messages || []))
        .catch(() => {});
    }, 240);
    return () => window.clearTimeout(t);
  }, [showInChatSearch, inChatQuery, activeConversation]);

  const scrollToMessage = useCallback((messageId: string) => {
    const el = document.getElementById(`wave-msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMsgId(messageId);
      window.setTimeout(() => {
        setHighlightedMsgId((cur) => (cur === messageId ? null : cur));
      }, 1800);
    }
  }, []);

  const loadOlderMessages = async () => {
    if (!activeConversation || !messages.length || isLoadingOlder) return;
    setIsLoadingOlder(true);
    const scroller = messagesScrollRef.current;
    const prevScrollHeight = scroller ? scroller.scrollHeight : 0;
    try {
      const res = await api.getMessages(activeConversation.id, messages[0].id, 35, false);
      const older = res.messages || [];
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...older.filter((m) => !seen.has(m.id)), ...prev];
      });
      setHasMoreOlder(Boolean(res.hasMore));
      window.requestAnimationFrame(() => {
        if (scroller) {
          scroller.scrollTop = scroller.scrollHeight - prevScrollHeight;
        }
      });
    } finally {
      setIsLoadingOlder(false);
    }
  };

  // File / Media Picker & Upload with Retry
  const startUploadForPending = async (item: PendingAttachment) => {
    setPendingAttachments((prev) =>
      prev.map((p) => (p.id === item.id ? { ...p, status: 'uploading', progress: 5, error: undefined } : p))
    );
    try {
      const uploaded = await api.uploadMediaFile(item.file, (pct) => {
        setPendingAttachments((prev) => prev.map((p) => (p.id === item.id ? { ...p, progress: pct } : p)));
      });
      setPendingAttachments((prev) =>
        prev.map((p) =>
          p.id === item.id
            ? {
                ...p,
                status: 'ready',
                progress: 100,
                uploadedUrl: uploaded.url,
                fileName: uploaded.filename,
                fileSize: uploaded.size,
                mimeType: uploaded.mimeType,
              }
            : p
        )
      );
    } catch (err: any) {
      setPendingAttachments((prev) =>
        prev.map((p) =>
          p.id === item.id ? { ...p, status: 'error', error: err?.message || 'Upload failed' } : p
        )
      );
    }
  };

  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const added: PendingAttachment[] = Array.from(files)
      .slice(0, 6 - pendingAttachments.length)
      .map((file) => {
        const mediaType = inferMediaType(file.type || '');
        const previewUrl =
          mediaType === 'image' || mediaType === 'video' ? URL.createObjectURL(file) : undefined;
        return {
          id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          file,
          mediaType,
          previewUrl,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream',
          progress: 0,
          status: 'uploading',
        };
      });
    if (added.length === 0) return;
    setPendingAttachments((prev) => [...prev, ...added]);
    added.forEach((item) => startUploadForPending(item));
  };

  const emitTyping = (typing: boolean) => {
    if (!activeConversation || !sendWsEvent) return;
    const now = Date.now();
    if (typing && now - lastTypingSentAtRef.current < 1800) return;
    lastTypingSentAtRef.current = now;
    sendWsEvent('chat:typing', { conversationId: activeConversation.id, isTyping: typing });
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!activeConversation || !currentUser || isSending) return;

    // Edit Mode
    if (editingMsg) {
      const trimmed = inputText.trim();
      if (!trimmed) return;
      setIsSending(true);
      setSendError('');
      try {
        const res = await api.editMessage(activeConversation.id, editingMsg.id, trimmed);
        setMessages((prev) => prev.map((m) => (m.id === editingMsg.id ? res.message : m)));
        setEditingMsg(null);
        setInputText('');
      } catch (err: any) {
        setSendError(err?.message || 'Unable to update message.');
      } finally {
        setIsSending(false);
      }
      return;
    }

    if (pendingAttachments.some((a) => a.status === 'uploading')) {
      setSendError('Please wait for attachments to finish uploading.');
      return;
    }
    if (pendingAttachments.some((a) => a.status === 'error')) {
      setSendError('Please retry or remove failed attachments.');
      return;
    }

    const readyAttachments: ChatAttachment[] = pendingAttachments
      .filter((a) => a.status === 'ready' && a.uploadedUrl)
      .map((a) => ({
        url: a.uploadedUrl!,
        mediaType: a.mediaType,
        fileName: a.fileName,
        fileSize: a.fileSize,
        mimeType: a.mimeType,
      }));

    const text = inputText.trim();
    if (!text && readyAttachments.length === 0) return;

    setIsSending(true);
    setSendError('');
    emitTyping(false);

    try {
      const primary = readyAttachments[0];
      const res = await api.sendMessage(activeConversation.id, text, primary?.url, {
        mediaType: primary?.mediaType,
        fileName: primary?.fileName,
        fileSize: primary?.fileSize,
        mimeType: primary?.mimeType,
        attachments: readyAttachments.length > 0 ? readyAttachments : undefined,
        replyTo: replyingTo
          ? {
              messageId: replyingTo.id,
              senderId: replyingTo.senderId,
              senderName: replyingTo.senderName,
              text: replyingTo.text || (replyingTo.mediaType ? `[${replyingTo.mediaType}]` : 'Message'),
              mediaType: replyingTo.mediaType,
            }
          : undefined,
      });

      setInputText('');
      setReplyingTo(null);
      pendingAttachments.forEach((a) => a.previewUrl && URL.revokeObjectURL(a.previewUrl));
      setPendingAttachments([]);

      setMessages((prev) => (prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message]));
      if (res.conversation) {
        setActiveConversation(res.conversation);
        setConversations((prev) => [
          res.conversation!,
          ...prev.filter((c) => c.id !== res.conversation!.id),
        ]);
      }
      window.setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 40);
    } catch (err: any) {
      setSendError(err?.message || 'Message failed to send.');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendVoiceNote = async (voice: {
    url: string;
    mimeType: string;
    fileName: string;
    fileSize: number;
    durationSeconds: number;
    waveform: number[];
  }) => {
    if (!activeConversation) return;
    const res = await api.sendMessage(activeConversation.id, '', voice.url, {
      mediaType: 'audio',
      fileName: voice.fileName,
      fileSize: voice.fileSize,
      mimeType: voice.mimeType,
      audioDuration: voice.durationSeconds,
      audioWaveform: voice.waveform,
      replyTo: replyingTo
        ? {
            messageId: replyingTo.id,
            senderId: replyingTo.senderId,
            senderName: replyingTo.senderName,
            text: replyingTo.text || 'Message',
            mediaType: replyingTo.mediaType,
          }
        : undefined,
    });
    setIsRecordingVoice(false);
    setReplyingTo(null);
    setMessages((prev) => (prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message]));
    window.setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 40);
  };

  const handleReact = async (msgId: string, emoji: string) => {
    if (!activeConversation) return;
    setOpenMenuMsgId(null);
    try {
      const res = await api.reactToMessage(activeConversation.id, msgId, emoji);
      setMessages((prev) => prev.map((m) => (m.id === msgId ? res.message : m)));
    } catch {
      // ignore
    }
  };

  const handlePin = async (msgId: string) => {
    if (!activeConversation) return;
    setOpenMenuMsgId(null);
    try {
      const res = await api.pinMessage(activeConversation.id, msgId);
      setMessages((prev) => prev.map((m) => (m.id === msgId ? res.message : m)));
      setActiveConversation((prev) => (prev ? { ...prev, pinnedMessageIds: res.pinnedMessageIds } : prev));
    } catch {
      // ignore
    }
  };

  const handleDeleteMsg = async (msg: ChatMessage, mode: 'me' | 'everyone') => {
    if (!activeConversation) return;
    setDeleteConfirmMsg(null);
    setOpenMenuMsgId(null);
    try {
      const res = await api.deleteMessage(activeConversation.id, msg.id, mode);
      if (mode === 'me') {
        setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      } else {
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? res.message : m)));
      }
    } catch (err: any) {
      setSendError(err?.message || 'Unable to delete message.');
    }
  };

  const handleForwardToConversation = async (targetConvId: string, msg: ChatMessage) => {
    await api.sendMessage(targetConvId, msg.text || '', msg.mediaUrl, {
      mediaType: msg.mediaType,
      fileName: msg.fileName,
      fileSize: msg.fileSize,
      mimeType: msg.mimeType,
      attachments: msg.attachments,
      audioDuration: msg.audioDuration,
      audioWaveform: msg.audioWaveform,
      forwardedFrom: { messageId: msg.id, senderName: msg.senderName },
    });
    loadConversations();
  };

  const handleRespondRequest = async (action: 'accept' | 'decline') => {
    if (!activeConversation) return;
    try {
      const res = await api.respondMessageRequest(activeConversation.id, action);
      setActiveConversation(res.conversation);
      loadConversations();
    } catch (err: any) {
      setSendError(err?.message || 'Unable to update message request');
    }
  };

  const handleStartDirectChat = async (userId: string) => {
    try {
      const res = await api.createDirectConversation(userId);
      setSearchQuery('');
      setSearchedPeople([]);
      setMainTab('chats');
      setConversations((prev) => [
        res.conversation,
        ...prev.filter((c) => c.id !== res.conversation.id),
      ]);
      openThread(res.conversation);
    } catch (err: any) {
      setSendError(err?.message || 'Unable to start conversation.');
    }
  };

  // Filtered Sidebar Conversations
  const requestCount = useMemo(
    () =>
      conversations.filter(
        (c) => c.isRequest && c.requestStatus === 'pending' && c.requestedBy !== currentUser?.id
      ).length,
    [conversations, currentUser?.id]
  );

  const visibleConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return conversations.filter((c) => {
      if (mainTab === 'requests') {
        return Boolean(c.isRequest && c.requestStatus === 'pending');
      }
      if (c.isRequest && c.requestStatus === 'declined') return false;
      if (c.isRequest && c.requestStatus === 'pending' && c.requestedBy !== currentUser?.id) return false;
      if (mainTab === 'groups' && !c.isGroup) return false;

      if (subFilter === 'archived') {
        if (!c.isArchived) return false;
      } else {
        if (c.isArchived) return false;
        if (subFilter === 'unread' && (!c.unreadCount || c.unreadCount <= 0)) return false;
        if (subFilter === 'pinned' && !c.isPinned) return false;
      }

      if (!q) return true;
      const title = getConvTitle(c).toLowerCase();
      const preview = (c.lastMessage?.text || '').toLowerCase();
      return title.includes(q) || preview.includes(q);
    });
  }, [conversations, mainTab, subFilter, searchQuery, currentUser?.id, getConvTitle]);

  const onlineContacts = useMemo(() => {
    const map = new Map<string, UserProfile>();
    conversations.forEach((c) => {
      if (c.isGroup) return;
      const peer = getPeer(c);
      if (peer && isPeerOnline(peer)) map.set(peer.id, peer);
    });
    return Array.from(map.values());
  }, [conversations, getPeer, isPeerOnline]);

  const pinnedMessages = useMemo(
    () => messages.filter((m) => m.isPinned && !m.isDeleted),
    [messages]
  );

  if (!currentUser) {
    return (
      <div className="w-full h-full flex flex-col bg-[var(--ml-surface)] text-[var(--ml-text-primary)]">
        <div className="px-4 py-3.5 border-b border-[var(--ml-border)] flex items-center justify-between">
          <WaveLogo size={28} showWordmark />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close MOTHERLAND WAVE"
            className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-[var(--ml-surface-soft)] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
          <WaveLogo size={54} className="mb-4" />
          <h2 className="font-display font-bold text-xl mb-2">Welcome to MOTHERLAND WAVE</h2>
          <p className="text-sm text-[var(--ml-text-secondary)] mb-5">
            Sign in with your MOTHERLAND account to send direct messages, voice notes, group chats, and start audio or video calls.
          </p>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenAuth?.();
            }}
            className="px-6 py-3 rounded-xl bg-[var(--ml-accent-teal)] text-white font-semibold text-sm inline-flex items-center gap-2 hover:opacity-90 cursor-pointer"
          >
            <LogIn className="w-4 h-4" /> Sign In to Wave
          </button>
        </div>
      </div>
    );
  }

  const activePeer = activeConversation ? getPeer(activeConversation) : undefined;
  const activePeerOnline = activePeer ? isPeerOnline(activePeer) : false;
  const typingEntry = activeConversation ? typingMap[activeConversation.id] : undefined;
  const isPeerTyping = Boolean(
    typingEntry && typingEntry.userId !== currentUser.id && typingEntry.expiresAt > Date.now()
  );

  const showPendingAcceptBanner = Boolean(
    activeConversation?.isRequest &&
      activeConversation.requestStatus === 'pending' &&
      activeConversation.requestedBy !== currentUser.id
  );

  return (
    <div className="w-full h-full flex flex-col md:flex-row bg-[var(--ml-surface)] text-[var(--ml-text-primary)] overflow-hidden relative">
      {/* LEFT SIDEBAR: WAVE HOMEPAGE */}
      <aside
        className={`${
          mobileShowThread ? 'hidden md:flex' : 'flex'
        } w-full md:w-[340px] lg:w-[370px] border-r border-[var(--ml-border)] flex-col h-full shrink-0 bg-[var(--ml-surface)]`}
      >
        {/* Brand Top Bar */}
        <div className="px-4 py-3 border-b border-[var(--ml-border)] flex items-center justify-between gap-2">
          <WaveLogo size={30} showWordmark />
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowCreateGroup(true)}
              title="New Wave Group"
              aria-label="Create new Wave group"
              className="w-10 h-10 rounded-xl bg-[var(--ml-surface-soft)] hover:border-[var(--ml-accent-teal)] border border-[var(--ml-border)] flex items-center justify-center text-[var(--ml-text-primary)] transition cursor-pointer"
            >
              <Users className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Close MOTHERLAND WAVE"
              aria-label="Close MOTHERLAND WAVE"
              className="w-10 h-10 rounded-xl bg-[var(--ml-surface-soft)] hover:bg-red-500/15 hover:text-red-400 border border-[var(--ml-border)] flex items-center justify-center text-[var(--ml-text-secondary)] transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="px-3.5 pt-3 pb-2 space-y-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-[var(--ml-text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats or find people..."
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[var(--ml-surface-soft)] border border-[var(--ml-border)] text-sm text-[var(--ml-text-primary)] focus:outline-none focus:border-[var(--ml-accent-teal)]"
            />
          </div>

          {/* Primary Wave Navigation Tabs */}
          <div className="grid grid-cols-4 gap-1 bg-[var(--ml-surface-soft)] p-1 rounded-xl border border-[var(--ml-border)]">
            {[
              { id: 'chats', label: 'Chats' },
              { id: 'groups', label: 'Groups' },
              { id: 'requests', label: requestCount > 0 ? `Req (${requestCount})` : 'Requests' },
              { id: 'calls', label: 'Calls' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setMainTab(t.id as any);
                  if (t.id === 'calls') {
                    api
                      .getCallHistory()
                      .then((res) => setCallsHistory(res.calls || []))
                      .catch(() => {});
                  }
                }}
                className={`py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
                  mainTab === t.id
                    ? 'bg-[var(--ml-accent-teal)] text-white shadow-sm'
                    : 'text-[var(--ml-text-secondary)] hover:text-[var(--ml-text-primary)]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {(mainTab === 'chats' || mainTab === 'groups') && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {(['all', 'unread', 'pinned', 'archived'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setSubFilter(f)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold capitalize transition whitespace-nowrap cursor-pointer ${
                    subFilter === f
                      ? 'bg-[var(--ml-accent-gold)]/20 text-[var(--ml-accent-gold)] border border-[var(--ml-accent-gold)]/40'
                      : 'text-[var(--ml-text-muted)] hover:bg-[var(--ml-surface-soft)]'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Active Online Strip */}
        {mainTab === 'chats' && !searchQuery && onlineContacts.length > 0 && (
          <div className="px-3.5 py-2 border-b border-[var(--ml-border)] flex items-center gap-3 overflow-x-auto">
            {onlineContacts.map((peer) => (
              <button
                key={peer.id}
                type="button"
                onClick={() => handleStartDirectChat(peer.id)}
                className="flex flex-col items-center gap-1 shrink-0 w-14 group cursor-pointer"
              >
                <div className="relative">
                  <img
                    src={peer.avatar}
                    alt={peer.displayName}
                    className="w-11 h-11 rounded-full object-cover ring-2 ring-[var(--ml-accent-teal)]/50 group-hover:ring-[var(--ml-accent-teal)] transition"
                  />
                  <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[var(--ml-surface)]" />
                </div>
                <span className="text-[11px] font-medium text-[var(--ml-text-secondary)] truncate w-full text-center">
                  {peer.displayName.split(' ')[0]}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Sidebar Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {/* People Quick-Start Results when searching */}
          {searchQuery.trim() && (
            <div className="mb-2 pb-2 border-b border-[var(--ml-border)]">
              <p className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--ml-text-muted)]">
                {isSearchingPeople ? 'Searching MOTHERLAND users...' : 'People on MOTHERLAND'}
              </p>
              {searchedPeople.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => handleStartDirectChat(person.id)}
                  className="w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-xl hover:bg-[var(--ml-surface-soft)] transition text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img src={person.avatar} alt={person.displayName} className="w-9 h-9 rounded-full object-cover shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[var(--ml-text-primary)] truncate">{person.displayName}</p>
                      <p className="text-[11px] text-[var(--ml-text-muted)] truncate">@{person.username}</p>
                    </div>
                  </div>
                  <UserPlus className="w-4 h-4 text-[var(--ml-accent-teal)] shrink-0" />
                </button>
              ))}
            </div>
          )}

          {/* Calls History List */}
          {mainTab === 'calls' ? (
            callsHistory.length === 0 ? (
              <div className="text-center py-12 px-4 text-sm text-[var(--ml-text-muted)]">
                <Phone className="w-8 h-8 mx-auto mb-2 opacity-35" />
                No Wave audio or video calls recorded yet.
              </div>
            ) : (
              callsHistory.map((rec) => {
                const isCaller = rec.callerId === currentUser.id;
                const peerTitle = isCaller ? rec.calleeName || 'Wave Member' : rec.callerName;
                const peerAvatar = isCaller ? rec.calleeAvatar || rec.callerAvatar : rec.callerAvatar;
                const matchingConv = conversations.find((c) => c.id === rec.conversationId);
                return (
                  <div
                    key={rec.id}
                    className="flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl hover:bg-[var(--ml-surface-soft)] transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img src={peerAvatar} alt={peerTitle} className="w-10 h-10 rounded-full object-cover shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--ml-text-primary)] truncate">{peerTitle}</p>
                        <div className="flex items-center gap-1.5 text-xs text-[var(--ml-text-muted)] tabular-nums">
                          {rec.status === 'missed' ? (
                            <PhoneMissed className="w-3.5 h-3.5 text-red-400" />
                          ) : isCaller ? (
                            <PhoneOutgoing className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <PhoneIncoming className="w-3.5 h-3.5 text-[var(--ml-accent-teal)]" />
                          )}
                          <span className="capitalize">{rec.status}</span>
                          {rec.durationSeconds > 0 && <span>· {formatCallDuration(rec.durationSeconds)}</span>}
                          <span>· {formatShortTime(rec.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    {matchingConv && onStartCall && (
                      <button
                        type="button"
                        onClick={() => onStartCall(matchingConv, rec.callType)}
                        title={`Call again (${rec.callType})`}
                        aria-label={`Redial ${peerTitle}`}
                        className="w-9 h-9 rounded-xl bg-[var(--ml-accent-teal)]/15 text-[var(--ml-accent-teal)] hover:bg-[var(--ml-accent-teal)] hover:text-white flex items-center justify-center transition shrink-0 cursor-pointer"
                      >
                        {rec.callType === 'video' ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                );
              })
            )
          ) : isLoading && conversations.length === 0 ? (
            <p className="text-center py-10 text-sm text-[var(--ml-text-muted)]">Loading Wave chats...</p>
          ) : visibleConversations.length === 0 ? (
            <div className="text-center py-12 px-4 text-sm text-[var(--ml-text-muted)]">
              <WaveLogo size={36} className="mx-auto mb-2.5 opacity-60" />
              {mainTab === 'requests'
                ? 'No pending Wave message requests.'
                : 'No conversations here yet. Search a MOTHERLAND user above to start waving!'}
            </div>
          ) : (
            visibleConversations.map((conv) => {
              const title = getConvTitle(conv);
              const avatar = getConvAvatar(conv);
              const peer = getPeer(conv);
              const online = peer ? isPeerOnline(peer) : false;
              const isSelected = activeConversation?.id === conv.id;
              const typing = typingMap[conv.id];
              const someoneTyping = Boolean(
                typing && typing.userId !== currentUser.id && typing.expiresAt > Date.now()
              );

              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => openThread(conv)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition cursor-pointer ${
                    isSelected
                      ? 'bg-[var(--ml-accent-teal)]/15 border border-[var(--ml-accent-teal)]/35'
                      : 'hover:bg-[var(--ml-surface-soft)] border border-transparent'
                  }`}
                >
                  <div className="relative shrink-0">
                    {avatar ? (
                      <img src={avatar} alt={title} className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-[var(--ml-accent-teal)]/20 text-[var(--ml-accent-teal)] flex items-center justify-center font-bold">
                        {title.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    {online && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[var(--ml-surface)]" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-[var(--ml-text-primary)] truncate flex items-center gap-1">
                        {title}
                        {conv.isPinned && <Pin className="w-3 h-3 text-[var(--ml-accent-gold)] shrink-0" />}
                        {conv.isMuted && <BellOff className="w-3 h-3 text-[var(--ml-text-muted)] shrink-0" />}
                        {Boolean(conv.disappearingSeconds) && (
                          <Clock className="w-3 h-3 text-[var(--ml-accent-teal)] shrink-0" />
                        )}
                      </span>
                      <span className="text-[11px] text-[var(--ml-text-muted)] tabular-nums shrink-0">
                        {conv.lastMessage ? formatShortTime(conv.lastMessage.createdAt) : ''}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p
                        className={`text-xs truncate ${
                          someoneTyping
                            ? 'text-[var(--ml-accent-teal)] font-medium'
                            : conv.unreadCount > 0
                            ? 'text-[var(--ml-text-primary)] font-semibold'
                            : 'text-[var(--ml-text-secondary)]'
                        }`}
                      >
                        {someoneTyping
                          ? `${typing.userName.split(' ')[0]} is typing...`
                          : conv.lastMessage?.isDeleted
                          ? 'Message deleted'
                          : conv.lastMessage?.text
                          ? conv.lastMessage.text
                          : conv.lastMessage?.mediaType === 'audio'
                          ? 'Voice message'
                          : conv.lastMessage?.mediaType
                          ? `Sent ${conv.lastMessage.mediaType}`
                          : conv.isGroup
                          ? `${conv.participants.length} members`
                          : 'Start conversation'}
                      </p>

                      {conv.unreadCount > 0 && (
                        <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--ml-accent-teal)] text-white text-[11px] font-bold flex items-center justify-center tabular-nums shrink-0">
                          {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* RIGHT PANE: ACTIVE CONVERSATION */}
      <main
        className={`${
          mobileShowThread ? 'flex' : 'hidden md:flex'
        } flex-1 min-w-0 flex-col h-full bg-[var(--ml-bg)] relative`}
      >
        {!activeConversation ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <WaveLogo size={64} className="mb-4" />
            <h3 className="font-display font-bold text-xl text-[var(--ml-text-primary)] mb-2">
              MOTHERLAND WAVE
            </h3>
            <p className="text-sm text-[var(--ml-text-secondary)] max-w-md mb-5">
              Select a conversation, create a group circle, send voice waveform notes, share files, or launch a WebRTC audio/video call.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowCreateGroup(true)}
                className="px-4 py-2.5 rounded-xl bg-[var(--ml-accent-teal)] text-white text-xs font-semibold inline-flex items-center gap-2 hover:opacity-90 cursor-pointer"
              >
                <Users className="w-4 h-4" /> New Wave Group
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Thread Header */}
            <header className="px-3 sm:px-4 py-2.5 border-b border-[var(--ml-border)] bg-[var(--ml-surface)]/95 backdrop-blur-md flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    setMobileShowThread(false);
                    setShowInfoDrawer(false);
                  }}
                  aria-label="Back to Wave chats"
                  className="md:hidden w-10 h-10 rounded-xl flex items-center justify-center hover:bg-[var(--ml-surface-soft)] cursor-pointer shrink-0"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>

                <div className="relative shrink-0">
                  <img
                    src={getConvAvatar(activeConversation)}
                    alt={getConvTitle(activeConversation)}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  {activePeerOnline && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[var(--ml-surface)]" />
                  )}
                </div>

                <div className="min-w-0">
                  <h4 className="font-display font-bold text-sm text-[var(--ml-text-primary)] truncate">
                    {getConvTitle(activeConversation)}
                  </h4>
                  <p className="text-[11px] text-[var(--ml-text-secondary)] truncate">
                    {isPeerTyping
                      ? `${typingEntry?.userName.split(' ')[0]} is typing...`
                      : activeConversation.isGroup
                      ? `${activeConversation.participants.length} members`
                      : activePeerOnline
                      ? 'Active now on Wave'
                      : activePeer?.lastActiveAt && activePeer.privacy?.showLastSeen !== false
                      ? `Last seen ${formatShortTime(activePeer.lastActiveAt)}`
                      : `@${activePeer?.username || 'wave'}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                {onStartCall && !showPendingAcceptBanner && (
                  <>
                    <button
                      type="button"
                      onClick={() => onStartCall(activeConversation, 'audio')}
                      title="Start Wave Audio Call"
                      aria-label="Start Wave Audio Call"
                      className="w-10 h-10 rounded-xl hover:bg-[var(--ml-surface-soft)] text-[var(--ml-accent-teal)] flex items-center justify-center transition cursor-pointer"
                    >
                      <Phone className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onStartCall(activeConversation, 'video')}
                      title="Start Wave Video Call"
                      aria-label="Start Wave Video Call"
                      className="w-10 h-10 rounded-xl hover:bg-[var(--ml-surface-soft)] text-[var(--ml-accent-teal)] flex items-center justify-center transition cursor-pointer"
                    >
                      <Video className="w-4 h-4" />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setShowInChatSearch((v) => !v)}
                  title="Search inside chat"
                  aria-label="Search inside chat"
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition cursor-pointer ${
                    showInChatSearch
                      ? 'bg-[var(--ml-accent-teal)]/15 text-[var(--ml-accent-teal)]'
                      : 'hover:bg-[var(--ml-surface-soft)] text-[var(--ml-text-secondary)]'
                  }`}
                >
                  <Search className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowInfoDrawer((v) => !v)}
                  title="Conversation & Safety Info"
                  aria-label="Conversation info"
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition cursor-pointer ${
                    showInfoDrawer
                      ? 'bg-[var(--ml-accent-teal)]/15 text-[var(--ml-accent-teal)]'
                      : 'hover:bg-[var(--ml-surface-soft)] text-[var(--ml-text-secondary)]'
                  }`}
                >
                  <Info className="w-4 h-4" />
                </button>
              </div>
            </header>

            {/* In-Chat Search Bar */}
            {showInChatSearch && (
              <div className="px-4 py-2 border-b border-[var(--ml-border)] bg-[var(--ml-surface)] space-y-2">
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-[var(--ml-text-muted)]" />
                  <input
                    type="text"
                    value={inChatQuery}
                    onChange={(e) => setInChatQuery(e.target.value)}
                    placeholder="Search messages in this thread..."
                    className="flex-1 bg-transparent text-sm text-[var(--ml-text-primary)] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setShowInChatSearch(false);
                      setInChatQuery('');
                    }}
                    className="text-xs font-semibold text-[var(--ml-text-secondary)] cursor-pointer"
                  >
                    Close
                  </button>
                </div>
                {inChatResults.length > 0 && (
                  <div className="max-h-36 overflow-y-auto space-y-1 pt-1 border-t border-[var(--ml-border)]">
                    {inChatResults.map((hit) => (
                      <button
                        key={hit.id}
                        type="button"
                        onClick={() => scrollToMessage(hit.id)}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[var(--ml-surface-soft)] text-xs cursor-pointer"
                      >
                        <span className="font-semibold text-[var(--ml-accent-teal)]">{hit.senderName}: </span>
                        <span className="text-[var(--ml-text-primary)]">{hit.text}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Disappearing Timer Strip */}
            {Boolean(activeConversation.disappearingSeconds) && (
              <div className="px-4 py-1.5 bg-[var(--ml-accent-teal)]/10 border-b border-[var(--ml-accent-teal)]/25 flex items-center justify-center gap-2 text-[11px] font-medium text-[var(--ml-accent-teal)]">
                <Clock className="w-3.5 h-3.5" />
                <span>
                  Disappearing messages active: new messages expire in{' '}
                  {activeConversation.disappearingSeconds === 86400 ? '24 hours' : '7 days'}.
                </span>
              </div>
            )}

            {/* Pinned Message Banner */}
            {pinnedMessages.length > 0 && (
              <button
                type="button"
                onClick={() => scrollToMessage(pinnedMessages[pinnedMessages.length - 1].id)}
                className="px-4 py-2 bg-[var(--ml-surface)] border-b border-[var(--ml-border)] flex items-center justify-between gap-2 text-left hover:bg-[var(--ml-surface-soft)] transition cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Pin className="w-3.5 h-3.5 text-[var(--ml-accent-gold)] shrink-0" />
                  <p className="text-xs text-[var(--ml-text-primary)] truncate">
                    <span className="font-semibold">Pinned: </span>
                    {pinnedMessages[pinnedMessages.length - 1].text || 'Media attachment'}
                  </p>
                </div>
                <span className="text-[10px] font-semibold text-[var(--ml-accent-teal)] shrink-0">Jump</span>
              </button>
            )}

            {/* Message Request Pending Prompt */}
            {showPendingAcceptBanner && (
              <div className="p-3.5 bg-[var(--ml-surface)] border-b border-[var(--ml-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-[var(--ml-accent-gold)] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-[var(--ml-text-primary)]">
                      Wave Message Request
                    </p>
                    <p className="text-xs text-[var(--ml-text-secondary)]">
                      {activePeer?.displayName || 'This user'} isn&apos;t in your friends list yet. Accept to reply or launch calls.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleRespondRequest('decline')}
                    className="px-3.5 py-2 rounded-xl border border-red-500/35 text-red-400 text-xs font-semibold hover:bg-red-500/10 cursor-pointer"
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRespondRequest('accept')}
                    className="px-4 py-2 rounded-xl bg-[var(--ml-accent-teal)] text-white text-xs font-semibold hover:opacity-90 cursor-pointer"
                  >
                    Accept
                  </button>
                </div>
              </div>
            )}

            {/* Messages Scroll Feed */}
            <div
              ref={messagesScrollRef}
              onScroll={(e) => {
                if (e.currentTarget.scrollTop < 60 && hasMoreOlder && !isLoadingOlder) {
                  loadOlderMessages();
                }
              }}
              className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 space-y-3"
            >
              {hasMoreOlder && (
                <div className="flex justify-center pb-2">
                  <button
                    type="button"
                    onClick={loadOlderMessages}
                    disabled={isLoadingOlder}
                    className="px-3.5 py-1.5 rounded-xl bg-[var(--ml-surface)] border border-[var(--ml-border)] text-xs font-semibold text-[var(--ml-text-secondary)] inline-flex items-center gap-1 hover:border-[var(--ml-accent-teal)] cursor-pointer"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                    {isLoadingOlder ? 'Loading earlier messages...' : 'Load older messages'}
                  </button>
                </div>
              )}

              {messages.map((msg) => {
                if (msg.messageType === 'system') {
                  return (
                    <div key={msg.id} id={`wave-msg-${msg.id}`} className="flex justify-center py-1">
                      <span className="px-3 py-1 rounded-xl bg-[var(--ml-surface)] border border-[var(--ml-border)] text-[11px] text-[var(--ml-text-muted)]">
                        {msg.text}
                      </span>
                    </div>
                  );
                }

                const isOwn = msg.senderId === currentUser.id;
                const attachments: ChatAttachment[] =
                  msg.attachments && msg.attachments.length > 0
                    ? msg.attachments
                    : msg.mediaUrl
                    ? [
                        {
                          url: msg.mediaUrl,
                          mediaType: msg.mediaType || 'image',
                          fileName: msg.fileName,
                          fileSize: msg.fileSize,
                          mimeType: msg.mimeType,
                          audioDuration: msg.audioDuration,
                          audioWaveform: msg.audioWaveform,
                        },
                      ]
                    : [];

                const reactionEntries = Object.entries(msg.reactions || {}).filter(
                  ([, users]) => Array.isArray(users) && users.length > 0
                );

                const isHighlighted = highlightedMsgId === msg.id;

                return (
                  <div
                    key={msg.id}
                    id={`wave-msg-${msg.id}`}
                    className={`group flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
                  >
                    <div className={`flex items-end gap-2 max-w-[88%] sm:max-w-[74%] ${isOwn ? 'flex-row-reverse' : ''}`}>
                      {!isOwn && (
                        <img
                          src={msg.senderAvatar}
                          alt={msg.senderName}
                          className="w-7 h-7 rounded-full object-cover shrink-0 mb-1"
                        />
                      )}

                      <div
                        className={`relative rounded-2xl px-3.5 py-2.5 shadow-sm transition-all ${
                          isHighlighted ? 'ring-2 ring-[#E6C987] scale-[1.01]' : ''
                        } ${
                          isOwn
                            ? 'bg-gradient-to-br from-[#1B3C59] to-[#235962] text-white rounded-br-sm border border-[#C9A25B]/25'
                            : 'bg-[var(--ml-surface)] text-[var(--ml-text-primary)] rounded-bl-sm border border-[var(--ml-border)]'
                        }`}
                      >
                        {activeConversation.isGroup && !isOwn && (
                          <p className="text-[11px] font-bold text-[var(--ml-accent-teal)] mb-1">
                            {msg.senderName}
                          </p>
                        )}

                        {msg.forwardedFrom && (
                          <p className={`text-[10px] italic mb-1 flex items-center gap-1 ${isOwn ? 'text-white/70' : 'text-[var(--ml-text-muted)]'}`}>
                            <Forward className="w-3 h-3" /> Forwarded from {msg.forwardedFrom.senderName}
                          </p>
                        )}

                        {/* Quoted Reply Block (Tap to scroll to parent message) */}
                        {msg.replyTo && !msg.isDeleted && (
                          <button
                            type="button"
                            onClick={() => scrollToMessage(msg.replyTo!.messageId)}
                            className={`w-full text-left mb-2 px-2.5 py-1.5 rounded-xl border-l-2 transition cursor-pointer ${
                              isOwn
                                ? 'bg-black/20 border-[#E6C987] text-white/90 hover:bg-black/30'
                                : 'bg-[var(--ml-surface-soft)] border-[var(--ml-accent-teal)] text-[var(--ml-text-primary)] hover:opacity-90'
                            }`}
                          >
                            <p className="text-[10px] font-bold truncate">
                              {msg.replyTo.senderName}
                            </p>
                            <div className="text-[11px] opacity-80 truncate">
                              <FireRichText text={msg.replyTo.text} emojiSize="xs" />
                            </div>
                          </button>
                        )}

                        {/* Media / Audio / Files */}
                        {!msg.isDeleted && attachments.length > 0 && (
                          <div className={`space-y-2 ${msg.text ? 'mb-2' : ''}`}>
                            {attachments.map((att, idx) => {
                              if (att.mediaType === 'audio') {
                                return (
                                  <AudioBubblePlayer
                                    key={idx}
                                    src={att.url}
                                    durationHint={att.audioDuration || msg.audioDuration}
                                    waveform={att.audioWaveform || msg.audioWaveform}
                                    isOwn={isOwn}
                                  />
                                );
                              }
                              if (att.mediaType === 'image') {
                                return (
                                  <a
                                    key={idx}
                                    href={att.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block rounded-xl overflow-hidden max-h-72 border border-black/15"
                                  >
                                    <img
                                      src={att.url}
                                      alt={att.fileName || 'Attachment'}
                                      className="max-w-full max-h-72 object-cover"
                                    />
                                  </a>
                                );
                              }
                              if (att.mediaType === 'video') {
                                return (
                                  <video
                                    key={idx}
                                    src={att.url}
                                    controls
                                    playsInline
                                    className="rounded-xl max-w-full max-h-64 bg-black"
                                  />
                                );
                              }
                              return (
                                <a
                                  key={idx}
                                  href={att.url}
                                  download={att.fileName}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border ${
                                    isOwn
                                      ? 'bg-white/10 border-white/20 text-white hover:bg-white/15'
                                      : 'bg-[var(--ml-surface-soft)] border-[var(--ml-border)] text-[var(--ml-text-primary)] hover:border-[var(--ml-accent-teal)]'
                                  }`}
                                >
                                  <FileText className="w-5 h-5 shrink-0" />
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-semibold truncate">{att.fileName || 'Document'}</p>
                                    {att.fileSize && (
                                      <p className="text-[10px] opacity-75">{formatFileSize(att.fileSize)}</p>
                                    )}
                                  </div>
                                  <Download className="w-4 h-4 shrink-0" />
                                </a>
                              );
                            })}
                          </div>
                        )}

                        {/* Text */}
                        {msg.isDeleted ? (
                          <p className="text-xs italic opacity-70">This message was deleted</p>
                        ) : msg.text ? (
                          <div className="text-sm leading-relaxed">
                            <FireRichText text={msg.text} emojiSize="sm" />
                          </div>
                        ) : null}

                        {/* Footer Timestamp + Status */}
                        <div
                          className={`mt-1 flex items-center justify-end gap-1.5 text-[10px] tabular-nums ${
                            isOwn ? 'text-white/75' : 'text-[var(--ml-text-muted)]'
                          }`}
                        >
                          {msg.isPinned && <Pin className="w-2.5 h-2.5 text-[#E6C987]" />}
                          {msg.isEdited && <span>Edited</span>}
                          <span>{formatShortTime(msg.createdAt)}</span>
                          {isOwn && !msg.isDeleted && (
                            msg.isRead ? (
                              <CheckCheck className="w-3.5 h-3.5 text-[#7AD3CE]" aria-label="Read" />
                            ) : msg.deliveredTo && msg.deliveredTo.length > 0 ? (
                              <CheckCheck className="w-3.5 h-3.5 opacity-75" aria-label="Delivered" />
                            ) : (
                              <Check className="w-3.5 h-3.5 opacity-70" aria-label="Sent" />
                            )
                          )}
                        </div>
                      </div>

                      {/* Quick Action Trigger */}
                      {!msg.isDeleted && (
                        <div className="relative flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition shrink-0">
                          <button
                            type="button"
                            onClick={() => setReplyingTo(msg)}
                            title="Reply"
                            aria-label="Reply to message"
                            className="w-7 h-7 rounded-lg hover:bg-[var(--ml-surface)] flex items-center justify-center text-[var(--ml-text-muted)] hover:text-[var(--ml-accent-teal)] cursor-pointer"
                          >
                            <Reply className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setOpenMenuMsgId(openMenuMsgId === msg.id ? null : msg.id)}
                            title="More actions"
                            aria-label="Message actions"
                            className="w-7 h-7 rounded-lg hover:bg-[var(--ml-surface)] flex items-center justify-center text-[var(--ml-text-muted)] hover:text-[var(--ml-text-primary)] cursor-pointer"
                          >
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </button>

                          {openMenuMsgId === msg.id && (
                            <div
                              className={`absolute bottom-8 z-40 w-48 rounded-2xl bg-[var(--ml-surface)] border border-[var(--ml-border)] shadow-xl p-1.5 space-y-1 ${
                                isOwn ? 'right-0' : 'left-0'
                              }`}
                            >
                              {/* Fire Emoji Reaction Row */}
                              <div className="flex items-center justify-between px-1 py-1 border-b border-[var(--ml-border)]">
                                {QUICK_EMOJIS.map((em) => {
                                  const token = `[[fire:${em.id}]]`;
                                  return (
                                    <button
                                      key={em.id}
                                      type="button"
                                      title={em.label}
                                      onClick={() => handleReact(msg.id, token)}
                                      className="w-7 h-7 rounded-lg hover:bg-[var(--ml-surface-soft)] flex items-center justify-center cursor-pointer"
                                    >
                                      <img src={em.assetUrl} alt={em.label} className="w-5 h-5 object-contain" />
                                    </button>
                                  );
                                })}
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setReplyingTo(msg);
                                  setOpenMenuMsgId(null);
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[var(--ml-surface-soft)] text-xs text-left cursor-pointer"
                              >
                                <Reply className="w-3.5 h-3.5" /> Reply
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setForwardMsg(msg);
                                  setOpenMenuMsgId(null);
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[var(--ml-surface-soft)] text-xs text-left cursor-pointer"
                              >
                                <Forward className="w-3.5 h-3.5" /> Forward
                              </button>
                              {msg.text && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard?.writeText(msg.text).catch(() => {});
                                    setCopiedId(msg.id);
                                    setOpenMenuMsgId(null);
                                    window.setTimeout(() => setCopiedId(null), 1500);
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[var(--ml-surface-soft)] text-xs text-left cursor-pointer"
                                >
                                  <Copy className="w-3.5 h-3.5" /> {copiedId === msg.id ? 'Copied!' : 'Copy text'}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handlePin(msg.id)}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[var(--ml-surface-soft)] text-xs text-left cursor-pointer"
                              >
                                <Pin className="w-3.5 h-3.5" /> {msg.isPinned ? 'Unpin' : 'Pin message'}
                              </button>
                              {isOwn && msg.text && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingMsg(msg);
                                    setInputText(msg.text);
                                    setOpenMenuMsgId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[var(--ml-surface-soft)] text-xs text-left cursor-pointer"
                                >
                                  <Edit3 className="w-3.5 h-3.5" /> Edit
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setDeleteConfirmMsg(msg);
                                  setOpenMenuMsgId(null);
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 text-red-400 text-xs text-left cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Reaction Chips */}
                    {reactionEntries.length > 0 && !msg.isDeleted && (
                      <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? 'pr-1' : 'pl-9'}`}>
                        {reactionEntries.map(([emoji, userIds]) => {
                          const iReacted = userIds.includes(currentUser.id);
                          return (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => handleReact(msg.id, emoji)}
                              className={`px-2 py-0.5 rounded-full text-[11px] inline-flex items-center gap-1 border transition cursor-pointer ${
                                iReacted
                                  ? 'bg-[var(--ml-accent-teal)]/20 border-[var(--ml-accent-teal)]/45 text-[var(--ml-text-primary)]'
                                  : 'bg-[var(--ml-surface)] border-[var(--ml-border)] text-[var(--ml-text-secondary)]'
                              }`}
                            >
                              <span className="inline-flex items-center">
                                <FireRichText text={emoji} emojiSize="xs" />
                              </span>
                              <span className="tabular-nums font-semibold">{userIds.length}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              <div ref={messagesEndRef} />
            </div>

            {/* Delete Mode Confirmation Bar */}
            {deleteConfirmMsg && (
              <div className="px-4 py-2.5 bg-[var(--ml-surface)] border-t border-[var(--ml-border)] flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[var(--ml-text-primary)]">Delete message?</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDeleteMsg(deleteConfirmMsg, 'me')}
                    className="px-3 py-1.5 rounded-xl bg-[var(--ml-surface-soft)] text-xs font-semibold cursor-pointer"
                  >
                    Delete for me
                  </button>
                  {deleteConfirmMsg.senderId === currentUser.id && (
                    <button
                      type="button"
                      onClick={() => handleDeleteMsg(deleteConfirmMsg, 'everyone')}
                      className="px-3 py-1.5 rounded-xl bg-red-500 text-white text-xs font-semibold cursor-pointer"
                    >
                      Delete for everyone
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmMsg(null)}
                    className="px-2.5 py-1.5 text-xs text-[var(--ml-text-muted)] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* COMPOSER FOOTER */}
            <footer className="p-2.5 sm:p-3 border-t border-[var(--ml-border)] bg-[var(--ml-surface)] space-y-2 shrink-0">
              {sendError && (
                <div className="px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-center justify-between">
                  <span>{sendError}</span>
                  <button type="button" onClick={() => setSendError('')} className="ml-2 font-bold cursor-pointer">
                    ×
                  </button>
                </div>
              )}

              {/* Quoted Reply / Edit Banner */}
              {(replyingTo || editingMsg) && (
                <div className="px-3 py-2 rounded-xl bg-[var(--ml-surface-soft)] border-l-2 border-[var(--ml-accent-teal)] flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-[var(--ml-accent-teal)]">
                      {editingMsg ? 'Editing message' : `Replying to ${replyingTo?.senderName}`}
                    </p>
                    <p className="text-xs text-[var(--ml-text-secondary)] truncate">
                      {(editingMsg || replyingTo)?.text || 'Media attachment'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setReplyingTo(null);
                      if (editingMsg) {
                        setEditingMsg(null);
                        setInputText('');
                      }
                    }}
                    aria-label="Cancel reply or edit"
                    className="w-7 h-7 rounded-lg hover:bg-[var(--ml-surface)] flex items-center justify-center cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Pending Attachments Progress Strip */}
              {pendingAttachments.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {pendingAttachments.map((att) => (
                    <div
                      key={att.id}
                      className="relative flex items-center gap-2 px-2.5 py-2 rounded-xl bg-[var(--ml-surface-soft)] border border-[var(--ml-border)] min-w-[165px] max-w-[210px] shrink-0"
                    >
                      {att.previewUrl && att.mediaType === 'image' ? (
                        <img src={att.previewUrl} alt={att.fileName} className="w-9 h-9 rounded-lg object-cover shrink-0" />
                      ) : (
                        <FileText className="w-6 h-6 text-[var(--ml-accent-teal)] shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold truncate">{att.fileName}</p>
                        <p className="text-[10px] tabular-nums text-[var(--ml-text-muted)]">
                          {att.status === 'uploading'
                            ? `Uploading ${att.progress}%`
                            : att.status === 'error'
                            ? 'Failed'
                            : formatFileSize(att.fileSize)}
                        </p>
                      </div>
                      {att.status === 'error' && (
                        <button
                          type="button"
                          onClick={() => startUploadForPending(att)}
                          title="Retry upload"
                          className="w-6 h-6 rounded-md bg-[var(--ml-accent-teal)]/20 text-[var(--ml-accent-teal)] flex items-center justify-center cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (att.previewUrl) URL.revokeObjectURL(att.previewUrl);
                          setPendingAttachments((prev) => prev.filter((p) => p.id !== att.id));
                        }}
                        aria-label="Remove attachment"
                        className="w-6 h-6 rounded-md hover:bg-red-500/15 text-red-400 flex items-center justify-center cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {!showPendingAcceptBanner && <FireDraftPreview value={inputText} />}

              {isRecordingVoice ? (
                <VoiceRecorderBar
                  onCancel={() => setIsRecordingVoice(false)}
                  onSendVoice={handleSendVoiceNote}
                />
              ) : (
                <form onSubmit={handleSend} className="flex items-end gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.zip"
                    className="hidden"
                    onChange={(e) => {
                      handleFilesSelected(e.target.files);
                      e.target.value = '';
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={showPendingAcceptBanner}
                    title="Attach photos, videos, audio, or documents"
                    aria-label="Attach files"
                    className="w-10 h-10 rounded-xl bg-[var(--ml-surface-soft)] hover:border-[var(--ml-accent-teal)] border border-[var(--ml-border)] flex items-center justify-center text-[var(--ml-text-secondary)] shrink-0 disabled:opacity-50 cursor-pointer"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>

                  <div className="flex-1 flex items-end gap-1.5 rounded-2xl bg-[var(--ml-surface-soft)] border border-[var(--ml-border)] focus-within:border-[var(--ml-accent-teal)] px-3 py-1.5">
                    <textarea
                      rows={1}
                      value={inputText}
                      disabled={showPendingAcceptBanner}
                      onChange={(e) => {
                        setInputText(e.target.value);
                        emitTyping(e.target.value.trim().length > 0);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder={
                        showPendingAcceptBanner
                          ? 'Accept request above to reply...'
                          : editingMsg
                          ? 'Edit your message...'
                          : 'Message on MOTHERLAND WAVE...'
                      }
                      className="w-full bg-transparent text-sm text-[var(--ml-text-primary)] placeholder:text-[var(--ml-text-muted)] resize-none max-h-28 py-1.5 focus:outline-none"
                    />
                    <FirePickerTrigger
                      size="sm"
                      active={firePickerOpen}
                      onClick={() => setFirePickerOpen(true)}
                      title="Insert Fire Emoji"
                    />
                  </div>

                  {!inputText.trim() && pendingAttachments.length === 0 && !editingMsg ? (
                    <button
                      type="button"
                      disabled={showPendingAcceptBanner}
                      onClick={() => setIsRecordingVoice(true)}
                      title="Record Voice Note"
                      aria-label="Record voice message"
                      className="w-11 h-11 rounded-xl bg-[var(--ml-accent-teal)] text-white flex items-center justify-center hover:opacity-90 disabled:opacity-50 transition shrink-0 cursor-pointer"
                    >
                      <Mic className="w-5 h-5" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={isSending || showPendingAcceptBanner}
                      aria-label="Send message"
                      className="w-11 h-11 rounded-xl bg-[var(--ml-accent-teal)] text-white flex items-center justify-center hover:opacity-90 disabled:opacity-50 transition shrink-0 cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  )}
                </form>
              )}
            </footer>
          </>
        )}
      </main>

      {/* RIGHT DRAWER: GROUP INFO & SAFETY */}
      {activeConversation && showInfoDrawer && (
        <GroupInfoDrawer
          isOpen={showInfoDrawer}
          conversation={activeConversation}
          currentUser={currentUser}
          onClose={() => setShowInfoDrawer(false)}
          onConversationUpdated={(updated) => {
            setActiveConversation(updated);
            setConversations((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
          }}
          onLeftGroup={(convId) => {
            setConversations((prev) => prev.filter((c) => c.id !== convId));
            setActiveConversation(null);
            setMobileShowThread(false);
          }}
          onBlockedPeer={() => {
            loadConversations();
            setActiveConversation(null);
            setMobileShowThread(false);
          }}
        />
      )}

      {/* MODALS */}
      <CreateGroupModal
        isOpen={showCreateGroup}
        currentUser={currentUser}
        onClose={() => setShowCreateGroup(false)}
        onCreated={(conv) => {
          setConversations((prev) => [conv, ...prev]);
          setMainTab('groups');
          openThread(conv);
        }}
      />

      <ForwardModal
        isOpen={Boolean(forwardMsg)}
        message={forwardMsg}
        conversations={conversations}
        currentUserId={currentUser.id}
        onClose={() => setForwardMsg(null)}
        onForwardToConversation={handleForwardToConversation}
      />

      <FireEmojiPicker
        isOpen={firePickerOpen}
        onClose={() => setFirePickerOpen(false)}
        onSelect={(emoji) => {
          setInputText((prev) => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}${emoji.token} `);
        }}
      />
    </div>
  );
};
