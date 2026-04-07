
import React, { useState, useRef, useCallback } from 'react';
import { EYE_LEVEL, MAX_LIFT } from '../constants';

interface ScaffoldingSliderProps {
  value: number;
  onChange: (val: number) => void;
}

const SLIDER_HEIGHT_MOBILE = 140;
const SLIDER_HEIGHT_DESKTOP = 350;

const ScaffoldingSlider: React.FC<ScaffoldingSliderProps> = ({ value, onChange }) => {
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const mobileContainerRef = useRef<HTMLDivElement>(null);
  
  // Calculate percentage (0 to 100) from bottom to top
  const percent = ((value - EYE_LEVEL) / (MAX_LIFT - EYE_LEVEL)) * 100;

  const updateValueFromPointer = useCallback((clientY: number) => {
    const el = containerRef.current || mobileContainerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const relativeY = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
    const newValue = EYE_LEVEL + relativeY * (MAX_LIFT - EYE_LEVEL);
    onChange(newValue);
  }, [onChange]);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    updateValueFromPointer(e.clientY);
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
    <div className="fixed right-2 md:right-10 top-[38%] md:top-1/2 -translate-y-1/2 z-20 select-none touch-none">
      
      {/* Desktop: Background container holding slider + label */}
      <div className="hidden md:block relative bg-black/30 backdrop-blur-sm rounded-lg px-2 py-3 border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.5)]">
        
        {/* Interactive Slider Container - Desktop */}
        <div 
          ref={containerRef}
          className="relative w-6 flex items-center justify-center cursor-ns-resize"
          style={{ height: `${SLIDER_HEIGHT_DESKTOP}px` }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {/* The Track */}
          <div className="absolute w-1.5 h-full bg-zinc-800 left-1/2 -translate-x-1/2 rounded-full overflow-hidden">
            <div 
              className="absolute bottom-0 left-0 w-full bg-[#005e99]"
              style={{ height: `${percent}%` }}
            />
          </div>

          {/* The Circle Handle */}
          <div 
            className={`absolute left-1/2 -translate-x-1/2 z-10 transition-all duration-300 ease-out flex items-center justify-center rounded-full border-2 border-white shadow-2xl
              ${isDragging 
                ? 'w-[72px] h-[72px] bg-[#005e99] scale-100 opacity-100 shadow-[0_0_35px_rgba(0,94,153,0.7)]' 
                : 'w-[24px] h-[24px] bg-white scale-100 opacity-90 hover:scale-110 hover:opacity-100'
              }`}
            style={{ 
              bottom: `${percent}%`, 
              marginBottom: isDragging ? '-36px' : '-12px' 
            }}
          >
            {isDragging && (
              <div className="flex flex-col items-center justify-center animate-in zoom-in-75 duration-200">
                <span className="text-2xl font-black font-mono leading-none tracking-tighter text-white">
                  {Math.round(value)}
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest text-white/80 mt-0.5">
                  Feet
                </span>
              </div>
            )}
          </div>

          {/* Tick Marks */}
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-6 pointer-events-none opacity-20">
            {[0, 25, 50, 75, 100].map((tick) => (
              <div 
                key={tick} 
                className="absolute left-1/2 -translate-x-1/2 w-4 h-[1px] bg-white"
                style={{ bottom: `${tick}%` }}
              />
            ))}
          </div>
        </div>

        {/* Label - positioned absolutely to the left, outside the panel */}
        <div className="absolute -left-[42px] top-1/2 -translate-y-1/2 -rotate-90 origin-center whitespace-nowrap pointer-events-none">
          <div className="bg-[#005e99] px-2 py-1 rounded-sm shadow-lg border border-white/10 flex items-center justify-center">
            <span className="text-[8px] font-black uppercase tracking-[0.15em] text-white leading-none block">
              Scaffold Elevation
            </span>
          </div>
        </div>
      </div>

      {/* Mobile: Slim slider only, no label */}
      <div className="md:hidden">
        <div 
          ref={mobileContainerRef}
          className="relative w-10 flex items-center justify-center cursor-ns-resize"
          style={{ height: `${SLIDER_HEIGHT_MOBILE}px` }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <div className="absolute w-1 h-full bg-zinc-800 left-1/2 -translate-x-1/2 rounded-full overflow-hidden">
            <div 
              className="absolute bottom-0 left-0 w-full bg-[#005e99]"
              style={{ height: `${percent}%` }}
            />
          </div>
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
      </div>

      {/* Static readout */}
      {!isDragging && (
        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-center text-white/30 font-mono text-[10px] md:text-[12px] tracking-widest">
          {value.toFixed(1)}'
        </div>
      )}
    </div>
  );
};

export default ScaffoldingSlider;
