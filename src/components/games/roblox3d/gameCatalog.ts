import type { GameCatalogEntry } from '../../../types';
import { ROBLOX_WORLD_REGISTRY } from './gameRegistry';
import type { RobloxWorldId } from './types';

export const ROBLOX_GAME_THUMBNAILS: Record<RobloxWorldId, string> = ROBLOX_WORLD_REGISTRY.reduce(
  (acc, item) => {
    acc[item.id] = item.thumbnail;
    return acc;
  },
  {} as Record<RobloxWorldId, string>
);

export const ROBLOX_DEFAULT_GAMES: GameCatalogEntry[] = [
  ...ROBLOX_WORLD_REGISTRY.map((item) => item.entry),
  {
    id: 'live_spy',
    name: 'LIVE SPY',
    subtitle: 'লাইভ ক্যামেরা ও থ্রিডি লাউঞ্জ সোশ্যাল ডিডাকশন',
    tagline: 'Live Camera Social Deduction',
    description:
      'Step inside a luxury private lounge with 6 or 8 real players. Spot the hidden Spy through live camera expressions, clever clues, and sharp voting.',
    category: 'multiplayer',
    badge: 'Online Multiplayer',
    status: 'playable',
    supportedCapacities: [6, 8],
    playersLabel: '6 or 8 Real Players',
    difficulty: 'Social Deduction',
    estimatedSession: '20–40 Mins',
    features: ['Live WebRTC Cam + Mic', '3D Lounge & Teddy Avatar', 'Real-Time Voting'],
  },
];
