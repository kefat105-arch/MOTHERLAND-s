/**
 * MOTHERLAND Multi-Server Management & Backend Service Registry
 * Section 1 & Section 2 Implementation
 */

export interface ServerNode {
  id: string;
  name: string;
  baseUrl: string;
  healthUrl: string;
  websocketUrl: string;
  isPrimary: boolean;
  isEnabled: boolean;
  status: 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'UNCHECKED';
  latencyMs?: number;
  lastChecked?: string;
  httpStatus?: number;
  assignedServices: Array<'primary_backend' | 'messaging_relay' | 'video_streaming' | 'social_storage' | 'game_websocket'>;
  addedAt: string;
}

export interface ServerAuditLog {
  id: string;
  timestamp: string;
  action: string;
  details: string;
  performedBy: string;
}

export const INITIAL_PRIMARY_SERVER: ServerNode = {
  id: 'motherland-primary',
  name: 'MOTHERLAND Production Backend',
  baseUrl: 'https://dream-world-open.onrender.com',
  healthUrl: 'https://dream-world-open.onrender.com/health',
  websocketUrl: 'wss://dream-world-open.onrender.com/ws/game',
  isPrimary: true,
  isEnabled: true,
  status: 'UNCHECKED',
  assignedServices: ['primary_backend', 'game_websocket'],
  addedAt: '2026-11-10T00:00:00.000Z',
};

const SERVERS_STORAGE_KEY = 'motherland_multi_server_registry';
const AUDIT_STORAGE_KEY = 'motherland_server_audit_log';

export function getRegisteredServers(): ServerNode[] {
  if (typeof window === 'undefined') return [INITIAL_PRIMARY_SERVER];
  try {
    const raw = localStorage.getItem(SERVERS_STORAGE_KEY);
    if (!raw) return [INITIAL_PRIMARY_SERVER];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [INITIAL_PRIMARY_SERVER];
  } catch {
    return [INITIAL_PRIMARY_SERVER];
  }
}

export function saveRegisteredServers(servers: ServerNode[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SERVERS_STORAGE_KEY, JSON.stringify(servers));
  } catch (e) {
    console.error('Failed saving server registry:', e);
  }
}

