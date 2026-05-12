
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Move, RotateCw, Maximize2, Pencil, Trash2, ChevronDown, ChevronUp, Eye, X, Copy } from 'lucide-react';
import { InteriorWall } from '../types';
import { ROOM_HEIGHT } from '../constants';
import { gizmoState } from './gizmoState';

interface GizmoToolbarProps {
  wall: InteriorWall;
  transformMode: 'translate' | 'rotate' | 'scale';
  onTransformModeChange: (mode: 'translate' | 'rotate' | 'scale') => void;
  onOpenEditor: () => void;
  onClone: () => void;
  onDelete: () => void;
  onDeselect: () => void;
  onPropertyChange: (wall: InteriorWall) => void;
}

// Inline numeric scrubber — click-drag horizontally to change value, or click to type
const Scrubber: React.FC<{
  label: string;
  value: number;
  step: number;
  min?: number;
  max?: number;
  color: string;
  onChange: (v: number) => void;
}> = ({ label, value, step, min, max, color, onChange }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartVal = useRef(0);

  const commitEdit = () => {
    const parsed = parseFloat(editValue);
    if (!isNaN(parsed)) {
      let v = Math.round(parsed / step) * step;
      if (min !== undefined) v = Math.max(min, v);
      if (max !== undefined) v = Math.min(max, v);
      onChange(v);
    }
    setIsEditing(false);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isEditing) return;
    e.preventDefault();
    isDragging.current = false;
    dragStartX.current = e.clientX;
    dragStartVal.current = value;

    const handleMove = (ev: MouseEvent) => {
      const dx = ev.clientX - dragStartX.current;
      if (Math.abs(dx) > 3) isDragging.current = true;
      if (!isDragging.current) return;

      const sensitivity = ev.shiftKey ? 0.2 : 1;
      let newVal = dragStartVal.current + (dx * step * sensitivity) / 20;
      newVal = Math.round(newVal / step) * step;
      if (min !== undefined) newVal = Math.max(min, newVal);
      if (max !== undefined) newVal = Math.min(max, newVal);
      onChange(newVal);
    };

    const handleUp = () => {
      if (!isDragging.current) {
        // Click without drag — open text editor
        setEditValue(value.toFixed(1));
        setIsEditing(true);
        setTimeout(() => inputRef.current?.select(), 0);
      }
      isDragging.current = false;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[7px] uppercase tracking-widest font-black" style={{ color }}>{label}</span>
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={e => {
            if (e.key === 'Enter') commitEdit();
            if (e.key === 'Escape') setIsEditing(false);
          }}
          className="w-14 bg-black/60 border border-white/20 rounded px-1 py-0.5 text-[11px] text-white text-center font-mono outline-none focus:border-white/40"
          autoFocus
        />
      ) : (
        <div
          className="w-14 px-1 py-0.5 text-[11px] text-white/80 text-center font-mono cursor-ew-resize select-none rounded hover:bg-white/10 transition-colors"
          onMouseDown={handleMouseDown}
          title="Drag to scrub, click to type"
        >
          {value.toFixed(1)}
        </div>
      )}
    </div>
  );
};

