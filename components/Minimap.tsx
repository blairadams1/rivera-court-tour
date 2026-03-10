import React, { useRef } from 'react';
import { ROOM_WIDTH, ROOM_DEPTH } from '../constants';
import { Hotspot } from '../types';

interface MinimapProps {
  hotspots: Hotspot[];
  activeHotspot: Hotspot | null;
  onHotspotClick: (hotspot: Hotspot) => void;
  onMapClick: (x: number, z: number) => void;
}

const Minimap: React.FC<MinimapProps> = ({ hotspots, activeHotspot, onHotspotClick, onMapClick }) => {
  const mapRef = useRef<HTMLDivElement>(null);

  const handleMapClick = (e: React.MouseEvent) => {
    if (!mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const pctX = x / rect.width;
    const pctY = y / rect.height;

    const worldX = (pctX - 0.5) * ROOM_WIDTH;
    const worldZ = (pctY - 0.5) * ROOM_DEPTH;

    onMapClick(worldX, worldZ);
  };

  return (
    <div 
      className="relative w-[153px] h-[102px] bg-black/60 backdrop-blur-md border border-white/20 rounded-xl overflow-hidden shadow-2xl cursor-crosshair"
      onClick={handleMapClick}
      ref={mapRef}
    >
      {/* Walls indicators */}
      <div className="absolute top-0 left-0 w-full h-1.5 bg-white/40" title="North Wall" />
      <div className="absolute bottom-0 left-0 w-full h-1.5 bg-white/40" title="South Wall" />
      <div className="absolute top-0 left-0 w-1.5 h-full bg-white/40" title="West Wall" />
      <div className="absolute top-0 right-0 w-1.5 h-full bg-white/40" title="East Wall" />

      {/* Hotspots */}
      {hotspots.map(h => {
        const left = `${((h.position[0] + ROOM_WIDTH / 2) / ROOM_WIDTH) * 100}%`;
        const top = `${((h.position[2] + ROOM_DEPTH / 2) / ROOM_DEPTH) * 100}%`;
        const isActive = activeHotspot?.id === h.id;
        
        return (
          <div
            key={h.id}
            onClick={(e) => {
              e.stopPropagation();
              onHotspotClick(h);
            }}
            className={`absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full cursor-pointer transition-all ${isActive ? 'bg-[#005e99] scale-150 z-10 shadow-[0_0_10px_rgba(0,94,153,0.8)]' : 'bg-white hover:scale-125 shadow-sm'}`}
            style={{ left, top }}
            title={h.title}
          />
        );
      })}

      {/* Player Indicator (updated via DOM for performance) */}
      <div 
        id="minimap-player" 
        className="absolute w-8 h-8 -ml-4 -mt-4 pointer-events-none"
        style={{ left: '50%', top: '50%' }}
      >
        <div id="minimap-cone" className="absolute inset-0 origin-center transition-transform duration-75">
          <svg width="32" height="32" viewBox="0 0 32 32">
            <path d="M16 16 L4 0 L28 0 Z" fill="rgba(255,255,255,0.4)" />
          </svg>
        </div>
        <div className="w-2.5 h-2.5 bg-[#005e99] rounded-full absolute top-[11px] left-[11px] border border-white shadow-[0_0_8px_rgba(0,160,255,0.8)]" />
      </div>
    </div>
  );
};

export default Minimap;
