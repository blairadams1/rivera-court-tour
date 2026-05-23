
import React, { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ROOM_WIDTH, ROOM_DEPTH, ROOM_HEIGHT } from '../constants';
import { gizmoState } from './gizmoState';
import type { ViewMode } from './AdminViewToolbar';

interface ViewConfig {
  position: [number, number, number];
  target: [number, number, number];
  up: [number, number, number];
  frustumSize: number;
}

const VIEW_CONFIGS: Record<Exclude<ViewMode, 'free'>, ViewConfig> = {
  top: {
    position: [0, 100, 0],
    target: [0, 0, 0],
    up: [0, 0, -1],
    frustumSize: 40,
  },
  north: {
    position: [0, ROOM_HEIGHT / 2, 50],
    target: [0, ROOM_HEIGHT / 2, -ROOM_DEPTH / 2],
    up: [0, 1, 0],
    frustumSize: 25,
  },
  south: {
    position: [0, ROOM_HEIGHT / 2, -50],
    target: [0, ROOM_HEIGHT / 2, ROOM_DEPTH / 2],
    up: [0, 1, 0],
    frustumSize: 25,
  },
  east: {
    position: [-50, ROOM_HEIGHT / 2, 0],
    target: [ROOM_WIDTH / 2, ROOM_HEIGHT / 2, 0],
    up: [0, 1, 0],
    frustumSize: 25,
  },
  west: {
    position: [50, ROOM_HEIGHT / 2, 0],
    target: [-ROOM_WIDTH / 2, ROOM_HEIGHT / 2, 0],
    up: [0, 1, 0],
    frustumSize: 25,
  },
};

interface OrthoViewControllerProps {
  viewMode: Exclude<ViewMode, 'free'>;
}

