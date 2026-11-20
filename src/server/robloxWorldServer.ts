import crypto from 'crypto';
import type {
  RobloxAvatarConfig,
  WorldRoomPlayerSnapshot,
  WorldRoomPublicState,
} from '../types';

export const WORLD_MAX_PLAYERS = 25;

export interface WorldServerUser {
  id: string;
  displayName: string;
}

interface InternalWorldPlayer extends WorldRoomPlayerSnapshot {
  joinedAt: number;
  lastUpdateAt: number;
}

interface InternalWorldRoom {
  roomId: string;
  serverNumber: number;
  worldId: string;
  phase: string;
  phaseTimer: number;
  phaseData: Record<string, any>;
  players: Map<string, InternalWorldPlayer>;
  tickTimer: NodeJS.Timeout;
}

const DEFAULT_AVATAR: RobloxAvatarConfig = {
  skinHex: 0xf3c297,
  shirtHex: 0x0f766e,
  pantsHex: 0x115e59,
  hairHex: 0x1e1b18,
  hatStyle: 'hair_swept',
  faceMood: 'smile',
  accessory: 'none',
};

const DISASTERS = [
  'MEGA TSUNAMI',
  'METEOR SHOWER',
  'TORNADO VORTEX',
  'VOLCANIC ERUPTION',
  'EARTHQUAKE',
  'BLIZZARD STORM',
] as const;

export class RobloxWorldServerEngine {
  private roomsById = new Map<string, InternalWorldRoom>();
  private roomsByWorld = new Map<string, InternalWorldRoom[]>();
  private userRoomMap = new Map<string, string>();
  private emitToUser: (userId: string, event: string, payload: Record<string, any>) => void;

  constructor(emitToUser: (userId: string, event: string, payload: Record<string, any>) => void) {
    this.emitToUser = emitToUser;
  }

  private createRoom(worldId: string, serverNumber: number): InternalWorldRoom {
    const roomId = `srv_${worldId}_${serverNumber}_${crypto.randomBytes(3).toString('hex')}`;
    const initialPhase = this.getInitialPhase(worldId);

    const room: InternalWorldRoom = {
      roomId,
      serverNumber,
      worldId,
      phase: initialPhase.phase,
      phaseTimer: initialPhase.timer,
      phaseData: initialPhase.data,
      players: new Map(),
      tickTimer: setInterval(() => this.tickRoom(roomId), 1000),
    };
    room.tickTimer.unref?.();

    this.roomsById.set(roomId, room);
    const list = this.roomsByWorld.get(worldId) || [];
    list.push(room);
    list.sort((a, b) => a.serverNumber - b.serverNumber);
    this.roomsByWorld.set(worldId, list);
    return room;
  }

  private getInitialPhase(worldId: string): {
    phase: string;
    timer: number;
    data: Record<string, any>;
  } {
    if (worldId === 'squid_game') {
      return {
        phase: 'green_light',
        timer: 5,
        data: { stageNum: 1, dollLooking: false, round: 1 },
      };
    }
    if (worldId === 'natural_disaster') {
      return {
        phase: 'calm',
        timer: 14,
        data: { round: 1, disaster: DISASTERS[0] },
      };
    }
    if (worldId === 'mm2_manor') {
      return {
        phase: 'playing',
        timer: 180,
        data: { round: 1, murdererId: '', sheriffId: '' },
      };
    }
    if (worldId === 'bedwars_sky') {
      return {
        phase: 'battle',
        timer: 600,
        data: {
          bedsAlive: { red: true, blue: true, green: true, yellow: true },
          emeraldTier: 1,
        },
      };
    }
    if (worldId === 'blox_arena') {
      return {
        phase: 'raid',
        timer: 300,
        data: { bossHp: 5000, bossMaxHp: 5000, islandTier: 1 },
      };
    }
    if (worldId === 'brookhaven_rp') {
      return {
        phase: 'sunset',
        timer: 180,
        data: { timeCycleIdx: 0 },
      };
    }
    return {
      phase: 'active',
      timer: 120,
      data: { round: 1 },
    };
  }

