import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize, 
  Sparkles, 
  Clock, 
  Eye, 
  AlertCircle, 
  RotateCw,
  Search,
  X,
  ExternalLink,
  Lock,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { VIDEO_COLLECTION } from './videos';

// Helper to format seconds as MM:SS
function formatTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export default function App() {
  const [selectedVideoId, setSelectedVideoId] = useState(VIDEO_COLLECTION[0].id);
  const selectedVideo = VIDEO_COLLECTION.find((v) => v.id === selectedVideoId) || VIDEO_COLLECTION[0];
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Interactive player states
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // 5s Interstitial popup state
  const [showInterstitial, setShowInterstitial] = useState(false);
  const [hasClickedJoin, setHasClickedJoin] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifySuccess, setVerifySuccess] = useState(false);

  useEffect(() => {
    // Initialize Telegram WebApp SDK if running inside Telegram
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
    }

    // Check if already verified
    const isAlreadyVerified = localStorage.getItem('miniapp_verified');
    if (isAlreadyVerified === 'true') {
      return;
    }

    // Show interstitial popup 5 seconds after app opens
    const timer = setTimeout(() => {
      setShowInterstitial(true);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  const handleJoinMiniApp = () => {
    const tgUrl = 'https://t.me/AppleFarmOfficialBot/App';
    // Use Telegram WebApp native link opener if available
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(tgUrl);
    } else {
      window.open(tgUrl, '_blank', 'noopener,noreferrer');
    }
    setHasClickedJoin(true);
  };

  const handleUnlockAndContinue = async () => {
    setIsVerifying(true);
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    const userId = tgUser?.id || null;
    const username = tgUser?.username || tgUser?.first_name || 'telegram_user';

    try {
      const res = await fetch('/api/verify-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          username,
          initData: window.Telegram?.WebApp?.initData || '',
          action: 'miniapp_join_verification',
          bot: 'AppleFarmOfficialBot',
          timestamp: new Date().toISOString()
        })
      });
      await res.json();
      
      setVerifySuccess(true);
      setTimeout(() => {
        setIsVerifying(false);
        setVerifySuccess(false);
        setShowInterstitial(false);
        localStorage.setItem('miniapp_verified', 'true');
      }, 1200);
    } catch (err) {
      console.warn('Verification fallback:', err);
      setVerifySuccess(true);
      setTimeout(() => {
        setIsVerifying(false);
        setVerifySuccess(false);
        setShowInterstitial(false);
        localStorage.setItem('miniapp_verified', 'true');
      }, 1000);
    }
  };

  const playerContainerRef = useRef(null);
  const loadingTimerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);

  // Clean timer utility
  const clearLoadingTimer = () => {
    if (loadingTimerRef.current) {
      clearTimeout(loadingTimerRef.current);
      loadingTimerRef.current = null;
    }
  };

  // Start buffering and then fail after ~3.5 seconds
  const startLoadingAndFail = () => {
    clearLoadingTimer();
    setErrorMessage(null);
    setIsLoading(true);

    loadingTimerRef.current = setTimeout(() => {
      setIsLoading(false);
      setErrorMessage('Server Overload: High Traffic Detected');
    }, 3500);
  };

  // Click Play button
  const handlePlayClick = () => {
    startLoadingAndFail();
  };

  // Click Similar Video Card
  const handleSelectVideo = (video) => {
    if (selectedVideoId === video.id && isLoading) return;
    setSelectedVideoId(video.id);
    setCurrentTime(0);
    startLoadingAndFail();
  };

  // Scrub timeline / Progress bar drag
  const handleSeekChange = (e) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    triggerControlsVisibility();
  };

  // Reset controls hide timer
  const triggerControlsVisibility = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(true); // Keep accessible or subtle
    }, 4000);
  };

  // Toggle Mute
  const toggleMute = () => {
    setIsMuted(!isMuted);
    triggerControlsVisibility();
  };

  // Toggle Fullscreen on player container
  const toggleFullscreen = () => {
    const container = playerContainerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      if (container.requestFullscreen) {
        container.requestFullscreen();
      } else if (container.webkitRequestFullscreen) {
        container.webkitRequestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  // Listen to browser fullscreen changes
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      clearLoadingTimer();
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  // Filter 4 similar videos (excluding currently selected main video, and filter by search query if typed)
  const similarVideos = VIDEO_COLLECTION.filter((v) => {
    const isNotSelected = v.id !== selectedVideo.id;
    if (!searchQuery.trim()) return isNotSelected;
    const q = searchQuery.toLowerCase().trim();
    const matches = 
      v.title.toLowerCase().includes(q) ||
      v.category.toLowerCase().includes(q) ||
      v.description.toLowerCase().includes(q);
    return isNotSelected && matches;
  });

  // Progress percentage
  const progressPercent = selectedVideo.durationSec > 0 
    ? (currentTime / selectedVideo.durationSec) * 100 
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#24685b] via-[#1f584d] to-[#143e36] text-white flex justify-center py-4 px-3 sm:px-4">
      {/* Centered Mobile-Responsive SPA Container (max-width around 430px) */}
      <main 
        className="w-full max-w-[430px] flex flex-col space-y-4"
        aria-label="Catch Video SPA"
      >
        {/* Search Bar (Replaces header) */}
        <header className="w-full">
          <div 
            id="app-search-bar"
            className="w-full bg-white text-gray-900 rounded-2xl py-2.5 px-4 shadow-lg shadow-teal-950/20 flex items-center gap-2.5 transition-all focus-within:ring-2 focus-within:ring-teal-400"
          >
            <Search className="w-5 h-5 text-gray-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search videos, topics..."
              className="w-full bg-transparent text-sm sm:text-base font-medium text-gray-800 placeholder-gray-400 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="p-1 text-gray-400 hover:text-gray-700 transition-colors"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </header>

        {/* Network Error Toast / Banner when play fails */}
        {errorMessage && (
          <div 
            role="alert"
            className="p-3.5 rounded-2xl bg-rose-950/85 border border-rose-500/50 backdrop-blur-md shadow-xl text-rose-100 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300"
          >
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs">
              <p className="font-bold text-rose-200">{errorMessage}</p>
              <p className="text-[11px] text-rose-300/80 mt-0.5 leading-snug">
                Streaming servers are temporarily overwhelmed by peak viewer traffic. Please wait a moment and retry.
              </p>
              <div className="mt-2.5 flex items-center gap-2">
                <button
                  onClick={startLoadingAndFail}
                  className="px-2.5 py-1 bg-rose-500/25 hover:bg-rose-500/35 text-rose-200 rounded-lg font-semibold text-[11px] transition-colors border border-rose-400/30 flex items-center gap-1.5"
                >
                  <RotateCw className="w-3 h-3" />
                  Retry
                </button>
                <button
                  onClick={() => setErrorMessage(null)}
                  className="px-2 py-1 text-rose-300 hover:text-white text-[11px] transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
            <button 
              onClick={() => setErrorMessage(null)}
              className="text-rose-400 hover:text-white transition-colors"
              aria-label="Close error"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 2. Main Video Player Area (Image acts as Video) */}
        <section aria-label="Main Video Player" className="space-y-2">
          <div 
            ref={playerContainerRef}
            id="main-video-player"
            onMouseMove={triggerControlsVisibility}
            onTouchStart={triggerControlsVisibility}
            className={`relative aspect-video w-full rounded-2xl sm:rounded-3xl overflow-hidden bg-black shadow-xl shadow-teal-950/50 border border-teal-400/20 select-none group ${
              isFullscreen ? 'fixed inset-0 z-50 rounded-none w-screen h-screen' : ''
            }`}
          >
            {/* Thumbnail Image acting as the Video Display */}
            <img
              src={selectedVideo.thumbnail}
              alt={selectedVideo.title}
              className={`w-full h-full object-cover transition-all duration-500 ${
                isLoading ? 'brightness-50 scale-102 filter blur-[1px]' : 'brightness-90 group-hover:brightness-95'
              }`}
            />

            {/* Gradient Vignette Shade for Player Controls */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/40 pointer-events-none" />

            {/* Top Bar Badges */}
            <div className="absolute top-3 left-3 right-3 flex justify-between items-center pointer-events-none z-10">
              <span className="px-2.5 py-0.5 text-[11px] font-bold tracking-wider bg-black/60 backdrop-blur-md rounded-md text-teal-300 border border-teal-300/30 shadow">
                HD
              </span>
              <span className="px-2 py-0.5 text-[11px] font-mono font-medium bg-black/60 backdrop-blur-md rounded-md text-gray-200">
                {selectedVideo.durationFormatted}
              </span>
            </div>

            {/* Buffering Loading Spinner Overlay (YouTube/Netflix minimal style) */}
            {isLoading && (
              <div 
                id="buffering-overlay"
                className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-30 transition-all duration-300 animate-in fade-in"
              >
                <div className="relative w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center">
                  <div className="w-full h-full rounded-full border-[3px] border-white/20" />
                  <div className="absolute inset-0 w-full h-full rounded-full border-[3px] border-transparent border-t-teal-400 border-r-teal-300 animate-buffering" />
                </div>
              </div>
            )}

            {/* Center Big Circular Play Button (shown by default when not loading) */}
            {!isLoading && (
              <button
                id="center-play-button"
                onClick={handlePlayClick}
                aria-label={`Play ${selectedVideo.title}`}
                className="absolute inset-0 m-auto w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-white/95 text-teal-900 hover:bg-white hover:scale-110 active:scale-95 transition-all duration-300 flex items-center justify-center shadow-2xl shadow-black/80 z-20 group-hover:ring-8 group-hover:ring-teal-400/30 focus:outline-none"
              >
                <Play className="w-7 h-7 sm:w-8 sm:h-8 fill-current ml-1 text-teal-900" />
              </button>
            )}

            {/* Bottom Real Video Controls Bar (Interactive Scrubber, Time, Fullscreen) */}
            <div 
              className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent pt-6 pb-2.5 px-3 z-20 flex flex-col gap-1.5 transition-opacity duration-300 ${
                showControls ? 'opacity-100' : 'opacity-80'
              }`}
            >
              {/* Interactive Timeline Process Bar (User can drag/scrub!) */}
              <div className="relative w-full flex items-center group/scrubber cursor-pointer py-1">
                {/* Background Track */}
                <div className="w-full h-1.5 bg-white/25 rounded-full overflow-hidden relative">
                  {/* Played Progress Bar */}
                  <div 
                    className="absolute top-0 left-0 h-full bg-teal-400 rounded-full transition-all duration-75"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                {/* Range Input for Dragging & Seeking freely */}
                <input
                  type="range"
                  min="0"
                  max={selectedVideo.durationSec}
                  step="1"
                  value={currentTime}
                  onChange={handleSeekChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  aria-label="Video scrubber"
                />

                {/* Scrubber Knob */}
                <div 
                  className="absolute w-3.5 h-3.5 bg-white rounded-full shadow-lg pointer-events-none transform -translate-x-1/2 transition-transform duration-75 group-hover/scrubber:scale-125"
                  style={{ left: `${progressPercent}%` }}
                />
              </div>

              {/* Controls Row: Play, Mute, Time Counter, Fullscreen */}
              <div className="flex items-center justify-between text-white text-xs pt-0.5">
                <div className="flex items-center gap-3">
                  {/* Play icon button */}
                  <button
                    onClick={handlePlayClick}
                    className="p-1 hover:text-teal-300 transition-colors focus:outline-none"
                    aria-label="Play"
                  >
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  </button>

                  {/* Volume / Mute */}
                  <button
                    onClick={toggleMute}
                    className="p-1 hover:text-teal-300 transition-colors focus:outline-none"
                    aria-label={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? (
                      <VolumeX className="w-4 h-4 text-rose-400" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>

                  {/* Dynamic Time Counter (Updates with scrubber!) */}
                  <span className="font-mono text-[11px] text-gray-200 tracking-tight select-none">
                    {formatTime(currentTime)} / {selectedVideo.durationFormatted}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Fullscreen Toggle Button */}
                  <button
                    onClick={toggleFullscreen}
                    className="p-1 hover:text-teal-300 transition-colors focus:outline-none"
                    aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                  >
                    {isFullscreen ? (
                      <Minimize className="w-4 h-4" />
                    ) : (
                      <Maximize className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Active Video Info Card */}
          <div className="p-3 bg-black/20 rounded-2xl border border-teal-400/10 backdrop-blur-xs flex flex-col gap-1">
            <h2 className="text-sm font-bold text-white tracking-tight leading-snug">
              {selectedVideo.title}
            </h2>
            <div className="flex items-center gap-3 text-[11px] text-teal-200/80">
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3 text-teal-400" /> {selectedVideo.views} views
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-teal-400" /> {selectedVideo.durationFormatted}
              </span>
              <span>•</span>
              <span className="text-emerald-300 font-medium">Full HD</span>
            </div>
            <p className="text-[11px] text-teal-100/70 mt-0.5 line-clamp-2">
              {selectedVideo.description}
            </p>
          </div>
        </section>

        {/* 3. Section Title: "Similar Videos" in white/subtle light text */}
        <section aria-label="Similar Videos Section" className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-white text-sm sm:text-base font-semibold tracking-wide flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-300" />
              Similar Videos
            </h3>
            <span className="text-[11px] text-teal-200/70 font-medium">
              Click card to select
            </span>
          </div>

          {/* 4. Thumbnails Grid / Empty State */}
          {similarVideos.length > 0 ? (
            <div 
              id="similar-videos-grid"
              className="grid grid-cols-2 gap-3"
            >
              {similarVideos.map((video) => (
                <div
                  key={video.id}
                  onClick={() => handleSelectVideo(video)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelectVideo(video);
                    }
                  }}
                  className="group flex flex-col bg-black/30 hover:bg-black/50 active:scale-97 border border-teal-400/20 hover:border-teal-300/50 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 shadow-md hover:shadow-teal-950/60 focus:outline-none focus:ring-2 focus:ring-teal-400"
                >
                  {/* Thumbnail Container */}
                  <div className="relative aspect-video w-full overflow-hidden bg-black/50">
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-108"
                    />

                    {/* Gradient Shade */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

                    {/* Hover Play Button */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <div className="w-8 h-8 rounded-full bg-white/95 text-teal-900 flex items-center justify-center shadow-lg transform group-hover:scale-105 transition-transform">
                        <Play className="w-4 h-4 fill-current ml-0.5 text-teal-900" />
                      </div>
                    </div>

                    {/* Top Left HD Badge */}
                    <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider bg-black/70 text-teal-300 backdrop-blur-xs border border-teal-300/25">
                      HD
                    </span>

                    {/* Duration Badge */}
                    <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-black/70 text-gray-200 backdrop-blur-xs">
                      {video.durationFormatted}
                    </span>
                  </div>

                  {/* Metadata */}
                  <div className="p-2.5 flex-1 flex flex-col justify-between">
                    <h4 className="text-xs font-semibold text-white/90 group-hover:text-teal-200 transition-colors line-clamp-2 leading-tight">
                      {video.title}
                    </h4>
                    <div className="mt-1.5 flex items-center justify-between text-[10px] text-teal-200/70">
                      <span className="px-1.5 py-0.2 rounded text-[10px] text-teal-300 bg-teal-950/60 font-bold border border-teal-400/20">
                        HD
                      </span>
                      <span>{video.views}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center bg-black/20 rounded-2xl border border-teal-400/10">
              <p className="text-xs text-teal-100/80">No videos found matching "{searchQuery}"</p>
              <button
                onClick={() => setSearchQuery('')}
                className="mt-2 text-xs text-teal-300 hover:text-white underline font-semibold"
              >
                Clear Search
              </button>
            </div>
          )}
        </section>
      </main>

      {/* Interstitial Action Lock Modal (Triggered after 5s) */}
      {showInterstitial && (
        <div 
          id="interstitial-modal"
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-300"
        >
          <div 
            className="w-full max-w-[390px] bg-gradient-to-b from-[#18483e] via-[#10322b] to-[#0a231e] border border-emerald-400/40 rounded-3xl p-6 text-center shadow-2xl shadow-black/80 flex flex-col items-center gap-4 relative animate-in zoom-in-95 duration-300"
          >
            {/* Action Required Tag */}
            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[11px] font-bold rounded-full uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              Action Required
            </span>

            {/* Modal Title & Description */}
            <div className="space-y-1.5">
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Join Mini App to Continue
              </h3>
              <p className="text-xs text-teal-100/80 leading-relaxed px-2">
                অ্যাপটি চালিয়ে যেতে এবং সকল ভিডিও আনলক করতে অফিসিয়াল টেলিগ্রাম মিনি অ্যাপে জয়েন করুন।
              </p>
            </div>

            {/* Primary Action Button */}
            <div className="w-full space-y-2.5 pt-1">
              <button
                onClick={handleJoinMiniApp}
                id="join-miniapp-button"
                className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-300 hover:from-emerald-300 hover:to-teal-200 text-teal-950 font-bold text-sm rounded-2xl shadow-lg shadow-emerald-500/25 active:scale-98 transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-emerald-300 cursor-pointer"
              >
                <span>Join Mini App</span>
                <ExternalLink className="w-4 h-4 text-teal-950" />
              </button>

              {/* Unlock / Continue button */}
              {hasClickedJoin ? (
                <button
                  onClick={handleUnlockAndContinue}
                  disabled={isVerifying}
                  id="unlock-continue-button"
                  className={`w-full py-3 px-4 rounded-xl border font-semibold text-xs transition-all flex items-center justify-center gap-2 animate-in fade-in cursor-pointer ${
                    verifySuccess 
                      ? 'bg-emerald-500/25 text-emerald-200 border-emerald-400/50 shadow-lg shadow-emerald-950/50' 
                      : isVerifying
                      ? 'bg-teal-900/40 text-teal-200 border-teal-500/40 cursor-wait'
                      : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
                  }`}
                >
                  {isVerifying ? (
                    verifySuccess ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 animate-bounce" />
                        <span>Verified with Telegram! Unlocking...</span>
                      </>
                    ) : (
                      <>
                        <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                        <span>Verifying with Telegram Bot...</span>
                      </>
                    )
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>I've Joined — Continue to App</span>
                    </>
                  )}
                </button>
              ) : (
                <p className="text-[11px] text-teal-200/60 flex items-center justify-center gap-1.5 pt-1">
                  <Lock className="w-3 h-3 text-teal-400/80" />
                  <span>Click join above to unlock the app</span>
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