const GizmoToolbar: React.FC<GizmoToolbarProps> = ({
  wall, transformMode, onTransformModeChange,
  onOpenEditor, onClone, onDelete, onDeselect, onPropertyChange
}) => {
  const [expanded, setExpanded] = useState(false);
  const [precisionMode, setPrecisionMode] = useState(gizmoState.precisionMode);

  const togglePrecision = useCallback(() => {
    const next = !precisionMode;
    setPrecisionMode(next);
    gizmoState.precisionMode = next;
  }, [precisionMode]);

  // Show the properties section relevant to current transform mode
  const modeLabel = transformMode === 'translate' ? 'Position' : transformMode === 'rotate' ? 'Rotation' : 'Scale';

  const updatePosition = useCallback((axis: 0 | 1 | 2, val: number) => {
    const pos: [number, number, number] = [...wall.position];
    pos[axis] = val;
    onPropertyChange({ ...wall, position: pos });
  }, [wall, onPropertyChange]);

  const updateScale = useCallback((axis: 0 | 1, val: number) => {
    const s: [number, number] = [...wall.scale];
    s[axis] = val;
    onPropertyChange({ ...wall, scale: s });
  }, [wall, onPropertyChange]);

  const updateRotation = useCallback((axis: 0 | 1 | 2, val: number) => {
    const r: [number, number, number] = Array.isArray(wall.rotation) ? [...wall.rotation] : [0, wall.rotation as number, 0];
    r[axis] = ((val % 360) + 360) % 360;
    onPropertyChange({ ...wall, rotation: r });
  }, [wall, onPropertyChange]);

  const updateType = useCallback((type: 'wall' | 'floor' | 'ceiling') => {
    const isHorizontal = type === 'floor' || type === 'ceiling';
    onPropertyChange({
      ...wall,
      type,
      billboard: isHorizontal ? false : wall.billboard,
      position: type === 'floor'
        ? [wall.position[0], 0.05, wall.position[2]]
        : type === 'ceiling'
        ? [wall.position[0], ROOM_HEIGHT - 0.05, wall.position[2]]
        : [wall.position[0], wall.position[1] < 1 ? 10 : wall.position[1], wall.position[2]]
    });
  }, [wall, onPropertyChange]);

  const toggleBillboard = useCallback(() => {
    onPropertyChange({ ...wall, billboard: !wall.billboard });
  }, [wall, onPropertyChange]);

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex flex-col items-center">
        {/* Main Toolbar Row */}
        <div className="flex items-center gap-1 bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl p-1.5 shadow-2xl">
          {/* Transform Mode Buttons */}
          <button
            onClick={() => onTransformModeChange('translate')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[10px] uppercase tracking-[0.15em] font-black transition-all ${
              transformMode === 'translate' ? 'bg-[#005e99] text-white shadow-lg' : 'text-white/50 hover:text-white hover:bg-white/10'
            }`}
          >
            <Move size={13} />
            Move
            <span className="text-[8px] opacity-40 ml-0.5">G</span>
          </button>
          <button
            onClick={() => onTransformModeChange('rotate')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[10px] uppercase tracking-[0.15em] font-black transition-all ${
              transformMode === 'rotate' ? 'bg-[#005e99] text-white shadow-lg' : 'text-white/50 hover:text-white hover:bg-white/10'
            }`}
          >
            <RotateCw size={13} />
            Rotate
            <span className="text-[8px] opacity-40 ml-0.5">R</span>
          </button>
          <button
            onClick={() => onTransformModeChange('scale')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[10px] uppercase tracking-[0.15em] font-black transition-all ${
              transformMode === 'scale' ? 'bg-[#005e99] text-white shadow-lg' : 'text-white/50 hover:text-white hover:bg-white/10'
            }`}
          >
            <Maximize2 size={13} />
            Scale
            <span className="text-[8px] opacity-40 ml-0.5">S</span>
          </button>

          {/* Separator */}
          <div className="w-px h-6 bg-white/10 mx-1"></div>

          {/* Live readout for current mode */}
          <div className="flex items-center gap-1 px-2">
            {transformMode === 'translate' && (
              <>
                <Scrubber label="X" value={wall.position[0]} step={0.5} color="#ff6b6b" onChange={v => updatePosition(0, v)} />
                <Scrubber label="Y" value={wall.position[1]} step={0.5} min={0} color="#51cf66" onChange={v => updatePosition(1, v)} />
                <Scrubber label="Z" value={wall.position[2]} step={0.5} color="#339af0" onChange={v => updatePosition(2, v)} />
              </>
            )}
            {transformMode === 'rotate' && (() => {
              const r = Array.isArray(wall.rotation) ? wall.rotation : [0, wall.rotation as number, 0];
              return (
                <>
                  <Scrubber label="X°" value={r[0]} step={1} min={0} max={359} color="#ff6b6b" onChange={v => updateRotation(0, v)} />
                  <Scrubber label="Y°" value={r[1]} step={1} min={0} max={359} color="#51cf66" onChange={v => updateRotation(1, v)} />
                  <Scrubber label="Z°" value={r[2]} step={1} min={0} max={359} color="#339af0" onChange={v => updateRotation(2, v)} />
                </>
              );
            })()}
            {transformMode === 'scale' && (
              <>
                <Scrubber label="W" value={wall.scale[0]} step={0.5} min={1} max={60} color="#ff6b6b" onChange={v => updateScale(0, v)} />
                <Scrubber label="H" value={wall.scale[1]} step={0.5} min={1} max={40} color="#51cf66" onChange={v => updateScale(1, v)} />
              </>
            )}
          </div>

          {/* Separator */}
          <div className="w-px h-6 bg-white/10 mx-1"></div>

          {/* Type toggle */}
          <div className="flex items-center bg-black/40 rounded-lg p-0.5 border border-white/5">
            <button
              onClick={() => updateType('wall')}
              className={`px-2.5 py-1.5 text-[9px] uppercase tracking-[0.1em] font-black rounded-md transition-all ${
                wall.type === 'wall' ? 'bg-[#005e99]/60 text-white' : 'text-white/30 hover:text-white/60'
              }`}
            >
              Wall
            </button>
            <button
              onClick={() => updateType('floor')}
              className={`px-2.5 py-1.5 text-[9px] uppercase tracking-[0.1em] font-black rounded-md transition-all ${
                wall.type === 'floor' ? 'bg-[#005e99]/60 text-white' : 'text-white/30 hover:text-white/60'
              }`}
            >
              Floor
            </button>
            <button
              onClick={() => updateType('ceiling')}
              className={`px-2.5 py-1.5 text-[9px] uppercase tracking-[0.1em] font-black rounded-md transition-all ${
                wall.type === 'ceiling' ? 'bg-[#005e99]/60 text-white' : 'text-white/30 hover:text-white/60'
              }`}
            >
              Ceil
            </button>
          </div>

          {/* Billboard / Look-At toggle */}
          {wall.type === 'wall' && (
            <button
              onClick={toggleBillboard}
              className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[10px] uppercase tracking-[0.15em] font-black transition-all ${
                wall.billboard ? 'bg-[#005e99] text-white shadow-lg' : 'text-white/40 hover:text-white hover:bg-white/10'
              }`}
              title="Billboard: panel always faces camera"
            >
              <Eye size={13} />
              <span className="hidden xl:inline">Look At</span>
            </button>
          )}

          {/* Separator */}
          <div className="w-px h-6 bg-white/10 mx-1"></div>

          {/* Expand / properties toggle */}
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1 px-2.5 py-2 rounded-lg text-[10px] uppercase tracking-[0.15em] font-black text-white/50 hover:text-white hover:bg-white/10 transition-all"
            title="Show all properties"
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {/* Edit (image/label) */}
          <button
            onClick={onOpenEditor}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] uppercase tracking-[0.15em] font-black text-white/50 hover:text-white hover:bg-white/10 transition-all"
            title="Edit image & label"
          >
            <Pencil size={12} />
          </button>

          {/* Clone / Duplicate */}
          <button
            onClick={onClone}
            className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[10px] uppercase tracking-[0.15em] font-black text-cyan-400/70 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all"
            title="Duplicate element"
          >
            <Copy size={12} />
          </button>

          {/* Delete */}
          <button
            onClick={onDelete}
            className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[10px] uppercase tracking-[0.15em] font-black text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <Trash2 size={12} />
          </button>

          {/* Close / Deselect */}
          <button
            onClick={onDeselect}
            className="flex items-center gap-1.5 px-2 py-2 rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-all"
            title="Deselect (ESC)"
          >
            <X size={13} />
          </button>
        </div>

        {/* Expanded properties panel */}
        {expanded && (
          <div className="mt-1 bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl p-4 shadow-2xl animate-in fade-in slide-in-from-top-1 duration-200 min-w-[420px]">
            <div className="grid grid-cols-3 gap-4">
              {/* Position */}
              <div>
                <div className="text-[8px] uppercase tracking-widest text-white/30 font-black mb-2">Position</div>
                <div className="flex gap-2">
                  <Scrubber label="X" value={wall.position[0]} step={0.5} color="#ff6b6b" onChange={v => updatePosition(0, v)} />
                  <Scrubber label="Y" value={wall.position[1]} step={0.5} min={0} color="#51cf66" onChange={v => updatePosition(1, v)} />
                  <Scrubber label="Z" value={wall.position[2]} step={0.5} color="#339af0" onChange={v => updatePosition(2, v)} />
                </div>
              </div>

              {/* Rotation */}
              <div>
                <div className="text-[8px] uppercase tracking-widest text-white/30 font-black mb-2">Rotation</div>
                <div className="flex gap-2 items-end">
                  {(() => {
                    const r = Array.isArray(wall.rotation) ? wall.rotation : [0, wall.rotation as number, 0];
                    return (
                      <>
                        <Scrubber label="X°" value={r[0]} step={1} min={0} max={359} color="#ff6b6b" onChange={v => updateRotation(0, v)} />
                        <Scrubber label="Y°" value={r[1]} step={1} min={0} max={359} color="#51cf66" onChange={v => updateRotation(1, v)} />
                        <Scrubber label="Z°" value={r[2]} step={1} min={0} max={359} color="#339af0" onChange={v => updateRotation(2, v)} />
                      </>
                    );
                  })()}
                  <div className="flex gap-1 pb-0.5">
                    {[0, 90, 180, 270].map(deg => (
                      <button
                        key={deg}
                        onClick={() => updateRotation(1, deg)}
                        className={`w-7 h-5 text-[8px] font-mono rounded transition-all ${
                          (Array.isArray(wall.rotation) ? wall.rotation[1] : wall.rotation) === deg ? 'bg-[#005e99]/60 text-white' : 'bg-white/5 text-white/30 hover:text-white/60'
                        }`}
                      >
                        {deg}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Scale */}
              <div>
                <div className="text-[8px] uppercase tracking-widest text-white/30 font-black mb-2">Scale (ft)</div>
                <div className="flex gap-2">
                  <Scrubber label="W" value={wall.scale[0]} step={0.5} min={1} max={60} color="#ff6b6b" onChange={v => updateScale(0, v)} />
                  <Scrubber label="H" value={wall.scale[1]} step={0.5} min={1} max={40} color="#51cf66" onChange={v => updateScale(1, v)} />
                </div>
              </div>
            </div>

            {/* Render Order */}
            <div className="mt-3 pt-3 border-t border-white/5">
              <div className="flex items-center gap-3">
                <div className="text-[8px] uppercase tracking-widest text-white/30 font-black">Draw Order</div>
                <Scrubber
                  label="▲"
                  value={wall.renderOrder || 0}
                  step={1}
                  min={0}
                  max={10}
                  color="#f59f00"
                  onChange={v => onPropertyChange({ ...wall, renderOrder: v })}
                />
                <span className="text-[8px] text-white/20">higher = on top</span>
              </div>
            </div>

            {/* Options */}
            {wall.type === 'wall' && (
              <div className="mt-3 pt-3 border-t border-white/5">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                    wall.billboard
                      ? 'bg-[#005e99] border-[#005e99]'
                      : 'border-white/20 group-hover:border-white/40'
                  }`}>
                    {wall.billboard && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    )}
                  </div>
                  <span className="text-[9px] uppercase tracking-widest text-white/50 font-black">Billboard / Look At Camera</span>
                  <span className="text-[8px] text-white/20 ml-auto">always faces viewer</span>
                </label>
              </div>
            )}

            {/* Compact info */}
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
              <span className="text-[8px] text-white/20 font-mono tracking-wider">
                {wall.label || wall.id} · {wall.type}{wall.billboard ? ' · billboard' : ''}
              </span>
              <span className="text-[8px] text-white/15 font-mono">
                SHIFT+drag for fine control
              </span>
            </div>
          </div>
        )}

        {/* Precision toggle + hint */}
        <div className="flex items-center justify-center gap-3 mt-1.5">
          <label className="flex items-center gap-1.5 cursor-pointer group" onClick={togglePrecision}>
            <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${
              precisionMode
                ? 'bg-[#f59f00] border-[#f59f00]'
                : 'border-white/20 group-hover:border-white/40'
            }`}>
              {precisionMode && (
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              )}
            </div>
            <span className={`text-[9px] uppercase tracking-widest font-black transition-colors ${
              precisionMode ? 'text-[#f59f00]' : 'text-white/25 group-hover:text-white/40'
            }`}>Precision</span>
          </label>
          <span className="text-[9px] text-white/20 tracking-widest uppercase">ESC · G · R · S</span>
        </div>
      </div>
    </div>
  );
};

export default GizmoToolbar;
