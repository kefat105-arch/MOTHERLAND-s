/**
 * Global 30-Category & Dynamic Subcategory Discovery Taxonomy
 * Shared cleanly between server discovery/ranking and frontend feed controls.
 */

export interface GlobalVideoCategoryDef {
  id: string;
  label: string;
  subcategories: string[];
  youtubeCategoryIds: string[];
  keywords: string[];
  discoveryQueries: string[];
}

export const GLOBAL_VIDEO_CATEGORIES: GlobalVideoCategoryDef[] = [
  {
    id: 'music_songs',
    label: 'Music and Songs',
    subcategories: ['Acoustic & Live', 'Pop & Indie', 'Bangla Folk & Band', 'Classical & Instrumental', 'Lo-fi & Chill'],
    youtubeCategoryIds: ['10'],
    keywords: ['music', 'song', 'songs', 'concert', 'acoustic', 'singer', 'album', 'lyrics', 'guitar', 'piano', 'band', 'lofi', 'coke studio', 'গান', 'সংগীত', 'বাউল', 'অ্যালবাম'],
    discoveryQueries: [
      'live acoustic concert session 4K',
      'Bangla folk band studio live',
      'world instrumental guitar piano concert',
      'indie music live performance',
      'Coke Studio acoustic session',
    ],
  },
  {
    id: 'football_sports',
    label: 'Football and Sports',
    subcategories: ['Match Highlights', 'Tactics & Analysis', 'Skills & Training', 'World Tournaments', 'Athletics'],
    youtubeCategoryIds: ['17'],
    keywords: ['football', 'soccer', 'goal', 'fifa', 'uefa', 'premier league', 'champions league', 'messi', 'ronaldo', 'stadium', 'ফুটবল', 'গোল', 'ম্যাচ'],
    discoveryQueries: [
      'football match highlights goals',
      'football tactics analysis explained',
      'world football skills training drills',
      'stadium atmosphere championship football',
    ],
  },
  {
    id: 'cricket_sports',
    label: 'Cricket and Other Sports',
    subcategories: ['Cricket Highlights', 'Bangladesh Cricket', 'Bowling & Batting', 'Badminton & Tennis', 'Combat & Olympics'],
    youtubeCategoryIds: ['17'],
    keywords: ['cricket', 'wicket', 'century', 'batsman', 'bowler', 'icc', 'ipl', 'bpl', 'tigers', 'tennis', 'badminton', 'olympics', 'ক্রিকেট', 'সাকিব', 'তামিম'],
    discoveryQueries: [
      'Bangladesh cricket highlights',
      'cricket thriller match last over',
      'international cricket bowling masterclass',
      'olympics badminton table tennis highlights',
    ],
  },
  {
    id: 'gaming_esports',
    label: 'Gaming and Esports',
    subcategories: ['Esports Tournaments', 'Open World Gameplay', 'Speedruns', 'Indie Devlogs', 'Strategy & Chess'],
    youtubeCategoryIds: ['20'],
    keywords: ['gaming', 'game', 'esports', 'gameplay', 'walkthrough', 'speedrun', 'chess', 'minecraft', 'valorant', 'pubg', 'free fire', 'gta', 'গেমিং', 'গেম'],
    discoveryQueries: [
      'esports championship highlights 4K',
      'indie game development documentary',
      'open world gaming showcase 4K',
      'chess grandmaster brilliant game analysis',
    ],
  },
  {
    id: 'technology_ai',
    label: 'Technology and AI',
    subcategories: ['Artificial Intelligence', 'Software Engineering', 'Gadgets & Hardware', 'Robotics', 'Cybersecurity'],
    youtubeCategoryIds: ['28'],
    keywords: ['technology', 'tech', 'ai', 'artificial intelligence', 'machine learning', 'coding', 'programming', 'software', 'robot', 'robotics', 'smartphone', 'laptop', 'gadget', 'cybersecurity', 'প্রযুক্তি'],
    discoveryQueries: [
      'artificial intelligence future explained',
      'robotics engineering breakthrough demo',
      'software engineering systems architecture',
      'smartphone hardware teardown review',
    ],
  },
  {
    id: 'science_space',
    label: 'Science and Space',
    subcategories: ['Astronomy & Cosmos', 'Physics & Quantum', 'Earth Sciences', 'Space Exploration', 'Experiments'],
    youtubeCategoryIds: ['28'],
    keywords: ['science', 'space', 'nasa', 'spacex', 'universe', 'galaxy', 'black hole', 'quantum', 'physics', 'chemistry', 'rocket', 'astronomy', 'বিজ্ঞান', 'মহাকাশ'],
    discoveryQueries: [
      'space universe cosmos documentary 4K',
      'rocket launch aerospace engineering',
      'physics quantum science explained visually',
      'james webb telescope discoveries 4K',
    ],
  },
  {
    id: 'education_learning',
    label: 'Education and Learning',
    subcategories: ['Mathematics & Logic', 'Language Learning', 'Study Skills', 'Career Skills', 'Explainers'],
    youtubeCategoryIds: ['27'],
    keywords: ['education', 'learn', 'learning', 'study', 'course', 'lesson', 'math', 'english', 'university', 'lecture', 'explained', 'শিক্ষা', 'পড়াশোনা'],
    discoveryQueries: [
      'visual mathematics intuition explained',
      'world geography interactive lesson',
      'effective study techniques science',
      'computer science fundamentals lecture',
    ],
  },
  {
    id: 'world_news',
    label: 'World News and Current Affairs',
    subcategories: ['Global Headlines', 'Economy & Policy', 'South Asia Affairs', 'Science & Climate News', 'Deep Reports'],
    youtubeCategoryIds: ['25'],
    keywords: ['news', 'breaking', 'world', 'global', 'affairs', 'report', 'headline', 'journalism', 'summit', 'economy', 'সংবাদ', 'খবর', 'বিশ্ব'],
    discoveryQueries: [
      'global news analysis documentary report',
      'Bangladesh development infrastructure news',
      'world economy current affairs explainer',
      'climate energy transition global report',
    ],
  },
  {
    id: 'travel_tourism',
    label: 'Travel and Tourism',
    subcategories: ['Bangladesh Destinations', 'World Cities', 'Mountain Treks', 'Island & Beach', 'Cultural Journeys'],
    youtubeCategoryIds: ['19'],
    keywords: ['travel', 'tour', 'tourism', 'vlog', 'trip', 'journey', 'sajek', 'cox', 'sylhet', 'bandarban', 'dhaka', 'peru', 'japan', 'europe', 'ভ্রমণ', 'সাজেক', 'সিলেট'],
    discoveryQueries: [
      'Sajek Valley Bandarban Bangladesh travel 4K',
      'world travel cinema 4K scenic journey',
      'Japan Kyoto rural train travel 4K',
      'Sylhet tea garden Bangladesh drone tour',
    ],
  },
  {
    id: 'nature_environment',
    label: 'Nature and Environment',
    subcategories: ['4K Scenic Landscapes', 'Forests & Rivers', 'Oceans & Marine', 'Weather & Aurora', 'Conservation'],
    youtubeCategoryIds: ['19', '15'],
    keywords: ['nature', 'forest', 'mountain', 'river', 'ocean', 'rain', 'sunset', 'waterfall', 'sundarbans', 'aurora', 'glacier', 'environment', 'প্রকৃতি', 'সুন্দরবন'],
    discoveryQueries: [
      'Sundarbans mangrove forest 4K nature',
      'mountain waterfalls aurora 4K HDR',
      'ocean coral reef marine documentary 4K',
      'relaxing rain forest river ambience 4K',
    ],
  },
  {
    id: 'comedy_entertainment',
    label: 'Comedy and Entertainment',
    subcategories: ['Stand-up & Sketch', 'Satire & Parody', 'Variety Shows', 'Pranks & Challenges', 'Pop Culture'],
    youtubeCategoryIds: ['23', '24'],
    keywords: ['comedy', 'funny', 'humor', 'laugh', 'sketch', 'standup', 'challenge', 'entertainment', 'parody', 'fun', 'কমেডি', 'হাসির', 'বিনোদন'],
    discoveryQueries: [
      'clean standup comedy entertainment clip',
      'creative challenge game show fun',
      'Bangla comedy natok entertainment',
      'improv theater stage performance',
    ],
  },
  {
    id: 'movies_short_films',
    label: 'Movies and Short Films',
    subcategories: ['Short Films', 'Cinema Breakdown', 'Bangla Drama', 'Cinematography', 'Trailers & Classics'],
    youtubeCategoryIds: ['1', '24'],
    keywords: ['movie', 'film', 'cinema', 'short film', 'drama', 'natok', 'trailer', 'director', 'cinematography', 'scene', 'সিনেমা', 'নাটক', 'শর্ট ফিল্ম'],
    discoveryQueries: [
      'award winning indie short film',
      'cinematography lighting breakdown film',
      'Bangla drama short film emotional',
      'classic film storytelling analysis',
    ],
  },
  {
    id: 'cooking_food',
    label: 'Cooking and Food',
    subcategories: ['Street Food Tours', 'Traditional Recipes', 'Baking & Desserts', 'Chef Techniques', 'Bangladeshi Cuisine'],
    youtubeCategoryIds: ['26', '22'],
    keywords: ['cook', 'cooking', 'food', 'recipe', 'kitchen', 'street food', 'biryani', 'chef', 'dish', 'meal', 'baking', 'রান্না', 'খাবার', 'বিরিয়ানি'],
    discoveryQueries: [
      'Dhaka Old Town street food tour',
      'authentic Bengali curry cooking recipe',
      'artisan bakery pastry chef kitchen',
      'world street food night market tour',
    ],
  },
  {
    id: 'cars_motorcycles',
    label: 'Cars and Motorcycles',
    subcategories: ['Car Reviews', 'Motorcycles & Touring', 'Electric Vehicles', 'Restorations', 'Motorsport'],
    youtubeCategoryIds: ['2'],
    keywords: ['car', 'cars', 'motorcycle', 'bike', 'supercar', 'ev', 'engine', 'motorsport', 'racing', 'drive', 'garage', 'গাড়ি', 'বাইক', 'মোটরসাইকেল'],
    discoveryQueries: [
      'electric vehicle engineering road test',
      'classic car restoration workshop',
      'motorcycle mountain touring vlog 4K',
      'motorsport pit stop engineering',
    ],
  },
  {
    id: 'fashion_lifestyle',
    label: 'Fashion and Lifestyle',
    subcategories: ['Minimalist Living', 'Streetwear & Heritage', 'Daily Routines', 'Home Aesthetics', 'Grooming'],
    youtubeCategoryIds: ['26', '22'],
    keywords: ['fashion', 'style', 'lifestyle', 'outfit', 'aesthetic', 'minimalist', 'routine', 'wardrobe', 'design', 'jamdani', 'ফ্যাশন', 'লাইফস্টাইল'],
    discoveryQueries: [
      'Bangladeshi Jamdani textile craft fashion',
      'minimalist morning lifestyle routine',
      'sustainable fashion craftsmanship story',
      'modern cozy home desk setup',
    ],
  },
  {
    id: 'health_fitness',
    label: 'Health and Fitness',
    subcategories: ['Home Workouts', 'Nutrition Science', 'Yoga & Mobility', 'Running & Endurance', 'Mental Wellness'],
    youtubeCategoryIds: ['26', '17'],
    keywords: ['health', 'fitness', 'workout', 'gym', 'exercise', 'yoga', 'nutrition', 'running', 'wellness', 'sleep', 'স্বাস্থ্য', 'ব্যায়াম'],
    discoveryQueries: [
      'calisthenics bodyweight strength workout',
      'evidence based nutrition sleep science',
      'morning yoga mobility stretch routine',
      'marathon runner endurance training',
    ],
  },
  {
    id: 'animals_wildlife',
    label: 'Animals and Wildlife',
    subcategories: ['Big Cats & Safari', 'Birds & Migration', 'Marine Creatures', 'Pets & Rescue', 'Animal Behavior'],
    youtubeCategoryIds: ['15'],
    keywords: ['animal', 'animals', 'wildlife', 'tiger', 'lion', 'elephant', 'bird', 'cat', 'dog', 'pet', 'rescue', 'safari', 'প্রাণী', 'বাঘ', 'পাখি'],
    discoveryQueries: [
      'wildlife safari big cats 4K documentary',
      'birds migration nature photography 4K',
      'animal shelter heartwarming rescue story',
      'Royal Bengal Tiger wildlife conservation',
    ],
  },
  {
    id: 'business_entrepreneurship',
    label: 'Business and Entrepreneurship',
    subcategories: ['Startups & Founders', 'Case Studies', 'Small Business', 'Personal Finance', 'Global Markets'],
    youtubeCategoryIds: ['22', '25'],
    keywords: ['business', 'startup', 'entrepreneur', 'finance', 'market', 'founder', 'company', 'marketing', 'investment', 'ব্যবসা', 'উদ্যোক্তা'],
    discoveryQueries: [
      'startup founder journey documentary',
      'small business craftsmanship workshop',
      'global supply chain business case study',
      'Bangladesh entrepreneur tech ecosystem',
    ],
  },
  {
    id: 'agriculture',
    label: 'Agriculture',
    subcategories: ['Modern Smart Farming', 'Crop & Harvest', 'Fisheries & Livestock', 'Organic Gardening', 'Rural Innovation'],
    youtubeCategoryIds: ['22', '28'],
    keywords: ['agriculture', 'farm', 'farming', 'harvest', 'crop', 'rice', 'garden', 'soil', 'irrigation', 'hydroponic', 'fishery', 'কৃষি', 'চাষ', 'খামার'],
    discoveryQueries: [
      'modern smart agriculture drone farming',
      'Bangladesh rice harvest village agriculture',
      'vertical hydroponic urban farm tour',
      'sustainable organic farm regenerative soil',
    ],
  },
  {
    id: 'history_culture',
    label: 'History and Culture',
    subcategories: ['Ancient Civilizations', 'Bengal Heritage', 'Museums & Artifacts', 'Cultural Traditions', 'Historical Events'],
    youtubeCategoryIds: ['27', '22'],
    keywords: ['history', 'culture', 'ancient', 'heritage', 'museum', 'civilization', 'tradition', 'archaeology', 'empire', 'bengal', 'ইতিহাস', 'সংস্কৃতি', 'ঐতিহ্য'],
    discoveryQueries: [
      'ancient civilizations history documentary 4K',
      'Bengal cultural heritage terracotta museum',
      'archaeology lost cities documentary',
      'world cultural festivals traditional music',
    ],
  },
  {
    id: 'art_creativity',
    label: 'Art and Creativity',
    subcategories: ['Painting & Sketching', 'Sculpture & Pottery', 'Digital Illustration', 'Photography', 'Calligraphy'],
    youtubeCategoryIds: ['24', '26'],
    keywords: ['art', 'paint', 'painting', 'drawing', 'sketch', 'pottery', 'sculpture', 'illustration', 'photography', 'calligraphy', 'শিল্প', 'চিত্রকলা', 'ছবি'],
    discoveryQueries: [
      'watercolor landscape painting timelapse',
      'ceramic pottery wheel master artisan',
      'street photography composition tips',
      'digital illustration concept art process',
    ],
  },
  {
    id: 'animation',
    label: 'Animation',
    subcategories: ['2D & Frame-by-Frame', '3D & Blender', 'Animated Short Films', 'Stop Motion', 'Motion Graphics'],
    youtubeCategoryIds: ['1'],
    keywords: ['animation', 'animated', '3d', '2d', 'blender', 'pixar', 'anime', 'stop motion', 'cartoon', 'motion graphics', 'অ্যানিমেশন'],
    discoveryQueries: [
      'animated short film award winning 4K',
      'blender 3D animation breakdown reel',
      'stop motion claymation behind scenes',
      'hand drawn 2D animation workflow',
    ],
  },
  {
    id: 'podcasts_interviews',
    label: 'Podcasts and Interviews',
    subcategories: ['Creator Interviews', 'Science & Tech Talks', 'Culture Conversations', 'Author Discussions', 'Founders'],
    youtubeCategoryIds: ['22', '24'],
    keywords: ['podcast', 'interview', 'conversation', 'talk show', 'discussion', 'q&a', 'speaker', 'পডকাস্ট', 'সাক্ষাৎকার'],
    discoveryQueries: [
      'inspiring creator interview conversation',
      'science technology deep podcast episode',
      'authors filmmakers roundtable interview',
      'Bangla talk show cultural conversation',
    ],
  },
  {
    id: 'motivation_development',
    label: 'Motivation and Personal Development',
    subcategories: ['Mindset & Habits', 'Productivity Systems', 'Public Speaking', 'Resilience Stories', 'Focus & Clarity'],
    youtubeCategoryIds: ['27', '22'],
    keywords: ['motivation', 'inspire', 'inspiration', 'mindset', 'habit', 'productivity', 'focus', 'growth', 'discipline', 'success', 'অনুপ্রেরণা'],
    discoveryQueries: [
      'overcoming odds inspiring life story',
      'deep work focus habits psychology',
      'public speaking communication confidence',
      'personal growth mindset documentary',
    ],
  },
  {
    id: 'diy_tutorials',
    label: 'DIY and Tutorials',
    subcategories: ['Woodworking & Crafts', 'Electronics & Arduino', 'Home Repair', 'Origami & Paper', 'Upcycling'],
    youtubeCategoryIds: ['26', '28'],
    keywords: ['diy', 'tutorial', 'how to', 'craft', 'woodworking', 'repair', 'build', 'handmade', 'origami', 'maker', 'তৈরি', 'টিউটোরিয়াল'],
    discoveryQueries: [
      'woodworking handmade furniture build',
      'electronics maker project workshop DIY',
      'creative home organization craft DIY',
      'camera gear repair restoration tutorial',
    ],
  },
  {
    id: 'social_awareness',
    label: 'Social Awareness',
    subcategories: ['Community Impact', 'Humanitarian Stories', 'Education Access', 'Civic Empathy', 'Environmental Action'],
    youtubeCategoryIds: ['29', '25'],
    keywords: ['social', 'awareness', 'community', 'charity', 'volunteer', 'climate action', 'humanitarian', 'equality', 'civic', 'সচেতনতা', 'সমাজ'],
    discoveryQueries: [
      'community solar clean water initiative documentary',
      'grassroots education volunteers impact story',
      'ocean plastic cleanup environmental project',
      'youth social innovation community story',
    ],
  },
  {
    id: 'documentary',
    label: 'Documentary',
    subcategories: ['Life & Society', 'Science & Engineering', 'Explorers', 'Mega Infrastructure', 'Human Stories'],
    youtubeCategoryIds: ['27', '19', '28'],
    keywords: ['documentary', 'doc', 'megaproject', 'expedition', 'investigative', 'biography', 'in-depth', 'প্রামাণ্যচিত্র', 'ডকুমেন্টারি'],
    discoveryQueries: [
      'engineering megaprojects documentary 4K',
      'human geography life in remote places documentary',
      'Bangladesh Padma Bridge river documentary',
      'deep sea exploration documentary 4K',
    ],
  },
  {
    id: 'architecture_construction',
    label: 'Architecture and Construction',
    subcategories: ['Modern Architecture', 'Sustainable Homes', 'Bridges & Skyscrapers', 'Interior Design', 'Heritage Buildings'],
    youtubeCategoryIds: ['28', '26'],
    keywords: ['architecture', 'construction', 'building', 'bridge', 'skyscraper', 'interior', 'design', 'concrete', 'bamboo', 'house', 'স্থাপত্য', 'নির্মাণ'],
    discoveryQueries: [
      'sustainable bamboo modern architecture design',
      'bridge skyscraper structural construction engineering',
      'compact architectural home tour',
      'historic terracotta mosque architecture Bengal',
    ],
  },
  {
    id: 'religion_cultural',
    label: 'Religion and Cultural Education',
    subcategories: ['Sacred Architecture', 'World Philosophy', 'Festival Heritage', 'Comparative Ethics', 'Spiritual Reflections'],
    youtubeCategoryIds: ['27', '22'],
    keywords: ['religion', 'spiritual', 'islamic', 'ramadan', 'eid', 'philosophy', 'ethics', 'heritage', 'temple', 'mosque', 'dhikr', 'quran', 'ধর্ম', 'সংস্কৃতি', 'দর্শন'],
    discoveryQueries: [
      'world sacred architecture calligraphy heritage',
      'Islamic geometric art history documentary',
      'philosophy ethics ancient wisdom lecture',
      'Ramadan Eid cultural traditions worldwide',
    ],
  },
  {
    id: 'other',
    label: 'Other',
    subcategories: ['Trending Clips', 'ASMR & Satisfying', 'Curiosities', 'Community Highlights'],
    youtubeCategoryIds: ['22', '24'],
    keywords: ['interesting', 'amazing', 'satisfy', 'asmr', 'trending', 'highlights', 'misc', 'vlog'],
    discoveryQueries: [
      'amazing mechanical watchmaking craftsmanship',
      'glassblowing artisan studio satisfying',
      'interesting world trivia curiosities',
    ],
  },
];

