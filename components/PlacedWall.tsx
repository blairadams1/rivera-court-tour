
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { TransformControls, Outlines } from '@react-three/drei';
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

  // ---- Safe number helper (prevents NaN from crashing the scene) ----
  const safeNum = (v: unknown, fallback = 0): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  // ---- Compute rotation ----
  // Migrate legacy single-number (Y-only) rotation to [x, y, z] tuple
  const rot = Array.isArray(wall.rotation)
    ? [safeNum(wall.rotation[0]), safeNum(wall.rotation[1]), safeNum(wall.rotation[2])]
    : [0, safeNum(wall.rotation), 0];
  const xRot = (rot[0] * Math.PI) / 180;
  const yRot = (rot[1] * Math.PI) / 180;
  const zRot = (rot[2] * Math.PI) / 180;
  const isFloor = wall.type === 'floor';
  const isCeiling = wall.type === 'ceiling';
  const isHorizontal = isFloor || isCeiling;
  // Floors face up (-PI/2), ceilings face down (+PI/2)
  const baseXTilt = isFloor ? -Math.PI / 2 : isCeiling ? Math.PI / 2 : 0;
  const pivotRotation: [number, number, number] = [baseXTilt + xRot, yRot, zRot];

  // Mesh offset: for base-pivot walls, shift up by 0.5 in local space so the
  // pivot group's origin sits at the bottom edge of the plane.
  // For floors/ceilings (horizontal) or center-pivot mode, keep origin at center.
  const useBasePivot = gizmoState.pivotAtBase && !isHorizontal;
  const meshOffset: [number, number, number] = useBasePivot ? [0, 0.5, 0] : [0, 0, 0];

  // ---- Sync pivot transform from props (only when not being gizmo-dragged) ----
  useEffect(() => {
    if (!pivotRef.current || gizmoState.isDragging) return;
    // Base-pivot: pivot at bottom edge; center-pivot: pivot at stored center Y
    const pivotY = useBasePivot
      ? wall.position[1] - wall.scale[1] / 2
      : wall.position[1];
    pivotRef.current.position.set(
      safeNum(wall.position[0]),
      safeNum(pivotY),
      safeNum(wall.position[2])
    );
    // Only set rotation from props when NOT in billboard mode
    // (billboard mode handles rotation in useFrame)
    if (!wall.billboard || isHorizontal) {
      pivotRef.current.rotation.set(
        safeNum(pivotRotation[0]),
        safeNum(pivotRotation[1]),
        safeNum(pivotRotation[2])
      );
    }
    pivotRef.current.scale.set(safeNum(wall.scale[0], 1), safeNum(wall.scale[1], 1), 1);
  }, [wall.position, wall.rotation, wall.scale, wall.type, wall.billboard, pivotMounted]);

  // ---- Billboard: rotate Y to always face camera ----
  useFrame(() => {
    if (!pivotRef.current || !wall.billboard || isHorizontal) return;
    // Don't override rotation while gizmo is being dragged in rotate mode
    if (gizmoState.isDragging && transformMode === 'rotate') return;

    const pivot = pivotRef.current;
    // Compute angle from pivot to camera on the XZ plane
    const dx = camera.position.x - pivot.position.x;
    const dz = camera.position.z - pivot.position.z;
    const angle = Math.atan2(dx, dz); // Y rotation to face camera

    pivot.rotation.set(0, safeNum(angle), 0);
  });

  // ---- TransformControls dragging-changed listener ----
  useEffect(() => {
    const controls = transformRef.current;
    if (!controls) return;

    const onDraggingChanged = (event: { value: boolean }) => {
      gizmoState.isDragging = event.value;
      if (!event.value && pivotRef.current) {
        // Drag ended — read from pivot and convert to center Y for storage
        const pivot = pivotRef.current;

        // Base pivot: convert base Y back to center Y for storage
        // Center pivot: use Y directly (already center Y)
        const rawY = useBasePivot
          ? pivot.position.y + Math.abs(pivot.scale.y) / 2
          : pivot.position.y;

        // Position
        const precise = gizmoState.precisionMode;
        const snapPos = (v: number) => precise
          ? Math.round(safeNum(v) * 100) / 100
          : Math.round(safeNum(v) * 2) / 2;
        const pos: [number, number, number] = [
          snapPos(pivot.position.x),
          snapPos(rawY),
          snapPos(pivot.position.z)
        ];

        // Rotation: extract all three axes in degrees
        let snappedRot: [number, number, number] = Array.isArray(wall.rotation)
          ? [safeNum(wall.rotation[0]), safeNum(wall.rotation[1]), safeNum(wall.rotation[2])]
          : [0, safeNum(wall.rotation), 0];
        if (!wall.billboard || isHorizontal) {
          // For horizontal planes, subtract the base X tilt before storing
          const baseX = baseXTilt;
          let xDeg = safeNum(((pivot.rotation.x - baseX) * 180) / Math.PI) % 360;
          let yDeg = safeNum((pivot.rotation.y * 180) / Math.PI) % 360;
          let zDeg = safeNum((pivot.rotation.z * 180) / Math.PI) % 360;
          if (xDeg < 0) xDeg += 360;
          if (yDeg < 0) yDeg += 360;
          if (zDeg < 0) zDeg += 360;
          const snapRot = (v: number) => precise ? Math.round(v * 10) / 10 : Math.round(v);
          snappedRot = [snapRot(xDeg), snapRot(yDeg), snapRot(zDeg)];
        }

        // Scale: read and round
        const snapScale = (v: number) => precise
          ? Math.max(0.1, Math.round(Math.abs(safeNum(v, 1)) * 100) / 100)
          : Math.max(0.5, Math.round(Math.abs(safeNum(v, 1)) * 2) / 2);
        const newScale: [number, number] = [
          snapScale(pivot.scale.x),
          snapScale(pivot.scale.y)
        ];

        onTransformEnd({
          ...wall,
          position: pos,
          rotation: snappedRot,
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
      case 'rotate':  return { showX: true, showY: true, showZ: true };
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
          rotationSnap={gizmoState.precisionMode ? null : Math.PI / 12}
          translationSnap={gizmoState.precisionMode ? null : 0.5}
          size={0.8}
          {...axisVisibility}
        />
      )}

      {/* Pivot group: positioned at the base of the wall */}
      <group ref={pivotRefCallback}>
        {/* Main mesh — offset upward so pivot origin is at the base */}
        <mesh
          position={meshOffset}
          renderOrder={wall.renderOrder || 0}
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
              depthWrite={!hasAlpha && !(wall.renderOrder && wall.renderOrder > 0)}
              depthTest={!(wall.renderOrder && wall.renderOrder > 0)}
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
              color={isSelected ? '#00ddff' : '#005e99'}
              wireframe
              transparent
              opacity={isSelected ? 0.8 : 0.4}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}

        {/* Bright selection outline */}
        {isAdminMode && isSelected && gizmoState.showOutlines && (
          <mesh position={meshOffset}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial visible={false} />
            <Outlines thickness={4} color="#00ddff" />
          </mesh>
        )}
      </group>
    </group>
  );
};

export default PlacedWall;
