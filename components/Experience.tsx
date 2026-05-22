
import React, { useMemo } from 'react';
import { MeshReflectorMaterial, Environment, Stars, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import MuralWall from './MuralWall';
import Hotspot from './Hotspot';
import PlacedWall from './PlacedWall';
import Controls from './Controls';
import CameraTracker from './CameraTracker';
import { WALLS, ROOM_WIDTH, ROOM_DEPTH, ROOM_HEIGHT, FLOOR_IMAGE_URL, CEILING_IMAGE_URL } from '../constants';
import { Hotspot as HotspotType, WallSide, InteriorWall } from '../types';
import { gizmoState } from './gizmoState';

interface ExperienceProps {
  scaffoldHeight: number;
  hotspots: HotspotType[];
  onHotspotClick: (hotspot: HotspotType) => void;
  isAdminMode: boolean;
  onWallClick: (position: [number, number, number], side: WallSide) => void;
  onDragHotspot: (id: string, position: [number, number, number]) => void;
  draggingHotspotId: string | null;
  setDraggingHotspotId: (id: string | null) => void;
  focusTarget: { position: [number, number, number]; wallSide: WallSide } | null;
  teleportTarget?: [number, number, number] | null;
  isSidebarOpen?: boolean;
  onNavigate?: () => void;
  hotspotsVisible?: boolean;
  interiorWalls?: InteriorWall[];
  onInteriorWallClick?: (wall: InteriorWall) => void;
  effectiveBounds?: { halfWidth: number; halfDepth: number };
  selectedWallId?: string | null;
  transformMode?: 'translate' | 'rotate' | 'scale';
  onWallTransformEnd?: (wall: InteriorWall) => void;
}

const Experience: React.FC<ExperienceProps> = ({ 
  scaffoldHeight, 
  hotspots, 
  onHotspotClick,
  isAdminMode,
  onWallClick,
  onDragHotspot,
  draggingHotspotId,
  setDraggingHotspotId,
  focusTarget,
  teleportTarget,
  isSidebarOpen = false,
  onNavigate,
  hotspotsVisible = true,
  interiorWalls = [],
  onInteriorWallClick,
  effectiveBounds,
  selectedWallId = null,
  transformMode = 'translate',
  onWallTransformEnd
}) => {
  const floorTexture = useTexture(FLOOR_IMAGE_URL);
  const ceilingTexture = useTexture(CEILING_IMAGE_URL);
  
  // Set texture properties for better appearance and performance
  useMemo(() => {
    if (floorTexture) {
      floorTexture.colorSpace = THREE.SRGBColorSpace;
      floorTexture.anisotropy = 16;
      floorTexture.wrapS = floorTexture.wrapT = THREE.ClampToEdgeWrapping;
    }
    if (ceilingTexture) {
      ceilingTexture.colorSpace = THREE.SRGBColorSpace;
      ceilingTexture.anisotropy = 16;
      ceilingTexture.wrapS = ceilingTexture.wrapT = THREE.ClampToEdgeWrapping;
    }
  }, [floorTexture, ceilingTexture]);

  return (
    <>
      <color attach="background" args={['#050505']} />
      
      {/* Balanced, even lighting for floor and ceiling without creating bright spots */}
      <ambientLight intensity={1.2} />
      <directionalLight position={[0, 40, 0]} intensity={0.5} />

      {WALLS.map((wall, i) => (
        <group 
          key={i} 
          onDoubleClick={(e) => {
            if (isAdminMode && !draggingHotspotId && !gizmoState.hotspotLocked) {
              e.stopPropagation();
              onWallClick([e.point.x, e.point.y, e.point.z], wall.side);
            }
          }}
          onPointerMove={(e) => {
            if (isAdminMode && draggingHotspotId && !gizmoState.hotspotLocked) {
              e.stopPropagation();
              const hotspot = hotspots.find(h => h.id === draggingHotspotId);
              if (hotspot && hotspot.wallSide === wall.side) {
                let pos: [number, number, number] = [e.point.x, e.point.y, e.point.z];
                const halfWidth = ROOM_WIDTH / 2;
                const halfDepth = ROOM_DEPTH / 2;
                
                switch (wall.side) {
                  case WallSide.NORTH: pos[2] = -halfDepth; break;
                  case WallSide.SOUTH: pos[2] = halfDepth; break;
                  case WallSide.EAST:  pos[0] = halfWidth; break;
                  case WallSide.WEST:  pos[0] = -halfWidth; break;
                }
                onDragHotspot(draggingHotspotId, pos);
              }
            }
          }}
          onPointerUp={(e) => {
            if (isAdminMode && draggingHotspotId && !gizmoState.hotspotLocked) {
              e.stopPropagation();
              setDraggingHotspotId(null);
            }
          }}
        >
          <MuralWall config={wall} />
        </group>
      ))}

      {hotspotsVisible && hotspots.map((hotspot) => (
        <Hotspot 
          key={hotspot.id} 
          data={hotspot} 
          onClick={onHotspotClick} 
          isAdminMode={isAdminMode}
          isDragging={draggingHotspotId === hotspot.id}
          onDragStart={() => isAdminMode && setDraggingHotspotId(hotspot.id)}
          onDragEnd={() => setDraggingHotspotId(null)}
        />
      ))}

      {/* Interior Walls & Floors */}
      {interiorWalls.map((wall) => (
        <PlacedWall
          key={wall.id}
          wall={wall}
          isAdminMode={isAdminMode}
          isSelected={selectedWallId === wall.id}
          transformMode={transformMode}
          onSelect={onInteriorWallClick || (() => {})}
          onTransformEnd={onWallTransformEnd || (() => {})}
        />
      ))}

      {/* Floor with provided Image and Subtle Reflection */}
      <mesh 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, -0.05, 0]}
        onDoubleClick={(e) => {
          if (isAdminMode && !draggingHotspotId && !gizmoState.hotspotLocked) {
            e.stopPropagation();
            onWallClick([e.point.x, e.point.y, e.point.z], WallSide.FLOOR);
          }
        }}
        onPointerMove={(e) => {
          if (isAdminMode && draggingHotspotId && !gizmoState.hotspotLocked) {
            e.stopPropagation();
            const hotspot = hotspots.find(h => h.id === draggingHotspotId);
            if (hotspot && hotspot.wallSide === WallSide.FLOOR) {
              onDragHotspot(draggingHotspotId, [e.point.x, 0, e.point.z]);
            }
          }
        }}
        onPointerUp={(e) => {
          if (isAdminMode && draggingHotspotId && !gizmoState.hotspotLocked) {
            e.stopPropagation();
            setDraggingHotspotId(null);
          }
        }}
      >
        <planeGeometry args={[ROOM_WIDTH, ROOM_DEPTH]} />
        <MeshReflectorMaterial
          map={floorTexture}
          blur={[400, 400]} 
          resolution={1024}
          mixBlur={1}
          mixStrength={0.8} 
          roughness={1}
          depthScale={1}
          minDepthThreshold={0.9}
          maxDepthThreshold={1.2}
          color="#999999" 
          metalness={0} 
          transparent={false}
          mirror={0.12} 
        />
      </mesh>

      {/* Ceiling with provided image */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, ROOM_HEIGHT, 0]}>
        <planeGeometry args={[ROOM_WIDTH, ROOM_DEPTH]} />
        <meshStandardMaterial map={ceilingTexture} roughness={1} metalness={0} />
      </mesh>

      <Stars radius={100} depth={50} count={500} factor={4} saturation={0} fade speed={1} />
      <Controls 
        targetY={scaffoldHeight} 
        focusTarget={focusTarget} 
        teleportTarget={teleportTarget} 
        isSidebarOpen={isSidebarOpen} 
        onNavigate={onNavigate}
      />
      <CameraTracker />
      <Environment preset="studio" />
    </>
  );
};

export default Experience;
