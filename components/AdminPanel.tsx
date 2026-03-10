
import React, { useState, useEffect } from 'react';
import { Hotspot, MediaType } from '../types';

interface AdminPanelProps {
  hotspots: Hotspot[];
  editingHotspot: Hotspot | null;
  onSave: (hotspot: Hotspot) => void;
  onEdit: (hotspot: Hotspot) => void;
  onDelete: (id: string) => void;
  onCancel: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ hotspots, editingHotspot, onSave, onEdit, onDelete, onCancel }) => {
  const [formData, setFormData] = useState<Partial<Hotspot>>({ title: '', description: '', mediaType: 'none', mediaUrl: '' });

  useEffect(() => {
    if (editingHotspot) setFormData(editingHotspot);
    else setFormData({ title: '', description: '', mediaType: 'none', mediaUrl: '' });
  }, [editingHotspot]);

  if (!editingHotspot) return (
    <div className="fixed left-8 bottom-8 z-40 bg-black/40 backdrop-blur-xl border border-white/5 p-5 w-60 rounded-xl shadow-2xl animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 bg-[#005e99] rounded-full shadow-[0_0_8px_#005e99]"></div>
        <h3 className="text-white/60 text-[10px] uppercase tracking-[0.3em] font-black">EXPLORE</h3>
      </div>
      
      <div className="text-[9px] uppercase tracking-[0.2em] text-[#005e99] mb-2 font-black">
        Discoveries ({hotspots.length})
      </div>
      
      <div className="space-y-1 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
        {hotspots.map(h => (
          <div 
            key={h.id} 
            className="text-[10px] flex justify-between items-center bg-white/5 hover:bg-white/10 p-2 rounded border border-white/5 cursor-pointer group transition-all" 
            onClick={() => onEdit(h)}
          >
            <span className="truncate max-w-[120px] text-white/60 group-hover:text-white font-medium">{h.title || 'Untitled'}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[110] bg-[#0a0a0a]/90 backdrop-blur-3xl border border-[#005e99]/40 p-8 w-[440px] rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300">
      <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
        <div>
          <h3 className="font-serif text-2xl text-white tracking-tight">Edit Discovery</h3>
          <p className="text-[9px] uppercase tracking-[0.3em] text-[#005e99] font-black mt-1">{editingHotspot.wallSide} WALL</p>
        </div>
        <button onClick={onCancel} className="text-white/20 hover:text-white transition-colors">✕</button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-[9px] uppercase tracking-widest text-white/40 block mb-1 font-black">Title</label>
          <input 
            className="w-full bg-black/40 border border-white/10 p-3 rounded-lg text-sm outline-none focus:border-[#005e99] transition-all text-white" 
            value={formData.title} 
            onChange={e => setFormData({...formData, title: e.target.value})} 
            placeholder="Mural Title..." 
          />
        </div>

        <div>
          <label className="text-[9px] uppercase tracking-widest text-white/40 block mb-1 font-black">Content</label>
          <textarea 
            className="w-full bg-black/40 border border-white/10 p-3 rounded-lg text-sm h-32 outline-none focus:border-[#005e99] resize-none leading-relaxed transition-all text-white" 
            value={formData.description} 
            onChange={e => setFormData({...formData, description: e.target.value})} 
            placeholder="Artistic context..." 
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[9px] uppercase tracking-widest text-white/40 block mb-1 font-black">Type</label>
            <select 
              className="w-full bg-black/40 border border-white/10 p-3 rounded-lg text-[10px] text-white outline-none focus:border-[#005e99] appearance-none cursor-pointer" 
              value={formData.mediaType} 
              onChange={e => setFormData({...formData, mediaType: e.target.value as MediaType})}
            >
              <option value="none">Text</option>
              <option value="image">Image</option>
              <option value="video">Video</option>
              <option value="audio">Audio</option>
            </select>
          </div>
          <div>
            <label className="text-[9px] uppercase tracking-widest text-white/40 block mb-1 font-black">URL</label>
            <input 
              className="w-full bg-black/40 border border-white/10 p-3 rounded-lg text-sm outline-none focus:border-[#005e99] transition-all text-white" 
              value={formData.mediaUrl} 
              onChange={e => setFormData({...formData, mediaUrl: e.target.value})} 
              placeholder="Media link..." 
            />
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button 
            onClick={() => onSave({...editingHotspot, ...formData} as Hotspot)} 
            className="flex-1 bg-[#005e99] text-white font-black py-3 rounded-lg text-[10px] uppercase tracking-[0.2em] hover:bg-white hover:text-[#005e99] transition-all"
          >
            Save
          </button>
          <button 
            onClick={() => onDelete(editingHotspot.id)} 
            className="px-6 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all text-[10px] uppercase font-black rounded-lg"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
