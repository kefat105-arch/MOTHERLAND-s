import crypto from 'crypto';
import type {
  GameCatalogEntry,
  LiveSpyCapacity,
  LiveSpyChatItem,
  LiveSpyClueItem,
  LiveSpyEliminationSummary,
  LiveSpyPhase,
  LiveSpyPlayerSeat,
  LiveSpyPublicState,
  LiveSpySecretAssignment,
  LiveSpyVoteTallyEntry,
} from '../types';

export interface SpyEngineUser {
  id: string;
  displayName: string;
  username: string;
  avatar: string;
}

interface InternalSeat {
  userId: string;
  displayName: string;
  username: string;
  avatar: string;
  seatIndex: number;
  cameraOn: boolean;
  micMuted: boolean;
  alive: boolean;
  wantsPlayAgain: boolean;
  revealedRole?: 'spy' | 'citizen';
}

interface InternalRoom {
  roomId: string;
  matchId: string;
  capacity: LiveSpyCapacity;
  phase: LiveSpyPhase;
  locked: boolean;
  countdownSec: number;
  round: number;
  category: string;
  secretWord: string;
  spyUserId: string;
  phaseEndsAt: number | null;
  players: InternalSeat[];
  cluesByRound: Map<number, LiveSpyClueItem[]>;
  readyToVoteUserIds: Set<string>;
  votes: Map<string, string>; // voterUserId -> targetUserId | 'skip'
  voteTally: LiveSpyVoteTallyEntry[];
  messages: LiveSpyChatItem[];
  eliminatedThisRound: LiveSpyEliminationSummary | null;
  winner: 'citizens' | 'spy' | null;
  timer: NodeJS.Timeout | null;
  countdownInterval: NodeJS.Timeout | null;
}

export interface LiveSpyPhaseDurations {
  countdownTickMs: number;
  roleRevealMs: number;
  clueMs: number;
  discussionMs: number;
  votingMs: number;
  eliminationMs: number;
}

const DEFAULT_DURATIONS: LiveSpyPhaseDurations = {
  countdownTickMs: 1000,
  roleRevealMs: 6000,
  clueMs: 45000,
  discussionMs: 55000,
  votingMs: 35000,
  eliminationMs: 7000,
};

const WORD_BANK: Array<{ category: string; word: string }> = [
  { category: 'Street Food', word: 'Fuchka' },
  { category: 'Tropical Fruit', word: 'Mango' },
  { category: 'Destinations', word: 'Coxs Bazar' },
  { category: 'Sports', word: 'Cricket' },
  { category: 'Transit', word: 'Rickshaw' },
  { category: 'Beverages', word: 'Masala Tea' },
  { category: 'Nature', word: 'Sundarbans' },
  { category: 'Music', word: 'Guitar' },
  { category: 'Places', word: 'Airport' },
  { category: 'Festivals', word: 'Eid Feast' },
  { category: 'Desserts', word: 'Roshogolla' },
  { category: 'Daily Life', word: 'Umbrella' },
  { category: 'Technology', word: 'Smartwatch' },
  { category: 'Cinema', word: 'Movie Theater' },
  { category: 'Dining', word: 'Rooftop Cafe' },
  { category: 'Animals', word: 'Royal Tiger' },
  { category: 'Travel', word: 'River Ferry' },
  { category: 'Games', word: 'Chessboard' },
  { category: 'Weather', word: 'Monsoon Rain' },
  { category: 'Workspace', word: 'Espresso Bar' },
];

export const GAME_CATALOG: GameCatalogEntry[] = [
  {
    id: 'live_spy',
    name: 'LIVE SPY',
    tagline: 'Live Camera Social Deduction',
    description:
      'Step inside a luxury private lounge with 6 or 8 real players. Spot the hidden Spy through live camera expressions, clever clues, and sharp voting.',
    category: 'multiplayer',
    badge: 'Online Multiplayer',
    status: 'playable',
    supportedCapacities: [6, 8],
  },
  {
    id: 'ludo_royal',
    name: 'LUDO ROYAL',
    tagline: 'Real-Time 4-Player Board Duel',
    description:
      'Classic dice strategy with voice-chat tables and tournament ladders inside MOTHERLAND.',
    category: 'coming_soon',
    badge: 'Coming Soon',
    status: 'coming_soon',
  },
  {
    id: 'carrom_club',
    name: 'CARROM CLUB',
    tagline: 'Physics Strike & Pocket Arena',
    description:
      'Challenge friends on bespoke teakwood boards with smooth touch-flick precision.',
    category: 'coming_soon',
    badge: 'Coming Soon',
    status: 'coming_soon',
  },
  {
    id: 'dhaka_trivia',
    name: 'SPEED TRIVIA LIVE',
    tagline: 'Lightning Cultural & World Quiz',
    description:
      'Rapid-fire social rounds covering Bengal heritage, cinema, music, and global pop culture.',
    category: 'coming_soon',
    badge: 'Coming Soon',
    status: 'coming_soon',
  },
];

