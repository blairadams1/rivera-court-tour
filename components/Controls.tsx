
import React, { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MOVEMENT_SPEED, LOOK_SENSITIVITY, COLLISION_BUFFER, ROOM_WIDTH, ROOM_DEPTH } from '../constants';
import { WallSide } from '../types';
import { joystickInput } from './VirtualJoystick';
import { gizmoState } from './gizmoState';

interface ControlsProps {
  targetY: number;
  focusTarget: { position: [number, number, number]; wallSide: WallSide } | null;
  teleportTarget?: [number, number, number] | null;
  isSidebarOpen?: boolean;
  onNavigate?: () => void;
  effectiveBounds?: { halfWidth: number; halfDepth: number };
}

const Controls: React.FC<ControlsProps> = ({ targetY, focusTarget, teleportTarget, isSidebarOpen, onNavigate, effectiveBounds }) => {
  const { camera, gl } = useThree();
  const keys = useRef<{ [key: string]: boolean }>({});
  const isDragging = useRef(false);
  const previousTouch = useRef<{ x: number, y: number } | null>(null);
  const velocity = useRef(new THREE.Vector3());
  
  const euler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const isTransitioning = useRef(false);
  const transitionTargetPos = useRef(new THREE.Vector3());
  const transitionTargetEuler = useRef(new THREE.Euler());

  const SIDEBAR_OFFSET_UNITS = 3.2;

  useEffect(() => {
    // Initial Camera Pitch (Look up at the wall)
    // 0.38 radians is approximately 22 degrees down.
    // This is 40 degrees lower (more towards the floor) than the previous -0.32 radians (~18 degrees up).
    euler.current.set( 0.38, 0, 0, 'YXZ');
    camera.quaternion.setFromEuler(euler.current);

    const handleKeyDown = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = true;
      if (onNavigate) onNavigate();
    };
    const handleKeyUp = (e: KeyboardEvent) => (keys.current[e.key.toLowerCase()] = false);
    const handleMouseDown = () => {
      isDragging.current = true;
      isTransitioning.current = false;
    };
    const handleMouseUp = () => (isDragging.current = false);
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || gizmoState.isDragging) return;
      if (onNavigate) onNavigate();
      euler.current.setFromQuaternion(camera.quaternion);
      euler.current.y -= e.movementX * LOOK_SENSITIVITY;
      euler.current.x -= e.movementY * LOOK_SENSITIVITY;
      // Clamp pitch to avoid flipping or looking strictly at the floor/ceiling
      euler.current.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, euler.current.x));
      camera.quaternion.setFromEuler(euler.current);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDragging.current = true;
        isTransitioning.current = false;
        previousTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging.current || !previousTouch.current || gizmoState.isDragging) return;
      if (e.touches.length === 1) {
        if (onNavigate) onNavigate();
        const touch = e.touches[0];
        const movementX = touch.clientX - previousTouch.current.x;
        const movementY = touch.clientY - previousTouch.current.y;

        euler.current.setFromQuaternion(camera.quaternion);
        euler.current.y -= movementX * LOOK_SENSITIVITY;
        euler.current.x -= movementY * LOOK_SENSITIVITY;
        euler.current.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, euler.current.x));
        camera.quaternion.setFromEuler(euler.current);

        previousTouch.current = { x: touch.clientX, y: touch.clientY };
      }
    };

    const handleTouchEnd = () => {
      isDragging.current = false;
      previousTouch.current = null;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    gl.domElement.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    gl.domElement.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      gl.domElement.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
      gl.domElement.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, [camera, gl, onNavigate]);

  useEffect(() => {
    if (!focusTarget) return;

    const [tx, ty, tz] = focusTarget.position;
    const VIEW_DISTANCE = 16;
    const MIN_HEIGHT = 6; // 6 feet minimum (coordinate system is in feet)
    
    let camX = tx;
    let camZ = tz;
    let camY = Math.max(ty, MIN_HEIGHT);
    let rotY = 0;
    let rotX = 0;

    switch (focusTarget.wallSide) {
      case WallSide.NORTH: camZ = tz + VIEW_DISTANCE; rotY = 0; break;
      case WallSide.SOUTH: camZ = tz - VIEW_DISTANCE; rotY = Math.PI; break;
      case WallSide.EAST:  camX = tx - VIEW_DISTANCE; rotY = -Math.PI / 2; break;
      case WallSide.WEST:  camX = tx + VIEW_DISTANCE; rotY = Math.PI / 2; break;
      case WallSide.FLOOR: {
        // Move camera to 9 feet height (coordinate system is in feet)
        camY = 9;
        
        const cdx = camera.position.x - tx;
        const cdz = camera.position.z - tz;
        
        // Default angle if we are standing exactly on top of it
        let angleToCamera = 0;
        if (Math.abs(cdx) > 0.1 || Math.abs(cdz) > 0.1) {
          angleToCamera = Math.atan2(cdz, cdx); // standard angle in XZ plane
        }
        
        // Snap to nearest 45° increment to keep uniform viewing angles
        const snappedAngle = Math.round(angleToCamera / (Math.PI / 4)) * (Math.PI / 4);
        
        // Use a distance of 5 units along with the 9ft height (2.74)
        // This keeps us further back so we aren't uncomfortably close to the floor
        const diagonalDist = 5; 
        camX = tx + Math.cos(snappedAngle) * diagonalDist;
        camZ = tz + Math.sin(snappedAngle) * diagonalDist;
        
        // Use THREE.js native LookAt for bulletproof rotation math
        const dummyCamera = new THREE.PerspectiveCamera();
        dummyCamera.rotation.order = 'YXZ'; // Match our controller's Euler order
        dummyCamera.position.set(camX, camY, camZ);
        dummyCamera.lookAt(tx, ty, tz);
        
        rotX = dummyCamera.rotation.x;
        rotY = dummyCamera.rotation.y;
        
        if (isSidebarOpen) {
          // Push camera to its local right so target appears on the left
          // Scale offset proportionally since viewing dist is 6 instead of 16
          const floorOffset = SIDEBAR_OFFSET_UNITS * (6 / 16);
          const right = new THREE.Vector3(1, 0, 0).applyQuaternion(dummyCamera.quaternion);
          camX += right.x * floorOffset;
          camY += right.y * floorOffset;
          camZ += right.z * floorOffset;
        }
        
        break;
      }
    }

    if (isSidebarOpen) {
      switch (focusTarget.wallSide) {
        case WallSide.NORTH: camX += SIDEBAR_OFFSET_UNITS; break;
        case WallSide.SOUTH: camX -= SIDEBAR_OFFSET_UNITS; break;
        case WallSide.EAST:  camZ += SIDEBAR_OFFSET_UNITS; break;
        case WallSide.WEST:  camZ -= SIDEBAR_OFFSET_UNITS; break;
      }
    }

    transitionTargetPos.current.set(camX, camY, camZ);
    transitionTargetEuler.current.set(rotX, rotY, 0, 'YXZ');
    isTransitioning.current = true;
  }, [focusTarget, isSidebarOpen, camera]);

  useEffect(() => {
    if (!teleportTarget) return;
    transitionTargetPos.current.set(teleportTarget[0], camera.position.y, teleportTarget[2]);
    transitionTargetEuler.current.copy(euler.current);
    isTransitioning.current = true;
  }, [teleportTarget]);

  const MIN_CAM_HEIGHT = 6; // 6 feet (coordinate system is in feet)

  useFrame((state, delta) => {
    // Clamp delta to prevent massive jumps during React lag spikes
    const dt = Math.min(delta, 0.05);

    if (isTransitioning.current) {
      // During transitions, lerp ALL axes including Y toward the target
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, transitionTargetPos.current.x, dt * 4);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, transitionTargetPos.current.y, dt * 4);
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, transitionTargetPos.current.z, dt * 4);
      const targetQuat = new THREE.Quaternion().setFromEuler(transitionTargetEuler.current);
      camera.quaternion.slerp(targetQuat, dt * 4);
      
      const dist = camera.position.distanceTo(transitionTargetPos.current);
      const angleDist = camera.quaternion.angleTo(targetQuat);
      
      if (dist < 0.1 && angleDist < 0.05) {
        euler.current.setFromQuaternion(targetQuat);
        isTransitioning.current = false;
      }
    } else {
      // Scaffold Height movement (when not transitioning)
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetY, dt * 3);

      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      forward.y = 0;
      forward.normalize();
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      right.y = 0;
      right.normalize();

      velocity.current.set(0, 0, 0);
      if (keys.current['w'] || keys.current['arrowup']) velocity.current.add(forward);
      if (keys.current['s'] || keys.current['arrowdown']) velocity.current.sub(forward);
      if (keys.current['a'] || keys.current['arrowleft']) velocity.current.sub(right);
      if (keys.current['d'] || keys.current['arrowright']) velocity.current.add(right);

      // Virtual joystick input (mobile)
      if (Math.abs(joystickInput.x) > 0.05 || Math.abs(joystickInput.y) > 0.05) {
        velocity.current.addScaledVector(right, joystickInput.x);
        velocity.current.addScaledVector(forward, -joystickInput.y);
        if (onNavigate) onNavigate();
      }

      if (velocity.current.lengthSq() > 0) {
        velocity.current.normalize().multiplyScalar(MOVEMENT_SPEED);
        camera.position.add(velocity.current);
      }
    }

    // Enforce minimum camera height of 6 feet at all times
    camera.position.y = Math.max(camera.position.y, MIN_CAM_HEIGHT);

    const halfWidth = (effectiveBounds?.halfWidth ?? ROOM_WIDTH / 2) - COLLISION_BUFFER;
    const halfDepth = (effectiveBounds?.halfDepth ?? ROOM_DEPTH / 2) - COLLISION_BUFFER;
    camera.position.x = Math.max(-halfWidth, Math.min(halfWidth, camera.position.x));
    camera.position.z = Math.max(-halfDepth, Math.min(halfDepth, camera.position.z));
  });

  return null;
};

export default Controls;
