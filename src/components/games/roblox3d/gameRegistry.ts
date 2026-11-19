import * as THREE from 'three';
import adoptIslandImg from '../../../assets/images/adopt_dream_island_hero_1795105446340.jpg';
import petSwarmImg from '../../../assets/images/pet_swarm_simulator_hero_1795105446297.jpg';
import squidGameImg from '../../../assets/images/squid_game_hero_1795100843775.jpg';
import towerObbyImg from '../../../assets/images/tower_obby_hero_1795100847823.jpg';
import naturalDisasterImg from '../../../assets/images/natural_disaster_hero_1795100847013.jpg';
import brookhavenImg from '../../../assets/images/brookhaven_city_hero_1795100847731.jpg';
import doorsHotelImg from '../../../assets/images/doors_hotel_hero_1795100847562.jpg';
import mm2ManorImg from '../../../assets/images/mm2_manor_hero_1795100846190.jpg';
import bloxElementalImg from '../../../assets/images/blox_elemental_hero_1795100847730.jpg';
import bedwarsImg from '../../../assets/images/bedwars_islands_hero_1795103204588.jpg';
import tycoonImg from '../../../assets/images/tycoon_empire_hero_1795103204897.jpg';
import type { GameCatalogEntry, RobloxAvatarConfig } from '../../../types';
import type { RobloxWorldId, SquidStageId, WorldController } from './types';
import { createSquidGameWorld } from './worlds/squidGameWorld';
import { createViralWorldById } from './worlds/viralWorlds';

export interface RobloxRegisteredWorld {
  id: RobloxWorldId;
  thumbnail: string;
  entry: GameCatalogEntry;
}