export class LiveSpyEngine {
  private rooms = new Map<string, InternalRoom>();
  private userToRoomId = new Map<string, string>();
  private disconnectTimers = new Map<string, NodeJS.Timeout>();
  private durations: LiveSpyPhaseDurations;
  private emitToUser: (userId: string, event: string, payload: Record<string, any>) => void;

  constructor(
    emitToUser: (userId: string, event: string, payload: Record<string, any>) => void,
    durations?: Partial<LiveSpyPhaseDurations>
  ) {
    this.emitToUser = emitToUser;
    this.durations = { ...DEFAULT_DURATIONS, ...(durations || {}) };
  }

  public getPublicRoomForUser(userId: string): LiveSpyPublicState | null {
    const roomId = this.userToRoomId.get(userId);
    if (!roomId) return null;
    const room = this.rooms.get(roomId);
    if (!room) {
      this.userToRoomId.delete(userId);
      return null;
    }
    return this.serializePublicRoom(room);
  }

  public getSecretForUser(userId: string): LiveSpySecretAssignment | null {
    const roomId = this.userToRoomId.get(userId);
    if (!roomId) return null;
    const room = this.rooms.get(roomId);
    if (!room) return null;
    if (room.phase === 'waiting' || room.phase === 'countdown') return null;
    return this.buildSecretPayload(room, userId);
  }

  public joinMatchmaking(user: SpyEngineUser, rawCapacity: number): LiveSpyPublicState {
    const capacity: LiveSpyCapacity = rawCapacity === 8 ? 8 : 6;
    this.clearDisconnectGrace(user.id);

    const existingRoomId = this.userToRoomId.get(user.id);
    if (existingRoomId) {
      const existing = this.rooms.get(existingRoomId);
      if (existing && existing.phase !== 'winner') {
        const seated = existing.players.find((p) => p.userId === user.id);
        if (seated) {
          seated.displayName = user.displayName;
          seated.username = user.username;
          seated.avatar = user.avatar;
          // If still waiting in a differently sized room, leave that room cleanly and re-queue
          if (existing.phase === 'waiting' && existing.capacity !== capacity && !existing.locked) {
            this.leaveRoom(user.id);
          } else {
            const state = this.serializePublicRoom(existing);
            this.emitToUser(user.id, 'spy:state', { state });
            if (existing.phase !== 'waiting' && existing.phase !== 'countdown') {
              const secret = this.buildSecretPayload(existing, user.id);
              if (secret) this.emitToUser(user.id, 'spy:secret', { secret });
            }
            return state;
          }
        }
      } else {
        this.leaveRoom(user.id);
      }
    }

    // Find an available, unlocked waiting room with open slots for this capacity
    let targetRoom: InternalRoom | null = null;
    for (const room of this.rooms.values()) {
      if (
        room.capacity === capacity &&
        room.phase === 'waiting' &&
        !room.locked &&
        room.players.length < room.capacity
      ) {
        targetRoom = room;
        break;
      }
    }

    if (!targetRoom) {
      targetRoom = this.createRoom(capacity);
      this.rooms.set(targetRoom.roomId, targetRoom);
    }

    // Strict guard against overfill or duplicate seat
    if (targetRoom.players.length >= targetRoom.capacity || targetRoom.locked) {
      targetRoom = this.createRoom(capacity);
      this.rooms.set(targetRoom.roomId, targetRoom);
    }

    const usedSeats = new Set(targetRoom.players.map((p) => p.seatIndex));
    let seatIndex = 0;
    while (usedSeats.has(seatIndex) && seatIndex < targetRoom.capacity) {
      seatIndex += 1;
    }

    targetRoom.players.push({
      userId: user.id,
      displayName: user.displayName,
      username: user.username,
      avatar: user.avatar,
      seatIndex,
      cameraOn: false,
      micMuted: false,
      alive: true,
      wantsPlayAgain: false,
    });
    this.userToRoomId.set(user.id, targetRoom.roomId);

    this.broadcastRoomState(targetRoom);

    // Trigger atomic lock + 3-2-1 countdown the exact instant room reaches full capacity
    if (targetRoom.players.length === targetRoom.capacity && targetRoom.phase === 'waiting' && !targetRoom.locked) {
      this.beginAtomicCountdown(targetRoom);
    }

    return this.serializePublicRoom(targetRoom);
  }

