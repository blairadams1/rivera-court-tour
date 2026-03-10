
import React, { useState, useEffect } from 'react';
import { Hotspot } from '../types';

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
          isVisible ? 'translate-x-0' : 'translate-x-full'
        }`}
        onClick={(e) => e.stopPropagation()} // Prevent taps on the panel itself from closing it
      >
        {displayHotspot && (
          <>
            {/* Header */}
            <div className="p-4 md:p-6 flex justify-between items-center border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-2 md:w-2.5 h-2 md:h-2.5 rounded-full bg-[#005e99] shadow-[0_0_12px_#005e99]"></div>
                <span className="text-[9px] md:text-[10px] uppercase tracking-[0.4em] text-white/50 font-black">MURAL DETAIL</span>
              </div>
              <button 
                onClick={onClose}
                className="w-10 h-10 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
            
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
              <div className={`transition-all duration-500 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                <h2 className="font-serif text-2xl md:text-4xl mb-4 md:mb-6 text-white leading-tight tracking-tight">
                  {displayHotspot.title}
                </h2>
                
                {displayHotspot.mediaUrl && (
                  <div className="mb-6 md:mb-8 rounded-lg overflow-hidden border border-white/10 bg-black/40 shadow-inner">
                    {displayHotspot.mediaType === 'image' && (
                      <img src={displayHotspot.mediaUrl} alt={displayHotspot.title} className="w-full h-auto object-cover" />
                    )}
                    {displayHotspot.mediaType === 'video' && (
                      isYouTube ? (
                        <div className="aspect-video w-full">
                          <iframe
                            src={`https://www.youtube.com/embed/${youtubeId}?autoplay=0&modestbranding=1&rel=0`}
                            className="w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            frameBorder="0"
                          />
                        </div>
                      ) : (
                        <video src={displayHotspot.mediaUrl} controls className="w-full" />
                      )
                    )}
                    {displayHotspot.mediaType === 'audio' && (
                      <div className="p-6 md:p-8 bg-[#005e99]/5 flex items-center justify-center">
                        <audio src={displayHotspot.mediaUrl} controls className="w-full" />
                      </div>
                    )}
                  </div>
                )}
                
                <div className="prose prose-invert max-w-none">
                  <p className="text-white/70 text-base md:text-lg leading-relaxed font-light whitespace-pre-wrap selection:bg-[#005e99] selection:text-white">
                    {displayHotspot.description}
                  </p>
                </div>
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
