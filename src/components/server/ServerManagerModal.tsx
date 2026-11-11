import React, { useState, useEffect } from 'react';
import {
  X,
  Server,
  Activity,
  Plus,
  RotateCcw,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Send,
  Terminal,
  Globe,
  Radio,
  Lock,
} from 'lucide-react';
import {
  ServerNode,
  ServerAuditLog,
  getRegisteredServers,
  saveRegisteredServers,
  getAuditLogs,
  testServerConnectivity,
  executeServerAdminCommand,
} from '../../services/serverRegistry';

interface ServerManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ServerManagerModal: React.FC<ServerManagerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [servers, setServers] = useState<ServerNode[]>([]);
  const [auditLogs, setAuditLogs] = useState<ServerAuditLog[]>([]);
  const [testingId, setTestingId] = useState<string | null>(null);

  // Admin Chat Box state (Section 2)
  const [chatCommand, setChatCommand] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{ sender: 'user' | 'system'; text: string; time: string }>>([
    {
      sender: 'system',
      text: 'MOTHERLAND Multi-Server Management Console ready.\nType commands like:\n• Test this server\n• Add this server: https://example.com\n• Show all connected servers',
      time: 'Ready',
    },
  ]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setServers(getRegisteredServers());
      setAuditLogs(getAuditLogs());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestServer = async (server: ServerNode) => {
    setTestingId(server.id);
    const updated = await testServerConnectivity(server);
    const newServers = servers.map((s) => (s.id === updated.id ? updated : s));
    setServers(newServers);
    saveRegisteredServers(newServers);
    setTestingId(null);
  };

  const handleSetPrimary = (server: ServerNode) => {
    const newServers = servers.map((s) => ({
      ...s,
      isPrimary: s.id === server.id,
    }));
    setServers(newServers);
    saveRegisteredServers(newServers);
  };

  const handleToggleEnable = (server: ServerNode) => {
    const newServers = servers.map((s) => (s.id === server.id ? { ...s, isEnabled: !s.isEnabled } : s));
    setServers(newServers);
    saveRegisteredServers(newServers);
  };

  const handleSendChatCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatCommand.trim() || isProcessing) return;

    const userText = chatCommand.trim();
    setChatCommand('');
    setChatHistory((prev) => [
      ...prev,
      { sender: 'user', text: userText, time: new Date().toLocaleTimeString() },
    ]);

    setIsProcessing(true);
    const result = await executeServerAdminCommand(userText, servers);

    if (result.updatedServers) {
      setServers(result.updatedServers);
    }
    setAuditLogs(getAuditLogs());

    setChatHistory((prev) => [
      ...prev,
      { sender: 'system', text: result.reply, time: new Date().toLocaleTimeString() },
    ]);
    setIsProcessing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl bg-[#090d16] border border-white/10 rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/5 flex items-center justify-between bg-[#0d1322]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg text-white">
                  MULTI-SERVER MANAGEMENT & BACKEND REGISTRY
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  CENTRAL ARCHITECTURE
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Primary backend candidate, multi-server routing, and authorized admin chat console
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* Server Nodes Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-300 font-mono">
                Registered Server Nodes ({servers.length})
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                Real connectivity & health verified
              </span>
            </div>

            <div className="space-y-3">
              {servers.map((server) => (
                <div
                  key={server.id}
                  className={`p-4 rounded-2xl bg-[#0f1627] border transition-all ${
                    server.isPrimary ? 'border-emerald-500/50 shadow-md shadow-emerald-950/40' : 'border-white/5'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-white">{server.name}</h4>
                        {server.isPrimary && (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-black">
                            PRIMARY SERVER
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                            server.status === 'ONLINE'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : server.status === 'DEGRADED'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-red-500/20 text-red-400 border border-red-500/30'
                          }`}
                        >
                          {server.status} {server.httpStatus ? `(HTTP ${server.httpStatus})` : ''}
                        </span>
                      </div>

                      <div className="mt-1 text-xs text-slate-400 font-mono space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <Globe className="w-3 h-3 text-slate-500" />
                          <span>Base: {server.baseUrl}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Radio className="w-3 h-3 text-slate-500" />
                          <span>WebSocket: {server.websocketUrl}</span>
                        </div>
                      </div>

                      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                        {server.assignedServices.map((svc) => (
                          <span
                            key={svc}
                            className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#162137] text-slate-300 border border-white/5"
                          >
                            {svc}
                          </span>
                        ))}
                        {server.latencyMs !== undefined && (
                          <span className="text-[10px] font-mono text-slate-500">
                            Latency: {server.latencyMs}ms
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleTestServer(server)}
                        disabled={testingId === server.id}
                        className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${testingId === server.id ? 'animate-spin' : ''}`} />
                        <span>Test Health</span>
                      </button>

                      {!server.isPrimary && (
                        <button
                          onClick={() => handleSetPrimary(server)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600/80 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors"
                        >
                          Make Primary
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Owner-Only Admin Configuration Chat Box */}
          <div className="rounded-2xl bg-[#0d1322] border border-white/10 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-300 font-mono">
                  Owner Admin Command Console (Section 2)
                </h4>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                Authorized Admin Session
              </span>
            </div>

            {/* Chat Messages Log */}
            <div className="space-y-2 max-h-48 overflow-y-auto p-3 bg-[#080c15] rounded-xl border border-white/5 text-xs font-mono">
              {chatHistory.map((m, idx) => (
                <div
                  key={idx}
                  className={`p-2 rounded-lg leading-relaxed ${
                    m.sender === 'user'
                      ? 'bg-blue-600/20 text-blue-200 border border-blue-500/30'
                      : 'bg-[#121929] text-emerald-300 border border-emerald-500/20 whitespace-pre-wrap'
                  }`}
                >
                  <div className="text-[10px] text-slate-500 mb-0.5">
                    [{m.sender.toUpperCase()}] • {m.time}
                  </div>
                  <div>{m.text}</div>
                </div>
              ))}
            </div>

            {/* Command Input Form */}
            <form onSubmit={handleSendChatCommand} className="flex items-center gap-2">
              <input
                type="text"
                value={chatCommand}
                onChange={(e) => setChatCommand(e.target.value)}
                placeholder="Type command: e.g. 'Add this server: https://...'"
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#080c15] border border-white/10 text-white placeholder-slate-500 text-xs font-mono focus:outline-none focus:border-emerald-500/50"
              />
              <button
                type="submit"
                disabled={isProcessing || !chatCommand.trim()}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Execute</span>
              </button>
            </form>
          </div>

          {/* Audit Trail */}
          <div className="rounded-2xl bg-[#0c111e] border border-white/5 p-4 text-xs">
            <span className="font-mono text-slate-400 font-bold block mb-2">
              Server Registry Audit Trail ({auditLogs.length})
            </span>
            {auditLogs.length > 0 ? (
              <div className="space-y-1.5 max-h-32 overflow-y-auto font-mono text-[11px] text-slate-400">
                {auditLogs.map((log) => (
                  <div key={log.id} className="p-1.5 rounded bg-white/[0.02]">
                    <span className="text-emerald-400">[{log.action}]</span> {log.details}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 italic">No configuration modifications logged yet.</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 bg-[#0a0f19] flex items-center justify-between text-xs text-slate-400">
          <span>MOTHERLAND Multi-Server Engine • Failover ready</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs"
          >
            Close Console
          </button>
        </div>
      </div>
    </div>
  );
};