  public leaveRoom(userId: string): void {
    this.clearDisconnectGrace(userId);
    const roomId = this.userToRoomId.get(userId);
    if (!roomId) {
      this.emitToUser(userId, 'spy:left', { roomId: null });
      return;
    }
    this.userToRoomId.delete(userId);
    const room = this.rooms.get(roomId);
    if (!room) {
      this.emitToUser(userId, 'spy:left', { roomId });
      return;
    }

    const leavingIndex = room.players.findIndex((p) => p.userId === userId);
    if (leavingIndex === -1) {
      this.emitToUser(userId, 'spy:left', { roomId });
      return;
    }

    const leavingPlayer = room.players[leavingIndex];
    room.readyToVoteUserIds.delete(userId);
    room.votes.delete(userId);

    if (room.phase === 'waiting' || room.phase === 'countdown') {
      room.players.splice(leavingIndex, 1);
      // Cancel countdown & unlock room if capacity drops below required threshold
      if (room.phase === 'countdown') {
        this.clearTimers(room);
        room.locked = false;
        room.phase = 'waiting';
        room.countdownSec = 0;
        room.phaseEndsAt = null;
      }
    } else if (room.phase === 'winner') {
      room.players.splice(leavingIndex, 1);
    } else {
      // Mid-match departure: mark disconnected player out cleanly and check win condition
      leavingPlayer.alive = false;
      leavingPlayer.cameraOn = false;
      leavingPlayer.micMuted = true;
      leavingPlayer.revealedRole = leavingPlayer.userId === room.spyUserId ? 'spy' : 'citizen';

      if (leavingPlayer.userId === room.spyUserId) {
        this.resolveWinner(room, 'citizens');
        this.emitToUser(userId, 'spy:left', { roomId });
        return;
      }
      const aliveCitizens = room.players.filter((p) => p.alive && p.userId !== room.spyUserId);
      if (aliveCitizens.length <= 1) {
        this.resolveWinner(room, 'spy');
        this.emitToUser(userId, 'spy:left', { roomId });
        return;
      }
      if (room.phase === 'clue' && this.haveAllAliveSubmittedClue(room)) {
        this.enterDiscussionPhase(room);
      } else if (room.phase === 'voting' && this.haveAllAliveVoted(room)) {
        this.resolveVotingAndEliminate(room);
      }
    }

    this.emitToUser(userId, 'spy:left', { roomId });

    if (room.players.length === 0) {
      this.destroyRoom(room);
      return;
    }

    this.broadcastRoomState(room);
  }

  public handleSocketDisconnected(userId: string, hasRemainingSockets: boolean): void {
    if (hasRemainingSockets) return;
    const roomId = this.userToRoomId.get(userId);
    if (!roomId) return;
    this.clearDisconnectGrace(userId);
    // Allow 8s reconnect grace window on mobile network drops before vacating seat
    const timer = setTimeout(() => {
      this.disconnectTimers.delete(userId);
      this.leaveRoom(userId);
    }, 8000);
    this.disconnectTimers.set(userId, timer);
  }

  public handleSocketConnected(userId: string): void {
    this.clearDisconnectGrace(userId);
    const roomId = this.userToRoomId.get(userId);
    if (!roomId) return;
    const room = this.rooms.get(roomId);
    if (!room) return;
    this.emitToUser(userId, 'spy:state', { state: this.serializePublicRoom(room) });
    if (room.phase !== 'waiting' && room.phase !== 'countdown') {
      const secret = this.buildSecretPayload(room, userId);
      if (secret) this.emitToUser(userId, 'spy:secret', { secret });
    }
  }

