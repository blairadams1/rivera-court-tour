
import React, { useRef, useCallback, useEffect, useState } from 'react';

// Shared ref that Controls.tsx reads each frame
export const joystickInput = { x: 0, y: 0 };

const JOYSTICK_SIZE = 60;
const KNOB_SIZE = 24;
const MAX_DISTANCE = (JOYSTICK_SIZE - KNOB_SIZE) / 2;

const VirtualJoystick: React.FC = () => {
  const baseRef = useRef<HTMLDivElement>(null);
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const [isActive, setIsActive] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const activeTouchId = useRef<number | null>(null);

  useEffect(() => {
    // Only show on touch-capable devices
    const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    setIsTouchDevice(hasTouchScreen);
  }, []);

  const getClampedOffset = useCallback((clientX: number, clientY: number) => {
    if (!baseRef.current) return { x: 0, y: 0 };
    const rect = baseRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > MAX_DISTANCE) {
      dx = (dx / dist) * MAX_DISTANCE;
      dy = (dy / dist) * MAX_DISTANCE;
    }
    return { x: dx, y: dy };
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (activeTouchId.current !== null) return; // already tracking a finger
    const touch = e.changedTouches[0];
    activeTouchId.current = touch.identifier;
    setIsActive(true);
    const offset = getClampedOffset(touch.clientX, touch.clientY);
    setKnobPos(offset);
    joystickInput.x = offset.x / MAX_DISTANCE;
    joystickInput.y = offset.y / MAX_DISTANCE;
  }, [getClampedOffset]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === activeTouchId.current) {
        const offset = getClampedOffset(touch.clientX, touch.clientY);
        setKnobPos(offset);
        joystickInput.x = offset.x / MAX_DISTANCE;
        joystickInput.y = offset.y / MAX_DISTANCE;
        break;
      }
    }
  }, [getClampedOffset]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === activeTouchId.current) {
        activeTouchId.current = null;
        setIsActive(false);
        setKnobPos({ x: 0, y: 0 });
        joystickInput.x = 0;
        joystickInput.y = 0;
        break;
      }
    }
  }, []);

  if (!isTouchDevice) return null;

  return (
    <div
      className="fixed z-[100] pointer-events-auto"
      style={{ bottom: 20, left: 14 }}
    >
      <div
        ref={baseRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        style={{
          width: JOYSTICK_SIZE,
          height: JOYSTICK_SIZE,
          borderRadius: '50%',
          border: '2px solid rgba(255,255,255,0.2)',
          background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0.25) 100%)',
          backdropFilter: 'blur(8px)',
          position: 'relative',
          touchAction: 'none',
          transition: isActive ? 'none' : 'box-shadow 0.3s ease',
          boxShadow: isActive 
            ? '0 0 20px rgba(0,94,153,0.3), inset 0 0 20px rgba(0,94,153,0.1)' 
            : '0 4px 20px rgba(0,0,0,0.5)',
        }}
      >
        {/* Direction arrows */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
          <svg width="30" height="30" viewBox="0 0 60 60" fill="none">
            {/* Up */}
            <path d="M30 8 L34 16 L26 16 Z" fill="white"/>
            {/* Down */}
            <path d="M30 52 L34 44 L26 44 Z" fill="white"/>
            {/* Left */}
            <path d="M8 30 L16 26 L16 34 Z" fill="white"/>
            {/* Right */}
            <path d="M52 30 L44 26 L44 34 Z" fill="white"/>
          </svg>
        </div>
        {/* Knob */}
        <div
          style={{
            width: KNOB_SIZE,
            height: KNOB_SIZE,
            borderRadius: '50%',
            background: isActive 
              ? 'radial-gradient(circle, rgba(0,94,153,0.7) 0%, rgba(0,94,153,0.3) 100%)' 
              : 'radial-gradient(circle, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.08) 100%)',
            border: `2px solid ${isActive ? 'rgba(0,94,153,0.6)' : 'rgba(255,255,255,0.15)'}`,
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: `translate(calc(-50% + ${knobPos.x}px), calc(-50% + ${knobPos.y}px))`,
            transition: isActive ? 'none' : 'transform 0.2s ease-out, background 0.3s ease, border 0.3s ease',
            boxShadow: isActive
              ? '0 0 12px rgba(0,94,153,0.4)'
              : '0 2px 8px rgba(0,0,0,0.4)',
          }}
        />
      </div>
      <div className="text-center mt-1.5 text-[8px] uppercase tracking-[0.3em] text-white/30 font-bold pointer-events-none select-none">
        MOVE
      </div>
    </div>
  );
};

export default VirtualJoystick;
