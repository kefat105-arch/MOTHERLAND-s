import React, { useEffect, useState } from 'react';
import { X, Users, Search, Check, Camera, Loader2 } from 'lucide-react';
import { api } from '../../api';
import type { Conversation, UserProfile } from '../../types';

interface CreateGroupModalProps {
  isOpen: boolean;
  currentUser: UserProfile;
  onClose: () => void;
  onCreated: (conv: Conversation) => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  currentUser,
  onClose,
  onCreated,
}) => {
  const [name, setName] = useState('');
  const [photo, setPhoto] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    api
      .searchUsers('')
      .then((res) => {
        if (active) {
          setUsers((res.users || []).filter((u) => u.id !== currentUser.id));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isOpen, currentUser.id]);

  if (!isOpen) return null;

  const toggleMember = (uid: string) => {
    setSelectedIds((prev) => (prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]));
  };

  const handlePhotoUpload = async (file: File) => {
    setUploadingPhoto(true);
    setError('');
    try {
      const uploaded = await api.uploadMediaFile(file);
      setPhoto(uploaded.url);
    } catch (err: any) {
      setError(err?.message || 'Unable to upload group photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Group name is required.');
      return;
    }
    if (selectedIds.length === 0) {
      setError('Select at least 1 member to create a Wave group.');
      return;
    }
    setCreating(true);
    setError('');
    try {
      const res = await api.createGroupConversation({
        name: name.trim(),
        memberIds: selectedIds,
        photo: photo || undefined,
      });
      setName('');
      setPhoto('');
      setSelectedIds([]);
      onCreated(res.conversation);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create Wave group.');
    } finally {
      setCreating(false);
    }
  };

  const filtered = users.filter((u) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return u.displayName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-[var(--ml-surface)] border border-[var(--ml-border)] shadow-2xl overflow-hidden flex flex-col max-h-[86vh]"
      >
        <div className="px-4 py-3.5 border-b border-[var(--ml-border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[var(--ml-accent-teal)]" />
            <h3 className="font-display font-bold text-base text-[var(--ml-text-primary)]">New Wave Group</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close group modal"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[var(--ml-text-secondary)] hover:bg-[var(--ml-surface-soft)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3 border-b border-[var(--ml-border)]">
          <div className="flex items-center gap-3">
            <label className="relative w-14 h-14 rounded-2xl bg-[var(--ml-surface-soft)] border border-[var(--ml-border)] flex items-center justify-center cursor-pointer overflow-hidden shrink-0 hover:border-[var(--ml-accent-teal)]">
              {photo ? (
                <img src={photo} alt="Group cover" className="w-full h-full object-cover" />
              ) : uploadingPhoto ? (
                <Loader2 className="w-5 h-5 animate-spin text-[var(--ml-accent-teal)]" />
              ) : (
                <Camera className="w-5 h-5 text-[var(--ml-text-muted)]" />
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePhotoUpload(file);
                }}
              />
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Group name (e.g., Family Circle)"
              maxLength={60}
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-[var(--ml-surface-soft)] border border-[var(--ml-border)] text-sm text-[var(--ml-text-primary)] focus:outline-none focus:border-[var(--ml-accent-teal)]"
            />
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-[var(--ml-text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people to add..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-[var(--ml-surface-soft)] border border-[var(--ml-border)] text-sm text-[var(--ml-text-primary)] focus:outline-none focus:border-[var(--ml-accent-teal)]"
            />
          </div>

          {error && <p className="text-xs text-red-400 font-medium">{error}</p>}
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filtered.map((user) => {
            const checked = selectedIds.includes(user.id);
            return (
              <button
                key={user.id}
                type="button"
                onClick={() => toggleMember(user.id)}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl transition text-left cursor-pointer ${
                  checked ? 'bg-[var(--ml-accent-teal)]/12 border border-[var(--ml-accent-teal)]/35' : 'hover:bg-[var(--ml-surface-soft)]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img src={user.avatar} alt={user.displayName} className="w-10 h-10 rounded-full object-cover shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--ml-text-primary)] truncate">{user.displayName}</p>
                    <p className="text-xs text-[var(--ml-text-muted)] truncate">@{user.username}</p>
                  </div>
                </div>
                <span
                  className={`w-6 h-6 rounded-lg flex items-center justify-center border shrink-0 ${
                    checked
                      ? 'bg-[var(--ml-accent-teal)] border-[var(--ml-accent-teal)] text-white'
                      : 'border-[var(--ml-border)]'
                  }`}
                >
                  {checked && <Check className="w-3.5 h-3.5" />}
                </span>
              </button>
            );
          })}
        </div>

        <div className="p-3.5 border-t border-[var(--ml-border)] flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-[var(--ml-text-secondary)] tabular-nums">
            {selectedIds.length} member{selectedIds.length === 1 ? '' : 's'} selected
          </span>
          <button
            type="submit"
            disabled={creating}
            className="px-5 py-2.5 rounded-xl bg-[var(--ml-accent-teal)] text-white font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition cursor-pointer"
          >
            {creating ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      </form>
    </div>
  );
};
