import React from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ROOM_WIDTH, ROOM_DEPTH } from '../constants';

const CameraTracker: React.FC = () => {
  const forward = new THREE.Vector3();

  useFrame(({ camera }) => {
    const player = document.getElementById('minimap-player');
    const cone = document.getElementById('minimap-cone');
    
    if (player && cone) {
      const left = ((camera.position.x + ROOM_WIDTH / 2) / ROOM_WIDTH) * 100;
      const top = ((camera.position.z + ROOM_DEPTH / 2) / ROOM_DEPTH) * 100;
      
      player.style.left = `${left}%`;
      player.style.top = `${top}%`;

      forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
      const angle = Math.atan2(-forward.x, -forward.z);
      cone.style.transform = `rotate(${-angle}rad)`;
    }
  });

  return null;
};

export default CameraTracker;
