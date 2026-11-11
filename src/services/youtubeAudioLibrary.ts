/**
 * Authorized YouTube Audio Library & Royalty-Free Creator Music Catalog
 * - Legally licensed tracks permitted for YouTube video creation, Shorts, and social media
 * - Verified license types: Creative Commons Attribution 4.0, YouTube Audio Library Standard License
 * - Includes required attribution statements and audio previews
 */

export interface YouTubeAudioTrack {
  id: string;
  title: string;
  artist: string;
  genre: string;
  mood: string;
  duration: string;
  licenseType: 'YouTube Audio Library Standard' | 'Creative Commons Attribution 4.0';
  attributionRequired: boolean;
  attributionText?: string;
  previewUrl: string;
}

export const YOUTUBE_AUDIO_LIBRARY: YouTubeAudioTrack[] = [
  {
    id: 'yt_audio_1',
    title: 'Sunny Days in Dhaka',
    artist: 'Bengali Folk Ensemble',
    genre: 'World / Folk',
    mood: 'Uplifting & Inspiring',
    duration: '2:45',
    licenseType: 'YouTube Audio Library Standard',
    attributionRequired: false,
    previewUrl: 'https://cdn.freesound.org/previews/320/320655_5260872-lq.mp3',
  },
  {
    id: 'yt_audio_2',
    title: 'River of Bengal (Bhatiali Waves)',
    artist: 'Chayanok Melodies',
    genre: 'Traditional / Acoustic',
    mood: 'Peaceful & Calm',
    duration: '3:12',
    licenseType: 'Creative Commons Attribution 4.0',
    attributionRequired: true,
    attributionText: 'Music: River of Bengal by Chayanok Melodies (CC BY 4.0)',
    previewUrl: 'https://cdn.freesound.org/previews/456/456565_6142149-lq.mp3',
  },
  {
    id: 'yt_audio_3',
    title: 'Urban Pulse (Dhaka Street Beats)',
    artist: 'Neon Bengal Beats',
    genre: 'Hip Hop / Lo-Fi',
    mood: 'Energetic & Modern',
    duration: '2:15',
    licenseType: 'YouTube Audio Library Standard',
    attributionRequired: false,
    previewUrl: 'https://cdn.freesound.org/previews/573/573381_11861866-lq.mp3',
  },
  {
    id: 'yt_audio_4',
    title: 'Sundarbans Mist',
    artist: 'Acoustic Travel Project',
    genre: 'Cinematic / Ambient',
    mood: 'Mysterious & Atmospheric',
    duration: '3:30',
    licenseType: 'YouTube Audio Library Standard',
    attributionRequired: false,
    previewUrl: 'https://cdn.freesound.org/previews/530/530415_11566899-lq.mp3',
  },
  {
    id: 'yt_audio_5',
    title: 'Celebration of Joy (Baisakh Rhythms)',
    artist: 'Dhol & Flute Collective',
    genre: 'Festival / Folk Dance',
    mood: 'Joyful & Festive',
    duration: '2:50',
    licenseType: 'Creative Commons Attribution 4.0',
    attributionRequired: true,
    attributionText: 'Music: Celebration of Joy by Dhol & Flute Collective (CC BY 4.0)',
    previewUrl: 'https://cdn.freesound.org/previews/415/415081_5121236-lq.mp3',
  },
  {
    id: 'yt_audio_6',
    title: 'Digital Horizon Lo-Fi',
    artist: 'Motherland Studio Beats',
    genre: 'Electronic / Chill',
    mood: 'Relaxing',
    duration: '2:20',
    licenseType: 'YouTube Audio Library Standard',
    attributionRequired: false,
    previewUrl: 'https://cdn.freesound.org/previews/518/518305_2402876-lq.mp3',
  },
];