  private tickRoom(roomId: string): void {
    const room = this.roomsById.get(roomId);
    if (!room || room.players.size === 0) return;

    room.phaseTimer = Math.max(0, room.phaseTimer - 1);

    if (room.worldId === 'squid_game') {
      if (room.phaseTimer <= 0) {
        if (room.phase === 'green_light') {
          room.phase = 'turning';
          room.phaseTimer = 1;
          room.phaseData.dollLooking = false;
        } else if (room.phase === 'turning') {
          room.phase = 'red_light';
          room.phaseTimer = 3 + (room.phaseData.round % 2);
          room.phaseData.dollLooking = true;
        } else {
          room.phase = 'green_light';
          room.phaseTimer = 4 + (room.phaseData.round % 3);
          room.phaseData.dollLooking = false;
          room.phaseData.round = Number(room.phaseData.round || 1) + 1;
        }
        this.broadcastState(room);
      }
    } else if (room.worldId === 'natural_disaster') {
      if (room.phaseTimer <= 0) {
        if (room.phase === 'calm') {
          room.phase = 'warning';
          room.phaseTimer = 5;
          const idx = Number(room.phaseData.round || 1) % DISASTERS.length;
          room.phaseData.disaster = DISASTERS[idx];
        } else if (room.phase === 'warning') {
          room.phase = 'disaster';
          room.phaseTimer = 28;
        } else {
          room.phase = 'calm';
          room.phaseTimer = 12;
          room.phaseData.round = Number(room.phaseData.round || 1) + 1;
        }
        this.broadcastState(room);
      }
    } else if (room.worldId === 'brookhaven_rp') {
      if (room.phaseTimer <= 0) {
        const cycles = ['day', 'sunset', 'night'];
        const nextIdx = (Number(room.phaseData.timeCycleIdx || 0) + 1) % cycles.length;
        room.phaseData.timeCycleIdx = nextIdx;
        room.phase = cycles[nextIdx];
        room.phaseTimer = 180;
        this.broadcastState(room);
      }
    } else if (room.worldId === 'mm2_manor') {
      if (room.phaseTimer <= 0) {
        room.phaseTimer = 180;
        room.phaseData.round = Number(room.phaseData.round || 1) + 1;
        const ids = Array.from(room.players.keys());
        room.phaseData.murdererId = ids[Math.floor(Math.random() * ids.length)] || '';
        room.phaseData.sheriffId = ids.length > 1 ? ids[(ids.indexOf(room.phaseData.murdererId) + 1) % ids.length] : '';
        this.broadcastState(room);
      }
    } else if (room.worldId === 'blox_arena') {
      if (room.phaseTimer <= 0 || Number(room.phaseData.bossHp || 0) <= 0) {
        room.phaseData.bossHp = 5000;
        room.phaseData.bossMaxHp = 5000;
        room.phaseData.islandTier = Number(room.phaseData.islandTier || 1) + 1;
        room.phaseTimer = 300;
        this.broadcastState(room);
      }
    } else if (room.worldId === 'bedwars_sky') {
      if (room.phaseTimer <= 0) {
        room.phaseTimer = 600;
        room.phaseData.bedsAlive = { red: true, blue: true, green: true, yellow: true };
        this.broadcastState(room);
      }
    }
  }

  private toPublicState(room: InternalWorldRoom): WorldRoomPublicState {
    return {
      roomId: room.roomId,
      serverNumber: room.serverNumber,
      worldId: room.worldId,
      maxPlayers: WORLD_MAX_PLAYERS,
      playerCount: room.players.size,
      phase: room.phase,
      phaseTimer: room.phaseTimer,
      phaseData: { ...room.phaseData },
      players: Array.from(room.players.values()).map((p) => ({
        userId: p.userId,
        displayName: p.displayName,
        x: p.x,
        y: p.y,
        z: p.z,
        yaw: p.yaw,
        speed: p.speed,
        grounded: p.grounded,
        actionActive: p.actionActive,
        inCar: p.inCar,
        score: p.score,
        avatarConfig: p.avatarConfig,
      })),
    };
  }