export function getAuditLogs(): ServerAuditLog[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addAuditLog(action: string, details: string, performedBy: string = 'Owner/Admin'): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getAuditLogs();
    const entry: ServerAuditLog = {
      id: `audit_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action,
      details,
      performedBy,
    };
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify([entry, ...current.slice(0, 49)]));
  } catch (e) {
    console.error('Failed logging server audit:', e);
  }
}

/**
 * Perform real health check against a server
 */
export async function testServerConnectivity(server: ServerNode): Promise<ServerNode> {
  const start = performance.now();
  const urlToTest = server.healthUrl || server.baseUrl;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const res = await fetch(urlToTest, {
      method: 'GET',
      mode: 'cors',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const latency = Math.round(performance.now() - start);
    const isOk = res.status >= 200 && res.status < 400;

    return {
      ...server,
      status: isOk ? 'ONLINE' : 'DEGRADED',
      httpStatus: res.status,
      latencyMs: latency,
      lastChecked: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
  } catch (err: unknown) {
    const latency = Math.round(performance.now() - start);
    return {
      ...server,
      status: 'OFFLINE',
      httpStatus: 0,
      latencyMs: latency,
      lastChecked: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
  }
}

/**
 * Chat command interpreter for Admin Server Console (Section 2)
 */
export async function executeServerAdminCommand(
  rawCommand: string,
  servers: ServerNode[]
): Promise<{ reply: string; updatedServers?: ServerNode[] }> {
  const cmd = rawCommand.trim();
  const lower = cmd.toLowerCase();

  // Show all servers
  if (lower.includes('show all') || lower.includes('list servers') || lower === 'servers') {
    const summary = servers
      .map(
        (s, idx) =>
          `[${idx + 1}] ${s.name} ${s.isPrimary ? '(PRIMARY)' : ''} — ${s.baseUrl} | Status: ${s.status} (${
            s.httpStatus ? 'HTTP ' + s.httpStatus : 'No ping'
          })`
      )
      .join('\n');
    return { reply: `Active Servers Registry (${servers.length}):\n${summary}` };
  }

  // Add server command: "Add this server: [url]"
  const addMatch = cmd.match(/add (?:this )?server:\s*(https?:\/\/[^\s]+)/i);
  if (addMatch && addMatch[1]) {
    const url = addMatch[1].trim().replace(/\/$/, '');
    if (!url.startsWith('https://') && !url.startsWith('http://localhost')) {
      return { reply: 'Error: Production servers must use secure HTTPS protocol.' };
    }

    const newId = `server-${Date.now().toString(36)}`;
    const newServer: ServerNode = {
      id: newId,
      name: `Backend Node (${new URL(url).hostname})`,
      baseUrl: url,
      healthUrl: `${url}/health`,
      websocketUrl: `wss://${new URL(url).host}/ws`,
      isPrimary: false,
      isEnabled: true,
      status: 'UNCHECKED',
      assignedServices: ['social_storage'],
      addedAt: new Date().toISOString(),
    };

    const tested = await testServerConnectivity(newServer);
    const updated = [...servers, tested];
    saveRegisteredServers(updated);
    addAuditLog('ADD_SERVER', `Added server ${tested.name} (${tested.baseUrl}) with initial status: ${tested.status}`);

    return {
      reply: `Successfully added and tested server: ${tested.name}\nBase URL: ${tested.baseUrl}\nHealth Check: HTTP ${tested.httpStatus || 'unreachable'} (${tested.status})\nAssigned: Social Storage`,
      updatedServers: updated,
    };
  }

  // Test server command: "Test this server" or "Test server: [name/id]"
  if (lower.startsWith('test')) {
    const target = servers[0]; // primary by default
    const tested = await testServerConnectivity(target);
    const updated = servers.map((s) => (s.id === tested.id ? tested : s));
    saveRegisteredServers(updated);
    addAuditLog('TEST_SERVER', `Tested server ${tested.name}: ${tested.status} (HTTP ${tested.httpStatus})`);

    return {
      reply: `Tested server: ${tested.name}\nBase URL: ${tested.baseUrl}\nHealth Check Result: ${tested.status} (HTTP ${tested.httpStatus || '0'}, Latency: ${tested.latencyMs}ms)\nNote: Dream World game WebSocket is configured on ${tested.websocketUrl}.`,
      updatedServers: updated,
    };
  }

  // Set primary server: "Set this as the primary server: [id or url]"
  const primaryMatch = cmd.match(/set (?:this as )?(?:the )?primary server(?::\s*([^\s]+))?/i);
  if (primaryMatch) {
    const targetArg = primaryMatch[1]?.trim();
    let target = servers[0];
    if (targetArg) {
      const found = servers.find((s) => s.id === targetArg || s.baseUrl.includes(targetArg));
      if (!found) return { reply: `Server matching "${targetArg}" not found in registry.` };
      target = found;
    }

    const updated = servers.map((s) => ({
      ...s,
      isPrimary: s.id === target.id,
    }));
    saveRegisteredServers(updated);
    addAuditLog('SET_PRIMARY', `Set ${target.name} (${target.baseUrl}) as primary server`);

    return {
      reply: `Confirmed: ${target.name} (${target.baseUrl}) is now designated as the PRIMARY MOTHERLAND server.`,
      updatedServers: updated,
    };
  }

  // Use server for messaging: "Use this server for messaging"
  if (lower.includes('for messaging')) {
    const target = servers[0];
    const updated = servers.map((s) => ({
      ...s,
      assignedServices:
        s.id === target.id
          ? Array.from(new Set([...s.assignedServices, 'messaging_relay' as const]))
          : s.assignedServices.filter((srv) => srv !== 'messaging_relay'),
    }));
    saveRegisteredServers(updated);
    addAuditLog('ASSIGN_SERVICE', `Assigned messaging_relay to ${target.name}`);

    return {
      reply: `Assigned service [messaging_relay] to ${target.name}. Note: Personal WhatsApp/Instagram messaging continues through verified Meta Graph APIs and direct protocol schemes.`,
      updatedServers: updated,
    };
  }

  return {
    reply: `Command not recognized. Available commands:\n• Add this server: [https://your-server.com]\n• Test this server\n• Set this as the primary server\n• Use this server for messaging\n• Show all connected servers`,
  };
}