const OrthoViewController: React.FC<OrthoViewControllerProps> = ({ viewMode }) => {
  const { gl, set, size, camera } = useThree();
  const perspCameraRef = useRef<THREE.Camera | null>(null);
  const orthoCameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const isFirstView = useRef(true);

  // Animation state
  const targetPosition = useRef(new THREE.Vector3());
  const targetQuaternion = useRef(new THREE.Quaternion());
  const targetUp = useRef(new THREE.Vector3(0, 1, 0));
  const targetFrustumSize = useRef(25);
  const currentFrustumSize = useRef(25);
  const isAnimating = useRef(false);

  // Save perspective camera on first render (before swapping)
  if (!perspCameraRef.current && camera instanceof THREE.PerspectiveCamera) {
    perspCameraRef.current = camera;
  }

  // Restore perspective camera on unmount
  useEffect(() => {
    return () => {
      if (perspCameraRef.current) {
        set({ camera: perspCameraRef.current as any });
      }
      isFirstView.current = true;
    };
  }, [set]);

  // Create camera on first view, animate on subsequent view changes
  useEffect(() => {
    const config = VIEW_CONFIGS[viewMode];
    if (!config) return;

    // Reset zoom on every view change
    gizmoState.orthoZoom = 1;

    // Compute the target orientation using a dummy CAMERA (not Object3D!)
    // Camera.lookAt() points -Z at the target, while Object3D.lookAt() points +Z — they differ by 180°.
    const dummyCam = new THREE.Camera();
    dummyCam.position.set(...config.position);
    dummyCam.up.set(...config.up);
    dummyCam.lookAt(new THREE.Vector3(...config.target));

    if (isFirstView.current || !orthoCameraRef.current) {
      // First view: create the ortho camera at the target position immediately
      const aspect = size.width / size.height;
      const fs = config.frustumSize;

      const ortho = new THREE.OrthographicCamera(
        -fs * aspect, fs * aspect, fs, -fs, 0.1, 300
      );
      ortho.position.set(...config.position);
      ortho.up.set(...config.up);
      ortho.lookAt(new THREE.Vector3(...config.target));
      ortho.zoom = 1;
      currentFrustumSize.current = fs;
      ortho.updateProjectionMatrix();

      orthoCameraRef.current = ortho;
      set({ camera: ortho as any });
      isFirstView.current = false;
    } else {
      // Subsequent views: set animation targets and let useFrame handle the transition
      targetPosition.current.set(...config.position);
      targetQuaternion.current.copy(dummyCam.quaternion);
      targetUp.current.set(...config.up);
      targetFrustumSize.current = config.frustumSize;
      isAnimating.current = true;
    }
  }, [viewMode, set]);

  // Handle window resize (update frustum aspect without resetting zoom/pan)
  useEffect(() => {
    if (!orthoCameraRef.current) return;
    const aspect = size.width / size.height;
    const fs = currentFrustumSize.current;
    const cam = orthoCameraRef.current;
    cam.left = -fs * aspect;
    cam.right = fs * aspect;
    cam.top = fs;
    cam.bottom = -fs;
    cam.updateProjectionMatrix();
  }, [size]);

  // Animation loop: smooth transitions + smooth zoom
  useFrame((_, delta) => {
    if (!orthoCameraRef.current) return;
    const cam = orthoCameraRef.current;
    const dt = Math.min(delta, 0.05);

    // ---- View transition animation ----
    if (isAnimating.current) {
      const speed = 8;
      const lerpFactor = Math.min(1, dt * speed);

      cam.position.lerp(targetPosition.current, lerpFactor);
      cam.quaternion.slerp(targetQuaternion.current, lerpFactor);

      // Animate frustum size for smooth field-of-view transition
      const fsDiff = targetFrustumSize.current - currentFrustumSize.current;
      if (Math.abs(fsDiff) > 0.01) {
        currentFrustumSize.current += fsDiff * lerpFactor;
        const aspect = size.width / size.height;
        cam.left = -currentFrustumSize.current * aspect;
        cam.right = currentFrustumSize.current * aspect;
        cam.top = currentFrustumSize.current;
        cam.bottom = -currentFrustumSize.current;
      }

      // Snap when close enough
      const posDist = cam.position.distanceTo(targetPosition.current);
      const angleDist = cam.quaternion.angleTo(targetQuaternion.current);
      if (posDist < 0.05 && angleDist < 0.01) {
        cam.position.copy(targetPosition.current);
        cam.quaternion.copy(targetQuaternion.current);
        cam.up.copy(targetUp.current);
        currentFrustumSize.current = targetFrustumSize.current;

        const aspect = size.width / size.height;
        cam.left = -currentFrustumSize.current * aspect;
        cam.right = currentFrustumSize.current * aspect;
        cam.top = currentFrustumSize.current;
        cam.bottom = -currentFrustumSize.current;

        isAnimating.current = false;
      }

      cam.updateProjectionMatrix();
    }

    // ---- Smooth zoom (responds to scroll-wheel and +/− buttons via gizmoState) ----
    const targetZoom = gizmoState.orthoZoom;
    if (Math.abs(cam.zoom - targetZoom) > 0.001) {
      cam.zoom = THREE.MathUtils.lerp(cam.zoom, targetZoom, dt * 12);
      cam.updateProjectionMatrix();
    }
  });

  // Pan (mouse drag) and zoom (scroll wheel) event handlers
  useEffect(() => {
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      gizmoState.orthoZoom = Math.max(0.2, Math.min(10, gizmoState.orthoZoom * factor));
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (gizmoState.isDragging || isAnimating.current) return;
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !orthoCameraRef.current || gizmoState.isDragging) return;

      const cam = orthoCameraRef.current;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;

      // Pan speed inversely proportional to zoom
      const panScale = (cam.right - cam.left) / (size.width * cam.zoom);
      const right = new THREE.Vector3();
      const up = new THREE.Vector3();
      const forward = new THREE.Vector3();
      cam.matrixWorld.extractBasis(right, up, forward);

      cam.position.addScaledVector(right, -dx * panScale);
      cam.position.addScaledVector(up, dy * panScale);
    };

    const handleMouseUp = () => { isDragging = false; };

    // Touch support
    let touchStartX = 0;
    let touchStartY = 0;
    let isTouchDragging = false;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1 && !gizmoState.isDragging && !isAnimating.current) {
        isTouchDragging = true;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isTouchDragging || !orthoCameraRef.current || gizmoState.isDragging) return;
      if (e.touches.length !== 1) return;

      const cam = orthoCameraRef.current;
      const dx = e.touches[0].clientX - touchStartX;
      const dy = e.touches[0].clientY - touchStartY;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;

      const panScale = (cam.right - cam.left) / (size.width * cam.zoom);
      const right = new THREE.Vector3();
      const up = new THREE.Vector3();
      const forward = new THREE.Vector3();
      cam.matrixWorld.extractBasis(right, up, forward);

      cam.position.addScaledVector(right, -dx * panScale);
      cam.position.addScaledVector(up, dy * panScale);
    };

    const handleTouchEnd = () => { isTouchDragging = false; };

    const domElement = gl.domElement;
    domElement.addEventListener('wheel', handleWheel, { passive: false });
    domElement.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    domElement.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      domElement.removeEventListener('wheel', handleWheel);
      domElement.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      domElement.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [gl, size]);

  return null;
};

export default OrthoViewController;