  private broadcastToRoom(
    room: InternalWorldRoom,
    event: string,
    payload: Record<string, any>,
    excludeUserId?: string
  ): void {
    for (const pid of room.players.keys()) {
      if (excludeUserId && pid === excludeUserId) continue;
      this.emitToUser(pid, event, payload);
    }
  }

  private broadcastState(room: InternalWorldRoom): void {
    const state = this.toPublicState(room);
    this.broadcastToRoom(room, 'world:state', { state });
  }

  public joinWorld(
    user: WorldServerUser,
    worldId: string,
    avatarConfig?: Partial<RobloxAvatarConfig>
  ): WorldRoomPublicState {
    // Leave previous room cleanly if switching
    const prevRoomId = this.userRoomMap.get(user.id);
    if (prevRoomId) {
      this.leaveWorld(user.id);
    }

    const existingList = this.roomsByWorld.get(worldId) || [];
    // Find first open room strictly below 25 players!
    let targetRoom = existingList.find((r) => r.players.size < WORLD_MAX_PLAYERS);
    if (!targetRoom) {
      // Find lowest unused serverNumber (1, 2, 3...)
      const usedNums = new Set(existingList.map((r) => r.serverNumber));
      let nextNum = 1;
      while (usedNums.has(nextNum)) nextNum++;
      targetRoom = this.createRoom(worldId, nextNum);
    }

    const mergedAvatar: RobloxAvatarConfig = {
      ...DEFAULT_AVATAR,
      ...(avatarConfig || {}),
    };

    const player: InternalWorldPlayer = {
      userId: user.id,
      displayName: user.displayName || 'Player',
      x: (Math.random() - 0.5) * 8,
      y: 0,
      z: (Math.random() - 0.5) * 8,
      yaw: Math.PI,
      speed: 0,
      grounded: true,
      actionActive: false,
      inCar: false,
      score: 0,
      avatarConfig: mergedAvatar,
      joinedAt: Date.now(),
      lastUpdateAt: Date.now(),
    };

    targetRoom.players.set(user.id, player);
    this.userRoomMap.set(user.id, targetRoom.roomId);

    const state = this.toPublicState(targetRoom);
    this.emitToUser(user.id, 'world:joined', { state, selfUserId: user.id });
    this.broadcastState(targetRoom);
    return state;
  }

  public leaveWorld(userId: string): void {
    const roomId = this.userRoomMap.get(userId);
    if (!roomId) return;
    this.userRoomMap.delete(userId);

    const room = this.roomsById.get(roomId);
    if (!room) return;
    room.players.delete(userId);
    this.broadcastToRoom(room, 'world:player_left', { userId, playerCount: room.players.size });

    if (room.players.size === 0) {
      clearInterval(room.tickTimer);
      this.roomsById.delete(roomId);
      const list = (this.roomsByWorld.get(room.worldId) || []).filter((r) => r.roomId !== roomId);
      if (list.length > 0) this.roomsByWorld.set(room.worldId, list);
      else this.roomsByWorld.delete(room.worldId);
    } else {
      this.broadcastState(room);
    }
  }

