import { useState, useEffect, useMemo, useCallback } from 'react';
import { Header, ActiveGlobalView } from './components/layout/Header';
import { PlatformNav } from './components/layout/PlatformNav';
import { BottomNav } from './components/layout/BottomNav';
import { UnifiedFeed } from './components/video/UnifiedFeed';
import { YouTubeFullExperience } from './components/video/YouTubeFullExperience';
import { VerticalSwipeFeed } from './components/video/VerticalSwipeFeed';
import { MotherlandHomeFeed } from './components/social/MotherlandHomeFeed';
import { BangladeshServicesHub } from './components/bangladesh/BangladeshServicesHub';
import { AddVideoModal } from './components/video/AddVideoModal';
import { VideoDetailModal } from './components/video/VideoDetailModal';
import { UnifiedSocialMessenger } from './components/messenger/UnifiedSocialMessenger';
import { UserProfileModal } from './components/social/UserProfileModal';
import { ServerManagerModal } from './components/server/ServerManagerModal';
import { VerificationReportModal } from './components/diagnostics/VerificationReportModal';
import { ApiStatusBanner } from './components/diagnostics/ApiStatusBanner';
import { MotherlandSplashScreen } from './components/layout/MotherlandSplashScreen';
import { GlobalSearchModal } from './components/search/GlobalSearchModal';
import { PlatformType, UnifiedVideo } from './types/video';
import { getUnifiedVideoFeed } from './services/videoAdapter';
import {
  testYouTubeApiKey,
  YouTubeApiDiagnostic,
  getCachedYouTubeDiagnostic,
} from './services/youtubeService';