export const CATEGORY_BY_ID: Record<string, GlobalVideoCategoryDef> = Object.fromEntries(
  GLOBAL_VIDEO_CATEGORIES.map((c) => [c.id, c])
);

// Popular YouTube category IDs useful with `videos.list?chart=mostPopular` (only 1 quota unit per call!)
export const YOUTUBE_CHART_CATEGORY_IDS: string[] = [
  '10', // Music
  '17', // Sports
  '20', // Gaming
  '28', // Science & Tech
  '27', // Education
  '25', // News & Politics
  '19', // Travel & Events
  '23', // Comedy
  '1',  // Film & Animation
  '15', // Pets & Animals
  '26', // Howto & Style
  '2',  // Autos & Vehicles
  '24', // Entertainment
  '22', // People & Blogs
];

export interface ContentClassification {
  categoryId: string;
  categoryLabel: string;
  subcategory: string;
  language: 'bn' | 'en' | 'global';
}

export function detectContentLanguage(text: string): 'bn' | 'en' | 'global' {
  const s = String(text || '');
  if (/[\u0980-\u09FF]/.test(s)) return 'bn';
  if (/\b(bangladesh|bangla|dhaka|sylhet|chattogram|rajshahi|sundarbans|sajek|natok)\b/i.test(s)) {
    return 'bn';
  }
  if (/[a-zA-Z]{3,}/.test(s)) return 'en';
  return 'global';
}

