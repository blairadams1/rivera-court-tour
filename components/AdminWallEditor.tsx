
import React, { useState, useEffect } from 'react';
import { InteriorWall } from '../types';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import { v4 as uuidv4 } from 'uuid';
import { Upload, Loader2, Trash2, Image as ImageIcon } from 'lucide-react';

interface AdminWallEditorProps {
  wall: InteriorWall;
  onSave: (wall: InteriorWall) => void;
  onDelete: (id: string) => void;
  onCancel: () => void;
}

const AdminWallEditor: React.FC<AdminWallEditorProps> = ({ wall, onSave, onDelete, onCancel }) => {
  const [formData, setFormData] = useState<InteriorWall>({ ...wall });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    setFormData({ ...wall });
  }, [wall]);

  // Save on every change
  useEffect(() => {
    const timeout = setTimeout(() => {
      onSave(formData);
    }, 300);
    return () => clearTimeout(timeout);
  }, [formData]);

  // --- Image Upload ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setUploadProgress(0);
    
    const fileId = uuidv4();
    const storageRef = ref(storage, `interior_walls/${formData.id}/${fileId}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        setUploadProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
      },
      (error) => {
        console.error('Upload failed', error);
        setIsUploading(false);
      },
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        setFormData(prev => ({ ...prev, imageUrl: url }));
        setIsUploading(false);
        setUploadProgress(0);
      }
    );
    e.target.value = '';
  };

  return (
    <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[110] bg-[#0a0a0a]/90 backdrop-blur-3xl border border-[#005e99]/40 w-[420px] max-h-[70vh] flex flex-col rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300">
      {/* Header */}
      <div className="flex justify-between items-center p-6 pb-3 shrink-0">
        <div>
          <h3 className="font-serif text-xl text-white tracking-tight">
            {formData.type === 'floor' ? 'Floor' : 'Wall'} Properties
          </h3>
          <p className="text-[9px] uppercase tracking-[0.3em] text-[#005e99] font-black mt-1">IMAGE &amp; LABEL</p>
        </div>
        <button onClick={onCancel} className="text-white/20 hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10">✕</button>
      </div>

      <div className="space-y-4 overflow-y-auto px-6 pb-6 custom-scrollbar">
        {/* Image Upload */}
        <div>
          <label className="text-[9px] uppercase tracking-widest text-white/40 block mb-2 font-black">Image</label>
          {formData.imageUrl ? (
            <div className="relative group">
              <img src={formData.imageUrl} alt="Wall texture" className="w-full h-28 object-cover rounded-lg border border-white/10" />
              <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer rounded-lg">
                <span className="text-[10px] text-white/80 uppercase tracking-widest font-black">Replace Image</span>
                <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={isUploading} />
              </label>
            </div>
          ) : (
            <label className={`border border-dashed rounded-lg p-6 text-center cursor-pointer transition-all block ${
              isUploading ? 'border-[#005e99] bg-[#005e99]/10' : 'border-white/10 bg-white/5 hover:border-white/20'
            }`}>
              {isUploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 size={20} className="animate-spin text-[#005e99]" />
                  <span className="text-[10px] text-white/50 uppercase tracking-widest">{uploadProgress}%</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload size={20} className="text-white/20" />
                  <span className="text-[10px] text-white/30 uppercase tracking-widest">Upload Image</span>
                </div>
              )}
              <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={isUploading} />
            </label>
          )}
        </div>

        {/* Label */}
        <div>
          <label className="text-[9px] uppercase tracking-widest text-white/40 block mb-1 font-black">Label</label>
          <input
            className="w-full bg-black/40 border border-white/10 p-2.5 rounded-lg text-sm outline-none focus:border-[#005e99] transition-all text-white"
            value={formData.label}
            onChange={e => setFormData(prev => ({ ...prev, label: e.target.value }))}
            placeholder="Description for this element..."
          />
        </div>

        {/* Billboard / Look At */}
        {formData.type !== 'floor' && (
          <label className="flex items-center gap-3 cursor-pointer group py-1" onClick={() => setFormData(prev => ({ ...prev, billboard: !prev.billboard }))}>
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
              formData.billboard
                ? 'bg-[#005e99] border-[#005e99]'
                : 'border-white/20 group-hover:border-white/40'
            }`}>
              {formData.billboard && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              )}
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-widest text-white/60 font-black block">Look At Camera</span>
              <span className="text-[8px] text-white/25">Panel always faces the viewer for depth illusion</span>
            </div>
          </label>
        )}

        {/* Info readout */}
        <div className="bg-black/30 border border-white/5 rounded-lg p-3">
          <p className="text-[8px] uppercase tracking-widest text-white/20 font-black mb-1">Transform Info</p>
          <p className="text-[10px] text-white/40 font-mono">
            Position: ({formData.position[0].toFixed(1)}, {formData.position[1].toFixed(1)}, {formData.position[2].toFixed(1)})
          </p>
          <p className="text-[10px] text-white/40 font-mono">
            Scale: {formData.scale[0].toFixed(1)} × {formData.scale[1].toFixed(1)} ft · Rotation: {formData.rotation}°
            {formData.billboard ? ' · Billboard' : ''}
          </p>
          <p className="text-[8px] text-white/15 mt-1 italic">
            Use the 3D gizmo controls in the viewport to adjust transforms
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 bg-white/5 text-white/60 font-black py-3 rounded-lg text-[10px] uppercase tracking-[0.2em] hover:bg-white/10 transition-all border border-white/5"
          >
            Done
          </button>
          <button
            onClick={() => onDelete(formData.id)}
            className="px-5 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all text-[10px] uppercase font-black rounded-lg flex items-center gap-1.5"
          >
            <Trash2 size={12} />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminWallEditor;