export const ROBLOX_WORLD_REGISTRY: RobloxRegisteredWorld[] = [
  {
    id: 'adopt_island',
    thumbnail: adoptIslandImg,
    entry: {
      id: 'adopt_island',
      name: 'ADOPT & RAISE: DREAM PET ISLAND 3D',
      subtitle: 'রেইনবো ব্রিজ, জায়ান্ট এগ নার্সারি, ৩ডি পোষা প্রাণী ও ২৫ প্লেয়ার দ্বীপ',
      tagline: 'Hatch Neon Pets · Rainbow Bridge · Ferris Wheel · Sky Castle · 25/Server',
      description:
        'জনপ্রিয় পেট-আইল্যান্ড ওয়ার্ল্ডের আদলে রঙিন ও উজ্জ্বল ৩ডি দ্বীপ! জায়ান্ট এগ থেকে নিজের ৩ডি সঙ্গী হ্যাচ করুন, হার্ট কালেক্ট করে লেভেল বাড়ান, রেইনবো ব্রিজ পেরিয়ে স্কাই ক্যাসেল ও ফেরিস হুইলে ঘুরে বেড়ান—২৫ প্লেয়ার একসাথে খেলবেন ও কথা বলবেন।',
      category: 'roleplay',
      badge: '25-Player Pet World',
      status: 'playable',
      maxPlayersPerRoom: 25,
      playersLabel: '25 Players / Server',
      difficulty: 'Dream Island 3D',
      estimatedSession: '40–90 Mins',
      features: ['3D Follower Pet', 'Rainbow Sky Castle', 'Voice & Chat Ready'],
    },
  },
  {
    id: 'pet_swarm',
    thumbnail: petSwarmImg,
    entry: {
      id: 'pet_swarm',
      name: 'PET SWARM & BEE KINGDOM 3D',
      subtitle: 'হানি-কম্প মাউন্টেন, ৩৬টি ফ্লাওয়ার-জেম ও বি-সোয়ার্ম (২৫ প্লেয়ার)',
      tagline: 'Bee Swarm Followers · Clover & Crystal Fields · Honeycomb Mountain · Honey Upgrades',
      description:
        '৩-তলা হানি-কম্প পাহাড়, উজ্জ্বল ক্লোভার-ক্রিস্টাল মাঠ ও ৫টি মৌমাছির ফলোয়ার সোয়ার্ম! পরাগ ও জেম সংগ্রহ করে হাইভ প্যাডে হানি-কয়েন কনভার্ট করুন এবং ব্যাগ ও সোয়ার্ম পাওয়ার আপগ্রেড করুন।',
      category: 'tycoon',
      badge: '25-Player Swarm Sim',
      status: 'playable',
      maxPlayersPerRoom: 25,
      playersLabel: '25 Players / Server',
      difficulty: 'Swarm Simulator',
      estimatedSession: '30–75 Mins',
      features: ['3D Bee Swarm Followers', '3-Tier Honeycomb Peak', '25 Players / Server'],
    },
  },
  {
    id: 'squid_game',
    thumbnail: squidGameImg,
    entry: {
      id: 'squid_game',
      name: 'SQUID GAME: SEASON 1 ARENA',
      subtitle: 'স্কুইড গেম সিজন ১ — ২৫ প্লেয়ার সারভাইভাল কমপ্লেক্স',
      tagline: 'Red Light · Dalgona · Tug of War · Marbles · 18-Step Glass Bridge · Squid Court',
      description:
        'শুধুমাত্র সিজন ১-এর ৬টি পূর্ণাঙ্গ খেলার বিশাল ৩ডি কমপ্লেক্স—ডরমিটরি হল, ৯৬ মিটার রেড লাইট গ্রিন লাইট মাঠ, প্লেগ্রাউন্ড ডালগোনা, স্কাই টাগ-অফ-ওয়ার, হানোক মার্বেল ভিলেজ, ১৮-ধাপের গ্লাস ব্রিজ ও ফাইনাল স্কুইড কোর্ট! প্রতি সার্ভারে ২৫ জন একসাথে খেলবেন; পূর্ণ হলে অটো নতুন সার্ভার তৈরি হবে।',
      category: 'survival',
      badge: '25-Player · Season 1',
      status: 'playable',
      maxPlayersPerRoom: 25,
      playersLabel: '25 Players / Server',
      difficulty: 'Season 1 Survival',
      estimatedSession: '30–60 Mins',
      seasonsSummary: [
        'Dormitory Hub + Red Light, Green Light (96m Courtyard & Giant Doll)',
        'Dalgona Honeycomb Playground + Tug of War High Steel Tower',
        'Hanok Marbles Village + 18-Step Tempered Glass Bridge + Squid Court Finale',
      ],
      features: ['25 Players / Server', 'Season 1 Complete 6 Games', 'Voice + Chat + 1P/3P'],
    },
  },
  {
    id: 'brookhaven_rp',
    thumbnail: brookhavenImg,
    entry: {
      id: 'brookhaven_rp',
      name: 'BROOKHAVEN MEGA CITY RP',
      subtitle: 'বিশাল ৩ডি মেট্রো সিটি, ব্যাংক, হাসপাতাল ও ২৫ প্লেয়ার রোলপ্লে',
      tagline: '240m Mega City · Sports Cars · Bank Vault · Villa Estates · Day/Night',
      description:
        'আধা ঘণ্টা থেকে ১ ঘণ্টারও বেশি খেলার বিশাল ওপেন-ওয়ার্ল্ড মেট্রো সিটি! পুলিশ স্টেশন, ব্যাংক ভল্ট, হাসপাতাল, বিচ রিসোর্ট, এয়ারপোর্ট রানওয়ে ও লাক্সারি ভিলা—২৫ জন রিয়েল প্লেয়ার একসাথে গাড়ি চালান ও শহর ঘুরে দেখুন।',
      category: 'roleplay',
      badge: '25-Player Mega City',
      status: 'playable',
      maxPlayersPerRoom: 25,
      playersLabel: '25 Players / Server',
      difficulty: 'Open World RP',
      estimatedSession: '45–90 Mins',
      features: ['240m Full City Map', 'Sports Car & Police Cruiser', 'Synced 25-Player RP'],
    },
  },
  {
    id: 'blox_arena',
    thumbnail: bloxElementalImg,
    entry: {
      id: 'blox_arena',
      name: 'BLOX SEA: 5-ISLAND RPG',
      subtitle: '৫টি বিশাল দ্বীপ, লেভেল ১–১০০ প্রোগ্রেশন ও ২৫ প্লেয়ার বস রেইড',
      tagline: '5 Archipelago Islands · Swords & Fruit Mastery · Raid Bosses · Chest Hunt',
      description:
        '৫টি আলাদা ৩ডি দ্বীপের বিশাল সমুদ্র অভিযান! স্টার্টার ডক থেকে জঙ্গল ধ্বংসাবশেষ, ভলকানো ফোর্ট, ফ্রোজেন সিটাডেল এবং স্কাই টেম্পল—চেস্ট খুঁজুন, লেভেল আপ করুন ও ২৫ প্লেয়ার মিলে জায়ান্ট রেইড বস হারান।',
      category: 'action',
      badge: '25-Player Sea RPG',
      status: 'playable',
      maxPlayersPerRoom: 25,
      playersLabel: '25 Players / Server',
      difficulty: 'Lv. 1–100 Action',
      estimatedSession: '45–60 Mins',
      features: ['5 Distinct 3D Islands', 'Shared World Raid Boss', 'Elemental Power Upgrades'],
    },
  },
  {
    id: 'tower_obby',
    thumbnail: towerObbyImg,
    entry: {
      id: 'tower_obby',
      name: 'MEGA TOWER OF OBBY: 40 STAGES',
      subtitle: '৪০ স্টেজের আকাশচুম্বী ৩ডি পার্কোর ও ২৫ প্লেয়ার রেস',
      tagline: '40 Sky Stages · Spinning Windmills · Laser Mazes · Space Summit',
      description:
        '৪০ স্টেজের বিশাল স্কাই-টু-স্পেস মেগা অব্বি! কনভেয়র ব্রিজ, ঘূর্ণায়মান উইন্ডমিল, নিয়ন গ্লাস, বাউন্স টাওয়ার ও লেজার গোলকধাঁধা পেরিয়ে ২৫ জন প্লেয়ার একসাথে শীর্ষে উঠুন।',
      category: 'obby',
      badge: '25-Player 40-Stage',
      status: 'playable',
      maxPlayersPerRoom: 25,
      playersLabel: '25 Players / Server',
      difficulty: '40-Stage Expedition',
      estimatedSession: '30–50 Mins',
      features: ['40 Checkpoint Stages', 'Live 25-Player Climb', 'Space Summit Crown'],
    },
  },
  {
    id: 'bedwars_sky',
    thumbnail: bedwarsImg,
    entry: {
      id: 'bedwars_sky',
      name: 'SKY BEDWARS: 4-KINGDOM CLASH',
      subtitle: '৪টি ভাসমান দুর্গ, ডায়মন্ড মাইন ও ২৫ প্লেয়ার টিম যুদ্ধ',
      tagline: 'Red/Blue/Green/Yellow Castles · Bed Defense · Ore Generators · Sky Bridges',
      description:
        'মেঘের ওপরে ৪টি বিশাল কেল্লা (লাল, নীল, সবুজ, হলুদ) ও কেন্দ্রীয় ডায়মন্ড দুর্গ! আয়রন ও এমারেল্ড জেনারেটর থেকে আর্মার-সোর্ড আপগ্রেড কিনুন, নিজের বেড রক্ষা করুন ও অন্য টিমের বেড ভেঙে জিতুন।',
      category: 'action',
      badge: '25-Player Sky PvP',
      status: 'playable',
      maxPlayersPerRoom: 25,
      playersLabel: '25 Players / Server',
      difficulty: 'Team Bed Defense',
      estimatedSession: '30–60 Mins',
      features: ['4 Island Castles + Mid', 'Weapon & Armor Shop', 'Live Server Bed Status'],
    },
  },
  {
    id: 'tycoon_empire',
    thumbnail: tycoonImg,
    entry: {
      id: 'tycoon_empire',
      name: 'BILLIONAIRE MEGA TYCOON 3D',
      subtitle: 'ড্রপার ফ্যাক্টরি, সুপারকার গ্যারেজ ও হেলিপ্যাড বিল্ডিং (২৫ প্লেয়ার)',
      tagline: '30 Base Upgrades · Cash Conveyors · Supercar Vault · Helipad Tower',
      description:
        'নিজের খালি প্লট থেকে শুরু করে কনভেয়ার ড্রপার, ক্যাশ জেনারেটর, গ্লাস টাওয়ার, সুপারকার শোরুম ও রুফটপ হেলিপ্যাড তৈরি করুন! প্রতি সার্ভারে ২৫ জন প্লেয়ার নিজেদের বিশাল সাম্রাজ্য গড়ে তুলুন।',
      category: 'tycoon',
      badge: '25-Player Tycoon',
      status: 'playable',
      maxPlayersPerRoom: 25,
      playersLabel: '25 Players / Server',
      difficulty: 'Empire Builder',
      estimatedSession: '40–60 Mins',
      features: ['30 Unlockable Pads', 'Auto-Cash Conveyor', '25-Player City Plots'],
    },
  },
  {
    id: 'natural_disaster',
    thumbnail: naturalDisasterImg,
    entry: {
      id: 'natural_disaster',
      name: 'NATURAL DISASTER ARCHIPELAGO',
      subtitle: 'স্কাইস্ক্র্যাপার, ফেরিস হুইল ও সুনামি-টর্নেডো সারভাইভাল',
      tagline: '6 Disasters · 5-Floor Skyscraper · Ferris Wheel · Mountain Peak',
      description:
        'বিশাল ১৮০ মিটার দ্বীপে ৫-তলা কাচের অফিস টাওয়ার, ফেরিস হুইল, বাতিঘর ও পাহাড়ের চূড়ায় দৌড়ে আশ্রয় নিন। ২৫ প্লেয়ারের সার্ভারে সুনামি, টর্নেডো, উল্কাবৃষ্টি, অগ্ন্যুৎপাত ও ভূমিকম্প মোকাবিলা করুন।',
      category: 'survival',
      badge: '25-Player Island',
      status: 'playable',
      maxPlayersPerRoom: 25,
      playersLabel: '25 Players / Server',
      difficulty: 'Endless Survival',
      estimatedSession: '30–60 Mins',
      features: ['5-Floor Climbable Tower', 'Synced 6 Disasters', '25-Player Survival'],
    },
  },
  {
    id: 'doors_hotel',
    thumbnail: doorsHotelImg,
    entry: {
      id: 'doors_hotel',
      name: 'DOORS: 100-DOOR GRAND HOTEL',
      subtitle: '০১ থেকে ১০০ দরজার বিশাল হোটেল ও ২৫ প্লেয়ার কো-অপ এস্কেপ',
      tagline: '100 Hotel Rooms · Library 50 · Flashlight Co-op · Rush & Eyes Survival',
      description:
        'হাতে ফ্ল্যাশলাইট নিয়ে ২৫ জন প্লেয়ার একসাথে ০১ থেকে ১০০ নম্বর দরজার ভৌতিক হোটেল পার হন! লুকানো চাবি খুঁজুন, লাইব্রেরি পাজল ও গ্রিনহাউস পেরিয়ে এলিভেটরে পৌঁছান।',
      category: 'horror',
      badge: '25-Player Co-op',
      status: 'playable',
      maxPlayersPerRoom: 25,
      playersLabel: '25 Players / Server',
      difficulty: '100-Room Horror',
      estimatedSession: '30–60 Mins',
      features: ['Full 100-Door Journey', 'Rush Flicker & Closets', 'Co-op Flashlights'],
    },
  },
  {
    id: 'mm2_manor',
    thumbnail: mm2ManorImg,
    entry: {
      id: 'mm2_manor',
      name: 'MURDER MYSTERY 2: GRAND ESTATE',
      subtitle: 'বহুতল প্রাসাদ ও বাগানে ২৫ প্লেয়ার শেরিফ-মার্ডারার শোডাউন',
      tagline: '2-Floor Manor + Garden Maze · Coins & Knives · Server Roles',
      description:
        'দোতলা মার্বেল প্রাসাদ, আন্ডারগ্রাউন্ড টানেল ও বাগানের ভেতর ২৫ জন প্লেয়ারের টানটান রহস্য! সার্ভার রিয়েল-টাইম শেরিফ ও মার্ডারার নির্বাচন করে—কয়েন জমিয়ে শেরিফ রিভলভার দিয়ে কিলারকে থামান।',
      category: 'action',
      badge: '25-Player Mystery',
      status: 'playable',
      maxPlayersPerRoom: 25,
      playersLabel: '25 Players / Server',
      difficulty: 'Social Combat',
      estimatedSession: '30–60 Mins',
      features: ['Multi-Floor Mansion', 'Server Role Assignment', '1P Crosshair Aiming'],
    },
  },
];