export function classifyVideoContent(input: {
  title?: string;
  description?: string;
  tags?: string[];
  hashtags?: string[];
  youtubeCategoryId?: string;
  channelTitle?: string;
  explicitCategoryId?: string;
}): ContentClassification {
  if (input.explicitCategoryId && CATEGORY_BY_ID[input.explicitCategoryId]) {
    const def = CATEGORY_BY_ID[input.explicitCategoryId];
    return {
      categoryId: def.id,
      categoryLabel: def.label,
      subcategory: def.subcategories[0] || def.label,
      language: detectContentLanguage(`${input.title || ''} ${input.description || ''}`),
    };
  }

  const combinedText = [
    input.title || '',
    input.description || '',
    ...(input.tags || []),
    ...(input.hashtags || []),
    input.channelTitle || '',
  ]
    .join(' ')
    .toLowerCase();

  const language = detectContentLanguage(combinedText);
  const ytCat = String(input.youtubeCategoryId || '').trim();

  let bestDef: GlobalVideoCategoryDef = CATEGORY_BY_ID.other;
  let bestScore = 0;

  for (const cat of GLOBAL_VIDEO_CATEGORIES) {
    if (cat.id === 'other') continue;
    let score = 0;
    if (ytCat && cat.youtubeCategoryIds.includes(ytCat)) {
      score += 4;
    }
    for (const kw of cat.keywords) {
      if (combinedText.includes(kw.toLowerCase())) {
        score += kw.length >= 6 ? 4 : 2.5;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestDef = cat;
    }
  }

  // Fallback by YouTube Category ID if no keywords hit strongly
  if (bestScore < 2.5 && ytCat) {
    const byYt = GLOBAL_VIDEO_CATEGORIES.find((c) => c.youtubeCategoryIds.includes(ytCat));
    if (byYt) bestDef = byYt;
  }

  // Pick matching subcategory based on keyword overlap or default first subcategory
  let subcategory = bestDef.subcategories[0] || bestDef.label;
  for (const sub of bestDef.subcategories) {
    const tokens = sub.toLowerCase().split(/[\s&/]+/).filter((t) => t.length >= 4);
    if (tokens.some((t) => combinedText.includes(t))) {
      subcategory = sub;
      break;
    }
  }

  return {
    categoryId: bestDef.id,
    categoryLabel: bestDef.label,
    subcategory,
    language,
  };
}

export interface MixedFeedCandidate<T> {
  item: T;
  id: string;
  creatorId: string;
  categoryId: string;
  score: number;
  isExplore?: boolean;
  isPopular?: boolean;
}

/**
 * Diversifies a scored candidate list so consecutive slots avoid category monotony
 * or back-to-back identical creators, while blending popular, personalized, and exploration picks.
 */
export function distributeMixedCategoryFeed<T>(
  candidates: MixedFeedCandidate<T>[],
  options: {
    limit?: number;
    maxConsecutiveCategory?: number;
    minCreatorGap?: number;
    exploreRatio?: number;
    seed?: string;
  } = {}
): T[] {
  if (!Array.isArray(candidates) || candidates.length === 0) return [];
  const limit = options.limit ?? candidates.length;
  const minCreatorGap = options.minCreatorGap ?? 2;
  const exploreRatio = options.exploreRatio ?? 0.25;

  // Dedupe candidates by id keeping highest score
  const byId = new Map<string, MixedFeedCandidate<T>>();
  for (const c of candidates) {
    const prev = byId.get(c.id);
    if (!prev || c.score > prev.score) {
      byId.set(c.id, c);
    }
  }

  const remaining = Array.from(byId.values()).sort((a, b) => b.score - a.score);
  const selected: MixedFeedCandidate<T>[] = [];
  const recentCategories: string[] = [];
  const recentCreators: string[] = [];
  const categoryUsage = new Map<string, number>();

  // Guarantee an exploration bucket so unseen/low-score categories still appear regularly
  const explorePool = remaining.filter((c) => c.isExplore);
  let exploreCursor = 0;

  while (remaining.length > 0 && selected.length < limit) {
    const slotIdx = selected.length;
    const shouldInjectExplore =
      explorePool.length > 0 &&
      slotIdx > 0 &&
      exploreRatio > 0 &&
      slotIdx % Math.max(3, Math.round(1 / exploreRatio)) === 0;

    let chosenIdx = -1;

    if (shouldInjectExplore) {
      while (exploreCursor < explorePool.length) {
        const exp = explorePool[exploreCursor++];
        const rIdx = remaining.findIndex((r) => r.id === exp.id);
        if (
          rIdx !== -1 &&
          !recentCategories.slice(-1).includes(remaining[rIdx].categoryId) &&
          !recentCreators.slice(-minCreatorGap).includes(remaining[rIdx].creatorId)
        ) {
          chosenIdx = rIdx;
          break;
        }
      }
    }

    // Pass 1: No repeat of last category AND no repeat within minCreatorGap AND prefer unused categories early
    if (chosenIdx === -1) {
      let bestPriority = -Infinity;
      const scanWindow = Math.min(remaining.length, 36);
      for (let i = 0; i < scanWindow; i++) {
        const cand = remaining[i];
        const sameLastCat = recentCategories.length > 0 && recentCategories[recentCategories.length - 1] === cand.categoryId;
        const sameCreator = Boolean(cand.creatorId) && recentCreators.slice(-minCreatorGap).includes(cand.creatorId);
        if (sameLastCat || sameCreator) continue;
        const usedCount = categoryUsage.get(cand.categoryId) || 0;
        const diversityBonus = usedCount === 0 ? 12 : -usedCount * 5;
        const priority = cand.score + diversityBonus - i * 0.25;
        if (priority > bestPriority) {
          bestPriority = priority;
          chosenIdx = i;
        }
      }
    }

    // Pass 2: Allow repeated creator if needed, still avoid back-to-back identical category
    if (chosenIdx === -1) {
      chosenIdx = remaining.findIndex(
        (c) => recentCategories.length === 0 || recentCategories[recentCategories.length - 1] !== c.categoryId
      );
    }

    // Pass 3: Absolute fallback when pool only has one category left
    if (chosenIdx === -1) {
      chosenIdx = 0;
    }

    const [picked] = remaining.splice(chosenIdx, 1);
    selected.push(picked);
    recentCategories.push(picked.categoryId);
    if (recentCategories.length > 3) recentCategories.shift();
    if (picked.creatorId) {
      recentCreators.push(picked.creatorId);
      if (recentCreators.length > minCreatorGap + 1) recentCreators.shift();
    }
    categoryUsage.set(picked.categoryId, (categoryUsage.get(picked.categoryId) || 0) + 1);
  }

  return selected.map((s) => s.item);
}
