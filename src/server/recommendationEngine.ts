import {
  GLOBAL_VIDEO_CATEGORIES,
  CATEGORY_BY_ID,
  classifyVideoContent,
  distributeMixedCategoryFeed,
  type MixedFeedCandidate,
} from '../shared/videoCategories.ts';
import type {
  Post,
  RecommendationLearningStage,
  RecommendationSignalPayload,
  UserRecommendationProfile,
} from '../types.ts';

export function computeLearningStage(totalSignals: number): RecommendationLearningStage {
  if (totalSignals < 5) return 'initial_discovery';
  if (totalSignals < 20) return 'early_learning';
  if (totalSignals < 60) return 'personalization';
  return 'continuous_adaptation';
}

export function createEmptyRecommendationProfile(userId: string): UserRecommendationProfile {
  return {
    userId,
    categoryScores: {},
    subcategoryScores: {},
    creatorScores: {},
    keywordScores: {},
    languageScores: {},
    searchInterests: [],
    hiddenCreators: [],
    reducedCategories: [],
    notInterestedIds: [],
    skippedIds: [],
    replayedIds: [],
    totalSignals: 0,
    learningStage: 'initial_discovery',
    updatedAt: new Date().toISOString(),
  };
}

function clampScore(val: number, min = -60, max = 120): number {
  if (!Number.isFinite(val)) return 0;
  return Math.max(min, Math.min(max, Math.round(val * 100) / 100));
}

function addWeight(map: Record<string, number>, key: string | undefined, delta: number, maxEntries = 80) {
  const clean = String(key || '').trim();
  if (!clean || !delta) return;
  map[clean] = clampScore((map[clean] || 0) + delta);
  const keys = Object.keys(map);
  if (keys.length > maxEntries) {
    keys
      .sort((a, b) => Math.abs(map[a]) - Math.abs(map[b]))
      .slice(0, keys.length - maxEntries)
      .forEach((k) => delete map[k]);
  }
}

function extractTokens(text: string): string[] {
  const stop = new Set([
    'the', 'and', 'for', 'with', 'from', 'this', 'that', 'your', 'into', 'video', 'youtube',
    'official', 'shorts', 'short', 'live', 'part', 'full', 'episode', 'new', 'best', 'top', '2025', '2026',
  ]);
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !stop.has(w))
    .slice(0, 8);
}

/**
 * Applies gentle time decay on continuous_adaptation stage so preferences evolve dynamically
 * instead of locking the user into historical categories forever.
 */
function applyGentleDecay(map: Record<string, number>, factor = 0.96) {
  for (const k of Object.keys(map)) {
    map[k] = Math.round(map[k] * factor * 100) / 100;
    if (Math.abs(map[k]) < 0.05) delete map[k];
  }
}

