
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { TransformControls, Outlines } from '@react-three/drei';
import * as THREE from 'three';
import { InteriorBox } from '../types';
import { gizmoState } from './gizmoState';
import { loadTextureCached } from '../textureCache';

// ---------------------------------------------------------------------------
// Checkerboard placeholder texture (module-level singleton, created once)
// ---------------------------------------------------------------------------
let _checkerboardTexture: THREE.CanvasTexture | null = null;

function getCheckerboardTexture(): THREE.CanvasTexture {
  if (_checkerboardTexture) return _checkerboardTexture;

  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const tileSize = 16;
  for (let y = 0; y < size; y += tileSize) {
    for (let x = 0; x < size; x += tileSize) {
      ctx.fillStyle = ((x + y) / tileSize) % 2 === 0 ? '#dddddd' : '#aaaaaa';
      ctx.fillRect(x, y, tileSize, tileSize);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  _checkerboardTexture = tex;
  return tex;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface PlacedBoxProps {
  box: InteriorBox;
  isAdminMode: boolean;
  isSelected: boolean;
  transformMode: 'translate' | 'rotate' | 'scale';
  onSelect: (box: InteriorBox) => void;
  onTransformEnd: (box: InteriorBox) => void;
}

// ---------------------------------------------------------------------------
// Face order for THREE.BoxGeometry material indices:
//   0: +X (right), 1: -X (left), 2: +Y (top),
//   3: -Y (bottom), 4: +Z (front), 5: -Z (back)
// ---------------------------------------------------------------------------
const FACE_KEYS = ['right', 'left', 'top', 'bottom', 'front', 'back'] as const;

const PlacedBox: React.FC<PlacedBoxProps> = ({
  box, isAdminMode, isSelected, transformMode, onSelect, onTransformEnd
}) => {
  const { gl } = useThree();

  // Per-face materials array — one MeshBasicMaterial per face slot
  const [materials, setMaterials] = useState<THREE.MeshBasicMaterial[]>([]);

  // Refs for the pivot group and TransformControls
  const pivotRef = useRef<THREE.Group | null>(null);
  const transformRef = useRef<any>(null);
  const [pivotMounted, setPivotMounted] = useState(false);

  // ---- Safe number helper (prevents NaN from crashing the scene) ----
  const safeNum = (v: unknown, fallback = 0): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  // ---- Pivot ref callback ----
  const pivotRefCallback = useCallback((node: THREE.Group | null) => {
    pivotRef.current = node;
    setPivotMounted(!!node);
  }, []);

  // ---- Material / Texture loading (uses shared cache) ----
  useEffect(() => {
    const loadTex = (url: string) => loadTextureCached(url, gl);

    /**
     * Build 6 materials (one per face).  For each slot we resolve in order:
     *   1. Per-face texture (per-face mode)
     *   2. Uniform texture
     *   3. Solid colour
     *   4. Checkerboard placeholder
     *
     * All textures are loaded in PARALLEL for fast loading.
     */
    const build = async () => {
      // Determine URLs for each face
      const urls: (string | undefined)[] = FACE_KEYS.map(faceKey => {
        if (box.textureMode === 'per-face' && box.faceTextures) return box.faceTextures[faceKey];
        if (box.textureMode === 'uniform') return box.textureUrl;
        return undefined;
      });

      // Load all textures in parallel
      const texResults = await Promise.all(
        urls.map(url => url ? loadTex(url).catch(() => null) : Promise.resolve(null))
      );

      // Build materials from results
      const mats: THREE.MeshBasicMaterial[] = texResults.map((tex) => {
        if (tex) {
          return new THREE.MeshBasicMaterial({ map: tex, side: THREE.FrontSide, toneMapped: false });
        }
        return createFallbackMaterial(box.color);
      });

      setMaterials(mats);
    };

    build();

    // Cleanup: dispose previous materials on re-run
    return () => {
      materials.forEach((m) => {
        m.map?.dispose();
        m.dispose();
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box.textureMode, box.textureUrl, box.faceTextures, box.color, gl]);

  // ---- Compute rotation (degrees → radians) ----
  const rot = Array.isArray(box.rotation)
    ? [safeNum(box.rotation[0]), safeNum(box.rotation[1]), safeNum(box.rotation[2])]
    : [0, 0, 0];
  const xRot = (rot[0] * Math.PI) / 180;
  const yRot = (rot[1] * Math.PI) / 180;
  const zRot = (rot[2] * Math.PI) / 180;

  // ---- Sync pivot transform from props (skip while gizmo is dragging) ----
  useEffect(() => {
    if (!pivotRef.current || gizmoState.isDragging) return;
    pivotRef.current.position.set(
      safeNum(box.position[0]),
      safeNum(box.position[1]),
      safeNum(box.position[2])
    );
    pivotRef.current.rotation.set(
      safeNum(xRot),
      safeNum(yRot),
      safeNum(zRot)
    );
    pivotRef.current.scale.set(
      safeNum(box.scale[0], 1),
      safeNum(box.scale[1], 1),
      safeNum(box.scale[2], 1)
    );
  }, [box.position, box.rotation, box.scale, pivotMounted]);

  // ---- TransformControls dragging-changed listener ----
  useEffect(() => {
    const controls = transformRef.current;
    if (!controls) return;

    const onDraggingChanged = (event: { value: boolean }) => {
      gizmoState.isDragging = event.value;

      if (!event.value && pivotRef.current) {
        // Drag ended — read transform from the pivot group
        const pivot = pivotRef.current;

        const precise = gizmoState.precisionMode;

        // Position snapping
        const snapPos = (v: number) => precise
          ? Math.round(safeNum(v) * 4) / 4   // 0.25 ft precision
          : Math.round(safeNum(v) * 1) / 1;  // 1 ft coarse
        const pos: [number, number, number] = [
          snapPos(pivot.position.x),
          snapPos(pivot.position.y),
          snapPos(pivot.position.z),
        ];

        // Rotation: convert radians → degrees
        let xDeg = safeNum((pivot.rotation.x * 180) / Math.PI) % 360;
        let yDeg = safeNum((pivot.rotation.y * 180) / Math.PI) % 360;
        let zDeg = safeNum((pivot.rotation.z * 180) / Math.PI) % 360;
        if (xDeg < 0) xDeg += 360;
        if (yDeg < 0) yDeg += 360;
        if (zDeg < 0) zDeg += 360;
        const snapRot = (v: number) => precise
          ? Math.round(v * 10) / 10
          : Math.round(v);
        const rotation: [number, number, number] = [
          snapRot(xDeg),
          snapRot(yDeg),
          snapRot(zDeg),
        ];

        // Scale snapping
        const snapScale = (v: number) => precise
          ? Math.max(0.1, Math.round(Math.abs(safeNum(v, 1)) * 10) / 10)  // 0.1 precision
          : Math.max(0.5, Math.round(Math.abs(safeNum(v, 1)) * 2) / 2);   // 0.5 coarse
        const scale: [number, number, number] = [
          snapScale(pivot.scale.x),
          snapScale(pivot.scale.y),
          snapScale(pivot.scale.z),
        ];

        onTransformEnd({
          ...box,
          position: pos,
          rotation,
          scale,
        });
      }
    };

    controls.addEventListener('dragging-changed', onDraggingChanged);
    return () => controls.removeEventListener('dragging-changed', onDraggingChanged);
  }, [isSelected, box, onTransformEnd]);

  // ---- Axis visibility per transform mode ----
  const axisVisibility = useMemo(() => {
    switch (transformMode) {
      case 'rotate':  return { showX: true, showY: true, showZ: true };
      case 'scale':   return { showX: true, showY: true, showZ: true };
      default:        return { showX: true, showY: true, showZ: true };
    }
  }, [transformMode]);

  // ---- Snapping values for TransformControls ----
  const translationSnap = gizmoState.precisionMode ? 0.25 : 1;
  const rotationSnap = gizmoState.precisionMode ? Math.PI / 36 : Math.PI / 12;
  const scaleSnap = gizmoState.precisionMode ? 0.1 : 0.5;

  // ---- Edge geometry for admin wireframe overlay ----
  const edgesGeo = useMemo(() => {
    const base = new THREE.BoxGeometry(1, 1, 1);
    const edges = new THREE.EdgesGeometry(base);
    base.dispose();
    return edges;
  }, []);

  // ---- Base vs center pivot offset ----
  // When pivotAtBase: mesh sits above pivot by half unit height
  const meshOffset: [number, number, number] = gizmoState.pivotAtBase ? [0, 0.5, 0] : [0, 0, 0];

  return (
    <group>
      {/* TransformControls gizmo — targets the pivot group */}
      {isSelected && isAdminMode && pivotMounted && pivotRef.current && (
        <TransformControls
          ref={transformRef}
          object={pivotRef.current}
          mode={transformMode}
          translationSnap={translationSnap}
          rotationSnap={rotationSnap}
          scaleSnap={scaleSnap}
          size={0.8}
          {...axisVisibility}
        />
      )}

      {/* Pivot group: positioned at base center (or geometric center) */}
      <group ref={pivotRefCallback}>
        {/* Main textured / coloured mesh */}
        <mesh
          position={meshOffset}
          renderOrder={box.renderOrder || 0}
          material={materials.length === 6 ? materials : undefined}
          onClick={(e) => {
            if (isAdminMode) {
              e.stopPropagation();
              onSelect(box);
            }
          }}
        >
          <boxGeometry args={[1, 1, 1]} />
          {/* Fallback material while textures are loading */}
          {materials.length !== 6 && (
            <meshBasicMaterial color={box.color || '#cccccc'} />
          )}
        </mesh>

        {/* Admin wireframe overlay using EdgesGeometry */}
        {isAdminMode && (
          <lineSegments position={meshOffset} geometry={edgesGeo}>
            <lineBasicMaterial
              color={isSelected ? '#00ddff' : '#003355'}
              transparent
              opacity={isSelected ? 0.8 : 0.25}
            />
          </lineSegments>
        )}

        {/* Bright selection outline */}
        {isAdminMode && isSelected && gizmoState.showOutlines && (
          <mesh position={meshOffset}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial visible={false} />
            <Outlines thickness={4} color="#00ddff" />
          </mesh>
        )}
      </group>
    </group>
  );
};

// ---------------------------------------------------------------------------
// Helper: create a fallback material (solid colour or checkerboard)
// ---------------------------------------------------------------------------
function createFallbackMaterial(color?: string): THREE.MeshBasicMaterial {
  if (color) {
    return new THREE.MeshBasicMaterial({ color, side: THREE.FrontSide });
  }
  // No colour specified — use checkerboard placeholder
  return new THREE.MeshBasicMaterial({
    map: getCheckerboardTexture(),
    side: THREE.FrontSide,
  });
}

export default PlacedBox;
