import React, { useEffect, useState } from 'react';
import {
  X,
  Server,
  Activity,
  Plus,
  Trash2,
  RotateCcw,
  CheckCircle2,
  ShieldAlert,
  Lock,
  Send,
  Terminal,
  RefreshCw,
} from 'lucide-react';
import { api } from '../api';
import type {
  AdminConfigChatMessage,
  ManagedServiceDomain,
  ServerRegistryEntry,
  ServerSwitchHistoryEntry,
  UserProfile,
} from '../types';

interface ServerManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
}

const SERVICE_OPTIONS: { id: ManagedServiceDomain; label: string }[] = [
  { id: 'main_app', label: 'Main App & Feed' },
  { id: 'video', label: 'Video & Shorts' },
  { id: 'messaging', label: 'WAVE Messaging' },
  { id: 'calls', label: 'WebRTC Calls' },
  { id: 'bd_services', label: 'Motherland live' },
];

export const ServerManagementModal: React.FC<ServerManagementModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const [servers, setServers] = useState<ServerRegistryEntry[]>([]);
  const [history, setHistory] = useState<ServerSwitchHistoryEntry[]>([]);
  const [chatMessages, setChatMessages] = useState<AdminConfigChatMessage[]>([]);
  const [activeTab, setActiveTab] = useState<'registry' | 'chat' | 'history'>('registry');

  const [loading, setLoading] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Add Server Form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBaseUrl, setNewBaseUrl] = useState('');
  const [newHealthPath, setNewHealthPath] = useState('/health');
  const [newWsUrl, setNewWsUrl] = useState('');
  const [newServices, setNewServices] = useState<ManagedServiceDomain[]>(['main_app', 'video']);

  // Owner Config Chat Input
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);

  const isOwner = currentUser?.role === 'owner';
  const isAdminOrOwner = currentUser?.role === 'owner' || currentUser?.role === 'admin';

  const loadData = async () => {
    setLoading(true);
    try {
      const reg = await api.getServers();
      setServers(reg.servers || []);
      if (isAdminOrOwner) {
        api.getServerHistory()
          .then((h) => setHistory(h.history || []))
          .catch(() => {});
      }
      if (isOwner) {
        api.getAdminServerChat()
          .then((c) => setChatMessages(c.messages || []))
          .catch(() => {});
      }
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'Unable to load server registry' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, currentUser?.id]);

  if (!isOpen) return null;

  const handleTestHealth = async (srv: ServerRegistryEntry) => {
    setTestingId(srv.id);
    setFeedback(null);
    try {
      const res = await api.testServerHealth(srv.id);
      if (res.server) {
        setServers((prev) => prev.map((s) => (s.id === res.server!.id ? res.server! : s)));
      }
      setFeedback({
        type: res.healthStatus === 'healthy' ? 'ok' : 'err',
        text: `${srv.name}: ${res.healthStatus.toUpperCase()} (${res.latencyMs}ms, HTTP ${res.httpStatus || 'ERR'})${res.error ? ` — ${res.error}` : ''}`,
      });
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'Health check failed' });
    } finally {
      setTestingId(null);
    }
  };

  const handleToggleEnable = async (srv: ServerRegistryEntry) => {
    try {
      const res = await api.updateServer(srv.id, { enabled: !srv.enabled });
      setServers((prev) => prev.map((s) => (s.id === res.server.id ? res.server : s)));
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'Toggle failed' });
    }
  };

  const handleSetPrimary = async (srv: ServerRegistryEntry) => {
    setFeedback(null);
    try {
      const res = await api.setPrimaryServer(srv.id);
      await loadData();
      setFeedback({ type: 'ok', text: `Primary server switched to ${res.server.name}` });
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'Cannot set primary' });
    }
  };

  const handleRollback = async () => {
    setFeedback(null);
    try {
      const res = await api.rollbackPrimaryServer();
      await loadData();
      setFeedback({ type: 'ok', text: `Rolled back primary server to ${res.server.name}` });
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'Rollback failed' });
    }
  };

  const handleDelete = async (id: string) => {
    setFeedback(null);
    try {
      await api.deleteServer(id);
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'Delete failed' });
    }
  };

  const handleCreateServer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      const res = await api.createServer({
        name: newName.trim(),
        baseUrl: newBaseUrl.trim(),
        healthPath: newHealthPath.trim() || '/health',
        wsUrl: newWsUrl.trim() || undefined,
        assignedServices: newServices,
      });
      setServers((prev) => [...prev, res.server]);
      setNewName('');
      setNewBaseUrl('');
      setNewWsUrl('');
      setShowAddForm(false);
      setFeedback({ type: 'ok', text: `Registered ${res.server.name}. Run Health Test before switching.` });
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'Failed to register server' });
    }
  };

  const handleSendChat = async (textToSend?: string, confirm = false) => {
    const text = (textToSend ?? chatInput).trim();
    if (!text) return;
    setChatSending(true);
    try {
      const res = await api.sendAdminServerChat(text, confirm);
      setChatMessages((prev) => [...prev, res.ownerMessage, res.systemMessage]);
      if (res.servers) setServers(res.servers);
      if (!textToSend) setChatInput('');
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'Command failed' });
    } finally {
      setChatSending(false);
    }
  };

  return (
    <div
      data-testid="server-management-modal"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[92vh] rounded-2xl bg-[var(--ml-surface)] border border-[var(--ml-border)] shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-[var(--ml-border)] flex items-center justify-between gap-2 bg-[var(--ml-surface-soft)]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#2B8A86]/15 border border-[#2B8A86]/35 flex items-center justify-center text-[#2B8A86]">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-display font-bold text-sm sm:text-base text-[var(--ml-text-primary)]">
                MOTHERLAND Multi-Server Registry & Isolation Hub
              </h2>
              <p className="text-[11px] text-[var(--ml-text-secondary)]">
                Manage HTTPS backend nodes, Dream World isolation, latency health checks & failover
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close server management"
            className="w-9 h-9 rounded-xl bg-[var(--ml-surface)] border border-[var(--ml-border)] flex items-center justify-center text-[var(--ml-text-secondary)] hover:text-[var(--ml-text-primary)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-4 pt-3 flex items-center gap-2 border-b border-[var(--ml-border)]">
          {[
            { id: 'registry', label: 'Server Registry' },
            ...(isOwner ? [{ id: 'chat', label: 'Owner Config Chat' }] : []),
            ...(isAdminOrOwner ? [{ id: 'history', label: 'Audit History' }] : []),
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-2 text-xs font-bold border-b-2 transition cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-[#2B8A86] text-[#2B8A86]'
                  : 'border-transparent text-[var(--ml-text-secondary)] hover:text-[var(--ml-text-primary)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {feedback && (
            <div
              className={`rounded-xl px-3.5 py-2.5 text-xs font-semibold border flex items-center justify-between gap-2 ${
                feedback.type === 'ok'
                  ? 'bg-emerald-500/10 border-emerald-500/35 text-emerald-400'
                  : 'bg-red-500/10 border-red-500/35 text-red-400'
              }`}
            >
              <span>{feedback.text}</span>
              <button type="button" onClick={() => setFeedback(null)} className="cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {activeTab === 'registry' && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-[var(--ml-text-secondary)]">
                  {loading ? 'Refreshing registry...' : `${servers.length} configured nodes`}
                </span>
                <div className="flex items-center gap-2">
                  {isOwner && (
                    <button
                      type="button"
                      onClick={handleRollback}
                      className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[var(--ml-surface-soft)] border border-[var(--ml-border)] text-xs font-semibold text-[var(--ml-text-primary)] inline-flex items-center gap-1.5 hover:border-[#D0AF72] cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-[#D0AF72]" /> Rollback Primary
                    </button>
                  )}
                  {isAdminOrOwner && (
                    <button
                      type="button"
                      onClick={() => setShowAddForm((v) => !v)}
                      className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#2B8A86] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add HTTPS Server
                    </button>
                  )}
                </div>
              </div>

              {showAddForm && isAdminOrOwner && (
                <form
                  onSubmit={handleCreateServer}
                  className="rounded-xl bg-[var(--ml-surface-soft)] border border-[#2B8A86]/40 p-3.5 space-y-2.5"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      required
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Server Name (e.g. Dhaka Cloud API)"
                      className="px-3 py-2 rounded-xl bg-[var(--ml-surface)] border border-[var(--ml-border)] text-xs text-[var(--ml-text-primary)]"
                    />
                    <input
                      type="url"
                      required
                      value={newBaseUrl}
                      onChange={(e) => setNewBaseUrl(e.target.value)}
                      placeholder="https://api.example.com"
                      className="px-3 py-2 rounded-xl bg-[var(--ml-surface)] border border-[var(--ml-border)] text-xs text-[var(--ml-text-primary)]"
                    />
                    <input
                      type="text"
                      value={newHealthPath}
                      onChange={(e) => setNewHealthPath(e.target.value)}
                      placeholder="Health path (default /health)"
                      className="px-3 py-2 rounded-xl bg-[var(--ml-surface)] border border-[var(--ml-border)] text-xs text-[var(--ml-text-primary)]"
                    />
                    <input
                      type="text"
                      value={newWsUrl}
                      onChange={(e) => setNewWsUrl(e.target.value)}
                      placeholder="Optional wss://.../ws"
                      className="px-3 py-2 rounded-xl bg-[var(--ml-surface)] border border-[var(--ml-border)] text-xs text-[var(--ml-text-primary)]"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {SERVICE_OPTIONS.map((opt) => {
                      const active = newServices.includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            setNewServices((prev) =>
                              active ? prev.filter((i) => i !== opt.id) : [...prev, opt.id]
                            )
                          }
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border cursor-pointer ${
                            active
                              ? 'bg-[#2B8A86]/20 border-[#2B8A86] text-[#2B8A86]'
                              : 'bg-[var(--ml-surface)] border-[var(--ml-border)] text-[var(--ml-text-secondary)]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--ml-text-secondary)] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-lg bg-[#2B8A86] text-white text-xs font-bold cursor-pointer"
                    >
                      Register Server
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-2.5">
                {servers.map((srv) => (
                  <div
                    key={srv.id}
                    className={`rounded-xl p-3.5 border ${
                      srv.isolated
                        ? 'bg-indigo-500/5 border-indigo-500/35'
                        : srv.isPrimary
                          ? 'bg-[#2B8A86]/8 border-[#2B8A86]/45'
                          : 'bg-[var(--ml-surface-soft)] border-[var(--ml-border)]'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-sm text-[var(--ml-text-primary)]">
                            {srv.name}
                          </span>
                          {srv.isPrimary && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#2B8A86] text-white">
                              PRIMARY
                            </span>
                          )}
                          {srv.isolated && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/20 text-indigo-300 inline-flex items-center gap-1">
                              <Lock className="w-3 h-3" /> ISOLATED GAME SERVER
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              srv.lastHealthStatus === 'healthy'
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : srv.lastHealthStatus === 'offline'
                                  ? 'bg-red-500/15 text-red-400'
                                  : 'bg-white/10 text-[var(--ml-text-secondary)]'
                            }`}
                          >
                            {srv.lastHealthStatus?.toUpperCase() || 'UNKNOWN'}
                            {srv.lastLatencyMs ? ` • ${srv.lastLatencyMs}ms` : ''}
                          </span>
                        </div>
                        <p className="text-xs font-mono text-[var(--ml-text-secondary)] break-all">
                          {srv.baseUrl}{srv.healthPath || '/health'}
                          {srv.wsUrl ? `  |  WS: ${srv.wsUrl}` : ''}
                        </p>
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {srv.assignedServices.map((svc) => (
                            <span
                              key={svc}
                              className="px-2 py-0.5 rounded-md bg-[var(--ml-surface)] border border-[var(--ml-border)] text-[10px] font-medium text-[var(--ml-text-secondary)]"
                            >
                              {svc}
                            </span>
                          ))}
                        </div>
                      </div>

                      {isAdminOrOwner && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            disabled={testingId === srv.id}
                            onClick={() => handleTestHealth(srv)}
                            className="px-2.5 py-1.5 rounded-lg bg-[var(--ml-surface)] border border-[var(--ml-border)] text-xs font-semibold text-[var(--ml-text-primary)] inline-flex items-center gap-1 hover:border-[#2B8A86] cursor-pointer"
                          >
                            {testingId === srv.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Activity className="w-3.5 h-3.5 text-[#2B8A86]" />
                            )}
                            Test
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleEnable(srv)}
                            className="px-2.5 py-1.5 rounded-lg bg-[var(--ml-surface)] border border-[var(--ml-border)] text-xs font-semibold text-[var(--ml-text-secondary)] cursor-pointer"
                          >
                            {srv.enabled ? 'Disable' : 'Enable'}
                          </button>

                          {isOwner && !srv.isPrimary && !srv.isolated && srv.enabled && (
                            <button
                              type="button"
                              onClick={() => handleSetPrimary(srv)}
                              className="px-2.5 py-1.5 rounded-lg bg-[#D0AF72]/15 border border-[#D0AF72]/40 text-xs font-bold text-[#D0AF72] inline-flex items-center gap-1 cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Set Primary
                            </button>
                          )}

                          {!srv.isolated && srv.id !== 'srv_motherland_local' && !srv.isPrimary && (
                            <button
                              type="button"
                              onClick={() => handleDelete(srv.id)}
                              aria-label="Delete server"
                              className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeTab === 'chat' && isOwner && (
            <div className="flex flex-col h-[420px] rounded-xl bg-[var(--ml-surface-soft)] border border-[var(--ml-border)] overflow-hidden">
              <div className="px-3.5 py-2 border-b border-[var(--ml-border)] flex items-center gap-2 text-xs text-[#D0AF72] font-semibold">
                <Terminal className="w-4 h-4" />
                <span>Owner-Only Server Controller (HTTPS validated • Confirmation enforced • Zero eval/shell)</span>
              </div>
              <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
                {chatMessages.length === 0 ? (
                  <div className="text-xs text-[var(--ml-text-secondary)] space-y-1.5 p-2">
                    <p className="font-semibold text-[var(--ml-text-primary)]">Try owner commands:</p>
                    <p>• <code className="text-[#2B8A86]">status</code></p>
                    <p>• <code className="text-[#2B8A86]">test dream world</code></p>
                    <p>• <code className="text-[#2B8A86]">add server Backup Node https://backup.example.com</code></p>
                    <p>• <code className="text-[#2B8A86]">rollback primary</code></p>
                  </div>
                ) : (
                  chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`rounded-xl p-2.5 text-xs whitespace-pre-wrap ${
                        msg.role === 'owner'
                          ? 'ml-10 bg-[#2B8A86] text-white'
                          : 'mr-6 bg-[var(--ml-surface)] border border-[var(--ml-border)] text-[var(--ml-text-primary)]'
                      }`}
                    >
                      <div className="font-bold text-[10px] opacity-75 mb-0.5">
                        {msg.senderName || msg.role.toUpperCase()}
                      </div>
                      <div>{msg.text}</div>
                      {msg.role === 'system' && msg.parsedIntent?.requiresConfirmation && !msg.parsedIntent?.confirmed && (
                        <button
                          type="button"
                          disabled={chatSending}
                          onClick={() =>
                            handleSendChat(
                              msg.parsedIntent?.action === 'rollback'
                                ? 'rollback primary'
                                : `switch primary to ${msg.parsedIntent?.targetServerId}`,
                              true
                            )
                          }
                          className="mt-2 px-3 py-1.5 rounded-lg bg-[#D0AF72] text-[#0E1117] font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                        >
                          <ShieldAlert className="w-3.5 h-3.5" /> Confirm Switch
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendChat();
                }}
                className="p-2.5 border-t border-[var(--ml-border)] flex items-center gap-2 bg-[var(--ml-surface)]"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder='Enter owner command (e.g. "status", "test srv_dream_world")...'
                  className="flex-1 px-3 py-2 rounded-xl bg-[var(--ml-surface-soft)] border border-[var(--ml-border)] text-xs text-[var(--ml-text-primary)] focus:outline-none focus:border-[#2B8A86]"
                />
                <button
                  type="submit"
                  disabled={chatSending || !chatInput.trim()}
                  className="min-h-[38px] px-3.5 py-2 rounded-xl bg-[#2B8A86] text-white text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" /> Run
                </button>
              </form>
            </div>
          )}

          {activeTab === 'history' && isAdminOrOwner && (
            <div className="space-y-2">
              {history.length === 0 ? (
                <p className="text-xs text-[var(--ml-text-secondary)] py-6 text-center">No switch audit entries recorded yet.</p>
              ) : (
                history.map((h) => (
                  <div
                    key={h.id}
                    className="rounded-xl bg-[var(--ml-surface-soft)] border border-[var(--ml-border)] p-3 flex items-start justify-between gap-2 text-xs"
                  >
                    <div>
                      <span className="font-bold text-[#2B8A86] uppercase mr-2">{h.action}</span>
                      <span className="text-[var(--ml-text-primary)] font-medium">{h.summary}</span>
                      <p className="text-[11px] text-[var(--ml-text-muted)] mt-0.5">
                        By @{h.actorUsername}
                      </p>
                    </div>
                    <span className="text-[11px] text-[var(--ml-text-muted)] whitespace-nowrap">
                      {new Date(h.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
