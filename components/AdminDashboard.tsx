
import React, { useState } from 'react';
import { Hotspot, WallSide } from '../types';

interface AdminDashboardProps {
  hotspots: Hotspot[];
  onClose: () => void;
  onUpdateHotspots: (hotspots: Hotspot[]) => void;
  onEditHotspot: (hotspot: Hotspot) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ hotspots, onClose, onUpdateHotspots, onEditHotspot }) => {
  const [filter, setFilter] = useState<string>('');
  const [wallFilter, setWallFilter] = useState<WallSide | 'ALL'>('ALL');

  const filteredHotspots = hotspots.filter(h => {
    const matchesText = h.title.toLowerCase().includes(filter.toLowerCase()) || 
                      h.description.toLowerCase().includes(filter.toLowerCase());
    const matchesWall = wallFilter === 'ALL' || h.wallSide === wallFilter;
    return matchesText && matchesWall;
  });

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(hotspots, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "rivera_court_hotspots.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (Array.isArray(json)) {
          onUpdateHotspots(json);
          alert('Import successful!');
        }
      } catch (err) {
        alert('Invalid JSON file.');
      }
    };
    reader.readAsText(file);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this hotspot?')) {
      onUpdateHotspots(hotspots.filter(h => h.id !== id));
    }
  };

  const clearAll = () => {
    if (window.confirm('EXTREME ACTION: Delete all hotspots in this session?')) {
      onUpdateHotspots([]);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl p-12 overflow-y-auto flex flex-col animate-in fade-in duration-300">
      <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-end mb-12 border-b border-white/10 pb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="px-2 py-0.5 bg-[#c5a059] text-black text-[10px] font-bold">ADMIN</span>
              <h2 className="font-serif text-5xl">Curatorial Dashboard</h2>
            </div>
            <p className="text-white/40 text-sm uppercase tracking-[0.2em]">Hotspot & Content Management System</p>
          </div>
          <button 
            onClick={onClose}
            className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Toolbar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="md:col-span-2">
            <label className="text-[10px] uppercase tracking-widest text-white/30 block mb-2 font-bold">Search Hotspots</label>
            <input 
              type="text" 
              placeholder="Filter by title or content..."
              className="w-full bg-zinc-900 border border-white/10 p-4 text-sm outline-none focus:border-[#c5a059] transition-colors"
              value={filter}
              onChange={e => setFilter(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-white/30 block mb-2 font-bold">Filter Wall</label>
            <select 
              className="w-full bg-zinc-900 border border-white/10 p-4 text-sm outline-none focus:border-[#c5a059] text-white appearance-none"
              value={wallFilter}
              onChange={e => setWallFilter(e.target.value as any)}
            >
              <option value="ALL">All Walls</option>
              <option value={WallSide.NORTH}>North Wall</option>
              <option value={WallSide.SOUTH}>South Wall</option>
              <option value={WallSide.EAST}>East Wall</option>
              <option value={WallSide.WEST}>West Wall</option>
            </select>
          </div>
          <div className="flex items-end gap-3">
             <button 
              onClick={handleExport}
              className="flex-1 bg-white/5 border border-white/10 py-4 text-[10px] uppercase tracking-widest font-bold hover:bg-white/10 transition-all"
            >
              Export JSON
            </button>
            <label className="flex-1 bg-white/5 border border-white/10 py-4 text-[10px] uppercase tracking-widest font-bold hover:bg-white/10 transition-all text-center cursor-pointer">
              Import
              <input type="file" className="hidden" accept=".json" onChange={handleImport} />
            </label>
          </div>
        </div>

        {/* List */}
        <div className="bg-zinc-900/50 border border-white/5 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-black/40 text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold border-b border-white/10">
                <th className="p-6">Detail Title</th>
                <th className="p-6">Wall</th>
                <th className="p-6">Media</th>
                <th className="p-6">Position (X,Y,Z)</th>
                <th className="p-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredHotspots.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-20 text-center text-white/20 italic font-light">
                    No hotspots found. Start by clicking a wall in the court.
                  </td>
                </tr>
              ) : (
                filteredHotspots.map(h => (
                  <tr key={h.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="p-6">
                      <div className="font-serif text-lg text-white mb-1">{h.title || 'Untitled Detail'}</div>
                      <div className="text-xs text-white/30 truncate max-w-xs">{h.description}</div>
                    </td>
                    <td className="p-6">
                      <span className="text-[10px] font-mono bg-white/5 px-2 py-1 border border-white/10 text-[#c5a059]">
                        {h.wallSide}
                      </span>
                    </td>
                    <td className="p-6">
                      <span className={`text-[10px] uppercase tracking-tighter font-bold ${
                        h.mediaType === 'video' ? 'text-red-400' : 
                        h.mediaType === 'audio' ? 'text-green-400' : 
                        h.mediaType === 'image' ? 'text-yellow-400' : 'text-white/20'
                      }`}>
                        {h.mediaType}
                      </span>
                    </td>
                    <td className="p-6 text-xs font-mono text-white/40">
                      {h.position.map(p => p.toFixed(1)).join(', ')}
                    </td>
                    <td className="p-6 text-right space-x-4">
                      <button 
                        onClick={() => onEditHotspot(h)}
                        className="text-[10px] uppercase tracking-widest text-[#c5a059] font-bold hover:underline"
                      >
                        Teleport & Edit
                      </button>
                      <button 
                        onClick={() => handleDelete(h.id)}
                        className="text-[10px] uppercase tracking-widest text-red-500 font-bold hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Actions */}
        <div className="mt-12 flex justify-between items-center text-white/20">
          <div className="text-xs font-mono">
            TOTAL ELEMENTS: {hotspots.length} | FILTERED: {filteredHotspots.length}
          </div>
          <button 
            onClick={clearAll}
            className="text-[10px] uppercase tracking-widest font-bold hover:text-red-500 transition-colors"
          >
            Clear All Mural Data
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
