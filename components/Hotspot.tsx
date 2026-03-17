
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Hotspot as HotspotType, WallSide } from '../types';

interface HotspotProps {
  data: HotspotType;
  onClick: (data: HotspotType) => void;
  isAdminMode?: boolean;
  isDragging?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

const Hotspot: React.FC<HotspotProps> = ({ 
  data, 
  onClick, 
  isAdminMode, 
  isDragging, 
  onDragStart, 
  onDragEnd 
}) => {
  const innerRingRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const labelRef = useRef<THREE.Group>(null);

  const { baseColor, rotation, offsetPosition } = useMemo(() => {
    const color = isDragging ? "#ffffff" : "#005e99";

    let rot: [number, number, number] = [0, 0, 0];
    let offset: [number, number, number] = [...data.position] as [number, number, number];
    const surfaceOffset = 0.25;

    switch (data.wallSide) {
      case WallSide.NORTH: rot = [0, 0, 0]; offset[2] += surfaceOffset; break;
      case WallSide.SOUTH: rot = [0, Math.PI, 0]; offset[2] -= surfaceOffset; break;
      case WallSide.EAST:  rot = [0, -Math.PI / 2, 0]; offset[0] -= surfaceOffset; break;
      case WallSide.WEST:  rot = [0, Math.PI / 2, 0]; offset[0] += surfaceOffset; break;
      case WallSide.FLOOR: rot = [-Math.PI / 2, 0, 0]; offset[1] = 0.05; break;
    }

    return { baseColor: color, rotation: rot, offsetPosition: offset };
  }, [data.mediaType, data.wallSide, data.position, isAdminMode, isDragging]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (innerRingRef.current) {
      const s = isDragging ? 1.4 : 1.1 + Math.cos(t * 4) * 0.15;
      innerRingRef.current.scale.set(s, s, s);
      (innerRingRef.current.material as THREE.MeshBasicMaterial).opacity = isDragging ? 0.8 : 0.6 + Math.cos(t * 4) * 0.3;
    }
    if (coreRef.current) {
      const s = isDragging ? 1.5 : 1.2 + Math.sin(t * 6) * 0.2;
      coreRef.current.scale.setScalar(s);
      (coreRef.current.material as THREE.MeshBasicMaterial).opacity = isDragging ? 0.9 : 0.3 + Math.sin(t * 2) * 0.25;
    }
    if (lightRef.current) {
      lightRef.current.intensity = isDragging ? 15 : 4 + Math.sin(t * 7) * 2.0;
    }
    if (labelRef.current) {
      labelRef.current.position.y = 1.6 + Math.sin(t * 3) * 0.1;
      labelRef.current.rotation.z = Math.sin(t * 1.5) * 0.1;
    }
  });

  return (
    <group position={offsetPosition} rotation={rotation} scale={[1.8, 1, 1]}>
      <pointLight ref={lightRef} color={baseColor} intensity={5} distance={15} decay={2} />

      {/* Inner ring */}
      <mesh 
        ref={innerRingRef}
        onPointerDown={(e) => {
          if (isAdminMode) {
            e.stopPropagation();
            onDragStart?.();
          }
        }}
        onPointerUp={(e) => {
          if (isAdminMode) {
            e.stopPropagation();
            onDragEnd?.();
          }
        }}
        onClick={(e) => {
          e.stopPropagation();
          onClick(data);
        }}
        onPointerOver={() => (document.body.style.cursor = isAdminMode ? 'move' : 'pointer')}
        onPointerOut={() => (document.body.style.cursor = 'default')}
      >
        <ringGeometry args={[0.45, 0.6, 48]} />
        <meshBasicMaterial color={baseColor} transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>

      {/* Core - animated transparency */}
      <mesh ref={coreRef}>
        <circleGeometry args={[0.25, 32]} />
        <meshBasicMaterial color={baseColor} transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>

      {isAdminMode && isDragging && (
        <mesh rotation={[0, 0, 0]} position={[0, 0, -0.1]}>
          <ringGeometry args={[0.0, 15, 32]} />
          <meshBasicMaterial color="#005e99" transparent opacity={0.1} />
        </mesh>
      )}



      <mesh 
        visible={false} 
        onPointerDown={(e) => {
          if (isAdminMode) {
            e.stopPropagation();
            onDragStart?.();
          }
        }}
        onPointerUp={(e) => {
          if (isAdminMode) {
            e.stopPropagation();
            onDragEnd?.();
          }
        }}
        onClick={(e) => {
          e.stopPropagation();
          onClick(data);
        }}
      >
        <circleGeometry args={[2.5, 16]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  );
};

export default Hotspot;
