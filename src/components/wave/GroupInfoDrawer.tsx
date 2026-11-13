import React, { useEffect, useState } from 'react';
import {
  X,
  Bell,
  BellOff,
  Pin,
  Archive,
  Clock,
  ShieldAlert,
  UserPlus,
  UserMinus,
  Shield,
  LogOut,
  FileText,
  Link2,
  Image as ImageIcon,
  Flag,
  Ban,
  Check,
} from 'lucide-react';
import { api } from '../../api';
import type { ChatAttachment, Conversation, UserProfile } from '../../types';

interface GroupInfoDrawerProps {
  isOpen: boolean;
  conversation: Conversation;
  currentUser: UserProfile;
  onClose: () => void;
  onConversationUpdated: (conv: Conversation) => void;
  onLeftGroup: (convId: string) => void;
  onBlockedPeer: (userId: string) => void;
}

export const GroupInfoDrawer: React.FC<GroupInfoDrawerProps> = ({
  isOpen,
  conversation,
  currentUser,
  onClose,
  onConversationUpdated,
  onLeftGroup,
  onBlockedPeer,
}) => {
  const [tab, setTab] = useState<'info' | 'media' | 'links'>('info');
  const [mediaItems, setMediaItems] = useState<(ChatAttachment & { messageId: string; senderName: string; createdAt: string })[]>([]);
  const [links, setLinks] = useState<{ url: string; messageId: string; senderName: string; createdAt: string }[]>([]);
  const [editingName, setEditingName] = useState(conversation.name || '');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');

  // Add members picker
  const [showAddMember, setShowAddMember] = useState(false);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [selectedNewIds, setSelectedNewIds] = useState<string[]>([]);

  // Report modal state
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('Harassment or Spam');
  const [reportDetails, setReportDetails] = useState('');

  useEffect(() => {
    setEditingName(conversation.name || '');
  }, [conversation.id, conversation.name]);

  useEffect(() => {
    if (!isOpen) return;
    api
      .getConversationMedia(conversation.id)
      .then((res) => {
        setMediaItems(res.items || []);
        setLinks(res.links || []);
      })
      .catch(() => {});
  }, [isOpen, conversation.id]);

  if (!isOpen) return null;

  const isGroup = conversation.isGroup;
  const peer = !isGroup
    ? conversation.participants.find((p) => p.id !== currentUser.id) || conversation.participants[0]
    : undefined;
  const isCreator = isGroup && conversation.creatorId === currentUser.id;
  const isAdmin = isGroup && (isCreator || conversation.adminIds?.includes(currentUser.id));

  const handleUpdateSetting = async (updates: Parameters<typeof api.updateConversationSettings>[1], note?: string) => {
    setSaving(true);
    setFeedback('');
    try {
      const res = await api.updateConversationSettings(conversation.id, updates);
      onConversationUpdated(res.conversation);
      if (note) setFeedback(note);
    } catch (err: any) {
      setFeedback(err?.message || 'Action failed');
    } finally {
      setSaving(false);
    }
  };

  const openAddMemberPicker = async () => {
    setShowAddMember(true);
    try {
      const res = await api.searchUsers('');
      const existing = new Set(conversation.participants.map((p) => p.id));
      setAllUsers((res.users || []).filter((u) => !existing.has(u.id)));
    } catch {
      setAllUsers([]);
    }
  };

  const handleConfirmAddMembers = async () => {
    if (!selectedNewIds.length) return;
    setSaving(true);
    try {
      const res = await api.addGroupMembers(conversation.id, selectedNewIds);
      onConversationUpdated(res.conversation);
      setSelectedNewIds([]);
      setShowAddMember(false);
      setFeedback('Members added.');
    } catch (err: any) {
      setFeedback(err?.message || 'Unable to add members');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMember = async (uid: string) => {
    setSaving(true);
    try {
      const res = await api.removeGroupMember(conversation.id, uid);
      onConversationUpdated(res.conversation);
    } catch (err: any) {
      setFeedback(err?.message || 'Unable to remove member');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAdmin = async (uid: string, currentlyAdmin: boolean) => {
    setSaving(true);
    try {
      const res = await api.setGroupAdmin(conversation.id, uid, !currentlyAdmin);
      onConversationUpdated(res.conversation);
    } catch (err: any) {
      setFeedback(err?.message || 'Unable to update admin role');
    } finally {
      setSaving(false);
    }
  };

  const handleLeaveGroup = async () => {
    setSaving(true);
    try {
      await api.leaveGroup(conversation.id);
      onLeftGroup(conversation.id);
      onClose();
    } catch (err: any) {
      setFeedback(err?.message || 'Unable to leave group');
    } finally {
      setSaving(false);
    }
  };

  const handleBlockPeer = async () => {
    if (!peer) return;
    setSaving(true);
    try {
      await api.toggleBlock(peer.id);
      onBlockedPeer(peer.id);
      onClose();
    } catch (err: any) {
      setFeedback(err?.message || 'Block toggle failed');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!peer) return;
    setSaving(true);
    try {
      await api.reportUser(peer.id, {
        reason: reportReason,
        details: reportDetails,
        conversationId: conversation.id,
      });
      setShowReport(false);
      setReportDetails('');
      setFeedback('Report submitted safely.');
    } catch (err: any) {
      setFeedback(err?.message || 'Report submission failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full sm:w-80 lg:w-96 border-l border-[var(--ml-border)] bg-[var(--ml-surface)] flex flex-col h-full shrink-0">
      <div className="px-4 py-3 border-b border-[var(--ml-border)] flex items-center justify-between">
        <h3 className="font-display font-bold text-sm text-[var(--ml-text-primary)]">
          {isGroup ? 'Group Details' : 'Chat Details & Safety'}
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details panel"
          className="w-9 h-9 rounded-xl flex items-center justify-center text-[var(--ml-text-secondary)] hover:bg-[var(--ml-surface-soft)] cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="px-3 pt-2.5 pb-1 flex gap-1.5 border-b border-[var(--ml-border)]">
        {[
          { id: 'info', label: 'Controls' },
          { id: 'media', label: `Media (${mediaItems.length})` },
          { id: 'links', label: `Links (${links.length})` },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as any)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              tab === t.id
                ? 'bg-[var(--ml-accent-teal)] text-white'
                : 'text-[var(--ml-text-secondary)] hover:bg-[var(--ml-surface-soft)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {feedback && (
          <div className="px-3 py-2 rounded-xl bg-[var(--ml-accent-teal)]/15 border border-[var(--ml-accent-teal)]/35 text-xs font-medium text-[var(--ml-text-primary)]">
            {feedback}
          </div>
        )}

        {tab === 'info' && (
          <>
            {/* Header Summary */}
            <div className="flex flex-col items-center text-center">
              <img
                src={isGroup ? conversation.photo || peer?.avatar || conversation.participants[0]?.avatar : peer?.avatar}
                alt={isGroup ? conversation.name || 'Wave Group' : peer?.displayName || 'User'}
                className="w-16 h-16 rounded-full object-cover mb-2.5 ring-2 ring-[var(--ml-border)]"
              />
              {isGroup && isAdmin ? (
                <div className="w-full flex gap-1.5 items-center mt-1">
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-xl bg-[var(--ml-surface-soft)] border border-[var(--ml-border)] text-sm font-semibold text-[var(--ml-text-primary)]"
                  />
                  <button
                    type="button"
                    disabled={saving || !editingName.trim() || editingName.trim() === conversation.name}
                    onClick={() => handleUpdateSetting({ name: editingName.trim() }, 'Group name updated')}
                    className="px-3 py-1.5 rounded-xl bg-[var(--ml-accent-teal)] text-white text-xs font-semibold disabled:opacity-50 cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <h4 className="font-display font-bold text-base text-[var(--ml-text-primary)]">
                  {isGroup ? conversation.name || 'Wave Group' : peer?.displayName}
                </h4>
              )}
              <p className="text-xs text-[var(--ml-text-muted)] mt-0.5">
                {isGroup
                  ? `${conversation.participants.length} participants`
                  : `@${peer?.username || 'member'}`}
              </p>
            </div>

            {/* Conversation Actions */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleUpdateSetting({ isMuted: !conversation.isMuted })}
                className="min-h-[46px] px-2 py-2 rounded-xl bg-[var(--ml-surface-soft)] hover:border-[var(--ml-accent-teal)] border border-[var(--ml-border)] flex flex-col items-center justify-center gap-1 text-[11px] font-semibold text-[var(--ml-text-primary)] cursor-pointer"
              >
                {conversation.isMuted ? <BellOff className="w-4 h-4 text-amber-400" /> : <Bell className="w-4 h-4" />}
                {conversation.isMuted ? 'Unmute' : 'Mute'}
              </button>
              <button
                type="button"
                onClick={() => handleUpdateSetting({ isPinned: !conversation.isPinned })}
                className="min-h-[46px] px-2 py-2 rounded-xl bg-[var(--ml-surface-soft)] hover:border-[var(--ml-accent-teal)] border border-[var(--ml-border)] flex flex-col items-center justify-center gap-1 text-[11px] font-semibold text-[var(--ml-text-primary)] cursor-pointer"
              >
                <Pin className={`w-4 h-4 ${conversation.isPinned ? 'text-[var(--ml-accent-gold)]' : ''}`} />
                {conversation.isPinned ? 'Unpin' : 'Pin'}
              </button>
              <button
                type="button"
                onClick={() => handleUpdateSetting({ isArchived: !conversation.isArchived })}
                className="min-h-[46px] px-2 py-2 rounded-xl bg-[var(--ml-surface-soft)] hover:border-[var(--ml-accent-teal)] border border-[var(--ml-border)] flex flex-col items-center justify-center gap-1 text-[11px] font-semibold text-[var(--ml-text-primary)] cursor-pointer"
              >
                <Archive className={`w-4 h-4 ${conversation.isArchived ? 'text-[var(--ml-accent-teal)]' : ''}`} />
                {conversation.isArchived ? 'Unarchive' : 'Archive'}
              </button>
            </div>

            {/* Disappearing Messages */}
            <div className="p-3 rounded-2xl bg-[var(--ml-surface-soft)] border border-[var(--ml-border)] space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[var(--ml-accent-teal)]" />
                <span className="text-xs font-bold text-[var(--ml-text-primary)]">Disappearing Messages</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { label: 'Off', val: 0 },
                  { label: '24 Hours', val: 86400 },
                  { label: '7 Days', val: 604800 },
                ].map((opt) => {
                  const active = (conversation.disappearingSeconds || 0) === opt.val;
                  return (
                    <button
                      key={opt.val}
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        handleUpdateSetting(
                          { disappearingSeconds: opt.val },
                          opt.val === 0 ? 'Disappearing timer turned off' : `New messages auto-expire after ${opt.label}`
                        )
                      }
                      className={`py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                        active
                          ? 'bg-[var(--ml-accent-teal)] text-white'
                          : 'bg-[var(--ml-surface)] border border-[var(--ml-border)] text-[var(--ml-text-secondary)]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-[var(--ml-text-muted)] leading-relaxed">
                New messages sent while enabled are purged by the server when expired. Browsers cannot block recipients from taking screenshots or copying text manually.
              </p>
            </div>

            {/* Group Member Management */}
            {isGroup && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--ml-text-secondary)]">
                    Members ({conversation.participants.length})
                  </span>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={openAddMemberPicker}
                      className="text-xs font-semibold text-[var(--ml-accent-teal)] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" /> Add
                    </button>
                  )}
                </div>

                {showAddMember && (
                  <div className="p-2.5 rounded-xl bg-[var(--ml-surface-soft)] border border-[var(--ml-border)] space-y-2">
                    <div className="max-h-36 overflow-y-auto space-y-1">
                      {allUsers.length === 0 ? (
                        <p className="text-xs text-[var(--ml-text-muted)] py-2 text-center">Everyone is already in this group</p>
                      ) : (
                        allUsers.map((u) => {
                          const picked = selectedNewIds.includes(u.id);
                          return (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() =>
                                setSelectedNewIds((prev) =>
                                  prev.includes(u.id) ? prev.filter((id) => id !== u.id) : [...prev, u.id]
                                )
                              }
                              className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-[var(--ml-surface)] text-xs text-left cursor-pointer"
                            >
                              <span className="truncate font-medium text-[var(--ml-text-primary)]">{u.displayName}</span>
                              {picked && <Check className="w-3.5 h-3.5 text-[var(--ml-accent-teal)]" />}
                            </button>
                          );
                        })
                      )}
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAddMember(false)}
                        className="px-2.5 py-1 rounded-lg text-xs text-[var(--ml-text-secondary)] cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={!selectedNewIds.length || saving}
                        onClick={handleConfirmAddMembers}
                        className="px-3 py-1 rounded-lg bg-[var(--ml-accent-teal)] text-white text-xs font-semibold disabled:opacity-50 cursor-pointer"
                      >
                        Add ({selectedNewIds.length})
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  {conversation.participants.map((member) => {
                    const memberIsCreator = member.id === conversation.creatorId;
                    const memberIsAdmin = memberIsCreator || conversation.adminIds?.includes(member.id);
                    const isSelf = member.id === currentUser.id;
                    return (
                      <div
                        key={member.id}
                        className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-[var(--ml-surface-soft)]"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img src={member.avatar} alt={member.displayName} className="w-8 h-8 rounded-full object-cover shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-[var(--ml-text-primary)] truncate">
                              {member.displayName} {isSelf ? '(You)' : ''}
                            </p>
                            <p className="text-[11px] text-[var(--ml-text-muted)]">
                              {memberIsCreator ? 'Creator' : memberIsAdmin ? 'Admin' : 'Member'}
                            </p>
                          </div>
                        </div>

                        {isAdmin && !isSelf && !memberIsCreator && (
                          <div className="flex items-center gap-1 shrink-0">
                            {isCreator && (
                              <button
                                type="button"
                                title={memberIsAdmin ? 'Demote admin' : 'Make admin'}
                                onClick={() => handleToggleAdmin(member.id, Boolean(memberIsAdmin))}
                                className="w-7 h-7 rounded-lg hover:bg-[var(--ml-surface)] flex items-center justify-center text-[var(--ml-accent-gold)] cursor-pointer"
                              >
                                <Shield className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              title="Remove from group"
                              onClick={() => handleRemoveMember(member.id)}
                              className="w-7 h-7 rounded-lg hover:bg-red-500/15 flex items-center justify-center text-red-400 cursor-pointer"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  disabled={saving}
                  onClick={handleLeaveGroup}
                  className="w-full min-h-[44px] rounded-xl border border-red-500/35 bg-red-500/10 text-red-400 font-semibold text-xs flex items-center justify-center gap-2 hover:bg-red-500/15 transition cursor-pointer"
                >
                  <LogOut className="w-4 h-4" /> Leave Wave Group
                </button>
              </div>
            )}

            {/* Safety Controls for 1:1 Chats */}
            {!isGroup && peer && (
              <div className="space-y-2 pt-2 border-t border-[var(--ml-border)]">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--ml-text-secondary)]">Safety &amp; Moderation</p>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleBlockPeer}
                  className="w-full min-h-[44px] rounded-xl border border-red-500/35 bg-red-500/10 text-red-400 font-semibold text-xs flex items-center justify-center gap-2 hover:bg-red-500/15 transition cursor-pointer"
                >
                  <Ban className="w-4 h-4" /> Block {peer.displayName}
                </button>
                <button
                  type="button"
                  onClick={() => setShowReport((v) => !v)}
                  className="w-full min-h-[44px] rounded-xl border border-[var(--ml-border)] bg-[var(--ml-surface-soft)] text-[var(--ml-text-primary)] font-semibold text-xs flex items-center justify-center gap-2 hover:border-amber-400/50 transition cursor-pointer"
                >
                  <Flag className="w-4 h-4 text-amber-400" /> Report Conversation
                </button>

                {showReport && (
                  <form onSubmit={handleSubmitReport} className="p-3 rounded-xl bg-[var(--ml-surface-soft)] border border-[var(--ml-border)] space-y-2">
                    <select
                      value={reportReason}
                      onChange={(e) => setReportReason(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-lg bg-[var(--ml-surface)] border border-[var(--ml-border)] text-xs text-[var(--ml-text-primary)]"
                    >
                      <option value="Harassment or Spam">Harassment or Spam</option>
                      <option value="Scam or Impersonation">Scam or Impersonation</option>
                      <option value="Inappropriate Content">Inappropriate Content</option>
                      <option value="Other Safety Issue">Other Safety Issue</option>
                    </select>
                    <textarea
                      value={reportDetails}
                      onChange={(e) => setReportDetails(e.target.value)}
                      placeholder="Optional context..."
                      rows={2}
                      className="w-full px-2.5 py-2 rounded-lg bg-[var(--ml-surface)] border border-[var(--ml-border)] text-xs text-[var(--ml-text-primary)]"
                    />
                    <button
                      type="submit"
                      disabled={saving}
                      className="w-full py-2 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs cursor-pointer"
                    >
                      Submit Report
                    </button>
                  </form>
                )}
              </div>
            )}
          </>
        )}

        {tab === 'media' && (
          <div className="space-y-2">
            {mediaItems.length === 0 ? (
              <div className="text-center py-10 text-xs text-[var(--ml-text-muted)]">
                <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
                No shared photos, videos, audio, or files yet.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {mediaItems.map((item, idx) =>
                  item.mediaType === 'image' ? (
                    <a
                      key={`${item.messageId}-${idx}`}
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="aspect-square rounded-xl overflow-hidden border border-[var(--ml-border)] bg-[var(--ml-surface-soft)]"
                    >
                      <img src={item.url} alt={item.fileName || 'Shared image'} className="w-full h-full object-cover" />
                    </a>
                  ) : (
                    <a
                      key={`${item.messageId}-${idx}`}
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="col-span-2 flex items-center gap-2.5 p-2.5 rounded-xl border border-[var(--ml-border)] bg-[var(--ml-surface-soft)] hover:border-[var(--ml-accent-teal)]"
                    >
                      <FileText className="w-4 h-4 text-[var(--ml-accent-teal)] shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-[var(--ml-text-primary)] truncate">
                          {item.fileName || `${item.mediaType} attachment`}
                        </p>
                        <p className="text-[11px] text-[var(--ml-text-muted)] truncate">{item.senderName}</p>
                      </div>
                    </a>
                  )
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'links' && (
          <div className="space-y-2">
            {links.length === 0 ? (
              <div className="text-center py-10 text-xs text-[var(--ml-text-muted)]">
                <Link2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                No shared URLs in this conversation.
              </div>
            ) : (
              links.map((lk, idx) => (
                <a
                  key={`${lk.messageId}-${idx}`}
                  href={lk.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block p-3 rounded-xl border border-[var(--ml-border)] bg-[var(--ml-surface-soft)] hover:border-[var(--ml-accent-teal)]"
                >
                  <p className="text-xs font-semibold text-[var(--ml-accent-teal)] truncate">{lk.url}</p>
                  <p className="text-[11px] text-[var(--ml-text-muted)] mt-0.5">{lk.senderName}</p>
                </a>
              ))
            )}
          </div>
        )}

        {isGroup && (
          <div className="pt-2 border-t border-[var(--ml-border)] flex items-start gap-2 text-[11px] text-[var(--ml-text-muted)]">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[var(--ml-accent-gold)]" />
            <span>Wave group calls currently connect directly via WebRTC peer mesh; larger multi-party rooms require a dedicated SFU relay.</span>
          </div>
        )}
      </div>
    </div>
  );
};
