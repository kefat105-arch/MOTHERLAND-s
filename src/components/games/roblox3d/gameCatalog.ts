import squidGameImg from '../../../assets/images/squid_game_hero_1795100843775.jpg';
import towerObbyImg from '../../../assets/images/tower_obby_hero_1795100847823.jpg';
import naturalDisasterImg from '../../../assets/images/natural_disaster_hero_1795100847013.jpg';
import brookhavenImg from '../../../assets/images/brookhaven_city_hero_1795100847731.jpg';
import doorsHotelImg from '../../../assets/images/doors_hotel_hero_1795100847562.jpg';
import mm2ManorImg from '../../../assets/images/mm2_manor_hero_1795100846190.jpg';
import bloxElementalImg from '../../../assets/images/blox_elemental_hero_1795100847730.jpg';
import bedwarsImg from '../../../assets/images/bedwars_islands_hero_1795103204588.jpg';
import tycoonImg from '../../../assets/images/tycoon_empire_hero_1795103204897.jpg';
import type { GameCatalogEntry } from '../../../types';
import type { RobloxWorldId } from './types';

export const ROBLOX_GAME_THUMBNAILS: Record<RobloxWorldId, string> = {
  squid_game: squidGameImg,
  brookhaven_rp: brookhavenImg,
  blox_arena: bloxElementalImg,
  tower_obby: towerObbyImg,
  bedwars_sky: bedwarsImg,
  tycoon_empire: tycoonImg,
  natural_disaster: naturalDisasterImg,
  doors_hotel: doorsHotelImg,
  mm2_manor: mm2ManorImg,
};

export const ROBLOX_DEFAULT_GAMES: GameCatalogEntry[] = [
  {
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
    features: ['25 Players / Server', 'Season 1 Complete 6 Games', 'Custom Avatar + 1P/3P'],
  },
  {
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
  {
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
  {
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
    features: ['Live WebRTC Cam + Mic', '3D Lounge & Teddy Avatar', 'Real-Time Voting'],
  },
];
