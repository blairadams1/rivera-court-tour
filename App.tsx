
import React, { useState, useEffect, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import Experience from './components/Experience';
import ScaffoldingSlider from './components/ScaffoldingSlider';
import HotspotInfoPanel from './components/HotspotInfoPanel';
import AdminPanel from './components/AdminPanel';
import Minimap from './components/Minimap';
import { EYE_LEVEL, ROOM_WIDTH, ROOM_DEPTH, MAX_LIFT } from './constants';
import { Hotspot, WallSide } from './types';

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
  const [hotspots, setHotspots] = useState<Hotspot[]>(() => {
    const saved = localStorage.getItem('dia-rivera-hotspots-v2');
    return saved ? JSON.parse(saved) : INITIAL_HOTSPOTS;
  });
  
  const [activeHotspot, setActiveHotspot] = useState<Hotspot | null>(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [editingHotspot, setEditingHotspot] = useState<Hotspot | null>(null);
  const [draggingHotspotId, setDraggingHotspotId] = useState<string | null>(null);
  const [focusTarget, setFocusTarget] = useState<{ position: [number, number, number]; wallSide: WallSide } | null>(null);
  const [teleportTarget, setTeleportTarget] = useState<[number, number, number] | null>(null);
  const [hasNavigated, setHasNavigated] = useState(false);

  useEffect(() => {
    localStorage.setItem('dia-rivera-hotspots-v2', JSON.stringify(hotspots));
  }, [hotspots]);

  const focusOnHotspot = useCallback((hotspot: Hotspot) => {
    setActiveHotspot(hotspot);
    setScaffoldHeight(hotspot.position[1]);
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
    setIsSidebarVisible(!isSidebarVisible);
  }, [activeHotspot, isSidebarVisible, hotspots, focusOnHotspot]);

  const handleNavigate = useCallback(() => {
    setHasNavigated(true);
  }, []);

  const handleWallClick = (position: [number, number, number], wallSide: WallSide) => {
    if (!isAdminMode || draggingHotspotId) return;
    let snappedPosition: [number, number, number] = [...position];
    const halfWidth = ROOM_WIDTH / 2;
    const halfDepth = ROOM_DEPTH / 2;
    switch (wallSide) {
      case WallSide.NORTH: snappedPosition[2] = -halfDepth; break;
      case WallSide.SOUTH: snappedPosition[2] = halfDepth; break;
      case WallSide.EAST:  snappedPosition[0] = halfWidth; break;
      case WallSide.WEST:  snappedPosition[0] = -halfWidth; break;
    }
    const newHotspot: Hotspot = { 
      id: `h-${Date.now()}`, 
      title: 'New Detail', 
      description: '', 
      wallSide, 
      position: snappedPosition, 
      mediaType: 'none' 
    };
    setHotspots(prev => [...prev, newHotspot]);
    setEditingHotspot(newHotspot);
    setFocusTarget({ position: snappedPosition, wallSide });
  };

  const handleSaveHotspot = (data: Hotspot) => {
    setHotspots(prev => prev.map(h => h.id === data.id ? data : h));
    setEditingHotspot(null);
  };

  const handleDragHotspot = useCallback((id: string, newPosition: [number, number, number]) => {
    setHotspots(prev => prev.map(h => h.id === id ? { ...h, position: newPosition } : h));
  }, []);

  const handleMapClick = useCallback((x: number, z: number) => {
    setTeleportTarget([x, scaffoldHeight, z]);
    setFocusTarget(null); // Clear focus target so it doesn't snap back
    setIsSidebarVisible(false); // Hide sidebar when free-navigating
    setHasNavigated(true);
  }, [scaffoldHeight]);

  return (
    <div className="relative w-full h-screen bg-[#050505] text-white select-none overflow-hidden">
      <OrientationBlocker />
      
      {/* HUD Layer - Always on top */}
      {!isAdminMode && !showOverlay && (
        <div className="fixed bottom-10 left-10 z-[200] flex flex-col gap-4 pointer-events-none animate-in slide-in-from-bottom-10 duration-700">
          <div className="flex items-center gap-6">
            <div className="flex gap-2 pointer-events-auto">
              <button 
                onClick={(e) => { e.stopPropagation(); navigate('prev'); }}
                className="w-11 h-11 rounded-full bg-[#005e99] flex items-center justify-center border border-white/20 shadow-[0_10px_40px_rgba(0,0,0,0.6)] hover:bg-white hover:text-[#005e99] active:scale-95 transition-all text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); navigate('next'); }}
                className="w-11 h-11 rounded-full bg-[#005e99] flex items-center justify-center border border-white/20 shadow-[0_10px_40px_rgba(0,0,0,0.6)] hover:bg-white hover:text-[#005e99] active:scale-95 transition-all text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </button>
            </div>
            
            <button 
              onClick={(e) => { e.stopPropagation(); toggleDetails(); }}
              className={`pointer-events-auto w-11 h-11 rounded-full flex items-center justify-center font-serif italic text-xl transition-all border shadow-[0_10px_40px_rgba(0,0,0,0.6)] ${isSidebarVisible ? 'bg-white text-[#005e99] border-white' : 'bg-zinc-800 text-white border-white/5 hover:bg-zinc-700'}`}
            >
              i
            </button>
          </div>
          
          <div className="pointer-events-auto">
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
        <div className="pointer-events-auto">
          <button 
            className={`transition-all px-6 py-2.5 rounded-full font-black border text-[10px] tracking-widest shadow-xl uppercase ${isAdminMode ? 'bg-[#005e99] text-white border-[#005e99]' : 'bg-black/40 backdrop-blur-md text-white/50 border-white/10 hover:text-white'}`} 
            onClick={() => {
              const nextMode = !isAdminMode;
              setIsAdminMode(nextMode);
              if (nextMode) {
                setEditingHotspot(null);
                setActiveHotspot(null);
              }
            }}
          >
            {isAdminMode ? 'ADMIN ACTIVE' : 'ADMIN ACCESS'}
          </button>
        </div>
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
          />
        </Suspense>
      </Canvas>

      <ScaffoldingSlider value={scaffoldHeight} onChange={setScaffoldHeight} />
      
      {/* Detail Panel Layer */}
      <HotspotInfoPanel 
        hotspot={activeHotspot}
        isVisible={!isAdminMode && isSidebarVisible} 
        onClose={() => setIsSidebarVisible(false)}
      />
      
      {isAdminMode && (
        <AdminPanel 
          hotspots={hotspots} 
          editingHotspot={editingHotspot} 
          onSave={handleSaveHotspot} 
          onEdit={(h) => focusOnHotspot(h)} 
          onDelete={(id) => { setHotspots(prev => prev.filter(h => h.id !== id)); setEditingHotspot(null); }} 
          onCancel={() => setEditingHotspot(null)} 
        />
      )}

      {showOverlay && (
        <div className="fixed inset-0 z-[500] bg-black/95 flex items-center justify-center p-8 backdrop-blur-md" onClick={() => setShowOverlay(false)}>
          <div className="max-w-2xl text-center p-8 md:p-12 bg-transparent animate-in zoom-in-95 duration-500">
            <img src={DIA_LOGO_URL} alt="DIA Logo" className="w-20 h-20 md:w-24 md:h-24 mx-auto mb-8 shadow-2xl border-2 border-white/20 rounded-full object-cover" />
            <h2 className="font-serif text-4xl md:text-6xl mb-6 md:mb-8 tracking-tight text-white leading-tight">Detroit Industry Murals</h2>
            <p className="text-base md:text-xl text-white/60 leading-relaxed mb-10 md:mb-14 font-light max-w-lg mx-auto">Explore Diego Rivera's masterpiece in stunning 3D. Navigate with the scaffolding lift to inspect the brushwork of industry and science.</p>
            <div className="flex flex-wrap justify-center gap-10 md:gap-14 mb-10 md:mb-14 opacity-80 font-mono text-[9px] md:text-[11px]">
              <div className="text-center"><div className="text-[#005e99] mb-2 md:mb-3 font-black">MOVE</div><div className="text-white/40">W S A D</div></div>
              <div className="text-center"><div className="text-[#005e99] mb-2 md:mb-3 font-black">VIEW</div><div className="text-white/40">DRAG MOUSE</div></div>
              <div className="text-center"><div className="text-[#005e99] mb-2 md:mb-3 font-black">DETAIL</div><div className="text-white/40">CLICK GLOWS</div></div>
            </div>
            <button className="w-full md:w-auto px-16 py-5 md:py-6 font-black text-white bg-[#005e99] hover:bg-white hover:text-[#005e99] transition-all shadow-2xl rounded-sm uppercase tracking-[0.25em] text-xs" onClick={() => setShowOverlay(false)}>ENTER THE COURT</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