export default function App() {
  // Splash Screen on initial launch
  const [showSplash, setShowSplash] = useState<boolean>(true);

  // Global Active View
  const [activeView, setActiveView] = useState<ActiveGlobalView>('motherland_home');

  // Video feed platform filter (when viewing ALL VIDEOS or single platform feed)
  const [videoPlatformFilter, setVideoPlatformFilter] = useState<PlatformType | 'all'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [globalSearchOpen, setGlobalSearchOpen] = useState<boolean>(false);

  // Modals
  const [messengerOpen, setMessengerOpen] = useState<boolean>(false);
  const [profileOpen, setProfileOpen] = useState<boolean>(false);
  const [serverManagerOpen, setServerManagerOpen] = useState<boolean>(false);
  const [addVideoOpen, setAddVideoOpen] = useState<boolean>(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState<boolean>(false);
  const [detailVideo, setDetailVideo] = useState<UnifiedVideo | null>(null);
  const [isMobileDeviceView, setIsMobileDeviceView] = useState<boolean>(false);

  // Diagnostic state for the provided YouTube Key
  const [diagnostic, setDiagnostic] = useState<YouTubeApiDiagnostic>(getCachedYouTubeDiagnostic());

  useEffect(() => {
    testYouTubeApiKey().then((diag) => {
      setDiagnostic(diag);
    });
  }, []);

  // Compute feed videos for universal video stream
  const videos = useMemo(() => {
    return getUnifiedVideoFeed(videoPlatformFilter, selectedCategory, searchQuery);
  }, [videoPlatformFilter, selectedCategory, searchQuery]);

  // Compute platform count badges
  const platformCounts = useMemo(() => {
    const all = getUnifiedVideoFeed('all', undefined, undefined);
    return {
      all: all.length,
      youtube: all.filter((v) => v.platform === 'youtube').length,
      tiktok: all.filter((v) => v.platform === 'tiktok').length,
      instagram: all.filter((v) => v.platform === 'instagram').length,
      facebook: all.filter((v) => v.platform === 'facebook').length,
    };
  }, []);

  const handleSelectGlobalView = (view: ActiveGlobalView) => {
    setActiveView(view);
    if (view === 'all_videos') {
      setVideoPlatformFilter('all');
    } else if (view === 'youtube' || view === 'tiktok' || view === 'facebook' || view === 'instagram') {
      setVideoPlatformFilter(view);
    }
  };

  const handleResetFilters = useCallback(() => {
    setVideoPlatformFilter('all');
    setSelectedCategory('all');
    setSearchQuery('');
  }, []);

  const handleVideoAdded = useCallback((newVideo: UnifiedVideo) => {
    setActiveView('all_videos');
    setVideoPlatformFilter(newVideo.platform);
  }, []);

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col items-center justify-start selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Device wrapper */}
      <div
        className={`w-full min-h-screen flex flex-col transition-all duration-300 ${
          isMobileDeviceView
            ? 'max-w-[430px] my-6 border-[8px] border-[#1e273a] rounded-[48px] shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden bg-[#07090e]'
            : 'max-w-full'
        }`}
      >
        {/* Android Notch indicator when in preview device frame */}
        {isMobileDeviceView && (
          <div className="w-full py-2 bg-[#090d16] flex items-center justify-between px-7 text-[11px] font-mono text-slate-400 select-none border-b border-white/5">
            <span className="font-semibold text-white">9:41</span>
            <div className="w-16 h-3 bg-black rounded-full" />
            <div className="flex items-center gap-1.5 text-[10px]">
              <span>5G</span>
              <span>100%</span>
            </div>
          </div>
        )}

        {/* Global API Diagnostic Notice Banner */}
        <ApiStatusBanner
          diagnostic={diagnostic}
          onOpenDiagnostics={() => setDiagnosticsOpen(true)}
        />

        {/* Main Global Navigation (Hidden when inside Dedicated YouTube Experience so it doesn't take up space) */}
        {activeView !== 'youtube' && (
          <Header
            activeView={activeView}
            onSelectView={handleSelectGlobalView}
            onOpenMessenger={() => setMessengerOpen(true)}
            onOpenProfile={() => setProfileOpen(true)}
            onOpenServerManager={() => setServerManagerOpen(true)}
            onOpenDiagnostics={() => setDiagnosticsOpen(true)}
            onToggleSearch={() => setGlobalSearchOpen(true)}
            searchOpen={globalSearchOpen}
            isMobileDeviceView={isMobileDeviceView}
            onToggleDeviceView={() => setIsMobileDeviceView(!isMobileDeviceView)}
            ytDiagnostic={diagnostic}
          />
        )}

        {/* Main Content Area */}
        <main className="flex-1 w-full">
          {/* 1. MOTHERLAND Native Social Home Feed (Section 4 & 11A) */}
          {activeView === 'motherland_home' && (
            <MotherlandHomeFeed
              onOpenUniversalVideos={() => setActiveView('all_videos')}
              onOpenUserProfile={() => setProfileOpen(true)}
            />
          )}

          {/* 2. YouTube Full In-App Experience (Section 6) */}
          {activeView === 'youtube' && (
            <YouTubeFullExperience
              onOpenVideoDetails={(v) => setDetailVideo(v)}
              onOpenAddVideo={() => setAddVideoOpen(true)}
              onOpenVerticalShorts={() => setActiveView('tiktok')}
              onBackToMotherland={() => handleSelectGlobalView('motherland_home')}
            />
          )}

          {/* 3. BANGLADESH SERVICES (Section 12) */}
          {activeView === 'bangladesh_services' && <BangladeshServicesHub />}

          {/* 4. TIKTOK Vertical Swipe Feed (Part D Requirement) */}
          {activeView === 'tiktok' && (
            <div className="w-full h-full p-0">
              <VerticalSwipeFeed
                onOpenDetails={(v) => setDetailVideo(v)}
                onOpenMessenger={() => setMessengerOpen(true)}
              />
            </div>
          )}

          {/* 5. ALL VIDEOS / Facebook / Instagram Video Stream (Section 5, 7, 8, 9) */}
          {(activeView === 'all_videos' ||
            activeView === 'facebook' ||
            activeView === 'instagram') && (
            <>
              {/* Platform Selector Bar */}
              <PlatformNav
                activePlatform={videoPlatformFilter}
                onSelectPlatform={(p) => {
                  setVideoPlatformFilter(p);
                  if (p === 'all') setActiveView('all_videos');
                  else if (p === 'youtube') setActiveView('youtube');
                  else setActiveView(p);
                }}
                counts={platformCounts}
              />

              <UnifiedFeed
                videos={videos}
                activePlatform={videoPlatformFilter}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                onOpenAddVideo={() => setAddVideoOpen(true)}
                onOpenDetails={(v) => setDetailVideo(v)}
                searchOpen={searchOpen}
                onResetFilters={handleResetFilters}
              />
            </>
          )}
        </main>

        {/* Mobile Navigation (Hidden when inside Dedicated YouTube Experience) */}
        {activeView !== 'youtube' && (
          <BottomNav
            activeView={activeView}
            onSelectView={handleSelectGlobalView}
            onOpenMessenger={() => setMessengerOpen(true)}
            onOpenProfile={() => setProfileOpen(true)}
          />
        )}
      </div>

      {/* Modals & Dialogs */}
      <UserProfileModal
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
        onOpenImageLightbox={(url, alt) => {}}
      />

      <ServerManagerModal
        isOpen={serverManagerOpen}
        onClose={() => setServerManagerOpen(false)}
      />

      {/* Unified Social Messenger Dialog (Part B Requirement) */}
      {messengerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <UnifiedSocialMessenger onClose={() => setMessengerOpen(false)} />
        </div>
      )}

      <AddVideoModal
        isOpen={addVideoOpen}
        onClose={() => setAddVideoOpen(false)}
        onVideoAdded={handleVideoAdded}
      />

      <VideoDetailModal
        video={detailVideo}
        onClose={() => setDetailVideo(null)}
      />

      <VerificationReportModal
        isOpen={diagnosticsOpen}
        onClose={() => setDiagnosticsOpen(false)}
        diagnostic={diagnostic}
        onDiagnosticUpdated={(d) => setDiagnostic(d)}
      />

      {/* Global Multi-Platform Search Modal */}
      <GlobalSearchModal
        isOpen={globalSearchOpen}
        onClose={() => setGlobalSearchOpen(false)}
        onSelectVideo={(video) => {
          setDetailVideo(video);
          setGlobalSearchOpen(false);
        }}
        onSelectPost={() => {
          setActiveView('motherland_home');
          setGlobalSearchOpen(false);
        }}
      />

      {/* Startup Brand Splash Animation */}
      {showSplash && (
        <MotherlandSplashScreen
          durationMs={2000}
          onFinish={() => setShowSplash(false)}
        />
      )}
    </div>
  );
}