  public updateMediaState(userId: string, cameraOn?: boolean, micMuted?: boolean): void {
    const room = this.getActiveRoom(userId);
    if (!room) return;
    const seat = room.players.find((p) => p.userId === userId);
    if (!seat) return;
    if (typeof cameraOn === 'boolean') seat.cameraOn = cameraOn;
    if (typeof micMuted === 'boolean') seat.micMuted = micMuted;
    this.broadcastRoomState(room);
  }

  public relayWebRtcSignal(
    fromUserId: string,
    targetUserId: string,
    signalPayload: Record<string, any>
  ): void {
    const room = this.getActiveRoom(fromUserId);
    if (!room) return;
    if (!targetUserId || targetUserId === fromUserId) return;
    const targetInRoom = room.players.some((p) => p.userId === targetUserId);
    if (!targetInRoom) return;

    this.emitToUser(targetUserId, 'spy:webrtc_signal', {
      roomId: room.roomId,
      fromUserId,
      ...signalPayload,
    });
  }

  public submitClue(userId: string, rawClue: string): { ok: boolean; error?: string } {
    const room = this.getActiveRoom(userId);
    if (!room) return { ok: false, error: 'You are not in an active match.' };
    if (room.phase !== 'clue') return { ok: false, error: 'Clues can only be submitted during the Clue Round.' };
    const seat = room.players.find((p) => p.userId === userId);
    if (!seat || !seat.alive) return { ok: false, error: 'Eliminated players cannot submit clues.' };

    const clue = String(rawClue || '').replace(/\s+/g, ' ').trim().slice(0, 48);
    if (!clue) return { ok: false, error: 'Please enter a valid clue.' };

    const roundClues = room.cluesByRound.get(room.round) || [];
    if (roundClues.some((c) => c.userId === userId)) {
      return { ok: false, error: 'You already submitted your clue for this round.' };
    }

    roundClues.push({
      round: room.round,
      userId,
      displayName: seat.displayName,
      seatIndex: seat.seatIndex,
      clue,
      createdAt: new Date().toISOString(),
    });
    room.cluesByRound.set(room.round, roundClues);
    this.broadcastRoomState(room);

    if (this.haveAllAliveSubmittedClue(room)) {
      this.enterDiscussionPhase(room);
    }
    return { ok: true };
  }

  public sendChatMessage(userId: string, rawText: string): { ok: boolean; error?: string } {
    const room = this.getActiveRoom(userId);
    if (!room) return { ok: false, error: 'Not in a room.' };
    const seat = room.players.find((p) => p.userId === userId);
    if (!seat) return { ok: false, error: 'Seat not found.' };
    if (
      room.phase !== 'waiting' &&
      room.phase !== 'discussion' &&
      room.phase !== 'clue' &&
      room.phase !== 'winner'
    ) {
      return { ok: false, error: 'Chat is paused right now.' };
    }
    if (!seat.alive && room.phase !== 'winner') {
      return { ok: false, error: 'Eliminated players observe silently until the match ends.' };
    }

    const text = String(rawText || '').replace(/\s+/g, ' ').trim().slice(0, 220);
    if (!text) return { ok: false, error: 'Empty message.' };

    const msg: LiveSpyChatItem = {
      id: `spychat_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      userId,
      displayName: seat.displayName,
      avatar: seat.avatar,
      text,
      createdAt: new Date().toISOString(),
    };
    room.messages.push(msg);
    if (room.messages.length > 60) {
      room.messages = room.messages.slice(-60);
    }
    this.broadcastRoomState(room);
    return { ok: true };
  }

  public markReadyToVote(userId: string): void {
    const room = this.getActiveRoom(userId);
    if (!room || room.phase !== 'discussion') return;
    const seat = room.players.find((p) => p.userId === userId);
    if (!seat || !seat.alive) return;

    room.readyToVoteUserIds.add(userId);
    this.broadcastRoomState(room);

    const aliveIds = room.players.filter((p) => p.alive).map((p) => p.userId);
    if (aliveIds.length > 0 && aliveIds.every((id) => room.readyToVoteUserIds.has(id))) {
      this.enterVotingPhase(room);
    }
  }

  public submitVote(userId: string, rawTargetUserId: string): { ok: boolean; error?: string } {
    const room = this.getActiveRoom(userId);
    if (!room) return { ok: false, error: 'Not in an active room.' };
    if (room.phase !== 'voting') return { ok: false, error: 'Voting is not open right now.' };
    const voter = room.players.find((p) => p.userId === userId);
    if (!voter || !voter.alive) return { ok: false, error: 'Eliminated players cannot vote.' };

    const target = String(rawTargetUserId || '').trim();
    if (target !== 'skip') {
      const targetSeat = room.players.find((p) => p.userId === target && p.alive);
      if (!targetSeat) return { ok: false, error: 'Selected player is not eligible for voting.' };
      if (targetSeat.userId === userId) return { ok: false, error: 'You cannot vote for yourself.' };
    }

    room.votes.set(userId, target);
    this.broadcastRoomState(room);

    if (this.haveAllAliveVoted(room)) {
      this.resolveVotingAndEliminate(room);
    }
    return { ok: true };
  }

  public requestPlayAgain(user: SpyEngineUser, capacityOverride?: number): LiveSpyPublicState {
    const room = this.getActiveRoom(user.id);
    const targetCapacity =
      capacityOverride === 8 || capacityOverride === 6
        ? capacityOverride
        : room?.capacity || 6;
    this.leaveRoom(user.id);
    return this.joinMatchmaking(user, targetCapacity);
  }

  public disposeAll(): void {
    for (const timer of this.disconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.disconnectTimers.clear();
    for (const room of this.rooms.values()) {
      this.clearTimers(room);
    }
    this.rooms.clear();
    this.userToRoomId.clear();
  }

  private createRoom(capacity: LiveSpyCapacity): InternalRoom {
    return {
      roomId: `spy_${capacity}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      matchId: '',
      capacity,
      phase: 'waiting',
      locked: false,
      countdownSec: 0,
      round: 0,
      category: '',
      secretWord: '',
      spyUserId: '',
      phaseEndsAt: null,
      players: [],
      cluesByRound: new Map(),
      readyToVoteUserIds: new Set(),
      votes: new Map(),
      voteTally: [],
      messages: [],
      eliminatedThisRound: null,
      winner: null,
      timer: null,
      countdownInterval: null,
    };
  }

