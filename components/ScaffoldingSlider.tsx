
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { EYE_LEVEL, MAX_LIFT } from '../constants';

interface ScaffoldingSliderProps {
  value: number;
  onChange: (val: number) => void;
}

const SLIDER_HEIGHT = 140;

const ScaffoldingSlider: React.FC<ScaffoldingSliderProps> = ({ value, onChange }) => {
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Calculate percentage (0 to 100) from bottom to top
  const percent = ((value - EYE_LEVEL) / (MAX_LIFT - EYE_LEVEL)) * 100;

  const updateValueFromPointer = useCallback((clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    // Calculate normalized Y (0 at bottom, 1 at top)
    const relativeY = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
    const newValue = EYE_LEVEL + relativeY * (MAX_LIFT - EYE_LEVEL);
    onChange(newValue);
  }, [onChange]);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    updateValueFromPointer(e.clientY);
    // Capture pointer to handle movement even outside the container
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDragging) {
      updateValueFromPointer(e.clientY);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  return (
    <div className="fixed right-2 md:right-12 top-[38%] -translate-y-1/2 flex items-center z-20 select-none touch-none">
      
      {/* Label with Blue Backdrop */}
      <div className="absolute -left-[46px] top-1/2 -translate-y-1/2 -rotate-90 origin-center whitespace-nowrap hidden md:block">
        <div className="bg-[#005e99] px-3 py-1 rounded-sm shadow-[0_4px_20px_rgba(0,0,0,0.4)] border border-white/10">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white">
            Scaffold Elevation
          </span>
        </div>
      </div>

      {/* Interactive Container */}
      <div 
        ref={containerRef}
        className="relative w-14 flex items-center justify-center cursor-ns-resize"
        style={{ height: `${SLIDER_HEIGHT}px` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        
        {/* The Track - Opaque solid color */}
        <div className="absolute w-1 h-full bg-zinc-800 left-1/2 -translate-x-1/2 rounded-full overflow-hidden">
          <div 
            className="absolute bottom-0 left-0 w-full bg-[#005e99]"
            style={{ height: `${percent}%` }}
          />
        </div>

        {/* The Circle Handle */}
        <div 
          className={`absolute left-1/2 -translate-x-1/2 z-10 transition-all duration-300 ease-out flex items-center justify-center rounded-full border-2 border-white shadow-2xl
            ${isDragging 
              ? 'w-[64px] h-[64px] bg-[#005e99] scale-100 opacity-100 shadow-[0_0_35px_rgba(0,94,153,0.7)]' 
              : 'w-[20px] h-[20px] bg-white scale-100 opacity-90 hover:scale-110 hover:opacity-100'
            }`}
          style={{ 
            bottom: `${percent}%`, 
            marginBottom: isDragging ? '-32px' : '-10px' 
          }}
        >
          {isDragging && (
            <div className="flex flex-col items-center justify-center animate-in zoom-in-75 duration-200">
              <span className="text-xl font-black font-mono leading-none tracking-tighter text-white">
                {Math.round(value)}
              </span>
              <span className="text-[8px] font-black uppercase tracking-widest text-white/80 mt-0.5">
                Feet
              </span>
            </div>
          )}
        </div>

        {/* Tick Marks */}
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-8 pointer-events-none opacity-20">
          {[0, 25, 50, 75, 100].map((tick) => (
            <div 
              key={tick} 
              className="absolute left-1/2 -translate-x-1/2 w-4 h-[1px] bg-white"
              style={{ bottom: `${tick}%` }}
            />
          ))}
        </div>
      </div>

      {/* Static readout */}
      {!isDragging && (
        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-center text-white/30 font-mono text-[10px] tracking-widest">
          {value.toFixed(1)}'
        </div>
      )}
    </div>
  );
};

export default ScaffoldingSlider;
