
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import Experience from './components/Experience';
import ScaffoldingSlider from './components/ScaffoldingSlider';
import VirtualJoystick from './components/VirtualJoystick';
import HotspotInfoPanel from './components/HotspotInfoPanel';
import AdminPanel from './components/AdminPanel';
import Minimap from './components/Minimap';
import { EYE_LEVEL, ROOM_WIDTH, ROOM_DEPTH, ROOM_HEIGHT, MAX_LIFT, COLLISION_BUFFER, WALLS, FLOOR_IMAGE_URL, CEILING_IMAGE_URL } from './constants';
import { Hotspot, WallSide, InteriorWall, InteriorBox, InteriorCylinder } from './types';
import { db } from './firebase';
import { VERSION, BUILD_NUMBER } from './version';
import { collection, onSnapshot, doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
import GizmoToolbar from './components/GizmoToolbar';
import BoxGizmoToolbar from './components/BoxGizmoToolbar';
import CylinderGizmoToolbar from './components/CylinderGizmoToolbar';
import { gizmoState } from './components/gizmoState';
import AdminViewToolbar from './components/AdminViewToolbar';
import AdminBoxEditor from './components/AdminBoxEditor';
import AdminCylinderEditor from './components/AdminCylinderEditor';
import type { ViewMode } from './components/AdminViewToolbar';
import { undoManager } from './undoManager';
import { preloadTexture } from './textureCache';

// ---- Edge-snap utilities ----
/** Compute the 4 edge midpoints of a panel in world space */
function computeEdgeMidpoints(w: InteriorWall): [number, number, number][] {
  const [cx, cy, cz] = w.position;
  const [width, height] = w.scale;
  const rotArr = Array.isArray(w.rotation) ? w.rotation : [0, Number(w.rotation) || 0, 0];
  const yRad = (rotArr[1] * Math.PI) / 180;
  const cosY = Math.cos(yRad);
  const sinY = Math.sin(yRad);
  const isHoriz = w.type === 'floor' || w.type === 'ceiling';

  // Left/right edges (along local X axis, rotated by Y)
  const edges: [number, number, number][] = [
    [cx - (width / 2) * cosY, cy, cz + (width / 2) * sinY],   // left
    [cx + (width / 2) * cosY, cy, cz - (width / 2) * sinY],   // right
  ];

  if (isHoriz) {
    // Horizontal panels: front/back edges along the depth direction (local Z after X-tilt)
    edges.push(
      [cx + (height / 2) * sinY, cy, cz + (height / 2) * cosY],  // front
      [cx - (height / 2) * sinY, cy, cz - (height / 2) * cosY],  // back
    );
  } else {
    // Vertical walls: top/bottom edges (Y doesn't change with Y-rotation)
    edges.push(
      [cx, cy + height / 2, cz],  // top
      [cx, cy - height / 2, cz],  // bottom
    );
  }
  return edges;
}

/** Snap a moved wall to the nearest edge of any other wall (within threshold) */
function snapToNearestEdge(moved: InteriorWall, allWalls: InteriorWall[], threshold = 3): InteriorWall {
  const movedEdges = computeEdgeMidpoints(moved);
  let bestDist = threshold;
  let bestOffset: [number, number, number] = [0, 0, 0];

  for (const other of allWalls) {
    if (other.id === moved.id) continue;
    const otherEdges = computeEdgeMidpoints(other);
    for (const me of movedEdges) {
      for (const oe of otherEdges) {
        const dx = oe[0] - me[0];
        const dy = oe[1] - me[1];
        const dz = oe[2] - me[2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < bestDist) {
          bestDist = dist;
          bestOffset = [dx, dy, dz];
        }
      }
    }
  }

  if (bestDist < threshold) {
    return {
      ...moved,
      position: [
        moved.position[0] + bestOffset[0],
        moved.position[1] + bestOffset[1],
        moved.position[2] + bestOffset[2],
      ],
    };
  }
  return moved;
}

const INITIAL_HOTSPOTS: Hotspot[] = [
  {
    id: 'h1',
    title: 'North Wall: The Production of the Engine',
    description: 'The North Wall is the heart of the Detroit Industry cycle. It depicts the manufacture of the 1932 Ford V-8 engine. Rivera captures the rhythmic, almost religious fervor of the assembly line. Look closely at the conveyor belts—they are rendered with such precision that they seem to pulsate. The composition is famously symmetrical, drawing your eye to the towering blast furnace in the background, which Rivera likened to a modern deity fueled by the labor of the multicultural workforce.',
    wallSide: WallSide.NORTH,
    position: [0, 16.5, -21.9],
    mediaType: 'video',
    mediaUrl: 'https://www.youtube.com/watch?v=90j8p6cU5IE'
  },
  {
    id: 'h2',
    title: 'South Wall: The Stamping and Body Work',
    description: 'The South Wall mirrors the North Wall but focuses on the final assembly and the stamping of automobile bodies. The massive "multi-ton press" dominates the center of this panel. Rivera famously incorporated elements of ancient Mesoamerican culture into these industrial machines—the top of the press is stylized to resemble Coatlicue, the Aztec mother goddess. This visual bridge connects the modern industrial age with the ancient, organic power of the Earth.',
    wallSide: WallSide.SOUTH,
    position: [0, 18, 21.9],
    mediaType: 'image',
    mediaUrl: 'https://res.cloudinary.com/djjpgrjh4/image/upload/v1772637799/SouthWall_Clean_10mb_nkfgea_a6akih.png'
  },
  {
    id: 'h3',
    title: 'East Wall: Agriculture and Natural Resources',
    description: 'Flanking the large windows, the East Wall murals represent the "natural" foundations of industry. Rivera depicts the fertility of the soil and the biological origins of life. The massive figures of women represent the diverse races of mankind, holding the raw materials of the earth—iron ore, coal, and limestone—which are the literal building blocks of the machinery seen on the adjacent walls. It serves as a reminder that all industry is rooted in the natural world.',
    wallSide: WallSide.EAST,
    position: [32.9, 21.5, 0],
    mediaType: 'none'
  },
  {
    id: 'h4',
    title: 'West Wall: Aviation and Power Production',
    description: 'The West Wall focuses on the results of Detroit’s industry: aviation and electricity. The panels depict the construction of airplanes and the harness of electrical power. Rivera explores the dual nature of technology—as a tool for both progress and potential destruction. Note the hawk and the dove motifs often hidden within the structural steel, symbolizing the choice between war and peace in the application of human ingenuity.',
    wallSide: WallSide.WEST,
    position: [-32.9, 21.5, 0],
    mediaType: 'none'
  },
  {
    id: 'h5',
    title: 'The "Nativity" of Science',
    description: 'This controversial panel on the North Wall depicts a child being vaccinated. At the time of its unveiling in 1933, it sparked a massive religious protest because the composition—a doctor, nurse, and infant surrounded by animals—deliberately mirrored traditional Christian Nativity scenes. Rivera stood his ground, viewing science and medicine as the "new" miracles of the modern world.',
    wallSide: WallSide.NORTH,
    position: [-24.5, 27.5, -21.9],
    mediaType: 'image',
    mediaUrl: 'https://res.cloudinary.com/djjpgrjh4/image/upload/v1767015820/north_azislv.png'
  }
];

const DIA_LOGO_URL = "https://res.cloudinary.com/djjpgrjh4/image/upload/v1767291014/DIACircleLogo_nivfwt.png";

const OrientationBlocker = () => (
  <div className="fixed inset-0 z-[1000] bg-black flex flex-col items-center justify-center p-6 text-center portrait:flex landscape:hidden md:hidden">
    <div className="w-20 h-20 mb-6 border-2 border-white/20 rounded-xl flex items-center justify-center animate-pulse">
      <svg className="w-12 h-12 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
        <path d="M12 18h.01" />
      </svg>
    </div>
    <h2 className="font-serif text-2xl mb-2 text-white">Landscape Only</h2>
    <p className="text-white/60 text-sm max-w-[240px]">This experience is designed for landscape view. Please rotate your device.</p>
  </div>
);

const App: React.FC = () => {
  const [scaffoldHeight, setScaffoldHeight] = useState(EYE_LEVEL);
  const [showOverlay, setShowOverlay] = useState(true);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);

  // ---- Asset Preloading ----
  const [preloadedCount, setPreloadedCount] = useState(0);
  const [preloadingComplete, setPreloadingComplete] = useState(false);

  const preloadUrls = useMemo(() => {
    const urls = [FLOOR_IMAGE_URL, CEILING_IMAGE_URL];
    WALLS.forEach((w) => {
      if (w.imageUrl) urls.push(w.imageUrl);
    });
    return urls;
  }, []);

  useEffect(() => {
    let loaded = 0;
    if (preloadUrls.length === 0) {
      setPreloadingComplete(true);
      return;
    }
    // Preload directly into Three.js texture cache so MuralWall gets instant hits
    preloadUrls.forEach((url) => {
      preloadTexture(url)
        .then(() => {
          loaded++;
          setPreloadedCount(loaded);
          if (loaded === preloadUrls.length) {
            setPreloadingComplete(true);
          }
        })
        .catch(() => {
          // Count failures as loaded to avoid blocking the user
          loaded++;
          setPreloadedCount(loaded);
          if (loaded === preloadUrls.length) {
            setPreloadingComplete(true);
          }
        });
    });
  }, [preloadUrls]);
  
  const [activeHotspot, setActiveHotspot] = useState<Hotspot | null>(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [editingHotspot, setEditingHotspot] = useState<Hotspot | null>(null);
  const [draggingHotspotId, setDraggingHotspotId] = useState<string | null>(null);
  const [focusTarget, setFocusTarget] = useState<{ position: [number, number, number]; wallSide: WallSide } | null>(null);
  const [teleportTarget, setTeleportTarget] = useState<[number, number, number] | null>(null);
  const [hasNavigated, setHasNavigated] = useState(false);
  const [hotspotsVisible, setHotspotsVisible] = useState(true);
  const showAdminButton = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('admin');

  // Interior walls state
  const [interiorWalls, setInteriorWalls] = useState<InteriorWall[]>([]);
  const [editingWall, setEditingWall] = useState<InteriorWall | null>(null);

  // Interior boxes state
  const [interiorBoxes, setInteriorBoxes] = useState<InteriorBox[]>([]);
  const [editingBox, setEditingBox] = useState<InteriorBox | null>(null);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);

  // Interior cylinders state
  const [interiorCylinders, setInteriorCylinders] = useState<InteriorCylinder[]>([]);
  const [editingCylinder, setEditingCylinder] = useState<InteriorCylinder | null>(null);
  const [selectedCylinderId, setSelectedCylinderId] = useState<string | null>(null);

  // Gizmo state
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  const [transformMode, setTransformMode] = useState<'translate' | 'rotate' | 'scale'>('translate');

  // Admin camera view mode
  const [adminViewMode, setAdminViewMode] = useState<ViewMode>('free');

  // Undo toast
  const [undoToast, setUndoToast] = useState<{ message: string; type: 'undo' | 'redo'; key: number } | null>(null);
  const [, forceUpdate] = useState(0);

  // Refs for current state (allows handlers to read current values without stale closures)
  const wallsRef = useRef<InteriorWall[]>([]);
  useEffect(() => { wallsRef.current = interiorWalls; }, [interiorWalls]);
  const boxesRef = useRef<InteriorBox[]>([]);
  useEffect(() => { boxesRef.current = interiorBoxes; }, [interiorBoxes]);
  const cylindersRef = useRef<InteriorCylinder[]>([]);
  useEffect(() => { cylindersRef.current = interiorCylinders; }, [interiorCylinders]);

  // Subscribe to undoManager changes to update UI
  useEffect(() => {
    undoManager.subscribe(() => forceUpdate(n => n + 1));
  }, []);

  // One-time seed: only runs if the 'metadata/seeded' flag doesn't exist yet
  useEffect(() => {
    const seedIfNeeded = async () => {
      const seededRef = doc(db, 'metadata', 'seeded');
      const seededSnap = await getDoc(seededRef);
      if (!seededSnap.exists()) {
        for (const hotspot of INITIAL_HOTSPOTS) {
          await setDoc(doc(db, 'hotspots', hotspot.id), hotspot);
        }
        await setDoc(seededRef, { seededAt: new Date().toISOString() });
      }
    };
    seedIfNeeded();
  }, []);

  // Live-sync hotspots from Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'hotspots'), (snapshot) => {
      const fetchedHotspots = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Hotspot));
      setHotspots(fetchedHotspots);
    });
    return () => unsubscribe();
  }, []);

  // Live-sync interior walls from Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'interiorWalls'), (snapshot) => {
      const fetched = snapshot.docs.map(d => {
        const data = { ...d.data(), id: d.id } as InteriorWall;
        // Sanitize rotation: migrate legacy single-number to [x,y,z] and guard against NaN
        if (!Array.isArray(data.rotation)) {
          const y = Number.isFinite(Number(data.rotation)) ? Number(data.rotation) : 0;
          data.rotation = [0, y, 0];
        } else {
          data.rotation = data.rotation.map(v => Number.isFinite(Number(v)) ? Number(v) : 0) as [number, number, number];
        }
        return data;
      });
      setInteriorWalls(fetched);
    });
    return () => unsubscribe();
  }, []);

  // Live-sync interior boxes from Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'interiorBoxes'), (snapshot) => {
      const fetched = snapshot.docs.map(d => {
        const data = { ...d.data(), id: d.id } as InteriorBox;
        if (!Array.isArray(data.rotation)) data.rotation = [0, 0, 0];
        if (!Array.isArray(data.scale) || data.scale.length < 3) data.scale = [3, 3, 3];
        return data;
      });
      setInteriorBoxes(fetched);
    });
    return () => unsubscribe();
  }, []);

  // Live-sync interior cylinders from Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'interiorCylinders'), (snapshot) => {
      const fetched = snapshot.docs.map(d => {
        const data = { ...d.data(), id: d.id } as InteriorCylinder;
        if (!Array.isArray(data.rotation)) data.rotation = [0, 0, 0];
        if (!Array.isArray(data.scale) || data.scale.length < 3) data.scale = [2, 6, 2];
        return data;
      });
      setInteriorCylinders(fetched);
    });
    return () => unsubscribe();
  }, []);

  // Dynamic bounds based on placed walls/floors
  const effectiveBounds = useMemo(() => {
    let maxX = ROOM_WIDTH / 2;
    let maxZ = ROOM_DEPTH / 2;
    for (const w of interiorWalls) {
      const halfW = w.scale[0] / 2;
      const halfH = (w.type === 'floor' || w.type === 'ceiling') ? w.scale[1] / 2 : 0;
      const yDeg = Array.isArray(w.rotation) ? w.rotation[1] : Number(w.rotation) || 0;
      const rad = (yDeg * Math.PI) / 180;
      const cos = Math.abs(Math.cos(rad));
      const sin = Math.abs(Math.sin(rad));
      const extentX = halfW * cos + halfH * sin;
      const extentZ = halfW * sin + halfH * cos;
      maxX = Math.max(maxX, Math.abs(w.position[0]) + extentX + COLLISION_BUFFER);
      maxZ = Math.max(maxZ, Math.abs(w.position[2]) + extentZ + COLLISION_BUFFER);
    }
    return { halfWidth: maxX, halfDepth: maxZ };
  }, [interiorWalls]);

  const focusOnHotspot = useCallback((hotspot: Hotspot) => {
    setActiveHotspot(hotspot);
    // For floor hotspots, set scaffold to 9ft; for wall hotspots use the hotspot's Y
    setScaffoldHeight(hotspot.wallSide === WallSide.FLOOR ? 9 : hotspot.position[1]);
    setFocusTarget({ position: hotspot.position, wallSide: hotspot.wallSide });
    setIsSidebarVisible(true);
    setHasNavigated(true);
  }, []);

  const navigate = useCallback((direction: 'next' | 'prev') => {
    if (hotspots.length === 0) return;
    const currentIndex = activeHotspot ? hotspots.findIndex(h => h.id === activeHotspot.id) : -1;
    let nextIndex = 0;
    if (direction === 'next') {
      nextIndex = (currentIndex + 1) % hotspots.length;
    } else {
      nextIndex = currentIndex <= 0 ? hotspots.length - 1 : currentIndex - 1;
    }
    focusOnHotspot(hotspots[nextIndex]);
  }, [activeHotspot, hotspots, focusOnHotspot]);

  const handleHotspotClick = useCallback((hotspot: Hotspot) => {
    if (isAdminMode) {
      setEditingHotspot(hotspot);
    } else {
      focusOnHotspot(hotspot);
    }
  }, [isAdminMode, focusOnHotspot]);

  const toggleDetails = useCallback(() => {
    if (!activeHotspot && !isSidebarVisible) {
      focusOnHotspot(hotspots[0]);
    }
    const willClose = isSidebarVisible;
    setIsSidebarVisible(!isSidebarVisible);
    if (willClose) {
      setFocusTarget(null); // Clear focus so scaffold slider re-engages
    }
  }, [activeHotspot, isSidebarVisible, hotspots, focusOnHotspot]);

  const handleNavigate = useCallback(() => {
    setHasNavigated(true);
  }, []);

  const handleWallClick = async (position: [number, number, number], wallSide: WallSide) => {
    if (!isAdminMode || draggingHotspotId) return;
    let snappedPosition: [number, number, number] = [...position];
    const halfWidth = ROOM_WIDTH / 2;
    const halfDepth = ROOM_DEPTH / 2;
    switch (wallSide) {
      case WallSide.NORTH: snappedPosition[2] = -halfDepth; break;
      case WallSide.SOUTH: snappedPosition[2] = halfDepth; break;
      case WallSide.EAST:  snappedPosition[0] = halfWidth; break;
      case WallSide.WEST:  snappedPosition[0] = -halfWidth; break;
      case WallSide.FLOOR: snappedPosition[1] = 0; break;
    }
    const newHotspot: Hotspot = { 
      id: `h-${Date.now()}`, 
      title: 'New Detail', 
      description: '', 
      wallSide, 
      position: snappedPosition, 
      mediaType: 'none' 
    };
    
    // Create directly in Firestore so all clients see it
    await setDoc(doc(db, 'hotspots', newHotspot.id), newHotspot);
    setEditingHotspot(newHotspot);
    setFocusTarget({ position: snappedPosition, wallSide });
  };

  const handleSaveHotspot = async (data: Hotspot) => {
    await setDoc(doc(db, 'hotspots', data.id), data);
    setEditingHotspot(null);
  };

  const handleDeleteHotspot = async (id: string) => {
    await deleteDoc(doc(db, 'hotspots', id));
    setEditingHotspot(null);
  };

  const handleDragHotspot = useCallback((id: string, newPosition: [number, number, number]) => {
    setHotspots(prev => prev.map(h => h.id === id ? { ...h, position: newPosition } : h));
    // Save position change immediately to remote
    const hotspotToUpdate = hotspots.find(h => h.id === id);
    if (hotspotToUpdate) {
      setDoc(doc(db, 'hotspots', id), { ...hotspotToUpdate, position: newPosition }, { merge: true });
    }
  }, [hotspots]);

  const handleMapClick = useCallback((x: number, z: number) => {
    setTeleportTarget([x, scaffoldHeight, z]);
    setFocusTarget(null); // Clear focus target so it doesn't snap back
    setIsSidebarVisible(false); // Hide sidebar when free-navigating
    setHasNavigated(true);
  }, [scaffoldHeight]);

  // --- Interior Wall CRUD ---
  const handleAddWall = useCallback(async (type: 'wall' | 'floor' | 'ceiling') => {
    const defaultPos: [number, number, number] =
      type === 'floor' ? [0, 0.05, 0] :
      type === 'ceiling' ? [0, ROOM_HEIGHT - 0.05, 0] :
      [0, 10, 0];
    const newWall: InteriorWall = {
      id: `iw-${Date.now()}`,
      type,
      imageUrl: '',
      position: defaultPos,
      rotation: [0, 0, 0],
      scale: [10, 10],
      label: ''
    };
    await setDoc(doc(db, 'interiorWalls', newWall.id), newWall);
    undoManager.push({ type: 'create', collection: 'interiorWalls', id: newWall.id, before: null, after: { ...newWall }, label: `Add ${type}`, timestamp: Date.now() });
    setSelectedWallId(newWall.id);
    setEditingWall(null);
  }, []);

  const handleSaveWall = useCallback(async (wall: InteriorWall) => {
    const before = wallsRef.current.find(w => w.id === wall.id);
    if (before) undoManager.pushMerge({ type: 'update', collection: 'interiorWalls', id: wall.id, before: { ...before }, after: { ...wall }, label: 'Edit wall', timestamp: Date.now() });
    await setDoc(doc(db, 'interiorWalls', wall.id), wall);
    setEditingWall(wall);
  }, []);

  const handleDeleteWall = useCallback(async (id: string) => {
    const before = wallsRef.current.find(w => w.id === id);
    if (before) undoManager.push({ type: 'delete', collection: 'interiorWalls', id, before: { ...before }, after: null, label: 'Delete wall', timestamp: Date.now() });
    await deleteDoc(doc(db, 'interiorWalls', id));
    setEditingWall(null);
  }, []);

  const handleCloneWall = useCallback(async (wall: InteriorWall) => {
    const cloned: InteriorWall = {
      ...wall,
      id: `iw-${Date.now()}`,
      label: wall.label ? `${wall.label} copy` : '',
    };
    await setDoc(doc(db, 'interiorWalls', cloned.id), cloned);
    setSelectedWallId(cloned.id);
  }, []);

  const handleEditWall = useCallback((wall: InteriorWall) => {
    setEditingWall(wall);
    setSelectedWallId(null); // close gizmo when opening popup editor
  }, []);

  const handleInteriorWallClick = useCallback((wall: InteriorWall) => {
    if (isAdminMode) {
      // Select wall for gizmo controls (not popup) — deselect any box
      setSelectedWallId(prev => prev === wall.id ? null : wall.id);
      setSelectedBoxId(null);
      setSelectedCylinderId(null);
      setEditingWall(null);
      setEditingBox(null);
      setEditingCylinder(null);
    }
  }, [isAdminMode]);

  const handleWallTransformEnd = useCallback(async (wall: InteriorWall) => {
    const before = wallsRef.current.find(w => w.id === wall.id);
    const final = gizmoState.snapEdges ? snapToNearestEdge(wall, wallsRef.current) : wall;
    if (before) undoManager.push({ type: 'update', collection: 'interiorWalls', id: wall.id, before: { ...before }, after: { ...final }, label: 'Move wall', timestamp: Date.now() });
    if (final !== wall) {
      setInteriorWalls(prev => prev.map(w => w.id === final.id ? final : w));
    }
    await setDoc(doc(db, 'interiorWalls', final.id), final);
  }, []);

  // Handle inline property changes from GizmoToolbar scrubbers
  const handleGizmoPropertyChange = useCallback(async (wall: InteriorWall) => {
    const before = wallsRef.current.find(w => w.id === wall.id);
    if (before) undoManager.pushMerge({ type: 'update', collection: 'interiorWalls', id: wall.id, before: { ...before }, after: { ...wall }, label: 'Edit wall', timestamp: Date.now() });
    setInteriorWalls(prev => prev.map(w => w.id === wall.id ? wall : w));
    await setDoc(doc(db, 'interiorWalls', wall.id), wall);
  }, []);

  // --- Interior Box CRUD ---
  const handleAddBox = useCallback(async () => {
    const newBox: InteriorBox = {
      id: `ib-${Date.now()}`,
      position: [0, 3, 0],
      rotation: [0, 0, 0],
      scale: [3, 3, 3],
      label: '',
      textureMode: 'uniform',
      color: '#cccccc',
    };
    await setDoc(doc(db, 'interiorBoxes', newBox.id), newBox);
    undoManager.push({ type: 'create', collection: 'interiorBoxes', id: newBox.id, before: null, after: { ...newBox }, label: 'Add box', timestamp: Date.now() });
    setSelectedBoxId(newBox.id);
    setSelectedWallId(null);
    setEditingBox(null);
    setEditingWall(null);
  }, []);

  const handleSaveBox = useCallback(async (box: InteriorBox) => {
    const before = boxesRef.current.find(b => b.id === box.id);
    if (before) undoManager.pushMerge({ type: 'update', collection: 'interiorBoxes', id: box.id, before: { ...before }, after: { ...box }, label: 'Edit box', timestamp: Date.now() });
    await setDoc(doc(db, 'interiorBoxes', box.id), box);
    setEditingBox(box);
  }, []);

  const handleDeleteBox = useCallback(async (id: string) => {
    const before = boxesRef.current.find(b => b.id === id);
    if (before) undoManager.push({ type: 'delete', collection: 'interiorBoxes', id, before: { ...before }, after: null, label: 'Delete box', timestamp: Date.now() });
    await deleteDoc(doc(db, 'interiorBoxes', id));
    setEditingBox(null);
    setSelectedBoxId(null);
  }, []);

  const handleCloneBox = useCallback(async (box: InteriorBox) => {
    const cloned: InteriorBox = {
      ...box,
      id: `ib-${Date.now()}`,
      label: box.label ? `${box.label} copy` : '',
      position: [box.position[0] + 2, box.position[1], box.position[2]],
    };
    await setDoc(doc(db, 'interiorBoxes', cloned.id), cloned);
    setSelectedBoxId(cloned.id);
  }, []);

  const handleEditBox = useCallback((box: InteriorBox) => {
    setEditingBox(box);
    setSelectedBoxId(null);
  }, []);

  const handleInteriorBoxClick = useCallback((box: InteriorBox) => {
    if (isAdminMode) {
      setSelectedBoxId(prev => prev === box.id ? null : box.id);
      setSelectedWallId(null);
      setSelectedCylinderId(null);
      setEditingWall(null);
      setEditingBox(null);
      setEditingCylinder(null);
    }
  }, [isAdminMode]);

  const handleBoxTransformEnd = useCallback(async (box: InteriorBox) => {
    const before = boxesRef.current.find(b => b.id === box.id);
    if (before) undoManager.push({ type: 'update', collection: 'interiorBoxes', id: box.id, before: { ...before }, after: { ...box }, label: 'Move box', timestamp: Date.now() });
    setInteriorBoxes(prev => prev.map(b => b.id === box.id ? box : b));
    await setDoc(doc(db, 'interiorBoxes', box.id), box);
  }, []);

  const handleBoxGizmoPropertyChange = useCallback(async (box: InteriorBox) => {
    const before = boxesRef.current.find(b => b.id === box.id);
    if (before) undoManager.pushMerge({ type: 'update', collection: 'interiorBoxes', id: box.id, before: { ...before }, after: { ...box }, label: 'Edit box', timestamp: Date.now() });
    setInteriorBoxes(prev => prev.map(b => b.id === box.id ? box : b));
    await setDoc(doc(db, 'interiorBoxes', box.id), box);
  }, []);

  // --- Interior Cylinder CRUD ---
  const handleAddCylinder = useCallback(async () => {
    const newCyl: InteriorCylinder = {
      id: `ic-${Date.now()}`,
      position: [0, 3, 0],
      rotation: [0, 0, 0],
      scale: [2, 6, 2],
      label: '',
      segments: 32,
      textureMode: 'uniform',
      color: '#cccccc',
    };
    await setDoc(doc(db, 'interiorCylinders', newCyl.id), newCyl);
    undoManager.push({ type: 'create', collection: 'interiorCylinders', id: newCyl.id, before: null, after: { ...newCyl }, label: 'Add cylinder', timestamp: Date.now() });
    setSelectedCylinderId(newCyl.id);
    setSelectedWallId(null);
    setSelectedBoxId(null);
    setEditingCylinder(null);
    setEditingWall(null);
    setEditingBox(null);
  }, []);

  const handleSaveCylinder = useCallback(async (cyl: InteriorCylinder) => {
    const before = cylindersRef.current.find(c => c.id === cyl.id);
    if (before) undoManager.pushMerge({ type: 'update', collection: 'interiorCylinders', id: cyl.id, before: { ...before }, after: { ...cyl }, label: 'Edit cylinder', timestamp: Date.now() });
    await setDoc(doc(db, 'interiorCylinders', cyl.id), cyl);
    setEditingCylinder(cyl);
  }, []);

  const handleDeleteCylinder = useCallback(async (id: string) => {
    const before = cylindersRef.current.find(c => c.id === id);
    if (before) undoManager.push({ type: 'delete', collection: 'interiorCylinders', id, before: { ...before }, after: null, label: 'Delete cylinder', timestamp: Date.now() });
    await deleteDoc(doc(db, 'interiorCylinders', id));
    setEditingCylinder(null);
    setSelectedCylinderId(null);
  }, []);

  const handleCloneCylinder = useCallback(async (cyl: InteriorCylinder) => {
    const cloned: InteriorCylinder = {
      ...cyl,
      id: `ic-${Date.now()}`,
      label: cyl.label ? `${cyl.label} copy` : '',
      position: [cyl.position[0] + 2, cyl.position[1], cyl.position[2]],
    };
    await setDoc(doc(db, 'interiorCylinders', cloned.id), cloned);
    setSelectedCylinderId(cloned.id);
  }, []);

  const handleEditCylinder = useCallback((cyl: InteriorCylinder) => {
    setEditingCylinder(cyl);
    setSelectedCylinderId(null);
  }, []);

  const handleInteriorCylinderClick = useCallback((cyl: InteriorCylinder) => {
    if (isAdminMode) {
      setSelectedCylinderId(prev => prev === cyl.id ? null : cyl.id);
      setSelectedWallId(null);
      setSelectedBoxId(null);
      setEditingWall(null);
      setEditingBox(null);
      setEditingCylinder(null);
    }
  }, [isAdminMode]);

  const handleCylinderTransformEnd = useCallback(async (cyl: InteriorCylinder) => {
    const before = cylindersRef.current.find(c => c.id === cyl.id);
    if (before) undoManager.push({ type: 'update', collection: 'interiorCylinders', id: cyl.id, before: { ...before }, after: { ...cyl }, label: 'Move cylinder', timestamp: Date.now() });
    setInteriorCylinders(prev => prev.map(c => c.id === cyl.id ? cyl : c));
    await setDoc(doc(db, 'interiorCylinders', cyl.id), cyl);
  }, []);

  const handleCylinderGizmoPropertyChange = useCallback(async (cyl: InteriorCylinder) => {
    const before = cylindersRef.current.find(c => c.id === cyl.id);
    if (before) undoManager.pushMerge({ type: 'update', collection: 'interiorCylinders', id: cyl.id, before: { ...before }, after: { ...cyl }, label: 'Edit cylinder', timestamp: Date.now() });
    setInteriorCylinders(prev => prev.map(c => c.id === cyl.id ? cyl : c));
    await setDoc(doc(db, 'interiorCylinders', cyl.id), cyl);
  }, []);

  // Undo/Redo helper
  const performUndo = useCallback(async () => {
    const action = await undoManager.undo(db);
    if (action) {
      setSelectedWallId(null); setSelectedBoxId(null); setSelectedCylinderId(null);
      setUndoToast({ message: `Undo: ${action.label}`, type: 'undo', key: Date.now() });
    }
  }, []);

  const performRedo = useCallback(async () => {
    const action = await undoManager.redo(db);
    if (action) {
      setUndoToast({ message: `Redo: ${action.label}`, type: 'redo', key: Date.now() });
    }
  }, []);

  // Auto-hide toast
  useEffect(() => {
    if (!undoToast) return;
    const t = setTimeout(() => setUndoToast(null), 2500);
    return () => clearTimeout(t);
  }, [undoToast]);

  // Keyboard shortcuts for gizmo modes + undo/redo
  useEffect(() => {
    if (!isAdminMode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      // Ctrl+Z = undo, Ctrl+Shift+Z / Ctrl+Y = redo
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        if (e.key === 'z' || e.key === 'Z') {
          e.preventDefault();
          if (e.shiftKey) { performRedo(); }
          else { performUndo(); }
          return;
        }
        if (e.key === 'y' || e.key === 'Y') {
          e.preventDefault();
          performRedo();
          return;
        }
      }

      const hasSelection = selectedWallId || selectedBoxId || selectedCylinderId;
      if (hasSelection) {
        switch (e.key) {
          case '1': setTransformMode('translate'); break;
          case '2': setTransformMode('rotate'); break;
          case '3': setTransformMode('scale'); break;
          case 'g': case 'G': setTransformMode('translate'); break;
          case 'r': case 'R': setTransformMode('rotate'); break;
          case 's': case 'S': setTransformMode('scale'); break;
          case 'Escape':
            setSelectedWallId(null);
            setSelectedBoxId(null);
            setSelectedCylinderId(null);
            break;
          case 'Delete': case 'Backspace': {
            if (selectedWallId) {
              handleDeleteWall(selectedWallId);
              setSelectedWallId(null);
            } else if (selectedBoxId) {
              handleDeleteBox(selectedBoxId);
              setSelectedBoxId(null);
            } else if (selectedCylinderId) {
              handleDeleteCylinder(selectedCylinderId);
              setSelectedCylinderId(null);
            }
            break;
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAdminMode, selectedWallId, selectedBoxId, selectedCylinderId, handleDeleteWall, handleDeleteBox, handleDeleteCylinder, performUndo, performRedo]);

  return (
    <div className="relative w-full h-screen bg-[#050505] text-white select-none overflow-hidden">
      <OrientationBlocker />
      
      {/* HUD Layer - Always on top */}
      {!isAdminMode && !showOverlay && (
        <div className="fixed bottom-4 left-4 z-[200] flex flex-col items-center gap-3 pointer-events-none animate-in slide-in-from-bottom-10 duration-700" style={{ width: '200px' }}>
          <div className="flex items-center justify-center gap-2 pointer-events-auto">
              <button 
                onClick={(e) => { e.stopPropagation(); navigate('prev'); }}
                className="w-10 h-10 rounded-full bg-[#005e99] flex items-center justify-center border border-white/20 shadow-[0_10px_40px_rgba(0,0,0,0.6)] hover:bg-white hover:text-[#005e99] active:scale-95 transition-all text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); navigate('next'); }}
                className="w-10 h-10 rounded-full bg-[#005e99] flex items-center justify-center border border-white/20 shadow-[0_10px_40px_rgba(0,0,0,0.6)] hover:bg-white hover:text-[#005e99] active:scale-95 transition-all text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </button>
            <button 
              onClick={(e) => { e.stopPropagation(); toggleDetails(); }}
              className={`w-10 h-10 rounded-full flex items-center justify-center font-serif italic text-lg transition-all border shadow-[0_10px_40px_rgba(0,0,0,0.6)] ${isSidebarVisible ? 'bg-white text-[#005e99] border-white' : 'bg-zinc-800 text-white border-white/5 hover:bg-zinc-700'}`}
            >
              i
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); setHotspotsVisible(v => !v); }}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all border shadow-[0_10px_40px_rgba(0,0,0,0.6)] ${hotspotsVisible ? 'bg-zinc-800 text-white border-white/5 hover:bg-zinc-700' : 'bg-white text-[#005e99] border-white'}`}
              title={hotspotsVisible ? 'Hide hotspots' : 'Show hotspots'}
            >
              {hotspotsVisible ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              )}
            </button>
          </div>
          
          <div className="pointer-events-auto hidden md:block">
            <Minimap 
              hotspots={hotspots}
              activeHotspot={activeHotspot}
              onHotspotClick={handleHotspotClick}
              onMapClick={handleMapClick}
            />
          </div>
        </div>
      )}

      {/* Header Layer */}
      <header className="fixed top-0 left-0 w-full p-4 md:p-8 z-20 pointer-events-none flex justify-between items-start">
        <div className={`pointer-events-auto flex items-center gap-4 transition-opacity duration-1000 ${hasNavigated ? 'opacity-0' : 'opacity-100'}`}>
          <img src={DIA_LOGO_URL} alt="DIA Logo" className="w-12 h-12 md:w-16 md:h-16 shadow-2xl border border-white/20 rounded-full object-cover" />
          <div className="flex flex-col drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
            <h1 className="font-serif text-2xl md:text-4xl tracking-tight leading-none text-white font-bold">Rivera Court</h1>
            <div className="mt-1.5 flex">
              <span className="text-[9px] md:text-[11px] uppercase tracking-[0.35em] text-[#005e99] font-black bg-white/95 px-2 py-0.5 rounded-[1px] shadow-sm">
                Detroit Industry Murals
              </span>
            </div>
          </div>
        </div>
        {showAdminButton && (
          <div className="pointer-events-auto">
            <button 
              className={`transition-all px-6 py-2.5 rounded-full font-black border text-[10px] tracking-widest shadow-xl uppercase ${isAdminMode ? 'bg-[#005e99] text-white border-[#005e99]' : 'bg-black/40 backdrop-blur-md text-white/50 border-white/10 hover:text-white'}`} 
              onClick={() => {
                const nextMode = !isAdminMode;
                setIsAdminMode(nextMode);
                if (nextMode) {
                  setEditingHotspot(null);
                  setActiveHotspot(null);
                } else {
                  setAdminViewMode('free');
                }
              }}
            >
              {isAdminMode ? 'ADMIN ACTIVE' : 'ADMIN ACCESS'}
            </button>
          </div>
        )}
      </header>

      <Canvas shadows camera={{ position: [0, EYE_LEVEL, 18], fov: 55 }} dpr={[1, 2]}>
        <Suspense fallback={null}>
          <Experience 
            scaffoldHeight={scaffoldHeight} 
            hotspots={hotspots} 
            onHotspotClick={handleHotspotClick} 
            isAdminMode={isAdminMode} 
            onWallClick={handleWallClick}
            onDragHotspot={handleDragHotspot}
            draggingHotspotId={draggingHotspotId}
            setDraggingHotspotId={setDraggingHotspotId}
            focusTarget={focusTarget}
            teleportTarget={teleportTarget}
            isSidebarOpen={!isAdminMode && isSidebarVisible}
            onNavigate={handleNavigate}
            hotspotsVisible={hotspotsVisible}
            interiorWalls={interiorWalls}
            onInteriorWallClick={handleInteriorWallClick}
            effectiveBounds={effectiveBounds}
            selectedWallId={selectedWallId}
            transformMode={transformMode}
            onWallTransformEnd={handleWallTransformEnd}
            viewMode={adminViewMode}
            interiorBoxes={interiorBoxes}
            selectedBoxId={selectedBoxId}
            onInteriorBoxClick={handleInteriorBoxClick}
            onBoxTransformEnd={handleBoxTransformEnd}
            interiorCylinders={interiorCylinders}
            selectedCylinderId={selectedCylinderId}
            onInteriorCylinderClick={handleInteriorCylinderClick}
            onCylinderTransformEnd={handleCylinderTransformEnd}
          />
        </Suspense>
      </Canvas>

      <ScaffoldingSlider value={scaffoldHeight} onChange={setScaffoldHeight} />
      <VirtualJoystick />

      {/* Gizmo Transform Toolbar */}
      {isAdminMode && selectedWallId && !editingWall && (() => {
        const selectedWall = interiorWalls.find(w => w.id === selectedWallId);
        if (!selectedWall) return null;
        return (
          <GizmoToolbar
            wall={selectedWall}
            transformMode={transformMode}
            onTransformModeChange={setTransformMode}
            onOpenEditor={() => {
              setEditingWall(selectedWall);
              setSelectedWallId(null);
            }}
            onClone={() => handleCloneWall(selectedWall)}
            onDelete={() => {
              handleDeleteWall(selectedWallId);
              setSelectedWallId(null);
            }}
            onDeselect={() => setSelectedWallId(null)}
            onPropertyChange={handleGizmoPropertyChange}
          />
        );
      })()}

      {/* Box Gizmo Toolbar */}
      {isAdminMode && selectedBoxId && !editingBox && (() => {
        const selectedBox = interiorBoxes.find(b => b.id === selectedBoxId);
        if (!selectedBox) return null;
        return (
          <BoxGizmoToolbar
            box={selectedBox}
            transformMode={transformMode}
            onTransformModeChange={setTransformMode}
            onOpenEditor={() => {
              setEditingBox(selectedBox);
              setSelectedBoxId(null);
            }}
            onClone={() => handleCloneBox(selectedBox)}
            onDelete={() => {
              handleDeleteBox(selectedBoxId);
              setSelectedBoxId(null);
            }}
            onDeselect={() => setSelectedBoxId(null)}
            onPropertyChange={handleBoxGizmoPropertyChange}
          />
        );
      })()}

      {/* Cylinder Gizmo Toolbar */}
      {isAdminMode && selectedCylinderId && !editingCylinder && (() => {
        const selectedCyl = interiorCylinders.find(c => c.id === selectedCylinderId);
        if (!selectedCyl) return null;
        return (
          <CylinderGizmoToolbar
            cylinder={selectedCyl}
            transformMode={transformMode}
            onTransformModeChange={setTransformMode}
            onOpenEditor={() => {
              setEditingCylinder(selectedCyl);
              setSelectedCylinderId(null);
            }}
            onClone={() => handleCloneCylinder(selectedCyl)}
            onDelete={() => {
              handleDeleteCylinder(selectedCylinderId);
              setSelectedCylinderId(null);
            }}
            onDeselect={() => setSelectedCylinderId(null)}
            onPropertyChange={handleCylinderGizmoPropertyChange}
          />
        );
      })()}
      
      {/* Detail Panel Layer */}
      <HotspotInfoPanel 
        hotspot={activeHotspot}
        isVisible={!isAdminMode && isSidebarVisible} 
        onClose={() => { setIsSidebarVisible(false); setFocusTarget(null); }}
      />
      
      {isAdminMode && !editingBox && !editingCylinder && (
        <AdminPanel 
          hotspots={hotspots} 
          editingHotspot={editingHotspot} 
          onSave={handleSaveHotspot} 
          onEdit={(h) => focusOnHotspot(h)} 
          onDelete={handleDeleteHotspot} 
          onCancel={() => setEditingHotspot(null)}
          interiorWalls={interiorWalls}
          editingWall={editingWall}
          selectedWallId={selectedWallId}
          onAddWall={handleAddWall}
          onSaveWall={handleSaveWall}
          onSelectWall={handleInteriorWallClick}
          onEditWall={handleEditWall}
          onDeleteWall={handleDeleteWall}
          onCancelWallEdit={() => setEditingWall(null)}
          interiorBoxes={interiorBoxes}
          selectedBoxId={selectedBoxId}
          onAddBox={handleAddBox}
          onSelectBox={handleInteriorBoxClick}
          interiorCylinders={interiorCylinders}
          selectedCylinderId={selectedCylinderId}
          onAddCylinder={handleAddCylinder}
          onSelectCylinder={handleInteriorCylinderClick}
        />
      )}

      {/* Box Editor */}
      {isAdminMode && editingBox && (
        <AdminBoxEditor
          box={editingBox}
          onSave={handleSaveBox}
          onDelete={handleDeleteBox}
          onCancel={() => setEditingBox(null)}
        />
      )}

      {/* Cylinder Editor */}
      {isAdminMode && editingCylinder && (
        <AdminCylinderEditor
          cylinder={editingCylinder}
          onSave={handleSaveCylinder}
          onDelete={handleDeleteCylinder}
          onCancel={() => setEditingCylinder(null)}
        />
      )}

      {/* Admin Camera View Toolbar */}
      {isAdminMode && (
        <AdminViewToolbar viewMode={adminViewMode} onViewModeChange={setAdminViewMode} />
      )}

      {/* Undo/Redo floating bar */}
      {isAdminMode && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-1 bg-black/70 backdrop-blur-xl border border-white/10 rounded-lg px-2 py-1 shadow-xl">
          <button
            onClick={performUndo}
            disabled={!undoManager.canUndo}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] uppercase tracking-[0.1em] font-black transition-all ${
              undoManager.canUndo ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-white/15 cursor-not-allowed'
            }`}
            title={undoManager.undoLabel ? `Undo: ${undoManager.undoLabel} (Ctrl+Z)` : 'Nothing to undo'}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
            Undo
            {undoManager.undoCount > 0 && <span className="text-[8px] text-white/30 ml-0.5">{undoManager.undoCount}</span>}
          </button>
          <div className="w-px h-4 bg-white/10"></div>
          <button
            onClick={performRedo}
            disabled={!undoManager.canRedo}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] uppercase tracking-[0.1em] font-black transition-all ${
              undoManager.canRedo ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-white/15 cursor-not-allowed'
            }`}
            title={undoManager.redoLabel ? `Redo: ${undoManager.redoLabel} (Ctrl+Shift+Z)` : 'Nothing to redo'}
          >
            Redo
            {undoManager.redoCount > 0 && <span className="text-[8px] text-white/30 ml-0.5">{undoManager.redoCount}</span>}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"></path></svg>
          </button>
          <span className="text-[8px] text-white/20 tracking-widest ml-1">CTRL+Z</span>
        </div>
      )}

      {/* Undo Toast */}
      {undoToast && (
        <div
          key={undoToast.key}
          className="fixed bottom-16 left-1/2 -translate-x-1/2 z-[250] px-5 py-2.5 rounded-xl bg-black/85 backdrop-blur-xl border border-white/15 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          <span className={`text-[11px] uppercase tracking-[0.15em] font-black ${
            undoToast.type === 'undo' ? 'text-amber-400' : 'text-teal-400'
          }`}>
            {undoToast.message}
          </span>
        </div>
      )}

      {showOverlay && (
        <div className="fixed inset-0 z-[500] bg-black/95 flex items-center justify-center backdrop-blur-md" onClick={() => { if (preloadingComplete) requestAnimationFrame(() => setShowOverlay(false)); }}>
          <div className="max-w-2xl w-full text-center px-6 py-10 md:px-12 md:py-12 bg-transparent animate-in zoom-in-95 duration-500 flex flex-col items-center justify-center min-h-[100dvh]" onClick={(e) => e.stopPropagation()}>
            <img src={DIA_LOGO_URL} alt="DIA Logo" className="w-16 h-16 md:w-24 md:h-24 mx-auto mb-5 md:mb-8 shadow-2xl border-2 border-white/20 rounded-full object-cover flex-shrink-0" />
            <div className="flex items-baseline justify-center gap-3 mb-4 md:mb-8">
              <h2 className="font-serif text-3xl md:text-6xl tracking-tight text-white leading-tight whitespace-nowrap">Detroit Industry Murals</h2>
              <span className="text-white text-xs font-mono tracking-widest bg-white/10 px-2 py-1 rounded-sm">{VERSION}.{BUILD_NUMBER}</span>
            </div>
            <p className="text-sm md:text-xl text-white/60 leading-relaxed mb-5 md:mb-9 font-light max-w-lg mx-auto">Explore Diego Rivera's masterpiece in stunning 3D.</p>

            {/* Visual Loading Bar */}
            {!preloadingComplete && (
              <div className="flex flex-col items-center justify-center mb-10 w-full max-w-xs mx-auto animate-pulse">
                <div className="text-[10px] text-white/40 uppercase tracking-[0.2em] mb-2 font-bold font-mono">
                  PRE-RENDERING 3D ENVIRONMENT ({preloadedCount}/{preloadUrls.length})
                </div>
                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden border border-white/5">
                  <div 
                    className="h-full bg-sky-500 transition-all duration-300 ease-out shadow-[0_0_8px_#0284c7]" 
                    style={{ width: `${(preloadedCount / preloadUrls.length) * 100}%` }}
                  />
                </div>
              </div>
            )}
            {/* Desktop instructions */}
            <div className="hidden md:flex flex-wrap justify-center gap-14 mb-10 font-mono text-[19px]">
              <div className="text-center flex flex-col items-center">
                <div className="text-[#005e99] mb-3 font-black text-[21px]">MOVE</div>
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="mb-2">
                  {/* Up arrow key */}
                  <rect x="16" y="2" width="16" height="14" rx="3" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" fill="rgba(0,94,153,0.15)"/>
                  <path d="M24 6 L24 12" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M21 9 L24 6 L27 9" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  {/* Left arrow key */}
                  <rect x="0" y="18" width="14" height="14" rx="3" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" fill="rgba(0,94,153,0.15)"/>
                  <path d="M4 25 L10 25" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M7 22 L4 25 L7 28" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  {/* Down arrow key */}
                  <rect x="16" y="18" width="16" height="14" rx="3" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" fill="rgba(0,94,153,0.15)"/>
                  <path d="M24 22 L24 28" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M21 25 L24 28 L27 25" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  {/* Right arrow key */}
                  <rect x="34" y="18" width="14" height="14" rx="3" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" fill="rgba(0,94,153,0.15)"/>
                  <path d="M38 25 L44 25" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M41 22 L44 25 L41 28" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div className="text-white/80 text-[13px]">ARROW KEYS</div>
              </div>
              <div className="text-center flex flex-col items-center">
                <div className="text-[#005e99] mb-3 font-black text-[21px]">VIEW</div>
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="mb-2">
                  {/* Mouse body */}
                  <rect x="12" y="6" width="24" height="36" rx="12" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" fill="rgba(0,94,153,0.15)"/>
                  {/* Center divider */}
                  <line x1="24" y1="6" x2="24" y2="22" stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
                  {/* Scroll wheel */}
                  <rect x="22" y="12" width="4" height="7" rx="2" stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" fill="none"/>
                  {/* Drag arrows */}
                  <path d="M6 24 L12 24" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M9 21 L6 24 L9 27" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M42 24 L36 24" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M39 21 L42 24 L39 27" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div className="text-white/80 text-[13px]">CLICK + DRAG</div>
              </div>
              <div className="text-center flex flex-col items-center">
                <div className="text-[#005e99] mb-3 font-black text-[21px]">DETAIL</div>
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="mb-2">
                  {/* Outer ring */}
                  <circle cx="24" cy="24" r="16" stroke="#005e99" strokeWidth="2" fill="rgba(0,94,153,0.2)"/>
                  {/* Inner dot */}
                  <circle cx="24" cy="24" r="6" fill="white" opacity="0.7"/>
                  {/* Pulse rings */}
                  <circle cx="24" cy="24" r="20" stroke="rgba(255,255,255,0.15)" strokeWidth="1" fill="none"/>
                  <circle cx="24" cy="24" r="11" stroke="rgba(255,255,255,0.2)" strokeWidth="1" fill="none"/>
                </svg>
                <div className="text-white/80 text-[13px]">CLICK CIRCLES</div>
              </div>
            </div>
            {/* Mobile instructions */}
            <div className="flex md:hidden flex-wrap justify-center gap-6 mb-6 font-mono text-[14px]">
              <div className="text-center flex flex-col items-center">
                <div className="text-[#005e99] mb-2 font-black text-[16px]">MOVE</div>
                <svg width="36" height="36" viewBox="0 0 40 40" fill="none" className="mb-1.5">
                  <circle cx="20" cy="20" r="18" stroke="rgba(255,255,255,0.3)" strokeWidth="2" fill="rgba(0,94,153,0.15)"/>
                  <circle cx="20" cy="20" r="7" fill="rgba(255,255,255,0.6)"/>
                  <path d="M20 6 L20 10" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M20 30 L20 34" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M6 20 L10 20" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M30 20 L34 20" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <div className="text-white/80 text-[11px]">JOYSTICK</div>
              </div>
              <div className="text-center flex flex-col items-center">
                <div className="text-[#005e99] mb-2 font-black text-[16px]">LOOK</div>
                <svg width="36" height="36" viewBox="0 0 40 40" fill="none" className="mb-1.5">
                  <path d="M10 20 Q14 14 20 14 Q26 14 30 20" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" fill="none"/>
                  <path d="M13 20 L8 17 M13 20 L8 23" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M27 20 L32 17 M27 20 L32 23" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="20" cy="26" r="3" fill="rgba(255,255,255,0.5)"/>
                  <circle cx="20" cy="26" r="5" stroke="rgba(255,255,255,0.3)" strokeWidth="1" fill="none"/>
                </svg>
                <div className="text-white/80 text-[11px]">SWIPE</div>
              </div>
              <div className="text-center flex flex-col items-center">
                <div className="text-[#005e99] mb-2 font-black text-[16px]">DETAIL</div>
                <svg width="36" height="36" viewBox="0 0 40 40" fill="none" className="mb-1.5">
                  <circle cx="20" cy="20" r="12" stroke="#005e99" strokeWidth="2" fill="rgba(0,94,153,0.2)"/>
                  <circle cx="20" cy="20" r="5" fill="white" opacity="0.7"/>
                  <path d="M20 4 L20 8" stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeLinecap="round"/>
                  <path d="M20 32 L20 36" stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeLinecap="round"/>
                </svg>
                <div className="text-white/80 text-[11px]">TAP CIRCLES</div>
              </div>
            </div>
            <button 
              disabled={!preloadingComplete}
              className={`w-full md:w-auto px-16 py-4 md:py-6 font-black text-white transition-all shadow-2xl rounded-sm uppercase tracking-[0.25em] text-xs flex-shrink-0 ${
                preloadingComplete 
                  ? 'bg-[#005e99] hover:bg-white hover:text-[#005e99] cursor-pointer' 
                  : 'bg-zinc-800 text-white/40 cursor-wait'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                requestAnimationFrame(() => setShowOverlay(false));
              }}
            >
              {preloadingComplete ? 'ENTER THE COURT' : `LOADING COURT ${Math.round((preloadedCount / preloadUrls.length) * 100)}%`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