  private clearTimers(room: InternalRoom): void {
    if (room.timer) {
      clearTimeout(room.timer);
      room.timer = null;
    }
    if (room.countdownInterval) {
      clearInterval(room.countdownInterval);
      room.countdownInterval = null;
    }
  }

  private clearDisconnectGrace(userId: string): void {
    const existing = this.disconnectTimers.get(userId);
    if (existing) {
      clearTimeout(existing);
      this.disconnectTimers.delete(userId);
    }
  }

  private getActiveRoom(userId: string): InternalRoom | null {
    const roomId = this.userToRoomId.get(userId);
    if (!roomId) return null;
    return this.rooms.get(roomId) || null;
  }

  private beginAtomicCountdown(room: InternalRoom): void {
    this.clearTimers(room);
    room.locked = true;
    room.phase = 'countdown';
    room.countdownSec = 3;
    room.phaseEndsAt = Date.now() + this.durations.countdownTickMs * 3;
    this.broadcastRoomState(room);

    room.countdownInterval = setInterval(() => {
      if (room.phase !== 'countdown') {
        this.clearTimers(room);
        return;
      }
      if (room.players.length < room.capacity) {
        this.clearTimers(room);
        room.locked = false;
        room.phase = 'waiting';
        room.countdownSec = 0;
        room.phaseEndsAt = null;
        this.broadcastRoomState(room);
        return;
      }
      room.countdownSec = Math.max(0, room.countdownSec - 1);
      if (room.countdownSec <= 0) {
        this.clearTimers(room);
        this.startMatch(room);
      } else {
        this.broadcastRoomState(room);
      }
    }, this.durations.countdownTickMs);
  }

