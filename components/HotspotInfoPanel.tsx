
import React, { useState, useEffect } from 'react';
import { Hotspot, WallSide } from '../types';
import { WALLS } from '../constants';
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

  const getYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const youtubeId = displayHotspot?.mediaUrl ? getYouTubeId(displayHotspot.mediaUrl) : null;
  const isYouTube = !!youtubeId;

  // Only show wall image for the 4 main wall hotspots (title starts with "North Wall", etc.)
  const isWallOverview = displayHotspot
    ? /^(North|South|East|West)\s+Wall\b/i.test(displayHotspot.title)
    : false;
  const wallImageUrl = displayHotspot && isWallOverview
    ? WALLS.find(w => w.side === displayHotspot.wallSide)?.imageUrl
    : null;

  return (
    <div 
      className={`fixed inset-0 z-[150] flex items-center justify-end md:p-6 transition-all duration-700 ease-in-out bg-transparent ${
        isVisible 
          ? 'pointer-events-auto' 
          : 'pointer-events-none'
      }`}
      onClick={onClose} // Tapping the backdrop closes the panel
    >
      <div 
        className={`w-full h-full landscape:w-[50vw] landscape:max-w-[50vw] md:max-w-lg md:max-h-[92vh] bg-black border-l md:border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.8)] md:rounded-2xl flex flex-col transition-transform duration-700 cubic-bezier(0.16, 1, 0.3, 1) will-change-transform ${
          isVisible ? 'translate-x-0' : 'translate-x-[calc(100%+2rem)]'
        }`}
        onClick={(e) => e.stopPropagation()} // Prevent taps on the panel itself from closing it
      >
        {displayHotspot && (
          <>
            {/* Header */}
            <div className="px-3 py-2 md:px-4 md:py-2.5 flex justify-between items-center border-b border-white/10 shrink-0">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#005e99] shadow-[0_0_8px_#005e99]"></div>
                <span className="text-[5px] md:text-[6px] uppercase tracking-[0.4em] text-white/50 font-black">MURAL DETAIL</span>
              </div>
              <button 
                onClick={onClose}
                className="w-7 h-7 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
            
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6 md:px-8 pt-1 pb-6 md:pb-8 custom-scrollbar">
              <div className={`transition-all duration-500 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
              >

              {/* Wall Image - only for North/South/East/West Wall hotspots */}
                {wallImageUrl && (
                  <div className={`mb-6 md:mb-8 rounded-lg overflow-hidden border border-white/10 shadow-lg ${
                    displayHotspot.wallSide === WallSide.EAST || displayHotspot.wallSide === WallSide.WEST ? 'w-[80%] mx-auto' : ''
                  }`}>
                    <img 
                      src={wallImageUrl} 
                      alt={`${displayHotspot.wallSide} Wall`}
                      className="w-full h-auto object-cover"
                    />
                  </div>
                )}

              {/* Image Gallery */}
                {displayHotspot.gallery && displayHotspot.gallery.length > 0 && (
                  <div className="mb-6 md:mb-8">
                    <ImageGallery images={displayHotspot.gallery} />
                  </div>
                )}

                <h2 className="font-serif text-2xl md:text-4xl mb-4 md:mb-6 text-white leading-tight tracking-tight">
                  {displayHotspot.title}
                </h2>
                
                {/* Description - Middle */}
                {displayHotspot.description && (
                  <div className="prose prose-invert max-w-none mb-6 md:mb-8">
                    <p className="text-white/70 text-base md:text-lg leading-relaxed font-light whitespace-pre-wrap selection:bg-[#005e99] selection:text-white">
                      {displayHotspot.description}
                    </p>
                  </div>
                )}

                {/* Video Embed - Bottom */}
                {displayHotspot.mediaUrl && isYouTube && (
                  <div className="rounded-lg overflow-hidden border border-white/10 bg-black/40 shadow-inner">
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
                  </div>
                )}
              </div>
            </div>
            
            {/* Footer */}
            <div className="p-4 md:p-6 border-t border-white/5 flex items-center justify-between opacity-30 shrink-0">
              <div className="text-[7px] md:text-[8px] uppercase tracking-[0.3em] text-[#005e99] font-black">
                DIA &bull; DETROIT INSTITUTE OF ARTS
              </div>
              <div className="text-[7px] md:text-[8px] font-mono text-white/50 uppercase">
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
