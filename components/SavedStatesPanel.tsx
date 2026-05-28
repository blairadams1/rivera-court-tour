
import React, { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, onSnapshot, writeBatch, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { InteriorWall, InteriorBox, InteriorCylinder } from '../types';
import { Save, Trash2, Clock, ChevronDown, ChevronUp, Upload, FolderOpen } from 'lucide-react';

// ---------------------------------------------------------------------------
// Saved State types — metadata (lightweight) vs payload (full data)
// ---------------------------------------------------------------------------

/** Lightweight metadata stored in `savedStateMeta` collection (~200 bytes each) */
interface SavedStateMeta {
  id: string;
  name: string;
  createdAt: number;
  wallCount: number;
  boxCount: number;
  cylinderCount: number;
}

/** Full payload stored in `savedStateData` collection (can be large) */
interface SavedStateData {
  walls: InteriorWall[];
  boxes: InteriorBox[];
  cylinders: InteriorCylinder[];
}

interface SavedStatesPanelProps {
  interiorWalls: InteriorWall[];
  interiorBoxes: InteriorBox[];
  interiorCylinders: InteriorCylinder[];
}

const SavedStatesPanel: React.FC<SavedStatesPanelProps> = ({
  interiorWalls, interiorBoxes, interiorCylinders
}) => {
  const [metas, setMetas] = useState<SavedStateMeta[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Listen for lightweight metadata ONLY (no object arrays)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'savedStateMeta'), (snap) => {
      const loaded: SavedStateMeta[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as SavedStateMeta));
      loaded.sort((a, b) => b.createdAt - a.createdAt);
      setMetas(loaded);
    });
    return unsub;
  }, []);

  // Auto-hide toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  // Save current state — split into meta + data documents
  const handleSave = useCallback(async () => {
    const name = saveName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const id = `ss-${Date.now()}`;

      // Write lightweight metadata
      const meta: SavedStateMeta = {
        id,
        name,
        createdAt: Date.now(),
        wallCount: interiorWalls.length,
        boxCount: interiorBoxes.length,
        cylinderCount: interiorCylinders.length,
      };
      await setDoc(doc(db, 'savedStateMeta', id), meta);

      // Write full payload separately (only loaded on demand)
      const data: SavedStateData = {
        walls: interiorWalls.map(w => ({ ...w })),
        boxes: interiorBoxes.map(b => ({ ...b })),
        cylinders: interiorCylinders.map(c => ({ ...c })),
      };
      await setDoc(doc(db, 'savedStateData', id), data);

      setSaveName('');
      setShowInput(false);
      setToast(`Saved "${name}"`);
    } catch (err) {
      console.error('Save state failed:', err);
      setToast('Save failed');
    }
    setSaving(false);
  }, [saveName, interiorWalls, interiorBoxes, interiorCylinders]);

  // Restore a saved state — load full payload on demand
  const handleRestore = useCallback(async (meta: SavedStateMeta) => {
    if (!confirm(`Restore "${meta.name}"?\n\nThis will replace all current walls, boxes, and cylinders with the saved snapshot.`)) return;
    setLoadingId(meta.id);
    try {
      // Fetch full payload on demand (NOT eagerly loaded)
      const dataSnap = await getDoc(doc(db, 'savedStateData', meta.id));
      if (!dataSnap.exists()) {
        // Fallback: try legacy single-doc format
        const legacySnap = await getDoc(doc(db, 'savedStates', meta.id));
        if (!legacySnap.exists()) { setToast('State data not found'); setLoadingId(null); return; }
        const legacy = legacySnap.data() as SavedStateData;
        await restorePayload(legacy);
      } else {
        await restorePayload(dataSnap.data() as SavedStateData);
      }
      setToast(`Restored "${meta.name}"`);
    } catch (err) {
      console.error('Restore state failed:', err);
      setToast('Restore failed');
    }
    setLoadingId(null);
  }, []);

  // Shared restore logic — delete all current, write saved
  const restorePayload = async (data: SavedStateData) => {
    // Delete all current objects
    const wallSnap = await getDocs(collection(db, 'interiorWalls'));
    const boxSnap = await getDocs(collection(db, 'interiorBoxes'));
    const cylSnap = await getDocs(collection(db, 'interiorCylinders'));

    const deleteBatch = writeBatch(db);
    wallSnap.forEach(d => deleteBatch.delete(d.ref));
    boxSnap.forEach(d => deleteBatch.delete(d.ref));
    cylSnap.forEach(d => deleteBatch.delete(d.ref));
    await deleteBatch.commit();

    // Write saved objects back
    const allOps: Array<{ ref: any; data: any }> = [
      ...(data.walls || []).map(w => ({ ref: doc(db, 'interiorWalls', w.id), data: w })),
      ...(data.boxes || []).map(b => ({ ref: doc(db, 'interiorBoxes', b.id), data: b })),
      ...(data.cylinders || []).map(c => ({ ref: doc(db, 'interiorCylinders', c.id), data: c })),
    ];

    // Split into batches of 500 (Firestore limit)
    for (let i = 0; i < allOps.length; i += 500) {
      const chunk = allOps.slice(i, i + 500);
      const batch = writeBatch(db);
      chunk.forEach(op => batch.set(op.ref, op.data));
      await batch.commit();
    }
  };

  // Delete a saved state (both meta + data)
  const handleDelete = useCallback(async (meta: SavedStateMeta) => {
    if (!confirm(`Delete saved state "${meta.name}"?`)) return;
    // Delete both documents and legacy format if it exists
    await Promise.all([
      deleteDoc(doc(db, 'savedStateMeta', meta.id)),
      deleteDoc(doc(db, 'savedStateData', meta.id)),
      deleteDoc(doc(db, 'savedStates', meta.id)).catch(() => {}), // legacy cleanup
    ]);
    setToast(`Deleted "${meta.name}"`);
  }, []);

  const totalObjects = interiorWalls.length + interiorBoxes.length + interiorCylinders.length;

  return (
    <div className="mb-4">
      {/* Header — clickable to expand/collapse */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-2 w-full mb-2 group"
      >
        <FolderOpen size={10} className="text-violet-400" />
        <h3 className="text-white/60 text-[10px] uppercase tracking-[0.3em] font-black group-hover:text-white/80 transition-colors">
          SCENE STATES
        </h3>
        {metas.length > 0 && (
          <span className="text-[8px] text-violet-400/50 font-mono">{metas.length}</span>
        )}
        <span className="ml-auto">
          {expanded
            ? <ChevronUp size={10} className="text-white/30" />
            : <ChevronDown size={10} className="text-white/30" />
          }
        </span>
      </button>

      {expanded && (
        <>
          {/* Save current state */}
          {showInput ? (
            <div className="flex gap-1 mb-3">
              <input
                type="text"
                placeholder="State name..."
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSave();
                  if (e.key === 'Escape') { setShowInput(false); setSaveName(''); }
                }}
                className="flex-1 bg-white/10 border border-white/10 rounded px-2 py-1.5 text-[10px] text-white placeholder:text-white/20 outline-none focus:border-violet-400/40"
                autoFocus
              />
              <button
                onClick={handleSave}
                disabled={!saveName.trim() || saving}
                className="px-3 py-1.5 bg-violet-500/30 hover:bg-violet-500/50 text-violet-300 text-[9px] uppercase tracking-widest font-black rounded transition-all disabled:opacity-30"
              >
                {saving ? '...' : 'Save'}
              </button>
              <button
                onClick={() => { setShowInput(false); setSaveName(''); }}
                className="px-2 py-1.5 text-white/30 hover:text-white/60 text-[9px] transition-all"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowInput(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2 bg-violet-500/20 hover:bg-violet-500/40 text-violet-400 text-[9px] uppercase tracking-widest font-black rounded-lg transition-all mb-3"
            >
              <Save size={10} />
              Save Current State
              <span className="text-[7px] text-violet-400/40 ml-1">({totalObjects} objects)</span>
            </button>
          )}

          {/* Saved states list */}
          <div className="space-y-1 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
            {metas.map(s => (
              <div
                key={s.id}
                className="bg-white/5 border border-white/5 rounded p-2.5 group hover:bg-white/10 hover:border-violet-500/20 transition-all"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] text-white/80 font-medium truncate flex-1">
                    {s.name}
                  </span>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => handleRestore(s)}
                      disabled={loadingId === s.id}
                      className="flex items-center gap-1 px-2 py-1 bg-violet-500/30 hover:bg-violet-500/50 text-violet-300 text-[8px] uppercase tracking-wider font-black rounded transition-all disabled:opacity-50"
                      title="Restore this state"
                    >
                      <Upload size={8} />
                      {loadingId === s.id ? '...' : 'Load'}
                    </button>
                    <button
                      onClick={() => handleDelete(s)}
                      className="px-1.5 py-1 hover:bg-red-500/20 text-white/25 hover:text-red-400 rounded transition-all"
                      title="Delete saved state"
                    >
                      <Trash2 size={9} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[8px] text-white/25 font-mono">
                  <Clock size={8} className="shrink-0" />
                  <span>
                    {new Date(s.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    {' '}
                    {new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="text-white/10">·</span>
                  <span>{s.wallCount}W · {s.boxCount}B · {s.cylinderCount}C</span>
                </div>
              </div>
            ))}
            {metas.length === 0 && (
              <div className="text-[9px] text-white/15 text-center py-4 italic">
                No saved states yet
              </div>
            )}
          </div>
        </>
      )}

      {/* Inline toast */}
      {toast && (
        <div className="mt-2 text-[9px] text-violet-400 text-center font-black uppercase tracking-wider animate-in fade-in duration-300">
          {toast}
        </div>
      )}
    </div>
  );
};

export default SavedStatesPanel;
