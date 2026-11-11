import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Play,
  Pause,
  Sliders,
  Music,
  Type,
  Crop,
  Check,
  Volume2,
  VolumeX,
  Sparkles,
  Download,
  Share2,
  RefreshCw,
  Search,
} from 'lucide-react';
import {
  YOUTUBE_AUDIO_LIBRARY,
  YouTubeAudioTrack,
} from '../../services/youtubeAudioLibrary';

interface VideoEditorStudioProps {
  isOpen: boolean;
  onClose: () => void;
  initialVideoUrl?: string;
  onSaveExport?: (editedData: {
    videoUrl: string;
    aspectRatio: string;
    filter: string;
    textOverlay?: string;
    audioTrack?: YouTubeAudioTrack;
  }) => void;
}

export const VideoEditorStudio: React.FC<VideoEditorStudioProps> = ({
  isOpen,
  onClose,
  initialVideoUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  onSaveExport,
}) => {
  const [activeTab, setActiveTab] = useState<'filters' | 'adjust' | 'ratio' | 'text' | 'audio'>('filters');
  const [isPlaying, setIsPlaying] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1' | '4:5'>('16:9');

  // Video adjustments
  const [selectedFilter, setSelectedFilter] = useState<string>('normal');
  const [brightness, setBrightness] = useState<number>(100);
  const [contrast, setContrast] = useState<number>(100);
  const [saturation, setSaturation] = useState<number>(100);

  // Text overlay
  const [overlayText, setOverlayText] = useState<string>('');
  const [textColor, setTextColor] = useState<string>('#ffffff');
  const [textBg, setTextBg] = useState<boolean>(true);
  const [textPosition, setTextPosition] = useState<'top' | 'center' | 'bottom'>('bottom');

  // Audio Track from YouTube Audio Library
  const [audioSearchQuery, setAudioSearchQuery] = useState('');
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<YouTubeAudioTrack | null>(null);
  const [audioPlaying, setAudioPlaying] = useState<boolean>(false);
  const [musicVolume, setMusicVolume] = useState<number>(75);
  const [originalVolume, setOriginalVolume] = useState<number>(100);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const filterPresets = [
    { id: 'normal', name: 'Normal', css: 'none' },
    { id: 'vivid', name: 'Vivid Bangla', css: 'saturate(1.4) contrast(1.1)' },
    { id: 'warm', name: 'Warm Sunset', css: 'sepia(0.25) saturate(1.25) hue-rotate(-10deg)' },
    { id: 'cinematic', name: 'Cinematic Teal', css: 'contrast(1.15) hue-rotate(15deg) saturate(1.1)' },
    { id: 'vintage', name: 'Vintage Film', css: 'contrast(1.2) brightness(0.9) sepia(0.3)' },
    { id: 'noir', name: 'Noir B&W', css: 'grayscale(1) contrast(1.25)' },
  ];

  const getCombinedFilter = () => {
    const preset = filterPresets.find((f) => f.id === selectedFilter);
    const baseCss = preset && preset.css !== 'none' ? preset.css : '';
    const adjustCss = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
    return baseCss ? `${baseCss} ${adjustCss}` : adjustCss;
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
      if (selectedAudioTrack && audioRef.current) {
        audioRef.current.play();
        setAudioPlaying(true);
      }
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      if (audioRef.current) {
        audioRef.current.pause();
        setAudioPlaying(false);
      }
    }
  };

  const handleSelectAudio = (track: YouTubeAudioTrack) => {
    if (selectedAudioTrack?.id === track.id) {
      if (audioPlaying) {
        audioRef.current?.pause();
        setAudioPlaying(false);
      } else {
        audioRef.current?.play();
        setAudioPlaying(true);
      }
    } else {
      setSelectedAudioTrack(track);
      setAudioPlaying(true);
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.volume = musicVolume / 100;
          audioRef.current.play().catch(() => {});
        }
      }, 50);
    }
  };

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = originalVolume / 100;
    }
  }, [originalVolume]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = musicVolume / 100;
    }
  }, [musicVolume]);

  const handleExport = () => {
    if (onSaveExport) {
      onSaveExport({
        videoUrl: initialVideoUrl,
        aspectRatio,
        filter: getCombinedFilter(),
        textOverlay: overlayText.trim() || undefined,
        audioTrack: selectedAudioTrack || undefined,
      });
    }
    onClose();
  };

  const filteredAudioTracks = YOUTUBE_AUDIO_LIBRARY.filter((track) => {
    return (
      !audioSearchQuery.trim() ||
      track.title.toLowerCase().includes(audioSearchQuery.toLowerCase()) ||
      track.artist.toLowerCase().includes(audioSearchQuery.toLowerCase()) ||
      track.genre.toLowerCase().includes(audioSearchQuery.toLowerCase()) ||
      track.mood.toLowerCase().includes(audioSearchQuery.toLowerCase())
    );
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-md">
      <div className="w-full max-w-4xl h-[92vh] max-h-[820px] bg-[#0c101c] border border-white/10 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between bg-[#111728]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">MOTHERLAND Video Studio</h3>
              <p className="text-[11px] text-slate-400">
                Creator filters, ratio cropping, text overlay & YouTube Audio Library
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-950/40"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Apply & Save</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Studio Body: Canvas + Tools */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          {/* Left Canvas Preview Area */}
          <div className="flex-1 bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden select-none">
            {/* Aspect container */}
            <div
              className={`relative bg-[#05070a] rounded-2xl overflow-hidden border border-white/15 flex items-center justify-center shadow-2xl transition-all duration-300 ${
                aspectRatio === '16:9'
                  ? 'w-full max-w-lg aspect-video'
                  : aspectRatio === '9:16'
                  ? 'h-[90%] aspect-[9/16]'
                  : aspectRatio === '1:1'
                  ? 'h-[80%] aspect-square'
                  : 'h-[85%] aspect-[4/5]'
              }`}
            >
              <video
                ref={videoRef}
                src={initialVideoUrl}
                playsInline
                loop
                onClick={togglePlay}
                className="w-full h-full object-cover cursor-pointer"
                style={{ filter: getCombinedFilter() }}
              />

              {/* Text Overlay on Canvas */}
              {overlayText.trim() && (
                <div
                  className={`absolute left-4 right-4 text-center pointer-events-none transition-all ${
                    textPosition === 'top'
                      ? 'top-4'
                      : textPosition === 'center'
                      ? 'top-1/2 -translate-y-1/2'
                      : 'bottom-4'
                  }`}
                >
                  <span
                    className={`inline-block px-3 py-1.5 rounded-xl font-bold text-sm sm:text-base tracking-wide max-w-full drop-shadow-md ${
                      textBg ? 'bg-black/75 backdrop-blur-xs' : ''
                    }`}
                    style={{ color: textColor }}
                  >
                    {overlayText}
                  </span>
                </div>
              )}

              {/* Play / Pause Floating Overlay Button */}
              <button
                onClick={togglePlay}
                className={`absolute inset-0 m-auto w-14 h-14 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-xs text-white flex items-center justify-center transition-all ${
                  isPlaying ? 'opacity-0 hover:opacity-100' : 'opacity-100'
                }`}
              >
                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
              </button>

              {/* Active Audio Indicator */}
              {selectedAudioTrack && (
                <div className="absolute top-2 left-2 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-xs border border-emerald-500/30 text-[10px] text-emerald-300 font-mono flex items-center gap-1.5">
                  <Music className="w-3 h-3 text-emerald-400" />
                  <span className="truncate max-w-[120px]">{selectedAudioTrack.title}</span>
                </div>
              )}
            </div>

            {/* Hidden audio element for YouTube Audio Library track */}
            {selectedAudioTrack && (
              <audio ref={audioRef} src={selectedAudioTrack.previewUrl} loop />
            )}
          </div>

          {/* Right Tools Controls Sidebar */}
          <div className="w-full md:w-80 bg-[#0f1424] border-t md:border-t-0 md:border-l border-white/10 flex flex-col h-72 md:h-full">
            {/* Tool Category Selector Bar */}
            <div className="flex items-center justify-around border-b border-white/10 p-1.5 bg-[#12182b] text-xs">
              <button
                onClick={() => setActiveTab('filters')}
                className={`flex-1 py-2 rounded-xl flex flex-col items-center gap-1 transition-all ${
                  activeTab === 'filters'
                    ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span className="text-[10px]">Filters</span>
              </button>

              <button
                onClick={() => setActiveTab('adjust')}
                className={`flex-1 py-2 rounded-xl flex flex-col items-center gap-1 transition-all ${
                  activeTab === 'adjust'
                    ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sliders className="w-4 h-4" />
                <span className="text-[10px]">Adjust</span>
              </button>

              <button
                onClick={() => setActiveTab('ratio')}
                className={`flex-1 py-2 rounded-xl flex flex-col items-center gap-1 transition-all ${
                  activeTab === 'ratio'
                    ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Crop className="w-4 h-4" />
                <span className="text-[10px]">Ratio</span>
              </button>

              <button
                onClick={() => setActiveTab('text')}
                className={`flex-1 py-2 rounded-xl flex flex-col items-center gap-1 transition-all ${
                  activeTab === 'text'
                    ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Type className="w-4 h-4" />
                <span className="text-[10px]">Text</span>
              </button>

              <button
                onClick={() => setActiveTab('audio')}
                className={`flex-1 py-2 rounded-xl flex flex-col items-center gap-1 transition-all ${
                  activeTab === 'audio'
                    ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Music className="w-4 h-4" />
                <span className="text-[10px]">Audio</span>
              </button>
            </div>

            {/* Tool Content Panels */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
              {/* 1. FILTERS TAB */}
              {activeTab === 'filters' && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Cinematic Presets
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {filterPresets.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setSelectedFilter(f.id)}
                        className={`p-3 rounded-2xl border text-left transition-all ${
                          selectedFilter === f.id
                            ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-md'
                            : 'bg-white/5 border-white/5 hover:bg-white/10 text-slate-300'
                        }`}
                      >
                        <span className="font-semibold text-xs block">{f.name}</span>
                        <span className="text-[10px] text-slate-400">
                          {f.id === 'normal' ? 'Original palette' : 'Color graded'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. ADJUSTMENTS TAB */}
              {activeTab === 'adjust' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Color Tuning
                    </h4>
                    <button
                      onClick={() => {
                        setBrightness(100);
                        setContrast(100);
                        setSaturation(100);
                      }}
                      className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Reset</span>
                    </button>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <div className="flex justify-between text-slate-300 mb-1">
                        <span>Brightness</span>
                        <span className="font-mono text-emerald-400">{brightness}%</span>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="150"
                        value={brightness}
                        onChange={(e) => setBrightness(Number(e.target.value))}
                        className="w-full accent-emerald-500 h-1.5 bg-white/10 rounded-lg cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-slate-300 mb-1">
                        <span>Contrast</span>
                        <span className="font-mono text-emerald-400">{contrast}%</span>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="150"
                        value={contrast}
                        onChange={(e) => setContrast(Number(e.target.value))}
                        className="w-full accent-emerald-500 h-1.5 bg-white/10 rounded-lg cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-slate-300 mb-1">
                        <span>Saturation</span>
                        <span className="font-mono text-emerald-400">{saturation}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="200"
                        value={saturation}
                        onChange={(e) => setSaturation(Number(e.target.value))}
                        className="w-full accent-emerald-500 h-1.5 bg-white/10 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 3. ASPECT RATIO TAB */}
              {activeTab === 'ratio' && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Crop & Aspect Ratio
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: '16:9', label: '16:9 Landscape', desc: 'YouTube & Standard Feed' },
                      { id: '9:16', label: '9:16 Vertical', desc: 'Shorts & Stories' },
                      { id: '1:1', label: '1:1 Square', desc: 'Classic Feed Post' },
                      { id: '4:5', label: '4:5 Portrait', desc: 'Mobile Tall Card' },
                    ].map((r) => (
                      <button
                        key={r.id}
                        onClick={() => setAspectRatio(r.id as any)}
                        className={`p-3 rounded-2xl border text-left transition-all ${
                          aspectRatio === r.id
                            ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-md'
                            : 'bg-white/5 border-white/5 hover:bg-white/10 text-slate-300'
                        }`}
                      >
                        <span className="font-bold text-xs block text-emerald-400 font-mono">
                          {r.id}
                        </span>
                        <span className="text-xs font-semibold text-white block mt-0.5">
                          {r.label}
                        </span>
                        <span className="text-[10px] text-slate-400">{r.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. TEXT OVERLAY TAB */}
              {activeTab === 'text' && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Text Overlay
                  </h4>
                  <input
                    type="text"
                    placeholder="Type caption or title..."
                    value={overlayText}
                    onChange={(e) => setOverlayText(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs placeholder:text-slate-500 focus:outline-hidden focus:border-emerald-500"
                  />

                  <div className="space-y-2 pt-2">
                    <span className="text-[11px] text-slate-400 block">Position</span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['top', 'center', 'bottom'] as const).map((pos) => (
                        <button
                          key={pos}
                          onClick={() => setTextPosition(pos)}
                          className={`py-1.5 rounded-xl text-xs font-medium capitalize border transition-all ${
                            textPosition === pos
                              ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                              : 'bg-white/5 border-white/5 text-slate-400'
                          }`}
                        >
                          {pos}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <span className="text-[11px] text-slate-400 block">Color</span>
                    <div className="flex items-center gap-2">
                      {['#ffffff', '#facc15', '#22d3ee', '#34d399', '#f87171'].map((c) => (
                        <button
                          key={c}
                          onClick={() => setTextColor(c)}
                          className={`w-7 h-7 rounded-full border-2 transition-transform ${
                            textColor === c ? 'scale-110 border-white' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>

                  <label className="flex items-center gap-2 pt-2 cursor-pointer text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={textBg}
                      onChange={(e) => setTextBg(e.target.checked)}
                      className="accent-emerald-500 rounded-sm"
                    />
                    <span>Add dark readable background banner</span>
                  </label>
                </div>
              )}

              {/* 5. AUDIO & YOUTUBE AUDIO LIBRARY TAB */}
              {activeTab === 'audio' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      YouTube Audio Library
                    </h4>
                    {selectedAudioTrack && (
                      <button
                        onClick={() => {
                          setSelectedAudioTrack(null);
                          setAudioPlaying(false);
                          if (audioRef.current) audioRef.current.pause();
                        }}
                        className="text-[10px] text-red-400 hover:underline"
                      >
                        Remove Music
                      </button>
                    )}
                  </div>

                  {/* Volume Sliders */}
                  <div className="p-3 rounded-2xl bg-white/5 border border-white/5 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-300">
                      <span>Music Volume</span>
                      <span className="font-mono text-emerald-400">{musicVolume}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={musicVolume}
                      onChange={(e) => setMusicVolume(Number(e.target.value))}
                      className="w-full accent-emerald-500 h-1.5 bg-white/10 rounded-lg cursor-pointer"
                    />

                    <div className="flex justify-between text-slate-300 pt-1">
                      <span>Original Video Sound</span>
                      <span className="font-mono text-emerald-400">{originalVolume}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={originalVolume}
                      onChange={(e) => setOriginalVolume(Number(e.target.value))}
                      className="w-full accent-emerald-500 h-1.5 bg-white/10 rounded-lg cursor-pointer"
                    />
                  </div>

                  {/* Search Audio */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search royalty-free music & SFX..."
                      value={audioSearchQuery}
                      onChange={(e) => setAudioSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs placeholder:text-slate-500 focus:outline-hidden focus:border-emerald-500"
                    />
                  </div>

                  {/* Audio Track List */}
                  <div className="space-y-1.5 max-h-56 overflow-y-auto no-scrollbar">
                    {filteredAudioTracks.map((track) => {
                      const isSelected = selectedAudioTrack?.id === track.id;
                      return (
                        <div
                          key={track.id}
                          onClick={() => handleSelectAudio(track)}
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-emerald-500/20 border-emerald-400 text-white'
                              : 'bg-white/5 border-white/5 hover:bg-white/10 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <div className="w-7 h-7 rounded-lg bg-emerald-600/30 text-emerald-400 flex items-center justify-center flex-shrink-0">
                              {isSelected && audioPlaying ? (
                                <Pause className="w-3.5 h-3.5" />
                              ) : (
                                <Play className="w-3.5 h-3.5 ml-0.5" />
                              )}
                            </div>
                            <div className="overflow-hidden">
                              <p className="font-semibold text-xs truncate leading-tight">
                                {track.title}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate">
                                {track.artist} • {track.genre}
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 flex-shrink-0">
                            {track.duration}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