export const ROBLOX_WORLD_ID_SET = new Set<string>(ROBLOX_WORLD_REGISTRY.map((w) => w.id));

export function isRegisteredRobloxWorld(id: string): id is RobloxWorldId {
  return ROBLOX_WORLD_ID_SET.has(id);
}

export function getRobloxWorldMeta(id: string): RobloxRegisteredWorld | undefined {
  return ROBLOX_WORLD_REGISTRY.find((w) => w.id === id);
}

/**
 * Plug-and-Play World Instantiator:
 * Every world registered here automatically inherits 25-player auto-overflow servers
 * + Unified Roblox Core UI (Voice Chat, Messages, Pause Menu, 25-Player List, Emotes, 1P/3P).
 */
export function createUnifiedRobloxWorld(
  worldId: RobloxWorldId,
  scene: THREE.Scene,
  isSoftwareGl: boolean,
  maxAnisotropy: number,
  initialAvatar: RobloxAvatarConfig,
  initialSquidStage: SquidStageId = 's1_red_light'
): WorldController {
  if (worldId === 'squid_game') {
    return createSquidGameWorld(scene, isSoftwareGl, maxAnisotropy, initialSquidStage);
  }
  return createViralWorldById(worldId, scene, isSoftwareGl, maxAnisotropy, initialAvatar);
}
