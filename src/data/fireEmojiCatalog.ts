import type { ReactionType as PostReactionType } from '../types';

export type FireEmojiCategory =
  | 'Expressions'
  | 'Love & Feelings'
  | 'Actions & Gestures'
  | 'Food & Drinks'
  | 'Animals & Nature'
  | 'Objects & Activities';

export interface FireEmojiItem {
  id: string;
  token: string;
  name: string;
  category: FireEmojiCategory;
  keywords: string[];
  assetUrl: string;
  animationHint?: 'glow' | 'bounce' | 'pulse' | 'wiggle';
}

export interface FireReactionOption {
  type: PostReactionType;
  id: string;
  label: string;
  assetUrl: string;
  color: string;
  ringColor: string;
}

export const FIRE_REACTIONS: FireReactionOption[] = [
  {
    type: 'like',
    id: 'react_like',
    label: 'Like',
    assetUrl: '/assets/fire-emojis/reactions/like.png',
    color: 'text-amber-400',
    ringColor: 'border-amber-500/40 bg-amber-500/10',
  },
  {
    type: 'haha',
    id: 'react_haha',
    label: 'Haha',
    assetUrl: '/assets/fire-emojis/reactions/haha.png',
    color: 'text-yellow-400',
    ringColor: 'border-yellow-500/40 bg-yellow-500/10',
  },
  {
    type: 'love',
    id: 'react_love',
    label: 'Love',
    assetUrl: '/assets/fire-emojis/reactions/love.png',
    color: 'text-rose-400',
    ringColor: 'border-rose-500/40 bg-rose-500/10',
  },
  {
    type: 'wow',
    id: 'react_wow',
    label: 'Wow',
    assetUrl: '/assets/fire-emojis/reactions/wow.png',
    color: 'text-orange-300',
    ringColor: 'border-orange-400/40 bg-orange-400/10',
  },
  {
    type: 'sad',
    id: 'react_sad',
    label: 'Sad',
    assetUrl: '/assets/fire-emojis/reactions/sad.png',
    color: 'text-sky-400',
    ringColor: 'border-sky-400/40 bg-sky-400/10',
  },
  {
    type: 'angry',
    id: 'react_angry',
    label: 'Angry',
    assetUrl: '/assets/fire-emojis/reactions/angry.png',
    color: 'text-red-500',
    ringColor: 'border-red-500/40 bg-red-500/10',
  },
  {
    type: 'care',
    id: 'react_care',
    label: 'Care',
    assetUrl: '/assets/fire-emojis/reactions/care.png',
    color: 'text-pink-400',
    ringColor: 'border-pink-400/40 bg-pink-400/10',
  },
  {
    type: 'cool',
    id: 'react_cool',
    label: 'Cool',
    assetUrl: '/assets/fire-emojis/reactions/cool.png',
    color: 'text-cyan-400',
    ringColor: 'border-cyan-400/40 bg-cyan-400/10',
  },
];

export const FIRE_EMOJI_CATEGORIES: FireEmojiCategory[] = [
  'Expressions',
  'Love & Feelings',
  'Actions & Gestures',
  'Food & Drinks',
  'Animals & Nature',
  'Objects & Activities',
];

function item(
  id: string,
  name: string,
  category: FireEmojiCategory,
  assetUrl: string,
  keywords: string[],
  animationHint?: FireEmojiItem['animationHint']
): FireEmojiItem {
  return {
    id,
    token: `[[fire:${id}]]`,
    name,
    category,
    keywords,
    assetUrl,
    animationHint,
  };
}

