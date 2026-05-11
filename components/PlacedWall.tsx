
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { InteriorWall } from '../types';
import { gizmoState } from './gizmoState';

interface PlacedWallProps {
  wall: InteriorWall;
  isAdminMode: boolean;
  isSelected: boolean;
  transformMode: 'translate' | 'rotate' | 'scale';
  onSelect: (wall: InteriorWall) => void;
  onTransformEnd: (wall: InteriorWall) => void;
}

const PlacedWall: React.FC<PlacedWallProps> = ({
  wall, isAdminMode, isSelected, transformMode, onSelect, onTransformEnd
}) => {
  const { gl, camera } = useThree();
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [hasAlpha, setHasAlpha] = useState(false);
  const [pivotMounted, setPivotMounted] = useState(false);

  const pivotRef = useRef<THREE.Group | null>(null);
  const transformRef = useRef<any>(null);

  // ---- Texture Loading ----
  useEffect(() => {
    if (!wall.imageUrl) return;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    loader.load(
      wall.imageUrl,
      (tex) => {
        tex.anisotropy = gl.capabilities.getMaxAnisotropy();
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = true;
        tex.premultiplyAlpha = false;
        setTexture(tex);
        setHasAlpha(wall.imageUrl.toLowerCase().includes('png'));
      },
      undefined,
      (err) => console.error('PlacedWall texture load failed:', wall.imageUrl, err)
    );
  }, [wall.imageUrl, gl]);

  // ---- Pivot ref callback ----
  const pivotRefCallback = useCallback((node: THREE.Group | null) => {
    pivotRef.current = node;
    setPivotMounted(!!node);
  }, []);

  // ---- Compute rotation ----
  const yRotation = (wall.rotation * Math.PI) / 180;
  const isFloor = wall.type === 'floor';
  const pivotRotation: [number, number, number] = isFloor
    ? [-Math.PI / 2, yRotation, 0]
    : [0, yRotation, 0];

  // Mesh offset: for walls, shift up by 0.5 in local space so the
  // pivot group's origin sits at the bottom edge of the plane.
  // For floors (horizontal), keep the origin at the center.
  const meshOffset: [number, number, number] = isFloor ? [0, 0, 0] : [0, 0.5, 0];

  // ---- Sync pivot transform from props (only when not being gizmo-dragged) ----
  useEffect(() => {
    if (!pivotRef.current || gizmoState.isDragging) return;
    // For walls the pivot sits at the base: center_y − half_height
    const baseY = isFloor ? wall.position[1] : wall.position[1] - wall.scale[1] / 2;
    pivotRef.current.position.set(wall.position[0], baseY, wall.position[2]);
    // Only set rotation from props when NOT in billboard mode
    // (billboard mode handles rotation in useFrame)
    if (!wall.billboard || isFloor) {
      pivotRef.current.rotation.set(pivotRotation[0], pivotRotation[1], pivotRotation[2]);
    }
    pivotRef.current.scale.set(wall.scale[0], wall.scale[1], 1);
  }, [wall.position, wall.rotation, wall.scale, wall.type, wall.billboard, pivotMounted]);

  // ---- Billboard: rotate Y to always face camera ----
  useFrame(() => {
    if (!pivotRef.current || !wall.billboard || isFloor) return;
    // Don't override rotation while gizmo is being dragged in rotate mode
    if (gizmoState.isDragging && transformMode === 'rotate') return;

    const pivot = pivotRef.current;
    // Compute angle from pivot to camera on the XZ plane
    const dx = camera.position.x - pivot.position.x;
    const dz = camera.position.z - pivot.position.z;
    const angle = Math.atan2(dx, dz); // Y rotation to face camera

    pivot.rotation.set(0, angle, 0);
  });

  // ---- TransformControls dragging-changed listener ----
  useEffect(() => {
    const controls = transformRef.current;
    if (!controls) return;

    const onDraggingChanged = (event: { value: boolean }) => {
      gizmoState.isDragging = event.value;
      if (!event.value && pivotRef.current) {
        // Drag ended — read from pivot and convert base→center for storage
        const pivot = pivotRef.current;

        // For walls, convert base Y back to center Y
        const rawY = isFloor
          ? pivot.position.y
          : pivot.position.y + Math.abs(pivot.scale.y) / 2;

        // Position: snap to 0.5 unit grid
        const pos: [number, number, number] = [
          Math.round(pivot.position.x * 2) / 2,
          Math.round(rawY * 2) / 2,
          Math.round(pivot.position.z * 2) / 2
        ];

        // Rotation: extract Y in degrees
        // For billboard walls, preserve the stored rotation (don't read the live camera-facing angle)
        let snappedRot = wall.rotation;
        if (!wall.billboard || isFloor) {
          let yRotDeg = ((pivot.rotation.y * 180) / Math.PI) % 360;
          if (yRotDeg < 0) yRotDeg += 360;
          snappedRot = Math.round(yRotDeg);
        }

        // Scale: read and round to 0.5
        const newScale: [number, number] = [
          Math.max(0.5, Math.round(Math.abs(pivot.scale.x) * 2) / 2),
          Math.max(0.5, Math.round(Math.abs(pivot.scale.y) * 2) / 2)
        ];

        onTransformEnd({
          ...wall,
          position: pos,
          rotation: snappedRot % 360,
          scale: newScale
        });
      }
    };

    controls.addEventListener('dragging-changed', onDraggingChanged);
    return () => controls.removeEventListener('dragging-changed', onDraggingChanged);
  }, [isSelected, wall, onTransformEnd, isFloor]);

  // ---- Axis visibility per transform mode ----
  const axisVisibility = useMemo(() => {
    switch (transformMode) {
      case 'rotate':  return { showX: false, showY: true, showZ: false };
      case 'scale':   return { showX: true, showY: true, showZ: false };
      default:        return { showX: true, showY: true, showZ: true };
    }
  }, [transformMode]);

  return (
    <group>
      {/* TransformControls gizmo — targets the pivot group at the base */}
      {isSelected && isAdminMode && pivotMounted && pivotRef.current && (
        <TransformControls
          ref={transformRef}
          object={pivotRef.current}
          mode={transformMode}
          rotationSnap={Math.PI / 12}
          translationSnap={0.5}
          size={0.8}
          {...axisVisibility}
        />
      )}

      {/* Pivot group: positioned at the base of the wall */}
      <group ref={pivotRefCallback}>
        {/* Main mesh — offset upward so pivot origin is at the base */}
        <mesh
          position={meshOffset}
          onClick={(e) => {
            if (isAdminMode) {
              e.stopPropagation();
              onSelect(wall);
            }
          }}
        >
          <planeGeometry args={[1, 1]} />
          {texture ? (
            <meshBasicMaterial
              map={texture}
              side={THREE.DoubleSide}
              transparent={true}
              alphaTest={hasAlpha ? 0.05 : 0}
              depthWrite={!hasAlpha}
              toneMapped={false}
              color="#ffffff"
            />
          ) : (
            <meshBasicMaterial
              color={wall.imageUrl ? '#333344' : '#222233'}
              side={THREE.DoubleSide}
            />
          )}
        </mesh>

        {/* Admin wireframe overlay — same offset as the textured mesh */}
        {isAdminMode && (
          <mesh position={meshOffset}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial
              color={isSelected ? '#00aaff' : '#005e99'}
              wireframe
              transparent
              opacity={isSelected ? 0.6 : 0.4}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}
      </group>
    </group>
  );
};

export default PlacedWall;