  private startMatch(room: InternalRoom): void {
    if (room.players.length < room.capacity) {
      room.locked = false;
      room.phase = 'waiting';
      room.countdownSec = 0;
      room.phaseEndsAt = null;
      this.broadcastRoomState(room);
      return;
    }

    this.clearTimers(room);
    const wordPair = WORD_BANK[crypto.randomInt(0, WORD_BANK.length)];
    const spyIdx = crypto.randomInt(0, room.players.length);

    room.matchId = `match_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    room.round = 1;
    room.category = wordPair.category;
    room.secretWord = wordPair.word;
    room.spyUserId = room.players[spyIdx].userId;
    room.phase = 'role_reveal';
    room.countdownSec = 0;
    room.cluesByRound = new Map();
    room.readyToVoteUserIds = new Set();
    room.votes = new Map();
    room.voteTally = [];
    room.eliminatedThisRound = null;
    room.winner = null;
    room.phaseEndsAt = Date.now() + this.durations.roleRevealMs;

    for (const p of room.players) {
      p.alive = true;
      p.wantsPlayAgain = false;
      p.revealedRole = undefined;
    }

    // Deliver strict private role/secret word per individual player ONLY
    for (const p of room.players) {
      const secret = this.buildSecretPayload(room, p.userId);
      if (secret) {
        this.emitToUser(p.userId, 'spy:secret', { secret });
      }
    }

    this.broadcastRoomState(room);

    room.timer = setTimeout(() => {
      this.enterCluePhase(room);
    }, this.durations.roleRevealMs);
  }

  private enterCluePhase(room: InternalRoom): void {
    this.clearTimers(room);
    room.phase = 'clue';
    room.readyToVoteUserIds.clear();
    room.votes.clear();
    room.voteTally = [];
    room.eliminatedThisRound = null;
    room.phaseEndsAt = Date.now() + this.durations.clueMs;
    this.broadcastRoomState(room);

    room.timer = setTimeout(() => {
      this.enterDiscussionPhase(room);
    }, this.durations.clueMs);
  }

  private enterDiscussionPhase(room: InternalRoom): void {
    this.clearTimers(room);
    room.phase = 'discussion';
    room.readyToVoteUserIds.clear();
    room.phaseEndsAt = Date.now() + this.durations.discussionMs;
    this.broadcastRoomState(room);

    room.timer = setTimeout(() => {
      this.enterVotingPhase(room);
    }, this.durations.discussionMs);
  }

  private enterVotingPhase(room: InternalRoom): void {
    this.clearTimers(room);
    room.phase = 'voting';
    room.votes.clear();
    room.voteTally = [];
    room.phaseEndsAt = Date.now() + this.durations.votingMs;
    this.broadcastRoomState(room);

    room.timer = setTimeout(() => {
      this.resolveVotingAndEliminate(room);
    }, this.durations.votingMs);
  }

  private resolveVotingAndEliminate(room: InternalRoom): void {
    this.clearTimers(room);
    const counts = new Map<string, number>();

    for (const target of room.votes.values()) {
      if (target === 'skip') continue;
      counts.set(target, (counts.get(target) || 0) + 1);
    }

    const tally: LiveSpyVoteTallyEntry[] = [];
    for (const [targetUserId, votes] of counts.entries()) {
      const seat = room.players.find((p) => p.userId === targetUserId);
      if (seat) {
        tally.push({ targetUserId, displayName: seat.displayName, votes });
      }
    }
    tally.sort((a, b) => b.votes - a.votes);
    room.voteTally = tally;

    let eliminatedSeat: InternalSeat | null = null;
    let reason: 'majority' | 'tie' | 'no_votes' = 'no_votes';

    if (tally.length > 0) {
      const topVotes = tally[0].votes;
      const topContenders = tally.filter((t) => t.votes === topVotes);
      if (topContenders.length === 1) {
        eliminatedSeat = room.players.find((p) => p.userId === topContenders[0].targetUserId) || null;
        reason = 'majority';
      } else {
        reason = 'tie';
      }
    }

    if (eliminatedSeat) {
      eliminatedSeat.alive = false;
      eliminatedSeat.revealedRole = eliminatedSeat.userId === room.spyUserId ? 'spy' : 'citizen';
      room.eliminatedThisRound = {
        round: room.round,
        eliminatedUserId: eliminatedSeat.userId,
        eliminatedName: eliminatedSeat.displayName,
        revealedRole: eliminatedSeat.revealedRole,
        reason,
      };
    } else {
      room.eliminatedThisRound = {
        round: room.round,
        eliminatedUserId: null,
        eliminatedName: null,
        revealedRole: null,
        reason,
      };
    }

    room.phase = 'elimination';
    room.phaseEndsAt = Date.now() + this.durations.eliminationMs;
    this.broadcastRoomState(room);

    room.timer = setTimeout(() => {
      if (eliminatedSeat && eliminatedSeat.userId === room.spyUserId) {
        this.resolveWinner(room, 'citizens');
        return;
      }
      const aliveCitizens = room.players.filter((p) => p.alive && p.userId !== room.spyUserId);
      const spySeat = room.players.find((p) => p.userId === room.spyUserId);
      if (!spySeat || !spySeat.alive) {
        this.resolveWinner(room, 'citizens');
        return;
      }
      if (aliveCitizens.length <= 1) {
        this.resolveWinner(room, 'spy');
        return;
      }
      room.round += 1;
      this.enterCluePhase(room);
    }, this.durations.eliminationMs);
  }

  private resolveWinner(room: InternalRoom, winner: 'citizens' | 'spy'): void {
    this.clearTimers(room);
    room.phase = 'winner';
    room.winner = winner;
    room.phaseEndsAt = null;
    for (const p of room.players) {
      p.revealedRole = p.userId === room.spyUserId ? 'spy' : 'citizen';
    }
    this.broadcastRoomState(room);
  }

  private haveAllAliveSubmittedClue(room: InternalRoom): boolean {
    const aliveIds = room.players.filter((p) => p.alive).map((p) => p.userId);
    const roundClues = room.cluesByRound.get(room.round) || [];
    const submittedSet = new Set(roundClues.map((c) => c.userId));
    return aliveIds.length > 0 && aliveIds.every((id) => submittedSet.has(id));
  }

  private haveAllAliveVoted(room: InternalRoom): boolean {
    const aliveIds = room.players.filter((p) => p.alive).map((p) => p.userId);
    return aliveIds.length > 0 && aliveIds.every((id) => room.votes.has(id));
  }

  private buildSecretPayload(room: InternalRoom, userId: string): LiveSpySecretAssignment | null {
    const seat = room.players.find((p) => p.userId === userId);
    if (!seat) return null;
    const isSpy = userId === room.spyUserId;
    return {
      roomId: room.roomId,
      matchId: room.matchId,
      role: isSpy ? 'spy' : 'citizen',
      category: room.category,
      secretWord: isSpy ? null : room.secretWord,
      instruction: isSpy
        ? 'You are the SPY! Observe clues, blend into the conversation, and avoid getting voted out.'
        : `You are a CITIZEN. Give clever clues related to "${room.secretWord}" without saying the word itself.`,
    };
  }

  private serializePublicRoom(room: InternalRoom): LiveSpyPublicState {
    const currentRoundClues = room.cluesByRound.get(room.round) || [];
    const clueUserSet = new Set(currentRoundClues.map((c) => c.userId));
    const players: LiveSpyPlayerSeat[] = room.players
      .slice()
      .sort((a, b) => a.seatIndex - b.seatIndex)
      .map((p) => ({
        userId: p.userId,
        displayName: p.displayName,
        username: p.username,
        avatar: p.avatar,
        seatIndex: p.seatIndex,
        cameraOn: p.cameraOn,
        micMuted: p.micMuted,
        alive: p.alive,
        clueSubmitted: clueUserSet.has(p.userId),
        hasVoted: room.votes.has(p.userId),
        readyToVote: room.readyToVoteUserIds.has(p.userId),
        wantsPlayAgain: p.wantsPlayAgain,
        revealedRole: p.revealedRole,
      }));

    const spySeat = room.players.find((p) => p.userId === room.spyUserId);

    return {
      roomId: room.roomId,
      matchId: room.matchId,
      capacity: room.capacity,
      phase: room.phase,
      locked: room.locked,
      countdownSec: room.countdownSec,
      round: room.round,
      category: room.category,
      phaseEndsAt: room.phaseEndsAt,
      serverTime: Date.now(),
      players,
      clues: currentRoundClues,
      messages: room.messages.slice(-40),
      voteTally: room.voteTally,
      eliminatedThisRound: room.eliminatedThisRound,
      winner: room.winner,
      finalReveal:
        room.phase === 'winner'
          ? {
              spyUserId: room.spyUserId,
              spyDisplayName: spySeat?.displayName || 'The Spy',
              category: room.category,
              secretWord: room.secretWord,
            }
          : null,
    };
  }

  private broadcastRoomState(room: InternalRoom): void {
    const state = this.serializePublicRoom(room);
    for (const player of room.players) {
      this.emitToUser(player.userId, 'spy:state', { state });
    }
  }

  private destroyRoom(room: InternalRoom): void {
    this.clearTimers(room);
    for (const p of room.players) {
      if (this.userToRoomId.get(p.userId) === room.roomId) {
        this.userToRoomId.delete(p.userId);
      }
    }
    this.rooms.delete(room.roomId);
  }
}
