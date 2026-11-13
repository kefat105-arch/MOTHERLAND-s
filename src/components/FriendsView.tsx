import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  UserCheck,
  UserX,
  Search,
  Check,
  X,
  Ban,
  MessageSquare,
  Clock,
  Shield,
  MapPin,
  Briefcase,
  LogIn,
  Loader2,
  Phone,
  Video,
} from 'lucide-react';
import { api } from '../api';
import type { UserProfile, FriendRequest } from '../types';
import { useBackHandler } from '../hooks/useBackNavigation';

interface FriendsViewProps {
  currentUser: UserProfile | null;
  onRefreshUser: () => void;
  onOpenChatWithUser: (userId: string) => void;
  onCallUser?: (userId: string, callType: 'audio' | 'video') => void;
  onOpenAuth: () => void;
  refreshSignal?: number;
}

export const FriendsView: React.FC<FriendsViewProps> = ({
  currentUser,
  onRefreshUser,
  onOpenChatWithUser,
  onCallUser,
  onOpenAuth,
  refreshSignal = 0,
}) => {
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'sent' | 'suggested' | 'search'>('friends');
  const [friendsList, setFriendsList] = useState<UserProfile[]>([]);
  const [suggestedList, setSuggestedList] = useState<UserProfile[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [friendsFilter, setFriendsFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [flashMessage, setFlashMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'remove' | 'block';
    userId: string;
    name: string;
  } | null>(null);
  const [viewingProfile, setViewingProfile] = useState<UserProfile | null>(null);

  useBackHandler('friends-profile-modal', Boolean(viewingProfile), () => setViewingProfile(null), 62);

  const showFlash = (text: string, isError = false) => {
    setFlashMessage({ text, isError });
    setTimeout(() => setFlashMessage(null), 3200);
  };

  const loadData = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      const data = await api.getFriendsData();
      setFriendsList(data.friends || []);
      setSuggestedList(data.suggested || []);
      setPendingRequests(data.pendingRequests || []);
      setSentRequests(data.sentRequests || []);
    } catch (err: any) {
      console.error('Failed to load friends data:', err);
      showFlash(err?.message || 'Unable to load friends data', true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser?.id, refreshSignal]);

  const handleSendRequest = async (userId: string, name: string) => {
    try {
      const res = await api.sendFriendRequest(userId);
      if (res.status === 'accepted') {
        showFlash(`You and ${name} are now friends!`);
      } else {
        showFlash(`Friend request sent to ${name}.`);
      }
      await loadData();
      if (searchQuery.trim()) {
        await handleSearchUsers(searchQuery);
      }
      onRefreshUser();
    } catch (err: any) {
      showFlash(err?.message || 'Could not send friend request.', true);
    }
  };

  const handleRespondRequest = async (requestId: string, action: 'accept' | 'reject' | 'cancel') => {
    try {
      await api.respondFriendRequest(requestId, action);
      showFlash(
        action === 'accept'
          ? 'Friend request accepted!'
          : action === 'cancel'
          ? 'Friend request canceled.'
          : 'Friend request declined.'
      );
      await loadData();
      if (searchQuery.trim()) {
        await handleSearchUsers(searchQuery);
      }
      onRefreshUser();
    } catch (err: any) {
      showFlash(err?.message || 'Action failed.', true);
    }
  };

  const handleConfirmFriendMutation = async () => {
    if (!confirmAction) return;
    const { type, userId, name } = confirmAction;
    setConfirmAction(null);
    try {
      if (type === 'remove') {
        await api.removeFriend(userId);
        showFlash(`${name} removed from friends.`);
      } else {
        await api.toggleBlock(userId);
        showFlash(`${name} has been blocked.`);
      }
      setViewingProfile(null);
      await loadData();
      onRefreshUser();
    } catch (err: any) {
      showFlash(err?.message || 'Failed to update connection.', true);
    }
  };

  const handleToggleFollow = async (userId: string) => {
    try {
      const res = await api.toggleFollow(userId);
      showFlash(res.isFollowing ? 'Supporting creator!' : 'Stopped supporting.');
      await loadData();
      onRefreshUser();
    } catch (err: any) {
      showFlash(err?.message || 'Support action failed.', true);
    }
  };

  const handleSearchUsers = async (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await api.searchUsers(q);
      setSearchResults((res.users || []).filter((u) => u.id !== currentUser?.id));
    } catch (err) {
      console.error('User search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="w-full max-w-2xl mx-auto p-4 mt-4">
        <div className="ml-glass rounded-3xl p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[var(--accent-primary-soft)] border border-[var(--accent-primary-border)] text-[var(--accent-primary)] flex items-center justify-center mx-auto">
            <Users className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-extrabold text-[var(--text-primary)]">
            Sign in to connect with Friends
          </h2>
          <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto leading-relaxed">
            Create an account or sign in to send friend requests, accept connections, and message friends directly on MOTHERLAND.
          </p>
          <button
            type="button"
            onClick={onOpenAuth}
            className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-primary-contrast)] text-xs font-bold inline-flex items-center gap-2 shadow-sm"
          >
            <LogIn className="w-4 h-4" />
            <span>Sign In or Register</span>
          </button>
        </div>
      </div>
    );
  }

  const filteredFriends = friendsFilter.trim()
    ? friendsList.filter(
        (f) =>
          f.displayName.toLowerCase().includes(friendsFilter.trim().toLowerCase()) ||
          f.username.toLowerCase().includes(friendsFilter.trim().toLowerCase())
      )
    : friendsList;

  const renderRelationshipButton = (user: UserProfile) => {
    if (user.relationshipStatus === 'friend') {
      return (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {onCallUser && (
            <>
              <button
                type="button"
                onClick={() => onCallUser(user.id, 'audio')}
                className="w-10 h-10 rounded-xl bg-[var(--bg-surface-alt)] hover:bg-[var(--accent-primary)] text-[var(--accent-primary)] hover:text-[var(--accent-primary-contrast)] border border-[var(--border-subtle)] flex items-center justify-center transition-colors"
                title="Audio Call"
                aria-label={`Audio call ${user.displayName}`}
              >
                <Phone className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onCallUser(user.id, 'video')}
                className="w-10 h-10 rounded-xl bg-[var(--bg-surface-alt)] hover:bg-[var(--accent-primary)] text-[var(--accent-primary)] hover:text-[var(--accent-primary-contrast)] border border-[var(--border-subtle)] flex items-center justify-center transition-colors"
                title="Video Call"
                aria-label={`Video call ${user.displayName}`}
              >
                <Video className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => onOpenChatWithUser(user.id)}
            className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-primary-contrast)] text-xs font-bold flex items-center gap-1.5 flex-shrink-0"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Message</span>
          </button>
        </div>
      );
    }
    if (user.relationshipStatus === 'pending_sent' && user.pendingRequestId) {
      return (
        <button
          type="button"
          onClick={() => handleRespondRequest(user.pendingRequestId!, 'cancel')}
          className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[var(--accent-gold-soft)] text-[var(--accent-gold)] border border-[var(--accent-gold-border)] text-xs font-bold flex items-center gap-1.5 flex-shrink-0"
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Cancel Request</span>
        </button>
      );
    }
    if (user.relationshipStatus === 'pending_received' && user.pendingRequestId) {
      return (
        <button
          type="button"
          onClick={() => handleRespondRequest(user.pendingRequestId!, 'accept')}
          className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)] text-xs font-bold flex items-center gap-1.5 flex-shrink-0"
        >
          <Check className="w-3.5 h-3.5" />
          <span>Accept</span>
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={() => handleSendRequest(user.id, user.displayName)}
        className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] border border-[var(--accent-primary-border)] hover:bg-[var(--accent-primary)] hover:text-[var(--accent-primary-contrast)] text-xs font-bold transition-colors flex items-center gap-1.5 flex-shrink-0"
      >
        <UserPlus className="w-3.5 h-3.5" />
        <span>Add Friend</span>
      </button>
    );
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-3 sm:p-4 space-y-4">
      {/* Header Panel */}
      <div className="ml-glass rounded-2xl p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[var(--accent-primary)] to-[var(--accent-gold)] p-0.5 flex items-center justify-center text-[var(--accent-primary-contrast)]">
              <Users className="w-5 h-5 stroke-[2.25px]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
                Friends &amp; Connections
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Connect, accept requests, and start private chats
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 text-xs">
            <div className="px-3 py-1.5 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] text-[var(--text-primary)]">
              <span className="font-bold text-[var(--accent-primary)] tabular-nums">{friendsList.length}</span> Friends
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] text-[var(--text-primary)]">
              <span className="font-bold text-[var(--accent-gold)] tabular-nums">{pendingRequests.length}</span> Requests
            </div>
          </div>
        </div>

        {/* Inline Confirmation Prompt */}
        {confirmAction && (
          <div className="mt-3 p-3 rounded-xl bg-[var(--danger-soft)] border border-[var(--danger)]/30 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-[var(--text-primary)] font-medium">
              {confirmAction.type === 'remove'
                ? `Remove ${confirmAction.name} from your friends?`
                : `Block ${confirmAction.name}? They will no longer be able to message or view your profile.`}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmFriendMutation}
                className="px-3 py-1.5 rounded-lg bg-[var(--danger)] text-white font-bold"
              >
                {confirmAction.type === 'remove' ? 'Remove' : 'Block'}
              </button>
            </div>
          </div>
        )}

        {/* Action Flash Alert */}
        {flashMessage && (
          <div
            className={`mt-3 p-2.5 rounded-xl text-xs flex items-center gap-2 ${
              flashMessage.isError
                ? 'bg-[var(--danger-soft)] border border-[var(--danger)]/30 text-[var(--danger)]'
                : 'bg-[var(--accent-primary-soft)] border border-[var(--accent-primary-border)] text-[var(--accent-primary)]'
            }`}
          >
            <Check className="w-4 h-4 flex-shrink-0" />
            <span>{flashMessage.text}</span>
          </div>
        )}

        {/* Tab Navigation (5 Tabs) */}
        <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-[var(--border-subtle)] overflow-x-auto no-scrollbar">
          {[
            { id: 'friends', label: `My Friends (${friendsList.length})`, badge: 0 },
            { id: 'requests', label: `Requests (${pendingRequests.length})`, badge: pendingRequests.length },
            { id: 'sent', label: `Sent (${sentRequests.length})`, badge: 0 },
            { id: 'suggested', label: `Suggested (${suggestedList.length})`, badge: 0 },
            { id: 'search', label: 'Search People', badge: 0 },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)]'
              }`}
            >
              <span>{tab.label}</span>
              {tab.badge > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-[var(--danger)] text-white text-[10px]">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="py-8 flex justify-center text-[var(--accent-primary)]">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      )}

      {/* TAB 1: MY FRIENDS */}
      {!isLoading && activeTab === 'friends' && (
        <div className="space-y-3">
          {friendsList.length > 0 && (
            <div className="ml-glass rounded-xl px-3.5 py-2 flex items-center gap-2">
              <Search className="w-4 h-4 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Filter your friends list..."
                value={friendsFilter}
                onChange={(e) => setFriendsFilter(e.target.value)}
                className="w-full bg-transparent text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none"
              />
            </div>
          )}

          {filteredFriends.length === 0 ? (
            <div className="p-8 text-center ml-glass rounded-2xl text-[var(--text-secondary)] text-xs space-y-2">
              <p>
                {friendsFilter
                  ? 'No matching friends found.'
                  : 'No confirmed friends yet. Check Suggested or Search People to connect!'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredFriends.map((friend) => (
                <div
                  key={friend.id}
                  className="ml-glass rounded-2xl p-3.5 flex items-center justify-between gap-3 hover:border-[var(--border-strong)] transition-all"
                >
                  <button
                    type="button"
                    onClick={() => setViewingProfile(friend)}
                    className="flex items-center gap-3 min-w-0 text-left"
                  >
                    <div className="relative flex-shrink-0">
                      <img
                        src={friend.avatar}
                        alt={friend.displayName}
                        className="w-12 h-12 rounded-xl object-cover border border-[var(--border-subtle)]"
                      />
                      {friend.isOnline && (
                        <span
                          className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[var(--bg-canvas)]"
                          title="Online"
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-[var(--text-primary)] truncate">
                          {friend.displayName}
                        </span>
                        {friend.isVerified && (
                          <span className="w-3.5 h-3.5 rounded-full bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)] flex items-center justify-center text-[8px] font-bold flex-shrink-0">
                            ✓
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-[var(--text-secondary)] block truncate">
                        @{friend.username}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {friend.mutualFriendsCount ? `${friend.mutualFriendsCount} mutual · ` : ''}
                        {friend.location || 'MOTHERLAND'}
                      </span>
                    </div>
                  </button>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {onCallUser && (
                      <>
                        <button
                          type="button"
                          onClick={() => onCallUser(friend.id, 'audio')}
                          className="w-10 h-10 rounded-xl bg-[var(--bg-surface-alt)] hover:bg-[var(--accent-primary)] text-[var(--accent-primary)] hover:text-[var(--accent-primary-contrast)] border border-[var(--border-subtle)] flex items-center justify-center transition-colors"
                          title="Audio Call"
                          aria-label={`Audio call ${friend.displayName}`}
                        >
                          <Phone className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onCallUser(friend.id, 'video')}
                          className="w-10 h-10 rounded-xl bg-[var(--bg-surface-alt)] hover:bg-[var(--accent-primary)] text-[var(--accent-primary)] hover:text-[var(--accent-primary-contrast)] border border-[var(--border-subtle)] flex items-center justify-center transition-colors"
                          title="Video Call"
                          aria-label={`Video call ${friend.displayName}`}
                        >
                          <Video className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => onOpenChatWithUser(friend.id)}
                      className="w-10 h-10 rounded-xl bg-[var(--accent-primary-soft)] hover:bg-[var(--accent-primary)] text-[var(--accent-primary)] hover:text-[var(--accent-primary-contrast)] border border-[var(--accent-primary-border)] flex items-center justify-center transition-colors"
                      title="Message Friend"
                      aria-label={`Message ${friend.displayName}`}
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmAction({ type: 'remove', userId: friend.id, name: friend.displayName })
                      }
                      className="w-10 h-10 rounded-xl bg-[var(--bg-surface-alt)] hover:bg-[var(--danger-soft)] text-[var(--text-secondary)] hover:text-[var(--danger)] border border-[var(--border-subtle)] flex items-center justify-center transition-colors"
                      title="Remove Friend"
                    >
                      <UserX className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmAction({ type: 'block', userId: friend.id, name: friend.displayName })
                      }
                      className="w-10 h-10 rounded-xl bg-[var(--bg-surface-alt)] hover:bg-[var(--danger-soft)] text-[var(--text-secondary)] hover:text-[var(--danger)] border border-[var(--border-subtle)] flex items-center justify-center transition-colors"
                      title="Block User"
                    >
                      <Ban className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: INCOMING FRIEND REQUESTS */}
      {!isLoading && activeTab === 'requests' && (
        <div className="space-y-3">
          {pendingRequests.length === 0 ? (
            <div className="p-8 text-center ml-glass rounded-2xl text-[var(--text-secondary)] text-xs">
              No pending incoming friend requests.
            </div>
          ) : (
            pendingRequests.map((req) => (
              <div
                key={req.id}
                className="ml-glass rounded-2xl p-4 flex items-center justify-between gap-3"
              >
                <button
                  type="button"
                  onClick={() => setViewingProfile(req.sender)}
                  className="flex items-center gap-3 min-w-0 text-left"
                >
                  <img
                    src={req.sender.avatar}
                    alt={req.sender.displayName}
                    className="w-12 h-12 rounded-xl object-cover border border-[var(--border-subtle)] flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <span className="font-bold text-sm text-[var(--text-primary)] block truncate">
                      {req.sender.displayName}
                    </span>
                    <span className="text-xs text-[var(--text-secondary)]">@{req.sender.username}</span>
                    <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">
                      Sent {new Date(req.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </button>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => handleRespondRequest(req.id, 'accept')}
                    className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-primary-contrast)] text-xs font-bold transition-colors flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3px]" />
                    <span>Accept</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRespondRequest(req.id, 'reject')}
                    className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] text-[var(--text-secondary)] text-xs font-medium hover:text-[var(--text-primary)] transition-colors"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 3: SENT FRIEND REQUESTS */}
      {!isLoading && activeTab === 'sent' && (
        <div className="space-y-3">
          {sentRequests.length === 0 ? (
            <div className="p-8 text-center ml-glass rounded-2xl text-[var(--text-secondary)] text-xs">
              You have no pending outgoing friend requests.
            </div>
          ) : (
            sentRequests.map((req) => {
              const target = req.recipient || req.sender;
              return (
                <div
                  key={req.id}
                  className="ml-glass rounded-2xl p-4 flex items-center justify-between gap-3"
                >
                  <button
                    type="button"
                    onClick={() => target && setViewingProfile(target)}
                    className="flex items-center gap-3 min-w-0 text-left"
                  >
                    <img
                      src={target?.avatar}
                      alt={target?.displayName}
                      className="w-12 h-12 rounded-xl object-cover border border-[var(--border-subtle)] flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="font-bold text-sm text-[var(--text-primary)] block truncate">
                        {target?.displayName || 'MOTHERLAND User'}
                      </span>
                      <span className="text-xs text-[var(--text-secondary)]">
                        @{target?.username || 'user'}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">
                        Sent {new Date(req.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRespondRequest(req.id, 'cancel')}
                    className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[var(--bg-surface-alt)] hover:bg-[var(--danger-soft)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--danger)] transition-colors flex items-center gap-1.5 flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Cancel Request</span>
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 4: SUGGESTED USERS */}
      {!isLoading && activeTab === 'suggested' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {suggestedList.length === 0 ? (
            <div className="col-span-full p-8 text-center ml-glass rounded-2xl text-[var(--text-secondary)] text-xs">
              No new suggestions right now. Try searching by name or username!
            </div>
          ) : (
            suggestedList.map((user) => (
              <div
                key={user.id}
                className="ml-glass rounded-2xl p-3.5 flex items-center justify-between gap-3 hover:border-[var(--border-strong)] transition-all"
              >
                <button
                  type="button"
                  onClick={() => setViewingProfile(user)}
                  className="flex items-center gap-3 min-w-0 text-left"
                >
                  <img
                    src={user.avatar}
                    alt={user.displayName}
                    className="w-12 h-12 rounded-xl object-cover border border-[var(--border-subtle)] flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm text-[var(--text-primary)] truncate">
                        {user.displayName}
                      </span>
                      {user.isVerified && (
                        <span className="w-3.5 h-3.5 rounded-full bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)] flex items-center justify-center text-[8px] font-bold flex-shrink-0">
                          ✓
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-[var(--text-secondary)] block truncate">
                      @{user.username}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] line-clamp-1">
                      {user.mutualFriendsCount ? `${user.mutualFriendsCount} mutual · ` : ''}
                      {user.bio}
                    </span>
                  </div>
                </button>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {renderRelationshipButton(user)}
                  <button
                    type="button"
                    onClick={() => handleToggleFollow(user.id)}
                    className="min-h-[40px] px-2.5 rounded-xl bg-[var(--bg-surface-alt)] hover:border-[var(--accent-gold-border)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center gap-1 text-[11px] font-bold transition-colors"
                    title="Support"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Support</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 5: SEARCH PEOPLE */}
      {!isLoading && activeTab === 'search' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 ml-glass focus-within:border-[var(--accent-primary)] rounded-xl px-3.5 py-2.5">
            <Search className="w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search people by name or @username..."
              value={searchQuery}
              onChange={(e) => handleSearchUsers(e.target.value)}
              className="w-full bg-transparent text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none"
            />
            {isSearching && <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-primary)]" />}
            {searchQuery && (
              <button
                type="button"
                onClick={() => handleSearchUsers('')}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {searchQuery.trim() && searchResults.length === 0 && !isSearching ? (
            <div className="p-8 text-center ml-glass rounded-2xl text-xs text-[var(--text-secondary)]">
              No users found matching &ldquo;{searchQuery}&rdquo;.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {searchResults.map((user) => (
                <div
                  key={user.id}
                  className="ml-glass rounded-2xl p-3.5 flex items-center justify-between gap-3"
                >
                  <button
                    type="button"
                    onClick={() => setViewingProfile(user)}
                    className="flex items-center gap-3 min-w-0 text-left"
                  >
                    <img
                      src={user.avatar}
                      alt={user.displayName}
                      className="w-12 h-12 rounded-xl object-cover border border-[var(--border-subtle)] flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="font-bold text-sm text-[var(--text-primary)] block truncate">
                        {user.displayName}
                      </span>
                      <span className="text-[11px] text-[var(--text-secondary)]">@{user.username}</span>
                      <span className="text-[10px] text-[var(--text-muted)] block truncate">
                        {user.mutualFriendsCount ? `${user.mutualFriendsCount} mutual · ` : ''}
                        {user.work || user.location || 'Member'}
                      </span>
                    </div>
                  </button>

                  {renderRelationshipButton(user)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Public Profile Preview Modal */}
      {viewingProfile && (
        <div
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setViewingProfile(null)}
        >
          <div
            className="w-full max-w-md ml-glass-elevated rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-28 bg-[var(--bg-surface-alt)] relative">
              <img
                src={viewingProfile.coverImage}
                alt={viewingProfile.displayName}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => setViewingProfile(null)}
                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/55 text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 -mt-10 relative space-y-3">
              <div className="flex items-end justify-between gap-3">
                <img
                  src={viewingProfile.avatar}
                  alt={viewingProfile.displayName}
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-[var(--accent-gold-border)] shadow-lg bg-[var(--bg-surface-solid)]"
                />
                <div className="flex items-center gap-2">
                  {renderRelationshipButton(viewingProfile)}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-base font-extrabold text-[var(--text-primary)]">
                    {viewingProfile.displayName}
                  </h3>
                  {viewingProfile.isVerified && (
                    <Shield className="w-4 h-4 text-[var(--accent-primary)]" />
                  )}
                </div>
                <p className="text-xs text-[var(--text-secondary)]">@{viewingProfile.username}</p>
              </div>

              {viewingProfile.bio && (
                <p className="text-xs text-[var(--text-primary)] leading-relaxed">
                  {viewingProfile.bio}
                </p>
              )}

              <div className="flex flex-wrap gap-3 text-[11px] text-[var(--text-secondary)]">
                {viewingProfile.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    {viewingProfile.location}
                  </span>
                )}
                {viewingProfile.work && (
                  <span className="flex items-center gap-1">
                    <Briefcase className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
                    {viewingProfile.work}
                  </span>
                )}
              </div>

              <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center gap-5 text-xs">
                <span>
                  <strong className="text-[var(--text-primary)]">{viewingProfile.friendsCount}</strong>{' '}
                  <span className="text-[var(--text-secondary)]">Friends</span>
                </span>
                <span>
                  <strong className="text-[var(--text-primary)]">{viewingProfile.followersCount}</strong>{' '}
                  <span className="text-[var(--text-secondary)]">Supporters</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
