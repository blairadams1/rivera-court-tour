
import React, { useState, useEffect } from 'react';
import { Hotspot, MediaType, GalleryImage } from '../types';
import { AdminGalleryEditor } from './AdminGalleryEditor';

interface AdminPanelProps {
  hotspots: Hotspot[];
  editingHotspot: Hotspot | null;
  onSave: (hotspot: Hotspot) => void;
  onEdit: (hotspot: Hotspot) => void;
  onDelete: (id: string) => void;
  onCancel: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ hotspots, editingHotspot, onSave, onEdit, onDelete, onCancel }) => {
  const [formData, setFormData] = useState<Partial<Hotspot>>({ title: '', description: '', mediaType: 'none', mediaUrl: '', gallery: [] });

  useEffect(() => {
    if (editingHotspot) setFormData(editingHotspot);
    else setFormData({ title: '', description: '', mediaType: 'none', mediaUrl: '', gallery: [] });
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
    <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[110] bg-[#0a0a0a]/90 backdrop-blur-3xl border border-[#005e99]/40 w-[550px] max-h-[90vh] flex flex-col rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300">
      <div className="flex justify-between items-center p-8 pb-4 shrink-0">
        <div>
          <h3 className="font-serif text-2xl text-white tracking-tight">Edit Discovery</h3>
          <p className="text-[9px] uppercase tracking-[0.3em] text-[#005e99] font-black mt-1">{editingHotspot.wallSide} WALL</p>
        </div>
        <button onClick={onCancel} className="text-white/20 hover:text-white transition-colors flex shrink-0 w-8 h-8 items-center justify-center rounded-full hover:bg-white/10">✕</button>
      </div>

      <div className="space-y-4 overflow-y-auto px-8 pb-8 custom-scrollbar">
        <div>
          <label className="text-[9px] uppercase tracking-widest text-white/40 block mb-1 font-black">Title</label>
          <input 
            className="w-full bg-black/40 border border-white/10 p-3 rounded-lg text-sm outline-none focus:border-[#005e99] transition-all text-white" 
            value={formData.title} 
            onChange={e => setFormData({...formData, title: e.target.value})} 
            placeholder="Mural Title..." 
          />
        </div>

        {/* Image Gallery - Always visible */}
        <div className="pt-2 border-t border-white/10">
          <AdminGalleryEditor 
            gallery={formData.gallery || []} 
            onChange={(newGallery: GalleryImage[]) => setFormData({...formData, gallery: newGallery})} 
            hotspotId={editingHotspot.id}
          />
        </div>

        <div>
          <label className="text-[9px] uppercase tracking-widest text-white/40 block mb-1 font-black">Description</label>
          <textarea 
            className="w-full bg-black/40 border border-white/10 p-3 rounded-lg text-sm h-32 outline-none focus:border-[#005e99] resize-none leading-relaxed transition-all text-white" 
            value={formData.description} 
            onChange={e => setFormData({...formData, description: e.target.value})} 
            placeholder="Artistic context..." 
          />
        </div>

        <div>
          <label className="text-[9px] uppercase tracking-widest text-white/40 block mb-1 font-black">Video URL</label>
          <input 
            className="w-full bg-black/40 border border-white/10 p-3 rounded-lg text-sm outline-none focus:border-[#005e99] transition-all text-white" 
            value={formData.mediaUrl} 
            onChange={e => setFormData({...formData, mediaUrl: e.target.value})} 
            placeholder="YouTube or video link..." 
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button 
            onClick={() => onSave({...editingHotspot, ...formData, mediaType: 'video'} as Hotspot)} 
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
