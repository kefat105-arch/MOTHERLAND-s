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
    id: 'sky_citadel',
    name: 'AETHER SKY CITADEL: ULTRA 3D',
    subtitle: 'শ্বেতপাথর ও সোনালি ভাসমান প্রাসাদ, ক্রিস্টাল ও ২৫ প্লেয়ার',
    tagline: 'Marble Sky Sanctums · Sculpted Stone Arches · Bounce Pads · 25/Server',
    description:
      'ভেইনড শ্বেতপাথর ও খোদাই করা প্রাচীন আর্চওয়ে দিয়ে তৈরি আকাশচুম্বী ভাসমান প্রাসাদ! ক্রিস্টাল শার্ড ও রিলিক সংগ্রহ করে মুভিং স্কাই-ব্রিজ পার হয়ে সোনালি এলিভেটেড বিজয় পোর্টালে পৌঁছান।',
    category: 'obby',
    badge: 'ULTRA PRO MAX · 3D',
    status: 'playable',
    maxPlayersPerRoom: 25,
    playersLabel: '25 Players / Server',
    difficulty: 'Sky Parkour',
    estimatedSession: '30–60 Mins',
    features: ['PBR Veined Marble', 'Crystal Sanctums', '25 Players / Server'],
  },
  {
    id: 'cyber_velocity',
    name: 'CYBER VELOCITY 2099: NEON CIRCUIT',
    subtitle: 'ফিউচারিস্টিক হোভার সুপারকার, নিয়ন হাইওয়ে ও ২৫ প্লেয়ার রেস',
    tagline: 'Hover Supercar · Rain-Slick Asphalt · Rooftop Checkpoints · 25/Server',
    description:
      'বৃষ্টির পর ঝকঝকে সাইবার অ্যাসফল্ট হাইওয়েতে নিজের নিয়ন হোভার সুপারকার চালান বা স্প্রিন্ট করুন! স্কাইট্রি ও আলোকিত টাওয়ার পেরিয়ে সার্কিট চেকপয়েন্ট জয় করুন।',
    category: 'action',
    badge: 'ULTRA PRO MAX · CAR 3D',
    status: 'playable',
    maxPlayersPerRoom: 25,
    playersLabel: '25 Players / Server',
    difficulty: 'High-Speed Circuit',
    estimatedSession: '30–60 Mins',
    features: ['Driveable Hovercar', 'Wet Asphalt Reflections', '25 Players / Server'],
  },
  {
    id: 'volcano_temple',
    name: 'OBSIDIAN VOLCANO: TEMPLE TRIALS',
    subtitle: 'লাভা গিরিখাত, ব্যাসল্ট মন্দির ও ক্রিস্টাল সংগ্রহ (২৫ প্লেয়ার)',
    tagline: 'Obsidian Basalt · Rising Magma Surges · Relic Hunting · 25/Server',
    description:
      'উত্তপ্ত ম্যাগমা গিরিখাতের ওপর খোদাই করা পাথরের মন্দির ও মুভিং ব্যাসল্ট ব্রিজ! নির্দিষ্ট সময়ে উঠে আসা লাভার ঢেউ এড়িয়ে প্রাচীন রত্ন সংগ্রহ করুন।',
    category: 'survival',
    badge: 'ULTRA PRO MAX · SURVIVAL',
    status: 'playable',
    maxPlayersPerRoom: 25,
    playersLabel: '25 Players / Server',
    difficulty: 'Volcanic Trial',
    estimatedSession: '30–60 Mins',
    features: ['Volcanic Basalt PBR', 'Dynamic Lava Surges', '25 Players / Server'],
  },
  {
    id: 'ocean_odyssey',
    name: 'EMERALD ARCHIPELAGO: OCEAN ODYSSEY',
    subtitle: 'কাঠের স্পিডবোট, ক্রান্তীয় দ্বীপ ও মুক্তো শিকার (২৫ প্লেয়ার)',
    tagline: 'Sail Wooden Speedboat · Tropical Palm Islands · Harbor Lamps · 25/Server',
    description:
      'স্বচ্ছ নীল সাগরের ঢেউয়ে কাঠের স্পিডবোট ভাসিয়ে ৭টি সবুজ ক্রান্তীয় দ্বীপ ঘুরে বেড়ান! পাম গাছ, হারবার ল্যাম্প ও সোনার রিলিক সংগ্রহ করে সমুদ্র অভিযাত্রী হয়ে উঠুন।',
    category: 'roleplay',
    badge: 'ULTRA PRO MAX · OCEAN 3D',
    status: 'playable',
    maxPlayersPerRoom: 25,
    playersLabel: '25 Players / Server',
    difficulty: 'Open Sea Exploration',
    estimatedSession: '40–90 Mins',
    features: ['Sailboat Steering', '7 Sculpted Islands', '25 Players / Server'],
  },
  {
    id: 'adopt_island',
    name: 'ADOPT & RAISE: DREAM PET ISLAND 3D',
    subtitle: 'রংধনু দ্বীপ, পোষা প্রাণী হ্যাচ ও ২৫ প্লেয়ার টাউন রোলপ্লে',
    tagline: 'Pet Nursery · Hatch Eggs · Floating Neon Pets · Rainbow Castle · Fairground',
    description:
      'Roblox-এর সবচেয়ে জনপ্রিয় কালারফুল অ্যাডপশন আইল্যান্ড! নার্সারি থেকে ডিম ফুটিয়ে কিউট ফ্লোটিং নিয়ন পেট (ড্রাগন, ইউনিকর্ন, ফক্স) পাশে নিয়ে পিৎজা শপ, হট এয়ার বেলুন পার্ক, ফেরিস হুইল ও রংধনু ব্রিজ পেরিয়ে স্কাই ক্যাসেল ঘুরে দেখুন।',
    category: 'roleplay',
    badge: '25-Player Pet RP',
    status: 'playable',
    maxPlayersPerRoom: 25,
    playersLabel: '25 Players / Server',
    difficulty: 'Cozy Town & Pets',
    estimatedSession: '45–90 Mins',
    features: ['3D Companion Pet Follower', 'Neon Egg Hatchery', 'Rainbow Sky Castle'],
  },
  {
    id: 'pet_swarm',
    name: 'PET SWARM & BEE KINGDOM 3D',
    subtitle: 'ক্লোভার মেডো, গোল্ডেন হানিকম্ব মাউন্টেন ও ২৫ প্লেয়ার সিমুলেটর',
    tagline: 'Hive Swarm · Honeycomb Mountain · Crystal Fields · Pet Evolution',
    description:
      'উজ্জ্বল সূর্যালোকে বিশাল ক্লোভার মাঠ থেকে ফুলের পরাগ ও জেমস সংগ্রহ করে আপনার হানিকম্ব হাইভ আপগ্রেড করুন! উড়ন্ত মৌমাছি ও ড্রাগন পেট সোয়ার্ম নিয়ে গোল্ডেন হানি মাউন্টেন জয় করুন।',
    category: 'tycoon',
    badge: '25-Player Simulator',
    status: 'playable',
    maxPlayersPerRoom: 25,
    playersLabel: '25 Players / Server',
    difficulty: 'Swarm Simulator',
    estimatedSession: '40–90 Mins',
    features: ['Flying Swarm Pets', 'Giant Honeycomb Mountain', 'Crystal Gem Fields'],
  },
  {
    id: 'squid_game',
    name: 'SQUID GAME: SEASON 1 ARENA',
    subtitle: 'স্কুইড গেম সিজন ১ — ২৫ প্লেয়ার সারভাইভাল কমপ্লেক্স',
    tagline: 'Red Light · Dalgona · Tug of War · Marbles · 18-Step Glass Bridge · Squid Court',
    description:
      'শুধুমাত্র সিজন ১-এর ৬টি পূর্ণাঙ্গ খেলার বিশাল ৩ডি কমপ্লেক্স—৪৫.৬ বিলিয়ন পিগি ব্যাংকসহ ডরমিটরি হল, ৯০ মিটার রেড লাইট গ্রিন লাইট মাঠ, প্লেগ্রাউন্ড ডালগোনা, স্কাই টাগ-অফ-ওয়ার, হানোক মার্বেল ভিলেজ, ১৮-ধাপের গ্লাস ব্রিজ ও ফাইনাল স্কুইড কোর্ট! প্রতি সার্ভারে ২৫ জন একসাথে খেলবেন; পূর্ণ হলে অটো নতুন সার্ভার তৈরি হবে।',
    category: 'survival',
    badge: '25-Player · Season 1',
    status: 'playable',
    maxPlayersPerRoom: 25,
    playersLabel: '25 Players / Server',
    difficulty: 'Season 1 Survival',
    estimatedSession: '30–60 Mins',
    seasonsSummary: [
      'Dormitory Hub + Red Light, Green Light (90m Courtyard & Giant Doll)',
      'Dalgona Honeycomb Playground + Tug of War High Steel Tower',
      'Hanok Marbles Village + 18-Step Tempered Glass Bridge + Squid Court Finale',
    ],
    features: ['25 Players Per Server', 'Season 1 Complete 6 Games', 'Custom R15 Avatar + 1P/3P'],
  },
  {
    id: 'brookhaven_rp',
    name: 'BROOKHAVEN MEGA CITY RP',
    subtitle: 'বিশাল ৩ডি মেট্রো সিটি, ব্যাংক, হাসপাতাল ও ২৫ প্লেয়ার রোলপ্লে',
    tagline: '240m Mega City · Sports Cars · Bank Vault · Villa Estates · Day/Night',
    description:
      'আধা ঘণ্টা থেকে ১ ঘণ্টারও বেশি খেলার বিশাল ওপেন-ওয়ার্ল্ড মেট্রো সিটি! পুলিশ স্টেশন, ব্যাংক ভল্ট, হাসপাতাল, বিচ রিসোর্ট, এয়ারপোর্ট রানওয়ে, সানসেট ক্যাফে ও লাক্সারি ভিলা—২৫ জন রিয়েল প্লেয়ার একসাথে গাড়ি চালান ও শহর ঘুরে দেখুন।',
    category: 'roleplay',
    badge: '25-Player Mega City',
    status: 'playable',
    maxPlayersPerRoom: 25,
    playersLabel: '25 Players / Server',
    difficulty: 'Open World RP',
    estimatedSession: '45–90 Mins',
    features: ['240m Full City Map', 'Sports Car & Police Cruiser', 'Synced 25-Player RP'],
  },
  {
    id: 'blox_arena',
    name: 'BLOX SEA: 5-ISLAND RPG',
    subtitle: '৫টি বিশাল দ্বীপ, লেভেল ১–১০০ প্রোগ্রেশন ও ২৫ প্লেয়ার বস রেইড',
    tagline: '5 Archipelago Islands · Swords & Fruit Mastery · Raid Bosses · Chest Hunt',
    description:
      'রবলক্স ব্লক্স ফ্রুটের মতো বিশাল ৫-দ্বীপের সমুদ্র অভিযানে নামুন! স্টার্টার ডক থেকে জঙ্গল ধ্বংসাবশেষ, ভলকানো ফোর্ট, ফ্রোজেন সিটাডেল এবং স্কাই টেম্পল—ট্রেজার চেস্ট খুঁজুন, লেভেল আপ করুন ও ২৫ প্লেয়ার মিলে জায়ান্ট রেইড বস হারান।',
    category: 'action',
    badge: '25-Player Sea RPG',
    status: 'playable',
    maxPlayersPerRoom: 25,
    playersLabel: '25 Players / Server',
    difficulty: 'Lv. 1–100 Action',
    estimatedSession: '45–60 Mins',
    features: ['5 Distinct 3D Islands', 'Shared World Raid Boss', 'Elemental Power Upgrades'],
  },
  {
    id: 'tower_obby',
    name: 'MEGA TOWER OF OBBY: 40 STAGES',
    subtitle: '৪০ স্টেজের আকাশচুম্বী ৩ডি পার্কোর ও ২৫ প্লেয়ার রেস',
    tagline: '40 Sky Stages · Spinning Windmills · Laser Mazes · Space Summit',
    description:
      'এক মিনিটের ছোট পার্কোর নয়—একেবারে ৪০ স্টেজের বিশাল স্কাই-টু-স্পেস মেগা অব্বি! কনভেয়র ব্রিজ, ঘূর্ণায়মান উইন্ডমিল, নিয়ন গ্লাস, বাউন্স টাওয়ার ও লেজার গোলকধাঁধা পেরিয়ে ২৫ জন প্লেয়ার একসাথে শীর্ষে উঠুন।',
    category: 'obby',
    badge: '25-Player 40-Stage',
    status: 'playable',
    maxPlayersPerRoom: 25,
    playersLabel: '25 Players / Server',
    difficulty: '40-Stage Expedition',
    estimatedSession: '30–50 Mins',
    features: ['40 Checkpoint Stages', 'Live 25-Player Climb', 'Space Summit Crown'],
  },
  {
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
  {
    id: 'tycoon_empire',
    name: 'BILLIONAIRE MEGA TYCOON 3D',
    subtitle: 'ড্রপার ফ্যাক্টরি, সুপারকার গ্যারেজ ও হেলিপ্যাড বিল্ডিং (২৫ প্লেয়ার)',
    tagline: '30+ Base Upgrades · Cash Conveyors · Supercar Vault · Helipad Tower',
    description:
      'নিজের খালি প্লট থেকে শুরু করে কনভেয়ার ড্রপার, ক্যাশ জেনারেটর, গ্লাস টাওয়ার, সুপারকার শোরুম ও রুফটপ হেলিপ্যাড তৈরি করুন! প্রতি সার্ভারে ২৫ জন প্লেয়ার নিজেদের বিশাল সাম্রাজ্য গড়ে তুলুন।',
    category: 'tycoon',
    badge: '25-Player Tycoon',
    status: 'playable',
    maxPlayersPerRoom: 25,
    playersLabel: '25 Players / Server',
    difficulty: 'Empire Builder',
    estimatedSession: '40–60 Mins',
    features: ['30+ Unlockable Pads', 'Auto-Cash Conveyor', '25-Player City Plots'],
  },
  {
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
  {
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
  {
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