export function applySignalToRecommendationProfile(
  profile: UserRecommendationProfile,
  payload: RecommendationSignalPayload
): UserRecommendationProfile {
  const next: UserRecommendationProfile = {
    ...profile,
    categoryScores: { ...(profile.categoryScores || {}) },
    subcategoryScores: { ...(profile.subcategoryScores || {}) },
    creatorScores: { ...(profile.creatorScores || {}) },
    keywordScores: { ...(profile.keywordScores || {}) },
    languageScores: { ...(profile.languageScores || {}) },
    searchInterests: [...(profile.searchInterests || [])],
    hiddenCreators: [...(profile.hiddenCreators || [])],
    reducedCategories: [...(profile.reducedCategories || [])],
    notInterestedIds: [...(profile.notInterestedIds || [])],
    skippedIds: [...(profile.skippedIds || [])],
    replayedIds: [...(profile.replayedIds || [])],
    totalSignals: Number(profile.totalSignals || 0) + 1,
    updatedAt: new Date().toISOString(),
  };

  if (next.totalSignals % 15 === 0) {
    applyGentleDecay(next.categoryScores, 0.95);
    applyGentleDecay(next.subcategoryScores, 0.95);
    applyGentleDecay(next.keywordScores, 0.94);
  }

  const classified = classifyVideoContent({
    title: payload.title || payload.searchQuery || '',
    tags: payload.tags || [],
    channelTitle: payload.creatorName || '',
    explicitCategoryId: payload.categoryId,
  });

  const catId = payload.categoryId && CATEGORY_BY_ID[payload.categoryId] ? payload.categoryId : classified.categoryId;
  const sub = payload.subcategory || classified.subcategory;
  const lang = payload.language || classified.language;
  const itemId = String(payload.videoId || payload.postId || '').trim();
  const creatorId = String(payload.creatorId || '').trim();

  let catDelta = 0;
  let creatorDelta = 0;
  let kwDelta = 0;
  let langDelta = 0;

  switch (payload.signalType) {
    case 'watch_progress': {
      const watchSec = Math.max(0, Number(payload.watchSeconds || 0));
      const durSec = Math.max(0, Number(payload.durationSeconds || 0));
      const ratio = durSec > 0 ? Math.min(1, watchSec / durSec) : 0;
      if (watchSec >= 8 || ratio >= 0.25) {
        const boost = 2 + Math.min(5, watchSec / 30) + ratio * 4;
        catDelta = boost;
        creatorDelta = boost * 0.8;
        kwDelta = 1.5;
        langDelta = 1.2;
      }
      break;
    }
    case 'complete':
      catDelta = 7;
      creatorDelta = 6;
      kwDelta = 3;
      langDelta = 2;
      break;
    case 'replay':
      catDelta = 9;
      creatorDelta = 8;
      kwDelta = 4;
      langDelta = 2;
      if (itemId && !next.replayedIds.includes(itemId)) {
        next.replayedIds = [itemId, ...next.replayedIds].slice(0, 100);
      }
      break;
    case 'like':
      catDelta = 5;
      creatorDelta = 4.5;
      kwDelta = 2.5;
      langDelta = 1.5;
      break;
    case 'comment':
      catDelta = 6.5;
      creatorDelta = 6;
      kwDelta = 3;
      langDelta = 1.5;
      break;
    case 'share':
      catDelta = 7.5;
      creatorDelta = 6.5;
      kwDelta = 3.5;
      langDelta = 1.5;
      break;
    case 'save':
      catDelta = 7;
      creatorDelta = 5.5;
      kwDelta = 3;
      langDelta = 1.5;
      break;
    case 'follow':
      catDelta = 6;
      creatorDelta = 10;
      kwDelta = 2;
      break;
    case 'search': {
      const q = String(payload.searchQuery || '').trim();
      if (q) {
        next.searchInterests = [q, ...next.searchInterests.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 25);
        catDelta = 4;
        kwDelta = 3;
        langDelta = 1;
      }
      break;
    }
    case 'skip':
      catDelta = -2.2;
      creatorDelta = -1.5;
      kwDelta = -1;
      if (itemId && !next.skippedIds.includes(itemId)) {
        next.skippedIds = [itemId, ...next.skippedIds].slice(0, 200);
      }
      break;
    case 'not_interested':
      catDelta = -7;
      creatorDelta = -5;
      kwDelta = -3;
      if (itemId && !next.notInterestedIds.includes(itemId)) {
        next.notInterestedIds = [itemId, ...next.notInterestedIds].slice(0, 300);
      }
      break;
    case 'reduce_category':
      catDelta = -18;
      if (catId && !next.reducedCategories.includes(catId)) {
        next.reducedCategories = [catId, ...next.reducedCategories].slice(0, 20);
      }
      break;
    case 'hide_creator':
      creatorDelta = -40;
      if (creatorId && !next.hiddenCreators.includes(creatorId)) {
        next.hiddenCreators = [creatorId, ...next.hiddenCreators].slice(0, 200);
      }
      break;
  }

  if (catDelta !== 0 && catId) {
    addWeight(next.categoryScores, catId, catDelta, 40);
    if (sub) addWeight(next.subcategoryScores, `${catId}::${sub}`, catDelta * 0.85, 80);
  }
  if (creatorDelta !== 0 && creatorId) {
    addWeight(next.creatorScores, creatorId, creatorDelta, 120);
  }
  if (kwDelta !== 0) {
    const tokens = [
      ...extractTokens(payload.title || ''),
      ...extractTokens(payload.searchQuery || ''),
      ...(payload.tags || []).map((t) => t.toLowerCase().trim()).filter((t) => t.length >= 2),
    ];
    for (const tk of Array.from(new Set(tokens)).slice(0, 8)) {
      addWeight(next.keywordScores, tk, kwDelta, 100);
    }
  }
  if (langDelta !== 0 && lang) {
    addWeight(next.languageScores, lang, langDelta, 10);
  }

  next.learningStage = computeLearningStage(next.totalSignals);
  return next;
}

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function buildDiscoveryQueryPlan(options: {
  mode: 'all' | 'for_you';
  profile?: UserRecommendationProfile | null;
  interestKeywords?: string[];
  seed?: string;
  refreshGen?: number;
  isShorts?: boolean;
}): { queries: string[]; categoryOrder: string[] } {
  const { mode, profile, interestKeywords = [], seed = '', refreshGen = 0, isShorts = false } = options;
  const reducedSet = new Set(profile?.reducedCategories || []);
  const stage = profile?.learningStage || 'initial_discovery';

  // Weight each of the 30 categories
  const weightedCats = GLOBAL_VIDEO_CATEGORIES.map((cat) => {
    const rawPref = profile?.categoryScores?.[cat.id] || 0;
    const isReduced = reducedSet.has(cat.id);
    const jitter = ((hashString(`${seed}_${refreshGen}_${cat.id}`) % 1000) / 1000) * 14;
    let priority = jitter;
    if (mode === 'for_you') {
      const prefWeight =
        stage === 'initial_discovery'
          ? 0.4
          : stage === 'early_learning'
          ? 0.75
          : 1.0;
      priority += rawPref * prefWeight;
    } else {
      // 'all' feed stays globally mixed while gently noticing clear preferences
      priority += Math.max(-10, Math.min(18, rawPref * 0.28));
    }
    if (isReduced) priority -= 35;
    return { cat, priority };
  }).sort((a, b) => b.priority - a.priority);

  // Interleave top personalized categories with broad global exploration across all 30 categories
  const topCount = mode === 'for_you' ? 6 : 4;
  const topCats = weightedCats.slice(0, topCount);
  const exploreCats = weightedCats
    .slice(topCount)
    .sort(
      (a, b) =>
        (hashString(`exp_${seed}_${refreshGen}_${a.cat.id}`) % 997) -
        (hashString(`exp_${seed}_${refreshGen}_${b.cat.id}`) % 997)
    );

  const orderedCats: typeof weightedCats = [];
  let ti = 0;
  let ei = 0;
  while (ti < topCats.length || ei < exploreCats.length) {
    if (ti < topCats.length) orderedCats.push(topCats[ti++]);
    if (ei < exploreCats.length) orderedCats.push(exploreCats[ei++]);
    if (mode === 'all' && ei < exploreCats.length) orderedCats.push(exploreCats[ei++]);
  }

  const queries: string[] = [];
  const seenQ = new Set<string>();

  // Inject search interests & watch-derived keywords cleanly without dominating all slots
  const searchSeeds = [
    ...(profile?.searchInterests || []).slice(0, 2),
    ...interestKeywords.slice(0, 2),
  ];
  for (const kw of searchSeeds) {
    const q = isShorts ? `${kw} #shorts` : `${kw}`;
    if (q && !seenQ.has(q.toLowerCase())) {
      seenQ.add(q.toLowerCase());
      queries.push(q);
    }
  }

  // Rotate query index within each category based on refreshGen + seed so refreshes get fresh queries
  for (let round = 0; round < 3; round++) {
    for (const { cat } of orderedCats) {
      if (cat.discoveryQueries.length === 0) continue;
      const qOffset = (hashString(`${seed}_${cat.id}`) + refreshGen + round) % cat.discoveryQueries.length;
      const baseQ = cat.discoveryQueries[qOffset];
      const finalQ = isShorts && !baseQ.includes('#shorts') ? `${baseQ} #shorts` : baseQ;
      if (!seenQ.has(finalQ.toLowerCase())) {
        seenQ.add(finalQ.toLowerCase());
        queries.push(finalQ);
      }
    }
  }

  return {
    queries,
    categoryOrder: orderedCats.map((c) => c.cat.id),
  };
}