export const FIRE_EMOJI_CATALOG: FireEmojiItem[] = [
  // Core 8 Reactions (available inside Expressions / Love as standalone stickers too)
  item('react_like', 'Fire Like', 'Actions & Gestures', '/assets/fire-emojis/reactions/like.png', ['like', 'thumbs up', 'yes', 'good', 'approve', 'fire'], 'bounce'),
  item('react_haha', 'Fire Haha', 'Expressions', '/assets/fire-emojis/reactions/haha.png', ['haha', 'laugh', 'lol', 'funny', 'tears', 'joy'], 'bounce'),
  item('react_love', 'Fire Love', 'Love & Feelings', '/assets/fire-emojis/reactions/love.png', ['love', 'heart eyes', 'adore', 'crush', 'romance'], 'pulse'),
  item('react_wow', 'Fire Wow', 'Expressions', '/assets/fire-emojis/reactions/wow.png', ['wow', 'amazed', 'surprised', 'shock', 'omg'], 'bounce'),
  item('react_sad', 'Fire Sad', 'Expressions', '/assets/fire-emojis/reactions/sad.png', ['sad', 'cry', 'tears', 'upset', 'sorry'], 'glow'),
  item('react_angry', 'Fire Angry', 'Expressions', '/assets/fire-emojis/reactions/angry.png', ['angry', 'mad', 'rage', 'furious', 'grr'], 'wiggle'),
  item('react_care', 'Fire Care', 'Love & Feelings', '/assets/fire-emojis/reactions/care.png', ['care', 'hug', 'support', 'warm', 'affection'], 'pulse'),
  item('react_cool', 'Fire Cool', 'Expressions', '/assets/fire-emojis/reactions/cool.png', ['cool', 'sunglasses', 'chill', 'swag', 'peace'], 'glow'),

  // Expressions PNG sheet (15)
  item('exp_01', 'Flame Happy', 'Expressions', '/assets/fire-emojis/expressions/exp_01.png', ['happy', 'smile', 'cheerful', 'glad'], 'bounce'),
  item('exp_02', 'FlameUwU Blush', 'Expressions', '/assets/fire-emojis/expressions/exp_02.png', ['blush', 'cute', 'uwu', 'sweet'], 'glow'),
  item('exp_03', 'Flame Serene', 'Expressions', '/assets/fire-emojis/expressions/exp_03.png', ['serene', 'calm', 'peaceful', 'content']),
  item('exp_04', 'Flame Big Grin', 'Expressions', '/assets/fire-emojis/expressions/exp_04.png', ['grin', 'laugh', 'excited', 'happy'], 'bounce'),
  item('exp_05', 'Flame Yummy', 'Expressions', '/assets/fire-emojis/expressions/exp_05.png', ['yummy', 'delicious', 'lick', 'tasty']),
  item('exp_06', 'Flame Shocked', 'Expressions', '/assets/fire-emojis/expressions/exp_06.png', ['shocked', 'uhoh', 'surprised', 'gasp']),
  item('exp_07', 'Flame Wink', 'Expressions', '/assets/fire-emojis/expressions/exp_07.png', ['wink', 'flirt', 'playful', 'cheeky']),
  item('exp_08', 'Flame Mischief Fangs', 'Expressions', '/assets/fire-emojis/expressions/exp_08.png', ['fangs', 'playful', 'silly', 'mischief']),
  item('exp_09', 'Flame Curious', 'Expressions', '/assets/fire-emojis/expressions/exp_09.png', ['curious', 'whistle', 'wonder', 'hmm']),
  item('exp_10', 'Flame Silly Tongue', 'Expressions', '/assets/fire-emojis/expressions/exp_10.png', ['tongue', 'silly', 'goofy', 'tease']),
  item('exp_11', 'Flame Beaming', 'Expressions', '/assets/fire-emojis/expressions/exp_11.png', ['beaming', 'proud', 'bright', 'smile']),
  item('exp_12', 'Flame Kiss Heart', 'Love & Feelings', '/assets/fire-emojis/expressions/exp_12.png', ['kiss', 'heart', 'mwah', 'love'], 'pulse'),
  item('exp_13', 'Flame Drooling', 'Expressions', '/assets/fire-emojis/expressions/exp_13.png', ['drool', 'craving', 'hungry', 'yum']),
  item('exp_14', 'Flame Pouting', 'Expressions', '/assets/fire-emojis/expressions/exp_14.png', ['pout', 'puffed', 'hmph', 'cute']),
  item('exp_15', 'Flame Halo Smirk', 'Expressions', '/assets/fire-emojis/expressions/exp_15.png', ['halo', 'smirk', 'innocent', 'angelic']),

  // Expressions SVG extensions (18)
  item('exp_crying_laugh', 'Flame Cry Laugh', 'Expressions', '/assets/fire-emojis/svg/exp_crying_laugh.svg', ['laugh', 'tears', 'lol', 'rofl', 'funny'], 'bounce'),
  item('exp_blush', 'Flame Warm Blush', 'Expressions', '/assets/fire-emojis/svg/exp_blush.svg', ['blush', 'warm', 'flattered', 'smile']),
  item('exp_wink_tongue', 'Flame Wink Tongue', 'Expressions', '/assets/fire-emojis/svg/exp_wink_tongue.svg', ['wink', 'tongue', 'playful', 'joking']),
  item('exp_shocked', 'Flame Open Wow', 'Expressions', '/assets/fire-emojis/svg/exp_shocked.svg', ['omg', 'astonished', 'gasp', 'shock']),
  item('exp_love_struck', 'Flame Heart Eyes', 'Love & Feelings', '/assets/fire-emojis/svg/exp_love_struck.svg', ['heart eyes', 'infatuated', 'love'], 'pulse'),
  item('exp_cool_smirk', 'Flame Shades', 'Expressions', '/assets/fire-emojis/svg/exp_cool_smirk.svg', ['cool', 'shades', 'sunglasses', 'confident']),
  item('exp_angel', 'Flame Angel', 'Expressions', '/assets/fire-emojis/svg/exp_angel.svg', ['angel', 'innocent', 'blessed', 'good']),
  item('exp_devil', 'Flame Imp', 'Expressions', '/assets/fire-emojis/svg/exp_devil.svg', ['devil', 'naughty', 'spicy', 'sassy']),
  item('exp_dizzy', 'Flame Dizzy', 'Expressions', '/assets/fire-emojis/svg/exp_dizzy.svg', ['dizzy', 'whoa', 'overwhelmed', 'spin']),
  item('exp_mind_blown', 'Flame Mind Blown', 'Expressions', '/assets/fire-emojis/svg/exp_mind_blown.svg', ['mind blown', 'wow', 'genius', 'explode'], 'bounce'),
  item('exp_nerd', 'Flame Nerd', 'Expressions', '/assets/fire-emojis/svg/exp_nerd.svg', ['nerd', 'smart', 'glasses', 'study']),
  item('exp_nervous', 'Flame Nervous', 'Expressions', '/assets/fire-emojis/svg/exp_nervous.svg', ['nervous', 'sweat', 'phew', 'tense']),
  item('exp_relieved', 'Flame Relieved', 'Expressions', '/assets/fire-emojis/svg/exp_relieved.svg', ['relieved', 'chill', 'relaxed', 'peace']),
  item('exp_shy', 'Flame Shy', 'Love & Feelings', '/assets/fire-emojis/svg/exp_shy.svg', ['shy', 'timid', 'bashful', 'sweet']),
  item('exp_sleepy', 'Flame Sleepy', 'Expressions', '/assets/fire-emojis/svg/exp_sleepy.svg', ['sleepy', 'tired', 'zzz', 'goodnight']),
  item('exp_star_eyes', 'Flame Starry Eyes', 'Expressions', '/assets/fire-emojis/svg/exp_star_eyes.svg', ['star', 'excited', 'superstar', 'amazed'], 'pulse'),
  item('exp_thinking', 'Flame Thinking', 'Expressions', '/assets/fire-emojis/svg/exp_thinking.svg', ['thinking', 'hmm', 'idea', 'wonder']),
  item('exp_worried', 'Flame Worried', 'Expressions', '/assets/fire-emojis/svg/exp_worried.svg', ['worried', 'concerned', 'aww', 'sad']),

  // Love & Buddies PNG sheet (20)
  item('love_01', 'Campfire Cozy', 'Love & Feelings', '/assets/fire-emojis/love/love_01.png', ['cozy', 'campfire', 'warm', 'chill']),
  item('love_02', 'Flame Blowing Kiss', 'Love & Feelings', '/assets/fire-emojis/love/love_02.png', ['kiss', 'heart', 'love', 'affection'], 'pulse'),
  item('love_03', 'Twin Flames Kiss', 'Love & Feelings', '/assets/fire-emojis/love/love_03.png', ['kiss', 'couple', 'romance', 'love'], 'pulse'),
  item('love_04', 'Little Spark', 'Love & Feelings', '/assets/fire-emojis/love/love_04.png', ['cute', 'tiny', 'spark', 'aww']),
  item('love_05', 'Flame Shy Hands', 'Love & Feelings', '/assets/fire-emojis/love/love_05.png', ['shy', 'warm', 'peace', 'cute']),
  item('love_06', 'Flame Determined', 'Expressions', '/assets/fire-emojis/love/love_06.png', ['determined', 'fierce', 'fired up', 'ready']),
  item('love_07', 'Flame Zooming', 'Actions & Gestures', '/assets/fire-emojis/love/love_07.png', ['zoom', 'fast', 'dash', 'speed']),
  item('love_08', 'Besties Flame Hug', 'Love & Feelings', '/assets/fire-emojis/love/love_08.png', ['friends', 'hug', 'besties', 'love'], 'pulse'),
  item('love_09', 'Flame Bonfire Joy', 'Love & Feelings', '/assets/fire-emojis/love/love_09.png', ['bonfire', 'joy', 'warmth', 'happy']),
  item('love_10', 'Flame Chubby Smile', 'Expressions', '/assets/fire-emojis/love/love_10.png', ['cute', 'smile', 'adorable', 'sweet']),
  item('love_11', 'Flame Tearful', 'Expressions', '/assets/fire-emojis/love/love_11.png', ['cry', 'tear', 'emotional', 'sad']),
  item('love_12', 'Flame Surprised Gasp', 'Expressions', '/assets/fire-emojis/love/love_12.png', ['gasp', 'shock', 'whoa', 'wow']),
  item('love_13', 'Flames Flower Gift', 'Love & Feelings', '/assets/fire-emojis/love/love_13.png', ['flower', 'gift', 'couple', 'care'], 'pulse'),
  item('love_14', 'Flame Piggyback', 'Love & Feelings', '/assets/fire-emojis/love/love_14.png', ['play', 'friends', 'fun', 'stack']),
  item('love_15', 'Flame Sparkle Cheer', 'Love & Feelings', '/assets/fire-emojis/love/love_15.png', ['cheer', 'happy', 'sparkle', 'joy']),
  item('love_16', 'Flame Hooray', 'Expressions', '/assets/fire-emojis/love/love_16.png', ['hooray', 'yay', 'excited', 'happy'], 'bounce'),
  item('love_17', 'Flame Holding Log', 'Objects & Activities', '/assets/fire-emojis/love/love_17.png', ['wood', 'fuel', 'camp', 'cozy']),
  item('love_18', 'Twin Flames Cuddle', 'Love & Feelings', '/assets/fire-emojis/love/love_18.png', ['cuddle', 'love', 'support', 'hug'], 'pulse'),
  item('love_19', 'Flame Floating Hug', 'Love & Feelings', '/assets/fire-emojis/love/love_19.png', ['hug', 'welcome', 'happy', 'open arms']),
  item('love_20', 'Flame startled Jump', 'Expressions', '/assets/fire-emojis/love/love_20.png', ['startled', 'whoa', 'jump', 'oh no']),

  // Actions PNG sheet (20)
  item('act_01', 'Flame Standing Smile', 'Actions & Gestures', '/assets/fire-emojis/actions/act_01.png', ['stand', 'wave', 'hello', 'cute']),
  item('act_02', 'Flame Running Joy', 'Actions & Gestures', '/assets/fire-emojis/actions/act_02.png', ['run', 'happy', 'hurry', 'go'], 'bounce'),
  item('act_03', 'Flame Sitting Yay', 'Actions & Gestures', '/assets/fire-emojis/actions/act_03.png', ['yay', 'hearts', 'happy', 'celebrate']),
  item('act_04', 'Flame Heart Balloon', 'Love & Feelings', '/assets/fire-emojis/actions/act_04.png', ['balloon', 'heart', 'gift', 'celebrate'], 'pulse'),
  item('act_05', 'Flame Reading Book', 'Actions & Gestures', '/assets/fire-emojis/actions/act_05.png', ['read', 'book', 'study', 'learn']),
  item('act_06', 'Flame Sleeping Pillow', 'Actions & Gestures', '/assets/fire-emojis/actions/act_06.png', ['sleep', 'pillow', 'rest', 'night']),
  item('act_07', 'Flame Pool Float', 'Actions & Gestures', '/assets/fire-emojis/actions/act_07.png', ['chill', 'float', 'vacation', 'relax']),
  item('act_08', 'Flame Snacking', 'Food & Drinks', '/assets/fire-emojis/actions/act_08.png', ['snack', 'eat', 'yum', 'treat']),
  item('act_09', 'Flame Big Heart Hug', 'Love & Feelings', '/assets/fire-emojis/actions/act_09.png', ['big heart', 'love', 'care', 'support'], 'pulse'),
  item('act_10', 'Flame Tantrum', 'Expressions', '/assets/fire-emojis/actions/act_10.png', ['angry', 'stomp', 'no', 'mad']),
  item('act_11', 'Flame Party Dance', 'Actions & Gestures', '/assets/fire-emojis/actions/act_11.png', ['party', 'dance', 'celebrate', 'cheers'], 'bounce'),
  item('act_12', 'Flame Birthday Cake', 'Food & Drinks', '/assets/fire-emojis/actions/act_12.png', ['birthday', 'cake', 'celebrate', 'party']),
  item('act_13', 'Flame Wizard Cap', 'Actions & Gestures', '/assets/fire-emojis/actions/act_13.png', ['hat', 'cool', 'excited', 'magic']),
  item('act_14', 'Flame Sick Thermometer', 'Expressions', '/assets/fire-emojis/actions/act_14.png', ['sick', 'fever', 'hot', 'ill']),
  item('act_15', 'Flame Heart Glasses', 'Love & Feelings', '/assets/fire-emojis/actions/act_15.png', ['glasses', 'love', 'cute', 'nerd']),
  item('act_16', 'Flame Fire Breath', 'Actions & Gestures', '/assets/fire-emojis/actions/act_16.png', ['fire breath', 'roar', 'power', 'lit'], 'glow'),
  item('act_17', 'Flame Eating Popcorn', 'Food & Drinks', '/assets/fire-emojis/actions/act_17.png', ['popcorn', 'movie', 'watch', 'drama']),
  item('act_18', 'Flame Gift Box', 'Love & Feelings', '/assets/fire-emojis/actions/act_18.png', ['gift', 'present', 'surprise', 'give']),
  item('act_19', 'Flame Melted Puddle', 'Expressions', '/assets/fire-emojis/actions/act_19.png', ['cry', 'exhausted', 'melt', 'tired']),
  item('act_20', 'Flame Holding Daisy', 'Love & Feelings', '/assets/fire-emojis/actions/act_20.png', ['flower', 'sweet', 'thank you', 'kind']),

  // Actions SVG gestures (11)
  item('act_thumbs_up', 'Fire Thumbs Up', 'Actions & Gestures', '/assets/fire-emojis/svg/act_thumbs_up.svg', ['thumbs up', 'like', 'yes', 'ok']),
  item('act_thumbs_down', 'Fire Thumbs Down', 'Actions & Gestures', '/assets/fire-emojis/svg/act_thumbs_down.svg', ['thumbs down', 'dislike', 'no']),
  item('act_clap', 'Fire Clap', 'Actions & Gestures', '/assets/fire-emojis/svg/act_clap.svg', ['clap', 'applause', 'bravo', 'congrats'], 'bounce'),
  item('act_wave', 'Fire Wave', 'Actions & Gestures', '/assets/fire-emojis/svg/act_wave.svg', ['wave', 'hi', 'hello', 'bye']),
  item('act_pray_thanks', 'Fire Thankful Hands', 'Actions & Gestures', '/assets/fire-emojis/svg/act_pray_thanks.svg', ['thanks', 'please', 'pray', 'namaste', 'bless']),
  item('act_muscle', 'Fire Flex', 'Actions & Gestures', '/assets/fire-emojis/svg/act_muscle.svg', ['strong', 'muscle', 'power', 'gym', 'win']),
  item('act_peace', 'Fire Peace Sign', 'Actions & Gestures', '/assets/fire-emojis/svg/act_peace.svg', ['peace', 'victory', 'chill', 'two']),
  item('act_fist_bump', 'Fire Fist Bump', 'Actions & Gestures', '/assets/fire-emojis/svg/act_fist_bump.svg', ['fist bump', 'respect', 'bro', 'solid']),
  item('act_high_five', 'Fire High Five', 'Actions & Gestures', '/assets/fire-emojis/svg/act_high_five.svg', ['high five', 'team', 'win', 'yes']),
  item('act_point_up', 'Fire Point Up', 'Actions & Gestures', '/assets/fire-emojis/svg/act_point_up.svg', ['this', 'up', 'top', 'agree']),
  item('act_fire_heart', 'Fire Heart Hands', 'Love & Feelings', '/assets/fire-emojis/svg/act_fire_heart.svg', ['heart', 'support', 'love', 'care'], 'pulse'),

  // Props PNG sheet (20)
  item('prop_01', 'Spark Shy Smile', 'Love & Feelings', '/assets/fire-emojis/props/prop_01.png', ['smile', 'spark', 'shy', 'warm']),
  item('prop_02', 'Spark Ice Cream', 'Food & Drinks', '/assets/fire-emojis/props/prop_02.png', ['ice cream', 'cone', 'dessert', 'sweet']),
  item('prop_03', 'Spark Big Cheer', 'Expressions', '/assets/fire-emojis/props/prop_03.png', ['cheer', 'happy', 'jump', 'excited']),
  item('prop_04', 'Spark Bashful', 'Love & Feelings', '/assets/fire-emojis/props/prop_04.png', ['bashful', 'sweet', 'kind', 'cute']),
  item('prop_05', 'Spark White Hat', 'Objects & Activities', '/assets/fire-emojis/props/prop_05.png', ['hat', 'style', 'happy', 'cool']),
  item('prop_06', 'Spark Candy Wrap', 'Food & Drinks', '/assets/fire-emojis/props/prop_06.png', ['candy', 'sweet', 'treat', 'sugar']),
  item('prop_07', 'Spark Water Drop Buddy', 'Animals & Nature', '/assets/fire-emojis/props/prop_07.png', ['water', 'friend', 'hug', 'harmony']),
  item('prop_08', 'Spark Bowtie', 'Objects & Activities', '/assets/fire-emojis/props/prop_08.png', ['bowtie', 'dapper', 'cute', 'classy']),
  item('prop_09', 'Spark Lollipop', 'Food & Drinks', '/assets/fire-emojis/props/prop_09.png', ['lollipop', 'candy', 'sweet', 'fun']),
  item('prop_10', 'Spark Round Glasses', 'Expressions', '/assets/fire-emojis/props/prop_10.png', ['glasses', 'smart', 'owl', 'cute']),
  item('prop_11', 'Spark Blue Balloon', 'Objects & Activities', '/assets/fire-emojis/props/prop_11.png', ['balloon', 'party', 'float', 'happy']),
  item('prop_12', 'Spark Wizard Hat', 'Objects & Activities', '/assets/fire-emojis/props/prop_12.png', ['wizard', 'magic', 'hat', 'spell']),
  item('prop_13', 'Spark Nap Time', 'Actions & Gestures', '/assets/fire-emojis/props/prop_13.png', ['nap', 'pillow', 'cozy', 'sleep']),
  item('prop_14', 'Spark Santa Hat', 'Objects & Activities', '/assets/fire-emojis/props/prop_14.png', ['festive', 'santa', 'winter', 'holiday']),
  item('prop_15', 'Spark Master Chef', 'Food & Drinks', '/assets/fire-emojis/props/prop_15.png', ['chef', 'cook', 'kitchen', 'food']),
  item('prop_16', 'Spark Cozy Sit', 'Love & Feelings', '/assets/fire-emojis/props/prop_16.png', ['sit', 'smile', 'calm', 'cute']),
  item('prop_17', 'Spark Cheers Drink', 'Food & Drinks', '/assets/fire-emojis/props/prop_17.png', ['cheers', 'drink', 'party', 'toast']),
  item('prop_18', 'Spark Wishing Star', 'Love & Feelings', '/assets/fire-emojis/props/prop_18.png', ['star', 'wish', 'kiss', 'magic'], 'pulse'),
  item('prop_19', 'Spark Holding Heart', 'Love & Feelings', '/assets/fire-emojis/props/prop_19.png', ['heart', 'care', 'love', 'support'], 'pulse'),
  item('prop_20', 'Spark Winter Beanie', 'Objects & Activities', '/assets/fire-emojis/props/prop_20.png', ['beanie', 'winter', 'cozy', 'warm']),

  // Sports PNG sheet (9)
  item('sport_01', 'Soccer On Fire', 'Objects & Activities', '/assets/fire-emojis/sports/sport_01.png', ['football', 'soccer', 'goal', 'on fire'], 'bounce'),
  item('sport_02', 'Tennis Smash Fire', 'Objects & Activities', '/assets/fire-emojis/sports/sport_02.png', ['tennis', 'smash', 'sport', 'win']),
  item('sport_03', 'Hockey Goal Fire', 'Objects & Activities', '/assets/fire-emojis/sports/sport_03.png', ['hockey', 'goal', 'puck', 'score']),
  item('sport_04', 'Basketball Hot Shot', 'Objects & Activities', '/assets/fire-emojis/sports/sport_04.png', ['basketball', 'hot shot', 'hoop', 'score']),
  item('sport_05', 'Volleyball Spike Fire', 'Objects & Activities', '/assets/fire-emojis/sports/sport_05.png', ['volleyball', 'spike', 'team', 'win']),
  item('sport_06', 'Turbo Tire Fire', 'Objects & Activities', '/assets/fire-emojis/sports/sport_06.png', ['racing', 'fast', 'car', 'speed']),
  item('sport_07', 'Baseball Home Run', 'Objects & Gestures' as FireEmojiCategory extends never ? never : 'Objects & Activities', '/assets/fire-emojis/sports/sport_07.png', ['baseball', 'home run', 'bat', 'win']),
  item('sport_08', 'Rugby Unstoppable', 'Objects & Activities', '/assets/fire-emojis/sports/sport_08.png', ['rugby', 'unstoppable', 'run', 'power']),
  item('sport_09', 'Bowling Strike Fire', 'Objects & Activities', '/assets/fire-emojis/sports/sport_09.png', ['bowling', 'strike', 'win', 'score']),

  // Food & Drinks SVGs (33)
  item('food_apple', 'Flame Apple', 'Food & Drinks', '/assets/fire-emojis/svg/food_apple.svg', ['apple', 'fruit', 'fresh', 'snack']),
  item('food_banana', 'Flame Banana', 'Food & Drinks', '/assets/fire-emojis/svg/food_banana.svg', ['banana', 'fruit', 'yellow']),
  item('food_mango', 'Flame Mango', 'Food & Drinks', '/assets/fire-emojis/svg/food_mango.svg', ['mango', 'aam', 'fruit', 'bangladesh']),
  item('food_watermelon', 'Flame Watermelon', 'Food & Drinks', '/assets/fire-emojis/svg/food_watermelon.svg', ['watermelon', 'summer', 'fruit', 'juicy']),
  item('food_grapes', 'Flame Grapes', 'Food & Drinks', '/assets/fire-emojis/svg/food_grapes.svg', ['grapes', 'fruit', 'sweet']),
  item('food_tomato', 'Flame Tomato', 'Food & Drinks', '/assets/fire-emojis/svg/food_tomato.svg', ['tomato', 'veggie', 'fresh']),
  item('food_carrot', 'Flame Carrot', 'Food & Drinks', '/assets/fire-emojis/svg/food_carrot.svg', ['carrot', 'vegetable', 'healthy']),
  item('food_broccoli', 'Flame Broccoli', 'Food & Drinks', '/assets/fire-emojis/svg/food_broccoli.svg', ['broccoli', 'green', 'veggie']),
  item('food_corn', 'Flame Corn', 'Food & Drinks', '/assets/fire-emojis/svg/food_corn.svg', ['corn', 'bhutta', 'roast']),
  item('food_chili', 'Flame Hot Chili', 'Food & Drinks', '/assets/fire-emojis/svg/food_chili.svg', ['chili', 'spicy', 'hot', 'pepper'], 'glow'),
  item('food_pizza', 'Flame Pizza', 'Food & Drinks', '/assets/fire-emojis/svg/food_pizza.svg', ['pizza', 'slice', 'cheese', 'party']),
  item('food_burger', 'Flame Burger', 'Food & Drinks', '/assets/fire-emojis/svg/food_burger.svg', ['burger', 'fast food', 'grill']),
  item('food_fries', 'Flame Fries', 'Food & Drinks', '/assets/fire-emojis/svg/food_fries.svg', ['fries', 'crispy', 'snack']),
  item('food_hotdog', 'Flame Hotdog', 'Food & Drinks', '/assets/fire-emojis/svg/food_hotdog.svg', ['hotdog', 'grill', 'snack']),
  item('food_taco', 'Flame Taco', 'Food & Drinks', '/assets/fire-emojis/svg/food_taco.svg', ['taco', 'spicy', 'food']),
  item('food_sushi', 'Flame Sushi', 'Food & Drinks', '/assets/fire-emojis/svg/food_sushi.svg', ['sushi', 'roll', 'food']),
  item('food_noodles', 'Flame Noodles', 'Food & Drinks', '/assets/fire-emojis/svg/food_noodles.svg', ['noodles', 'ramen', 'hot', 'soup']),
  item('food_biryani', 'Flame Biryani', 'Food & Drinks', '/assets/fire-emojis/svg/food_biryani.svg', ['biryani', 'kacchi', 'rice', 'feast', 'dhaka']),
  item('food_samosa', 'Flame Singara Samosa', 'Food & Drinks', '/assets/fire-emojis/svg/food_samosa.svg', ['samosa', 'singara', 'snack', 'tea']),
  item('food_bread', 'Flame Bread', 'Food & Drinks', '/assets/fire-emojis/svg/food_bread.svg', ['bread', 'bakery', 'toast']),
  item('food_egg', 'Flame Egg', 'Food & Drinks', '/assets/fire-emojis/svg/food_egg.svg', ['egg', 'breakfast', 'morning']),
  item('food_cake', 'Flame Cake', 'Food & Drinks', '/assets/fire-emojis/svg/food_cake.svg', ['cake', 'birthday', 'party', 'sweet']),
  item('food_donut', 'Flame Donut', 'Food & Drinks', '/assets/fire-emojis/svg/food_donut.svg', ['donut', 'sweet', 'dessert']),
  item('food_cookie', 'Flame Cookie', 'Food & Drinks', '/assets/fire-emojis/svg/food_cookie.svg', ['cookie', 'biscuit', 'snack']),
  item('food_chocolate', 'Flame Chocolate', 'Food & Drinks', '/assets/fire-emojis/svg/food_chocolate.svg', ['chocolate', 'sweet', 'gift']),
  item('food_ice_cream', 'Flame Ice Cream', 'Food & Drinks', '/assets/fire-emojis/svg/food_ice_cream.svg', ['ice cream', 'cool', 'dessert']),
  item('food_ice_pop', 'Flame Popsicle', 'Food & Drinks', '/assets/fire-emojis/svg/food_ice_pop.svg', ['popsicle', 'ice pop', 'summer']),
  item('food_honey', 'Flame Honey Jar', 'Food & Drinks', '/assets/fire-emojis/svg/food_honey.svg', ['honey', 'sweet', 'sundarbans']),
  item('food_coffee', 'Flame Coffee', 'Food & Drinks', '/assets/fire-emojis/svg/food_coffee.svg', ['coffee', 'espresso', 'morning', 'cafe']),
  item('food_tea', 'Flame Cha Tea', 'Food & Drinks', '/assets/fire-emojis/svg/food_tea.svg', ['tea', 'cha', 'sylhet', 'warm']),
  item('food_boba', 'Flame Boba Drink', 'Food & Drinks', '/assets/fire-emojis/svg/food_boba.svg', ['boba', 'bubble tea', 'drink']),
  item('food_juice', 'Flame Juice', 'Food & Drinks', '/assets/fire-emojis/svg/food_juice.svg', ['juice', 'fresh', 'drink']),
  item('food_soda', 'Flame Fizz Soda', 'Food & Drinks', '/assets/fire-emojis/svg/food_soda.svg', ['soda', 'drink', 'cold']),

  // Animals & Nature SVGs (34)
  item('nat_lion', 'Flame Lion', 'Animals & Nature', '/assets/fire-emojis/svg/nat_lion.svg', ['lion', 'king', 'brave', 'wild']),
  item('nat_tiger', 'Royal Flame Tiger', 'Animals & Nature', '/assets/fire-emojis/svg/nat_tiger.svg', ['tiger', 'bengal', 'roar', 'bangladesh'], 'glow'),
  item('nat_cat', 'Flame Cat', 'Animals & Nature', '/assets/fire-emojis/svg/nat_cat.svg', ['cat', 'kitty', 'meow', 'cute']),
  item('nat_dog', 'Flame Puppy', 'Animals & Nature', '/assets/fire-emojis/svg/nat_dog.svg', ['dog', 'puppy', 'loyal', 'cute']),
  item('nat_fox', 'Flame Fox', 'Animals & Nature', '/assets/fire-emojis/svg/nat_fox.svg', ['fox', 'clever', 'orange', 'wild']),
  item('nat_wolf', 'Flame Wolf', 'Animals & Nature', '/assets/fire-emojis/svg/nat_wolf.svg', ['wolf', 'pack', 'fierce']),
  item('nat_bear', 'Flame Bear', 'Animals & Nature', '/assets/fire-emojis/svg/nat_bear.svg', ['bear', 'teddy', 'cozy']),
  item('nat_panda', 'Flame Panda', 'Animals & Nature', '/assets/fire-emojis/svg/nat_panda.svg', ['panda', 'cute', 'bear']),
  item('nat_rabbit', 'Flame Bunny', 'Animals & Nature', '/assets/fire-emojis/svg/nat_rabbit.svg', ['rabbit', 'bunny', 'fast', 'cute']),
  item('nat_monkey', 'Flame Monkey', 'Animals & Nature', '/assets/fire-emojis/svg/nat_monkey.svg', ['monkey', 'playful', 'funny']),
  item('nat_bird', 'Flame Songbird', 'Animals & Nature', '/assets/fire-emojis/svg/nat_bird.svg', ['bird', 'fly', 'tweet', 'freedom']),
  item('nat_eagle', 'Flame Eagle', 'Animals & Nature', '/assets/fire-emojis/svg/nat_eagle.svg', ['eagle', 'soar', 'sharp', 'power']),
  item('nat_owl', 'Flame Owl', 'Animals & Nature', '/assets/fire-emojis/svg/nat_owl.svg', ['owl', 'night', 'wise']),
  item('nat_duck', 'Flame Duck', 'Animals & Nature', '/assets/fire-emojis/svg/nat_duck.svg', ['duck', 'quack', 'pond']),
  item('nat_fish', 'Flame Koi Fish', 'Animals & Nature', '/assets/fire-emojis/svg/nat_fish.svg', ['fish', 'river', 'ilish', 'swim']),
  item('nat_dolphin', 'Flame Dolphin', 'Animals & Nature', '/assets/fire-emojis/svg/nat_dolphin.svg', ['dolphin', 'ocean', 'smart']),
  item('nat_whale', 'Flame Whale', 'Animals & Nature', '/assets/fire-emojis/svg/nat_whale.svg', ['whale', 'sea', 'ocean', 'splash']),
  item('nat_butterfly', 'Flame Butterfly', 'Animals & Nature', '/assets/fire-emojis/svg/nat_butterfly.svg', ['butterfly', 'nature', 'flutter']),
  item('nat_bee', 'Flame Honeybee', 'Animals & Nature', '/assets/fire-emojis/svg/nat_bee.svg', ['bee', 'buzz', 'busy', 'sweet']),
  item('nat_rose', 'Flame Rose', 'Animals & Nature', '/assets/fire-emojis/svg/nat_rose.svg', ['rose', 'flower', 'love', 'beauty']),
  item('nat_sunflower', 'Flame Sunflower', 'Animals & Nature', '/assets/fire-emojis/svg/nat_sunflower.svg', ['sunflower', 'bright', 'summer']),
  item('nat_hibiscus', 'Flame Hibiscus', 'Animals & Nature', '/assets/fire-emojis/svg/nat_hibiscus.svg', ['hibiscus', 'joba', 'flower']),
  item('nat_tulip', 'Flame Tulip', 'Animals & Nature', '/assets/fire-emojis/svg/nat_tulip.svg', ['tulip', 'spring', 'flower']),
  item('nat_tree', 'Flame Banyan Tree', 'Animals & Nature', '/assets/fire-emojis/svg/nat_tree.svg', ['tree', 'forest', 'green', 'nature']),
  item('nat_palm_tree', 'Flame Coconut Palm', 'Animals & Nature', '/assets/fire-emojis/svg/nat_palm_tree.svg', ['palm', 'beach', 'coxs bazar', 'island']),
  item('nat_cactus', 'Flame Cactus', 'Animals & Nature', '/assets/fire-emojis/svg/nat_cactus.svg', ['cactus', 'desert', 'plant']),
  item('nat_sun', 'Flame Sun', 'Animals & Nature', '/assets/fire-emojis/svg/nat_sun.svg', ['sun', 'morning', 'bright', 'shine'], 'glow'),
  item('nat_moon', 'Flame Crescent Moon', 'Animals & Nature', '/assets/fire-emojis/svg/nat_moon.svg', ['moon', 'night', 'eid', 'dream']),
  item('nat_star', 'Flame Gold Star', 'Animals & Nature', '/assets/fire-emojis/svg/nat_star.svg', ['star', 'sparkle', 'top', 'shine'], 'pulse'),
  item('nat_rainbow', 'Flame Rainbow', 'Animals & Nature', '/assets/fire-emojis/svg/nat_rainbow.svg', ['rainbow', 'color', 'hope', 'sky']),
  item('nat_lightning', 'Flame Lightning', 'Animals & Nature', '/assets/fire-emojis/svg/nat_lightning.svg', ['lightning', 'bolt', 'energy', 'fast'], 'pulse'),
  item('nat_rain', 'Flame Raindrop', 'Animals & Nature', '/assets/fire-emojis/svg/nat_rain.svg', ['rain', 'monsoon', 'cloud', 'borsha']),
  item('nat_wave', 'Flame Ocean Wave', 'Animals & Nature', '/assets/fire-emojis/svg/nat_wave.svg', ['wave', 'sea', 'bay', 'surf']),
  item('nat_mountain', 'Flame Mountain', 'Animals & Nature', '/assets/fire-emojis/svg/nat_mountain.svg', ['mountain', 'hill', 'bandarban', 'peak']),

  // Objects & Activities SVGs (41)
  item('obj_flag_bd', 'Flame Motherland Flag', 'Objects & Activities', '/assets/fire-emojis/svg/obj_flag_bd.svg', ['bangladesh', 'motherland', 'flag', 'bd'], 'pulse'),
  item('obj_crown', 'Flame Crown', 'Objects & Activities', '/assets/fire-emojis/svg/obj_crown.svg', ['crown', 'king', 'queen', 'champion'], 'glow'),
  item('obj_trophy', 'Flame Trophy', 'Objects & Activities', '/assets/fire-emojis/svg/obj_trophy.svg', ['trophy', 'winner', 'award', '1st']),
  item('obj_medal', 'Flame Gold Medal', 'Objects & Activities', '/assets/fire-emojis/svg/obj_medal.svg', ['medal', 'gold', 'win', 'award']),
  item('obj_rocket', 'Flame Rocket', 'Objects & Activities', '/assets/fire-emojis/svg/obj_rocket.svg', ['rocket', 'launch', 'boost', 'space'], 'bounce'),
  item('obj_fireworks', 'Flame Fireworks', 'Objects & Activities', '/assets/fire-emojis/svg/obj_fireworks.svg', ['fireworks', 'celebrate', 'festival', 'boom'], 'pulse'),
  item('obj_confetti', 'Flame Party Popper', 'Objects & Activities', '/assets/fire-emojis/svg/obj_confetti.svg', ['confetti', 'party', 'congrats', 'win']),
  item('obj_balloon', 'Flame Balloon', 'Objects & Activities', '/assets/fire-emojis/svg/obj_balloon.svg', ['balloon', 'birthday', 'party']),
  item('obj_gift', 'Flame Gift', 'Objects & Activities', '/assets/fire-emojis/svg/obj_gift.svg', ['gift', 'present', 'box', 'surprise']),
  item('obj_diamond', 'Flame Diamond', 'Objects & Activities', '/assets/fire-emojis/svg/obj_diamond.svg', ['diamond', 'gem', 'rare', 'shine']),
  item('obj_gem_ring', 'Flame Ring', 'Objects & Activities', '/assets/fire-emojis/svg/obj_gem_ring.svg', ['ring', 'diamond', 'wedding', 'love']),
  item('obj_cricket_bat', 'Flame Cricket Bat', 'Objects & Activities', '/assets/fire-emojis/svg/obj_cricket_bat.svg', ['cricket', 'six', 'bat', 'match']),
  item('obj_gaming', 'Flame Controller', 'Objects & Activities', '/assets/fire-emojis/svg/obj_gaming.svg', ['game', 'gaming', 'esports', 'play']),
  item('obj_music_note', 'Flame Music Note', 'Objects & Activities', '/assets/fire-emojis/svg/obj_music_note.svg', ['music', 'song', 'melody', 'vibe']),
  item('obj_headphones', 'Flame Headphones', 'Objects & Activities', '/assets/fire-emojis/svg/obj_headphones.svg', ['headphones', 'audio', 'listen', 'dj']),
  item('obj_microphone', 'Flame Mic', 'Objects & Activities', '/assets/fire-emojis/svg/obj_microphone.svg', ['mic', 'sing', 'podcast', 'live']),
  item('obj_guitar', 'Flame Guitar', 'Objects & Activities', '/assets/fire-emojis/svg/obj_guitar.svg', ['guitar', 'rock', 'band', 'music']),
  item('obj_drum', 'Flame Drum', 'Objects & Activities', '/assets/fire-emojis/svg/obj_drum.svg', ['drum', 'beat', 'rhythm', 'dhol']),
  item('obj_camera', 'Flame Camera', 'Objects & Activities', '/assets/fire-emojis/svg/obj_camera.svg', ['camera', 'photo', 'snap', 'pic']),
  item('obj_clapper', 'Flame Action Clapper', 'Objects & Activities', '/assets/fire-emojis/svg/obj_clapper.svg', ['video', 'movie', 'reel', 'shoot']),
  item('obj_palette', 'Flame Art Palette', 'Objects & Activities', '/assets/fire-emojis/svg/obj_palette.svg', ['art', 'paint', 'creative', 'design']),
  item('obj_megaphone', 'Flame Megaphone', 'Objects & Activities', '/assets/fire-emojis/svg/obj_megaphone.svg', ['boost', 'announce', 'news', 'share']),
  item('obj_ticket', 'Flame Ticket', 'Objects & Activities', '/assets/fire-emojis/svg/obj_ticket.svg', ['ticket', 'event', 'concert', 'pass']),
  item('obj_phone', 'Flame Smartphone', 'Objects & Activities', '/assets/fire-emojis/svg/obj_phone.svg', ['phone', 'mobile', 'call', 'app']),
  item('obj_laptop', 'Flame Laptop', 'Objects & Activities', '/assets/fire-emojis/svg/obj_laptop.svg', ['laptop', 'code', 'work', 'tech']),
  item('obj_lightbulb', 'Flame Bright Idea', 'Objects & Activities', '/assets/fire-emojis/svg/obj_lightbulb.svg', ['idea', 'genius', 'smart', 'tip'], 'glow'),
  item('obj_book', 'Flame Book', 'Objects & Activities', '/assets/fire-emojis/svg/obj_book.svg', ['book', 'story', 'read', 'study']),
  item('obj_clock', 'Flame Clock', 'Objects & Activities', '/assets/fire-emojis/svg/obj_clock.svg', ['time', 'clock', 'now', 'schedule']),
  item('obj_watch', 'Flame Watch', 'Objects & Activities', '/assets/fire-emojis/svg/obj_watch.svg', ['watch', 'time', 'style']),
  item('obj_compass', 'Flame Compass', 'Objects & Activities', '/assets/fire-emojis/svg/obj_compass.svg', ['compass', 'explore', 'travel', 'map']),
  item('obj_key', 'Flame Golden Key', 'Objects & Activities', '/assets/fire-emojis/svg/obj_key.svg', ['key', 'unlock', 'access', 'secret']),
  item('obj_lock', 'Flame Vault Lock', 'Objects & Activities', '/assets/fire-emojis/svg/obj_lock.svg', ['lock', 'vault', 'secure', 'private']),
  item('obj_shield', 'Flame Shield', 'Objects & Activities', '/assets/fire-emojis/svg/obj_shield.svg', ['shield', 'protect', 'safe', 'verified']),
  item('obj_umbrella', 'Flame Umbrella', 'Objects & Activities', '/assets/fire-emojis/svg/obj_umbrella.svg', ['umbrella', 'rain', 'monsoon']),
  item('obj_car', 'Flame Car', 'Objects & Activities', '/assets/fire-emojis/svg/obj_car.svg', ['car', 'drive', 'road', 'trip']),
  item('obj_motorcycle', 'Flame Motorbike', 'Objects & Activities', '/assets/fire-emojis/svg/obj_motorcycle.svg', ['bike', 'motorcycle', 'ride', 'speed']),
  item('obj_bicycle', 'Flame Bicycle', 'Objects & Activities', '/assets/fire-emojis/svg/obj_bicycle.svg', ['bicycle', 'cycle', 'ride', 'eco']),
  item('obj_bus', 'Flame Bus', 'Objects & Activities', '/assets/fire-emojis/svg/obj_bus.svg', ['bus', 'travel', 'journey']),
  item('obj_train', 'Flame Express Train', 'Objects & Activities', '/assets/fire-emojis/svg/obj_train.svg', ['train', 'metro', 'dhaka', 'express']),
  item('obj_boat', 'Flame Sailboat', 'Objects & Activities', '/assets/fire-emojis/svg/obj_boat.svg', ['boat', 'nouka', 'river', 'padma']),
  item('obj_airplane', 'Flame Airplane', 'Objects & Activities', '/assets/fire-emojis/svg/obj_airplane.svg', ['plane', 'flight', 'travel', 'sky']),
];

export const FIRE_EMOJI_MAP: Record<string, FireEmojiItem> = Object.fromEntries(
  FIRE_EMOJI_CATALOG.map((emoji) => [emoji.id, emoji])
);