  public updatePlayerState(
    userId: string,
    patch: {
      x?: number;
      y?: number;
      z?: number;
      yaw?: number;
      speed?: number;
      grounded?: boolean;
      actionActive?: boolean;
      inCar?: boolean;
      score?: number;
      avatarConfig?: Partial<RobloxAvatarConfig>;
    }
  ): void {
    const roomId = this.userRoomMap.get(userId);
    if (!roomId) return;
    const room = this.roomsById.get(roomId);
    if (!room) return;
    const p = room.players.get(userId);
    if (!p) return;

    if (typeof patch.x === 'number' && Number.isFinite(patch.x)) p.x = patch.x;
    if (typeof patch.y === 'number' && Number.isFinite(patch.y)) p.y = patch.y;
    if (typeof patch.z === 'number' && Number.isFinite(patch.z)) p.z = patch.z;
    if (typeof patch.yaw === 'number' && Number.isFinite(patch.yaw)) p.yaw = patch.yaw;
    if (typeof patch.speed === 'number' && Number.isFinite(patch.speed)) p.speed = patch.speed;
    if (typeof patch.grounded === 'boolean') p.grounded = patch.grounded;
    if (typeof patch.actionActive === 'boolean') p.actionActive = patch.actionActive;
    if (typeof patch.inCar === 'boolean') p.inCar = patch.inCar;
    if (typeof patch.score === 'number' && Number.isFinite(patch.score)) p.score = patch.score;
    if (patch.avatarConfig && typeof patch.avatarConfig === 'object') {
      p.avatarConfig = { ...p.avatarConfig, ...patch.avatarConfig };
    }
    p.lastUpdateAt = Date.now();

    this.broadcastToRoom(
      room,
      'world:player_moved',
      {
        player: {
          userId: p.userId,
          displayName: p.displayName,
          x: p.x,
          y: p.y,
          z: p.z,
          yaw: p.yaw,
          speed: p.speed,
          grounded: p.grounded,
          actionActive: p.actionActive,
          inCar: p.inCar,
          score: p.score,
          avatarConfig: p.avatarConfig,
        },
      },
      userId
    );
  }

  public handleWorldAction(userId: string, actionType: string, data: Record<string, any> = {}): void {
    const roomId = this.userRoomMap.get(userId);
    if (!roomId) return;
    const room = this.roomsById.get(roomId);
    if (!room) return;

    if (room.worldId === 'blox_arena' && actionType === 'damage_boss') {
      const dmg = Math.min(250, Math.max(10, Number(data.damage || 60)));
      room.phaseData.bossHp = Math.max(0, Number(room.phaseData.bossHp || 5000) - dmg);
      this.broadcastState(room);
      return;
    }

    if (room.worldId === 'bedwars_sky' && actionType === 'break_bed' && data.team) {
      const team = String(data.team);
      if (room.phaseData.bedsAlive && team in room.phaseData.bedsAlive) {
        room.phaseData.bedsAlive[team] = false;
        this.broadcastState(room);
      }
      return;
    }

    this.broadcastToRoom(room, 'world:action', {
      userId,
      actionType,
      data,
    });
  }

  public sendRoomChat(userId: string, text: string): void {
    const clean = text.trim().slice(0, 140);
    if (!clean) return;
    const roomId = this.userRoomMap.get(userId);
    if (!roomId) return;
    const room = this.roomsById.get(roomId);
    if (!room) return;
    const p = room.players.get(userId);
    if (!p) return;

    this.broadcastToRoom(room, 'world:chat', {
      id: `wc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      userId,
      displayName: p.displayName,
      text: clean,
      createdAt: new Date().toISOString(),
    });
  }

  public getServerStatsSummary(): Record<
    string,
    { activeServers: number; totalPlayers: number; maxPerRoom: number; rooms: Array<{ serverNumber: number; players: number }> }
  > {
    const out: Record<
      string,
      { activeServers: number; totalPlayers: number; maxPerRoom: number; rooms: Array<{ serverNumber: number; players: number }> }
    > = {};
    for (const [worldId, rooms] of this.roomsByWorld.entries()) {
      const totalPlayers = rooms.reduce((acc, r) => acc + r.players.size, 0);
      out[worldId] = {
        activeServers: rooms.length,
        totalPlayers,
        maxPerRoom: WORLD_MAX_PLAYERS,
        rooms: rooms.map((r) => ({ serverNumber: r.serverNumber, players: r.players.size })),
      };
    }
    return out;
  }
}
