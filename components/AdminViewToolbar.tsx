
import React, { useState, useEffect, useCallback } from 'react';
import { Minus, Plus, Eye } from 'lucide-react';
import { gizmoState } from './gizmoState';

export type ViewMode = 'free' | 'top' | 'north' | 'south' | 'east' | 'west';

interface AdminViewToolbarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

// ---- 3D Orientation Cube ----
const CUBE_SIZE = 38;
const HALF = CUBE_SIZE / 2;

const CUBE_ROTATIONS: Record<ViewMode, string> = {
  free:  'rotateX(-20deg) rotateY(-25deg)',
  top:   'rotateX(90deg)',
  north: 'rotateY(0deg)',
  south: 'rotateY(180deg)',
  east:  'rotateY(-90deg)',
  west:  'rotateY(90deg)',
};

interface CubeFace {
  label: string;
  view: ViewMode;
  transform: string;
  bg: string;
  activeBg: string;
}

const FACES: CubeFace[] = [
  { label: 'N', view: 'north', transform: `translateZ(${HALF}px)`,                          bg: 'rgba(255,255,255,0.04)', activeBg: '#005e99' },
  { label: 'S', view: 'south', transform: `rotateY(180deg) translateZ(${HALF}px)`,          bg: 'rgba(255,255,255,0.04)', activeBg: '#005e99' },
  { label: 'E', view: 'east',  transform: `rotateY(90deg) translateZ(${HALF}px)`,           bg: 'rgba(255,255,255,0.04)', activeBg: '#005e99' },
  { label: 'W', view: 'west',  transform: `rotateY(-90deg) translateZ(${HALF}px)`,          bg: 'rgba(255,255,255,0.04)', activeBg: '#005e99' },
  { label: 'T', view: 'top',   transform: `rotateX(90deg) translateZ(${HALF}px)`,           bg: 'rgba(255,255,255,0.04)', activeBg: '#005e99' },
  { label: '',  view: 'free',  transform: `rotateX(-90deg) translateZ(${HALF}px)`,           bg: 'rgba(255,255,255,0.02)', activeBg: 'rgba(255,255,255,0.02)' },
];

const OrientationCube: React.FC<{ viewMode: ViewMode; onViewModeChange: (m: ViewMode) => void }> = ({ viewMode, onViewModeChange }) => (
  <div
    style={{ perspective: '300px', width: CUBE_SIZE, height: CUBE_SIZE }}
    className="shrink-0 cursor-pointer"
    title="Orientation"
  >
    <div
      style={{
        width: CUBE_SIZE,
        height: CUBE_SIZE,
        position: 'relative',
        transformStyle: 'preserve-3d',
        transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: CUBE_ROTATIONS[viewMode],
      }}
    >
      {FACES.map((face, i) => {
        const isActive = viewMode === face.view;
        return (
          <div
            key={i}
            onClick={(e) => {
              e.stopPropagation();
              if (face.view !== 'free') onViewModeChange(face.view);
            }}
            style={{
              position: 'absolute',
              width: CUBE_SIZE,
              height: CUBE_SIZE,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isActive ? face.activeBg : face.bg,
              border: `1px solid ${isActive ? 'rgba(0,94,153,0.6)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: '3px',
              transform: face.transform,
              fontSize: '10px',
              fontWeight: 900,
              letterSpacing: '0.1em',
              color: isActive ? 'white' : 'rgba(255,255,255,0.25)',
              backfaceVisibility: 'hidden',
              transition: 'background-color 0.3s, color 0.3s, border-color 0.3s',
              cursor: face.view !== 'free' ? 'pointer' : 'default',
            }}
          >
            {face.label}
          </div>
        );
      })}
    </div>
  </div>
);

// ---- View Buttons ----
const VIEW_OPTIONS: { mode: ViewMode; label: string; icon?: React.ReactNode }[] = [
  { mode: 'free',  label: 'Free', icon: <Eye size={12} /> },
  { mode: 'top',   label: 'Top' },
  { mode: 'north', label: 'N' },
  { mode: 'south', label: 'S' },
  { mode: 'east',  label: 'E' },
  { mode: 'west',  label: 'W' },
];

// ---- Main Toolbar ----
const AdminViewToolbar: React.FC<AdminViewToolbarProps> = ({ viewMode, onViewModeChange }) => {
  const [displayZoom, setDisplayZoom] = useState(100);
  const isOrtho = viewMode !== 'free';

  // Poll gizmoState.orthoZoom to keep the display in sync with scroll-wheel changes
  useEffect(() => {
    if (!isOrtho) return;
    const interval = setInterval(() => {
      setDisplayZoom(Math.round(gizmoState.orthoZoom * 100));
    }, 80);
    return () => clearInterval(interval);
  }, [isOrtho]);

  const handleZoomIn = useCallback(() => {
    gizmoState.orthoZoom = Math.min(10, gizmoState.orthoZoom * 1.25);
    setDisplayZoom(Math.round(gizmoState.orthoZoom * 100));
  }, []);

  const handleZoomOut = useCallback(() => {
    gizmoState.orthoZoom = Math.max(0.2, gizmoState.orthoZoom * 0.8);
    setDisplayZoom(Math.round(gizmoState.orthoZoom * 100));
  }, []);

  const handleResetZoom = useCallback(() => {
    gizmoState.orthoZoom = 1;
    setDisplayZoom(100);
  }, []);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center gap-2 bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-2 shadow-2xl">

        {/* Orientation Cube */}
        <div className="px-1">
          <OrientationCube viewMode={viewMode} onViewModeChange={onViewModeChange} />
        </div>

        {/* Separator */}
        <div className="w-px h-8 bg-white/10" />

        {/* View Buttons */}
        <div className="flex items-center gap-0.5">
          {VIEW_OPTIONS.map(({ mode, label, icon }) => (
            <button
              key={mode}
              onClick={() => onViewModeChange(mode)}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-[10px] uppercase tracking-[0.12em] font-black transition-all duration-200 ${
                viewMode === mode
                  ? 'bg-[#005e99] text-white shadow-lg shadow-[#005e99]/20'
                  : 'text-white/40 hover:text-white hover:bg-white/10'
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {/* Zoom Controls — only visible in ortho modes */}
        <div
          className={`flex items-center gap-1 overflow-hidden transition-all duration-300 ease-in-out ${
            isOrtho ? 'max-w-[200px] opacity-100 ml-0' : 'max-w-0 opacity-0 ml-0'
          }`}
        >
          {/* Separator */}
          <div className="w-px h-8 bg-white/10 shrink-0" />

          <button
            onClick={handleZoomOut}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all shrink-0"
            title="Zoom out"
          >
            <Minus size={13} />
          </button>

          <button
            onClick={handleResetZoom}
            className="min-w-[42px] h-7 rounded-lg flex items-center justify-center text-[10px] font-mono font-bold text-white/60 hover:text-white hover:bg-white/10 transition-all shrink-0 tabular-nums"
            title="Reset zoom to 100%"
          >
            {displayZoom}%
          </button>

          <button
            onClick={handleZoomIn}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all shrink-0"
            title="Zoom in"
          >
            <Plus size={13} />
          </button>
        </div>
      </div>

      {/* Hint text */}
      {isOrtho && (
        <div className="text-center mt-2 text-[9px] text-white/20 tracking-widest uppercase animate-in fade-in duration-500">
          Drag to pan · Scroll to zoom
        </div>
      )}
    </div>
  );
};

export default AdminViewToolbar;
