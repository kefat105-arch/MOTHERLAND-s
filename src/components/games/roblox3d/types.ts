import type * as THREE from 'three';
import type { RobloxAvatarConfig } from '../../../types';

export type RobloxWorldId =
  | 'adopt_island'
  | 'pet_swarm'
  | 'squid_game'
  | 'brookhaven_rp'
  | 'blox_arena'
  | 'tower_obby'
  | 'bedwars_sky'
  | 'tycoon_empire'
  | 'natural_disaster'
  | 'doors_hotel'
  | 'mm2_manor'
  | 'sky_citadel'
  | 'cyber_velocity'
  | 'volcano_temple'
  | 'ocean_odyssey';

export type CustomGameBiome = 'sky_day' | 'golden_sunset' | 'cyber_night' | 'volcano_ash';
export type CustomGroundMaterial = 'grass' | 'marble' | 'asphalt' | 'basalt' | 'sand';

export type CustomObjectKind =
  | 'spawn_pad'
  | 'platform_stone'
  | 'platform_marble'
  | 'platform_wood'
  | 'platform_neon'
  | 'moving_platform'
  | 'bounce_pad'
  | 'stone_arch'
  | 'tree_palm'
  | 'tree_pine'
  | 'crystal_pillar'
  | 'coin_gem'
  | 'checkpoint'
  | 'laser_spinner'
  | 'hazard_lava'
  | 'finish_portal';

export interface CustomGameObject {
  uid: string;
  kind: CustomObjectKind;
  x: number;
  y: number;
  z: number;
  rotY?: number;
  scale?: number;
  colorHex?: string;
}

export interface CustomGameDefinition {
  id: string;
  title: string;
  description: string;
  biome: CustomGameBiome;
  groundMaterial: CustomGroundMaterial;
  moveSpeed: number;
  jumpPower: number;
  creatorId?: string;
  creatorName?: string;
  objects: CustomGameObject[];
  createdAt?: string;
  updatedAt?: string;
}

export type SquidSeason = 1;

export type SquidStageId =
  | 's1_red_light'
  | 's1_dalgona'
  | 's1_tug_of_war'
  | 's1_marbles'
  | 's1_glass_bridge'
  | 's1_squid_duel';

export interface SquidStageInfo {
  id: SquidStageId;
  season: 1;
  episodeNum: number;
  title: string;
  bnTitle: string;
  ruleSummary: string;
}

export const SQUID_STAGES: SquidStageInfo[] = [
  {
    id: 's1_red_light',
    season: 1,
    episodeNum: 1,
    title: 'Red Light, Green Light',
    bnTitle: 'রেড লাইট, গ্রিন লাইট',
    ruleSummary: 'সবুজ আলোতে দৌড়ান, পুতুল ঘুরলে সাথে সাথে স্থির হয়ে দাঁড়ান!',
  },
  {
    id: 's1_dalgona',
    season: 1,
    episodeNum: 2,
    title: 'Sugar Honeycomb (Dalgona)',
    bnTitle: 'ডালগোনা ক্যান্ডি খোদাই',
    ruleSummary: 'সুই দিয়ে সাবধানে ক্যান্ডির আকৃতি খোদাই করুন!',
  },
  {
    id: 's1_tug_of_war',
    season: 1,
    episodeNum: 3,
    title: 'Tug of War Sky Tower',
    bnTitle: 'টাগ অফ ওয়ার রশি টানাটানি',
    ruleSummary: 'উঁচু স্টিলের ব্রিজে দ্রুত টান দিয়ে প্রতিপক্ষ দলকে হারান!',
  },
  {
    id: 's1_marbles',
    season: 1,
    episodeNum: 4,
    title: 'Hanok Marbles Village',
    bnTitle: 'হানোক ভিলেজ মার্বেল খেলা',
    ruleSummary: 'কোরিয়ান গলিতে লক্ষ্য ঠিক করে ৫টি মার্বেল হিট জিতুন!',
  },
  {
    id: 's1_glass_bridge',
    season: 1,
    episodeNum: 5,
    title: '18-Step Glass Bridge',
    bnTitle: '১৮ ধাপের গ্লাস ব্রিজ',
    ruleSummary: 'টেম্পারড গ্লাস চিনে ১৮ ধাপের উঁচু ব্রিজ পার হন!',
  },
  {
    id: 's1_squid_duel',
    season: 1,
    episodeNum: 6,
    title: 'Squid Court Finale',
    bnTitle: 'স্কুইড গেম ফাইনাল',
    ruleSummary: 'স্কুইড হেডে পৌঁছান বা প্রতিদ্বন্দ্বী ২১৮-কে কোর্টের বাইরে ফেলুন!',
  },
];

export type DalgonaShape = 'circle' | 'triangle' | 'star' | 'umbrella';

export interface DalgonaOverlayState {
  active: boolean;
  shape: DalgonaShape;
  progress: number;
  cracks: number;
  done: boolean;
  failed: boolean;
}

export interface RobloxHudState {
  worldTitle: string;
  stageLabel: string;
  timerSec: number | null;
  score: number;
  scoreLabel: string;
  levelLabel?: string;
  lives: number;
  maxLives: number;
  phase: 'playing' | 'stage_clear' | 'eliminated' | 'victory';
  signalText: string | null;
  signalTone: 'info' | 'green' | 'red' | 'gold';
  actionLabel: string | null;
  secondaryActionLabel: string | null;
  canSwitchStage: boolean;
  squidStageId?: SquidStageId;
  dalgona?: DalgonaOverlayState | null;
  minigamePrompt?: {
    title: string;
    meter: number;
    targetLabel: string;
  } | null;
  inCar?: boolean;
  serverSyncEvent?: {
    actionType: string;
    data: Record<string, any>;
  } | null;
}

export interface PlayerInputState {
  moveX: number;
  moveZ: number;
  jumpPressed: boolean;
  actionPressed: boolean;
  secondaryPressed: boolean;
  sprint: boolean;
}

export interface ServerWorldContext {
  phase: string;
  phaseTimer: number;
  phaseData: Record<string, any>;
  playerCount: number;
  selfUserId?: string;
}

export interface WorldController {
  update: (
    dt: number,
    elapsed: number,
    input: PlayerInputState,
    yaw: number,
    pitch: number,
    isFirstPerson: boolean,
    serverCtx?: ServerWorldContext | null
  ) => RobloxHudState;
  getPlayerPosition: (out: THREE.Vector3) => THREE.Vector3;
  getPlayerYaw: () => number;
  getPlayerSpeed: () => number;
  isPlayerGrounded: () => boolean;
  groundHeightAt: (x: number, z: number) => number;
  setAvatarConfig?: (config: RobloxAvatarConfig) => void;
  setSquidStage?: (stageId: SquidStageId) => void;
  submitDalgonaProgress?: (progress: number, cracks: number, failed: boolean, completed: boolean) => void;
  reset: () => void;
  dispose: () => void;
}