export function scoreAndDistributeFeedPosts(
  candidates: Post[],
  options: {
    mode: 'all' | 'for_you';
    profile?: UserRecommendationProfile | null;
    friendIds?: Set<string>;
    followedIds?: Set<string>;
    excludeIds?: Set<string>;
    seed?: string;
    refreshGen?: number;
    limit?: number;
    viewerId?: string;
  }
): Post[] {
  const {
    mode,
    profile,
    friendIds = new Set(),
    followedIds = new Set(),
    excludeIds = new Set(),
    seed = '',
    refreshGen = 0,
    limit = candidates.length,
    viewerId,
  } = options;

  const hiddenCreators = new Set(profile?.hiddenCreators || []);
  const notInterested = new Set(profile?.notInterestedIds || []);
  const reducedCategories = new Set(profile?.reducedCategories || []);
  const skippedIds = new Set(profile?.skippedIds || []);
  const replayedIds = new Set(profile?.replayedIds || []);
  const stage = profile?.learningStage || 'initial_discovery';
  const now = Date.now();

  const mixedInputs: MixedFeedCandidate<Post>[] = [];

  for (const post of candidates) {
    const extId = String(post.externalId || post.id);
    const creatorId = String(post.author?.id || '');
    if (hiddenCreators.has(creatorId)) continue;
    if (notInterested.has(post.id) || notInterested.has(extId)) continue;

    const classification = post.categoryId && CATEGORY_BY_ID[post.categoryId]
      ? {
          categoryId: post.categoryId,
          categoryLabel: post.categoryLabel || CATEGORY_BY_ID[post.categoryId].label,
          subcategory: post.subcategory || CATEGORY_BY_ID[post.categoryId].subcategories[0],
          language: post.language || 'global',
        }
      : classifyVideoContent({
          title: post.content,
          hashtags: post.hashtags,
          channelTitle: post.author?.displayName,
        });

    const enrichedPost: Post = {
      ...post,
      categoryId: classification.categoryId,
      categoryLabel: classification.categoryLabel,
      subcategory: classification.subcategory,
      language: classification.language,
    };

    let score = 0;

    // 1. Social graph & native community boost
    if (friendIds.has(creatorId)) score += 18;
    if (followedIds.has(creatorId)) score += 14;
    if (viewerId && creatorId === viewerId) score += 5;
    if (enrichedPost.source === 'motherland') score += 6;

    // 2. Category & Subcategory affinity
    const catAffinity = profile?.categoryScores?.[classification.categoryId] || 0;
    const subAffinity = profile?.subcategoryScores?.[`${classification.categoryId}::${classification.subcategory}`] || 0;
    const creatorAffinity = profile?.creatorScores?.[creatorId] || 0;
    const stageMult =
      mode === 'for_you'
        ? stage === 'initial_discovery'
          ? 0.45
          : stage === 'early_learning'
          ? 0.85
          : 1.2
        : 0.4;

    score += Math.max(-25, Math.min(36, catAffinity * 0.65 * stageMult));
    score += Math.max(-12, Math.min(18, subAffinity * 0.55 * stageMult));
    score += Math.max(-20, Math.min(28, creatorAffinity * 0.7 * stageMult));

    // 3. Language preference
    const langAffinity = profile?.languageScores?.[classification.language] || 0;
    score += Math.max(-4, Math.min(8, langAffinity * 0.5));

    // 4. Keyword / Search interest match
    const lowerText = `${enrichedPost.content || ''} ${(enrichedPost.hashtags || []).join(' ')}`.toLowerCase();
    for (const [kw, kwScore] of Object.entries(profile?.keywordScores || {})) {
      if (kw && lowerText.includes(kw.toLowerCase())) {
        score += Math.max(-6, Math.min(10, kwScore * 0.5));
      }
    }
    for (const q of profile?.searchInterests || []) {
      if (q && lowerText.includes(q.toLowerCase())) {
        score += 7;
      }
    }

    // 5. Explicit penalties & skips
    if (reducedCategories.has(classification.categoryId)) score -= 24;
    if (skippedIds.has(enrichedPost.id) || skippedIds.has(extId)) score -= 14;
    if (replayedIds.has(enrichedPost.id) || replayedIds.has(extId)) score -= 4; // already replayed recently, discover fresh siblings
    if (excludeIds.has(enrichedPost.id) || excludeIds.has(extId)) score -= 30;

    // 6. Popular + Emerging creator balance (log engagement + emerging discovery lift)
    const views = Number(enrichedPost.stats?.views || 0);
    const likes = Number(enrichedPost.stats?.likes || 0);
    const comments = Number(enrichedPost.stats?.comments || 0);
    const shares = Number(enrichedPost.stats?.shares || 0);
    const engagement = likes * 1.5 + comments * 2.5 + shares * 2 + views * 0.002;
    score += Math.log10(engagement + 1) * 4.5;
    const isPopular = views >= 250_000 || likes >= 10_000;
    if (!isPopular && enrichedPost.mediaType === 'video') {
      // Emerging creator discovery boost so smaller creators surface too
      score += 4.5;
    }

    // 7. Freshness preference (soft recency curve + refresh jitter for novelty)
    const ageHours = Math.max(0, (now - new Date(enrichedPost.createdAt).getTime()) / (1000 * 60 * 60));
    score += 12 / (1 + ageHours / 48);
    score += ((hashString(`${seed}_${refreshGen}_${extId}`) % 100) / 100) * 6;

    const isExplore = catAffinity <= 0 && !friendIds.has(creatorId) && !followedIds.has(creatorId);

    mixedInputs.push({
      item: enrichedPost,
      id: extId,
      creatorId,
      categoryId: classification.categoryId,
      score,
      isExplore,
      isPopular,
    });
  }

  const exploreRatio =
    mode === 'for_you'
      ? stage === 'initial_discovery'
        ? 0.45
        : stage === 'early_learning'
        ? 0.35
        : 0.22
      : 0.35;

  return distributeMixedCategoryFeed(mixedInputs, {
    limit,
    minCreatorGap: 2,
    exploreRatio,
    seed: `${seed}_${refreshGen}`,
  });
}
