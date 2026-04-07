
import React, { useState, useEffect, useRef } from 'react';
import { Hotspot } from '../types';
import ImageGallery from './ImageGallery';

interface HotspotInfoPanelProps {
  hotspot: Hotspot | null;
  isVisible: boolean;
  onClose?: () => void;
}

const HotspotInfoPanel: React.FC<HotspotInfoPanelProps> = ({ hotspot, isVisible, onClose }) => {
  const [displayHotspot, setDisplayHotspot] = useState<Hotspot | null>(hotspot);

  // Update the displayed content only when a new hotspot is provided,
  // but keep the previous content if hotspot becomes null to allow exit animations to show the data as it slides away.
  useEffect(() => {
    if (hotspot) {
      setDisplayHotspot(hotspot);
    }
  }, [hotspot]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollHint, setShowScrollHint] = useState(true);
  const [showVideo, setShowVideo] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Reset scroll hint when a new hotspot is displayed
  useEffect(() => {
    setShowVideo(false);
    if (hotspot) {
      setShowScrollHint(true);
      if (scrollRef.current) {
        scrollRef.current.scrollTop = 0;
      }
      // Delay iframe render to avoid GPU compositing crashes during slide animation
      const timer = setTimeout(() => setShowVideo(true), 750);
      return () => clearTimeout(timer);
    }
  }, [hotspot]);

  const getYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const youtubeId = displayHotspot?.mediaUrl ? getYouTubeId(displayHotspot.mediaUrl) : null;
  const isYouTube = !!youtubeId;

  return (
    <div 
      className={`fixed inset-0 z-[150] flex items-center justify-end md:p-6 transition-all duration-700 ease-in-out bg-transparent ${
        isVisible 
          ? 'pointer-events-auto' 
          : 'pointer-events-none'
      }`}
      onClick={onClose}
    >
      <div 
        className={`bg-black border-l md:border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.8)] flex flex-col will-change-transform transition-all duration-700 cubic-bezier(0.16, 1, 0.3, 1) ${
          isFullscreen
            ? 'fixed inset-0 w-full h-full max-w-none max-h-none rounded-none z-[200]'
            : 'w-full h-full landscape:w-[40vw] landscape:max-w-[40vw] md:max-w-[410px] md:max-h-[92vh] md:rounded-2xl'
        } ${
          isVisible ? 'translate-x-0' : 'translate-x-[calc(100%+2rem)]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {displayHotspot && (
          <>
            {/* Header */}
            <div className="px-2 py-1 md:px-2 md:py-1.5 flex justify-between items-center border-b border-white/10 shrink-0">
              <div className="flex items-center gap-1">
                <div className="w-1 h-1 rounded-full bg-[#005e99] shadow-[0_0_6px_#005e99]"></div>
                <span className="text-[4px] md:text-[5px] uppercase tracking-[0.4em] text-white/50 font-black leading-none mt-px">MURAL DETAIL</span>
              </div>
              <div className="flex items-center gap-1">
                {/* Fullscreen toggle */}
                <button
                  onClick={() => setIsFullscreen(f => !f)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-all"
                  title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                >
                  {isFullscreen ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
                  )}
                </button>
                {/* Close */}
                <button 
                  onClick={onClose}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-all"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>
            </div>
            
            {/* Scrollable Content with fade hint */}
            <div className="relative flex-1 min-h-0">
              <div 
                ref={scrollRef}
                className="h-full overflow-y-auto pt-0 pb-6 md:pb-8 custom-scrollbar"
                onScroll={(e) => {
                  const el = e.currentTarget;
                  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20;
                  const grad = el.parentElement?.querySelector('[data-fade]') as HTMLElement;
                  if (grad) grad.style.opacity = atBottom ? '0' : '1';
                  // Hide scroll hint once user scrolls down at all
                  if (el.scrollTop > 10) {
                    setShowScrollHint(false);
                  }
                }}
              >
                <div className={`transition-all duration-500 delay-300 flex flex-col ${isFullscreen ? 'max-w-3xl mx-auto w-full' : ''} ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                >

                {/* Image Gallery - Full Width */}
                  {displayHotspot.gallery && displayHotspot.gallery.length > 0 && (
                    <div className="w-full">
                      <ImageGallery images={displayHotspot.gallery} />
                    </div>
                  )}

                  <h2 className="font-serif text-2xl md:text-4xl mb-4 md:mb-6 text-white leading-tight tracking-tight px-6 md:px-8 mt-2">
                    {displayHotspot.title}
                  </h2>
                  
                  {/* Description */}
                  {displayHotspot.description && (
                    <div className="prose prose-invert max-w-none mb-6 md:mb-8 px-6 md:px-8">
                      <p className="text-white/70 text-base md:text-lg leading-relaxed font-light whitespace-pre-wrap selection:bg-[#005e99] selection:text-white">
                        {displayHotspot.description}
                      </p>
                    </div>
                  )}

                  {/* Video Embed */}
                  {displayHotspot.mediaUrl && isYouTube && (
                    <div className="rounded-lg overflow-hidden border border-white/10 bg-black/40 shadow-inner mx-6 md:mx-8 mb-6 md:mb-8 flex items-center justify-center min-h-[200px]">
                      {showVideo ? (
                        <div className="aspect-video w-full">
                          <iframe
                            src={`https://www.youtube.com/embed/${youtubeId}?autoplay=0&modestbranding=1&rel=0`}
                            className="w-full h-full"
                            title={`Video: ${displayHotspot.title}`}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            frameBorder="0"
                          />
                        </div>
                      ) : (
                        <div className="animate-pulse flex flex-col items-center gap-3">
                           <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33 2.78 2.78 0 0 0 1.94 2c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33z"/><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/></svg>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {/* Bottom fade gradient */}
              <div 
                data-fade
                className="absolute bottom-0 left-0 right-2 h-16 pointer-events-none transition-opacity duration-300"
                style={{ background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.95))' }}
              />
            </div>
            
            {/* Footer */}
            <div className="relative p-4 md:p-6 border-t border-white/5 flex items-center justify-between shrink-0">
              <div className="opacity-30 text-[7px] md:text-[8px] uppercase tracking-[0.3em] text-[#005e99] font-black">
                DIA &bull; DETROIT INSTITUTE OF ARTS
              </div>

              {/* Scroll down arrow indicator inside footer */}
              <div 
                className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-opacity duration-500 ${showScrollHint ? 'opacity-100' : 'opacity-0'}`}
              >
                <div className="flex flex-col items-center animate-bounce">
                  <span className="text-[9px] uppercase tracking-[0.2em] text-white font-bold">Scroll</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeOpacity="1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5">
                    <path d="M7 13l5 5 5-5"/>
                    <path d="M7 6l5 5 5-5"/>
                  </svg>
                </div>
              </div>

              <div className="opacity-30 text-[7px] md:text-[8px] font-mono text-white/50 uppercase">
                {displayHotspot.wallSide} WALL
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default HotspotInfoPanel;
