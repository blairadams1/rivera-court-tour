
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { TransformControls, Outlines } from '@react-three/drei';
import * as THREE from 'three';
import { InteriorCylinder } from '../types';
import { gizmoState } from './gizmoState';

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
interface PlacedCylinderProps {
  cylinder: InteriorCylinder;
  isAdminMode: boolean;
  isSelected: boolean;
  transformMode: 'translate' | 'rotate' | 'scale';
  onSelect: (cyl: InteriorCylinder) => void;
  onTransformEnd: (cyl: InteriorCylinder) => void;
}

// ---------------------------------------------------------------------------
// Face order for THREE.CylinderGeometry material indices:
//   0: side body,  1: top cap,  2: bottom cap
// ---------------------------------------------------------------------------
const FACE_KEYS = ['side', 'top', 'bottom'] as const;

const PlacedCylinder: React.FC<PlacedCylinderProps> = ({
  cylinder, isAdminMode, isSelected, transformMode, onSelect, onTransformEnd
}) => {
  const { gl } = useThree();

  // Per-face materials array — one MeshBasicMaterial per material group
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

  // ---- Material / Texture loading ----
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');

    /**
     * Load a single texture and configure it for quality rendering.
     */
    const loadTex = (url: string): Promise<THREE.Texture> =>
      new Promise((resolve, reject) => {
        loader.load(
          url,
          (tex) => {
            tex.anisotropy = gl.capabilities.getMaxAnisotropy();
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.minFilter = THREE.LinearMipmapLinearFilter;
            tex.magFilter = THREE.LinearFilter;
            tex.generateMipmaps = true;
            resolve(tex);
          },
          undefined,
          (err) => {
            console.error('PlacedCylinder texture load failed:', url, err);
            reject(err);
          }
        );
      });

    /**
     * Build 3 materials (one per material group: side, top, bottom).
     * For each slot we resolve in order:
     *   1. Per-face texture (per-face mode)
     *   2. Uniform texture
     *   3. Solid colour
     *   4. Checkerboard placeholder
     */
    const build = async () => {
      const mats: THREE.MeshBasicMaterial[] = [];

      for (let i = 0; i < 3; i++) {
        const faceKey = FACE_KEYS[i];

        // Determine which texture URL (if any) applies to this face
        let url: string | undefined;
        if (cylinder.textureMode === 'per-face' && cylinder.faceTextures) {
          url = cylinder.faceTextures[faceKey];
        } else if (cylinder.textureMode === 'uniform') {
          url = cylinder.textureUrl;
        }

        if (url) {
          try {
            const tex = await loadTex(url);
            mats.push(new THREE.MeshBasicMaterial({
              map: tex,
              side: THREE.FrontSide,
              toneMapped: false,
            }));
          } catch {
            // Texture failed — fall through to colour / checkerboard
            mats.push(createFallbackMaterial(cylinder.color));
          }
        } else {
          mats.push(createFallbackMaterial(cylinder.color));
        }
      }

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
  }, [cylinder.textureMode, cylinder.textureUrl, cylinder.faceTextures, cylinder.color, gl]);

  // ---- Compute rotation (degrees → radians) ----
  const rot = Array.isArray(cylinder.rotation)
    ? [safeNum(cylinder.rotation[0]), safeNum(cylinder.rotation[1]), safeNum(cylinder.rotation[2])]
    : [0, 0, 0];
  const xRot = (rot[0] * Math.PI) / 180;
  const yRot = (rot[1] * Math.PI) / 180;
  const zRot = (rot[2] * Math.PI) / 180;

  // ---- Sync pivot transform from props (skip while gizmo is dragging) ----
  useEffect(() => {
    if (!pivotRef.current || gizmoState.isDragging) return;
    pivotRef.current.position.set(
      safeNum(cylinder.position[0]),
      safeNum(cylinder.position[1]),
      safeNum(cylinder.position[2])
    );
    pivotRef.current.rotation.set(
      safeNum(xRot),
      safeNum(yRot),
      safeNum(zRot)
    );
    pivotRef.current.scale.set(
      safeNum(cylinder.scale[0], 1),
      safeNum(cylinder.scale[1], 1),
      safeNum(cylinder.scale[2], 1)
    );
  }, [cylinder.position, cylinder.rotation, cylinder.scale, pivotMounted]);

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
          ...cylinder,
          position: pos,
          rotation,
          scale,
        });
      }
    };

    controls.addEventListener('dragging-changed', onDraggingChanged);
    return () => controls.removeEventListener('dragging-changed', onDraggingChanged);
  }, [isSelected, cylinder, onTransformEnd]);

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

  // ---- Cylinder geometry segments ----
  const segments = cylinder.segments || 32;

  // ---- Edge geometry for admin wireframe overlay ----
  const edgesGeo = useMemo(() => {
    const base = new THREE.CylinderGeometry(0.5, 0.5, 1, segments);
    const edges = new THREE.EdgesGeometry(base);
    base.dispose();
    return edges;
  }, [segments]);

  // ---- Base vs center pivot offset ----
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
          renderOrder={cylinder.renderOrder || 0}
          material={materials.length === 3 ? materials : undefined}
          onClick={(e) => {
            if (isAdminMode) {
              e.stopPropagation();
              onSelect(cylinder);
            }
          }}
        >
          <cylinderGeometry args={[0.5, 0.5, 1, segments]} />
          {/* Fallback material while textures are loading */}
          {materials.length !== 3 && (
            <meshBasicMaterial color={cylinder.color || '#cccccc'} />
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
            <cylinderGeometry args={[0.5, 0.5, 1, segments]} />
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

export default PlacedCylinder;
