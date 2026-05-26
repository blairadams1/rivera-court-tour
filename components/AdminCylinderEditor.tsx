
import React, { useState, useEffect, useRef } from 'react';
import { InteriorCylinder, CylinderFaceTextures } from '../types';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import { v4 as uuidv4 } from 'uuid';
import { Upload, Loader2, Trash2, Image as ImageIcon, X } from 'lucide-react';

interface AdminCylinderEditorProps {
  cylinder: InteriorCylinder;
  onSave: (cyl: InteriorCylinder) => void;
  onDelete: (id: string) => void;
  onCancel: () => void;
}

const FACE_NAMES: { key: keyof CylinderFaceTextures; label: string; indicator: string }[] = [
  { key: 'side',   label: 'Side (Body Wrap)', indicator: '◯' },
  { key: 'top',    label: 'Top (Cap)',         indicator: '⬒' },
  { key: 'bottom', label: 'Bottom (Cap)',      indicator: '⬓' },
];

const AdminCylinderEditor: React.FC<AdminCylinderEditorProps> = ({ cylinder, onSave, onDelete, onCancel }) => {
  const [formData, setFormData] = useState<InteriorCylinder>({ ...cylinder });
  const [uploadingFace, setUploadingFace] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Keep formData in sync when the cylinder prop changes externally
  const isFirstRender = useRef(true);
  useEffect(() => {
    setFormData({ ...cylinder });
  }, [cylinder]);

  // Auto-save with 300ms debounce (skip the very first render to avoid a save-on-mount)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timeout = setTimeout(() => {
      onSave(formData);
    }, 300);
    return () => clearTimeout(timeout);
  }, [formData]);

  // ---- Upload helper ----
  const handleUpload = async (
    file: File,
    storagePath: string,
    onComplete: (url: string) => void,
    faceKey?: string,
  ) => {
    setUploadingFace(faceKey ?? 'uniform');
    setUploadProgress(0);

    const storageReference = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageReference, file);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        setUploadProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
      },
      (error) => {
        console.error('Upload failed', error);
        setUploadingFace(null);
      },
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        onComplete(url);
        setUploadingFace(null);
        setUploadProgress(0);
      },
    );
  };

  // ---- Uniform upload ----
  const handleUniformUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileId = uuidv4();
    const path = `interior_cylinders/${formData.id}/uniform_${fileId}_${file.name}`;
    handleUpload(file, path, (url) => {
      setFormData((prev) => ({ ...prev, textureUrl: url }));
    });
    e.target.value = '';
  };

  // ---- Per-face upload ----
  const handleFaceUpload = (faceKey: keyof CylinderFaceTextures, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileId = uuidv4();
    const path = `interior_cylinders/${formData.id}/${faceKey}_${fileId}_${file.name}`;
    handleUpload(
      file,
      path,
      (url) => {
        setFormData((prev) => ({
          ...prev,
          faceTextures: { ...(prev.faceTextures || {}), [faceKey]: url },
        }));
      },
      faceKey,
    );
    e.target.value = '';
  };

  // ---- Rendering helpers ----
  const isUploading = uploadingFace !== null;

  const renderUploadZone = (
    currentUrl: string | undefined,
    onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
    busy: boolean,
    label?: string,
  ) => {
    if (currentUrl) {
      return (
        <div className="relative group">
          <img src={currentUrl} alt={label ?? 'Texture'} className="w-full h-28 object-cover rounded-lg border border-white/10" />
          <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer rounded-lg">
            <span className="text-[10px] text-white/80 uppercase tracking-widest font-black">Replace</span>
            <input type="file" className="hidden" accept="image/*" onChange={onFileChange} disabled={isUploading} />
          </label>
        </div>
      );
    }
    return (
      <label
        className={`border border-dashed rounded-lg p-4 text-center cursor-pointer transition-all block ${
          busy ? 'border-[#005e99] bg-[#005e99]/10' : 'border-white/10 bg-white/5 hover:border-white/20'
        }`}
      >
        {busy ? (
          <div className="flex flex-col items-center gap-1">
            <Loader2 size={16} className="animate-spin text-[#005e99]" />
            <span className="text-[10px] text-white/50 uppercase tracking-widest">{uploadProgress}%</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <Upload size={16} className="text-white/20" />
            <span className="text-[10px] text-white/30 uppercase tracking-widest">Upload Image</span>
          </div>
        )}
        <input type="file" className="hidden" accept="image/*" onChange={onFileChange} disabled={isUploading} />
      </label>
    );
  };

  return (
    <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[110] bg-[#0a0a0a]/90 backdrop-blur-3xl border border-[#005e99]/40 w-[420px] max-h-[80vh] flex flex-col rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300">
      {/* Header */}
      <div className="flex justify-between items-center p-6 pb-3 shrink-0">
        <div>
          <h3 className="font-serif text-xl text-white tracking-tight">Edit Cylinder</h3>
          <p className="text-[9px] uppercase tracking-[0.3em] text-[#005e99] font-black mt-1">TEXTURES &amp; LABEL</p>
        </div>
        <button
          onClick={onCancel}
          className="text-white/20 hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10"
        >
          <X size={16} />
        </button>
      </div>

      <div className="space-y-4 overflow-y-auto px-6 pb-6 custom-scrollbar">
        {/* Label */}
        <div>
          <label className="text-[9px] uppercase tracking-widest text-white/40 block mb-1 font-black">Label</label>
          <input
            className="w-full bg-black/40 border border-white/10 p-2.5 rounded-lg text-sm outline-none focus:border-[#005e99] transition-all text-white"
            value={formData.label}
            onChange={(e) => setFormData((prev) => ({ ...prev, label: e.target.value }))}
            placeholder="Cylinder label..."
          />
        </div>

        {/* Segments */}
        <div>
          <label className="text-[9px] uppercase tracking-widest text-white/40 block mb-1 font-black">Segments</label>
          <input
            type="number"
            min={3}
            max={128}
            className="w-full bg-black/40 border border-white/10 p-2.5 rounded-lg text-sm outline-none focus:border-[#005e99] transition-all text-white"
            value={formData.segments ?? 32}
            onChange={(e) => {
              const val = Math.max(3, Math.min(128, parseInt(e.target.value, 10) || 32));
              setFormData((prev) => ({ ...prev, segments: val }));
            }}
          />
          <p className="text-[8px] text-white/20 mt-1 italic">Higher values = smoother surface (default: 32)</p>
        </div>

        {/* Color */}
        <div>
          <label className="text-[9px] uppercase tracking-widest text-white/40 block mb-1 font-black">Fallback Color</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              className="w-8 h-8 rounded-lg border border-white/10 bg-transparent cursor-pointer shrink-0"
              value={formData.color || '#cccccc'}
              onChange={(e) => setFormData((prev) => ({ ...prev, color: e.target.value }))}
            />
            <span className="text-[10px] text-white/40 font-mono uppercase">{formData.color || '#cccccc'}</span>
          </div>
        </div>

        {/* Texture Mode Toggle */}
        <div>
          <label className="text-[9px] uppercase tracking-widest text-white/40 block mb-2 font-black">Texture Mode</label>
          <div className="flex items-center gap-0.5 bg-white/5 rounded-lg p-0.5">
            <button
              onClick={() => setFormData((prev) => ({ ...prev, textureMode: 'uniform' }))}
              className={`flex-1 px-3 py-2 rounded-lg text-[10px] uppercase tracking-[0.12em] font-black transition-all duration-200 ${
                formData.textureMode === 'uniform'
                  ? 'bg-[#005e99] text-white shadow-lg shadow-[#005e99]/20'
                  : 'text-white/40 hover:text-white hover:bg-white/10'
              }`}
            >
              Uniform
            </button>
            <button
              onClick={() => setFormData((prev) => ({ ...prev, textureMode: 'per-face' }))}
              className={`flex-1 px-3 py-2 rounded-lg text-[10px] uppercase tracking-[0.12em] font-black transition-all duration-200 ${
                formData.textureMode === 'per-face'
                  ? 'bg-[#005e99] text-white shadow-lg shadow-[#005e99]/20'
                  : 'text-white/40 hover:text-white hover:bg-white/10'
              }`}
            >
              Per-Face
            </button>
          </div>
        </div>

        {/* Uniform Mode */}
        {formData.textureMode === 'uniform' && (
          <div>
            <label className="text-[9px] uppercase tracking-widest text-white/40 block mb-2 font-black">Texture</label>
            {renderUploadZone(formData.textureUrl, handleUniformUpload, uploadingFace === 'uniform')}
          </div>
        )}

        {/* Per-Face Mode */}
        {formData.textureMode === 'per-face' && (
          <div className="space-y-3">
            <label className="text-[9px] uppercase tracking-widest text-white/40 block font-black">Face Textures</label>
            {FACE_NAMES.map(({ key, label, indicator }) => {
              const faceUrl = formData.faceTextures?.[key];
              const isFaceBusy = uploadingFace === key;
              return (
                <div key={key} className="bg-white/5 rounded-lg border border-white/5 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base leading-none" style={{ color: faceUrl ? '#005e99' : 'rgba(255,255,255,0.2)' }}>
                      {indicator}
                    </span>
                    <span className="text-[10px] uppercase tracking-widest text-white/60 font-black">{label}</span>
                    {faceUrl && (
                      <span className="ml-auto text-[8px] uppercase tracking-widest text-emerald-400/60 font-black">Set</span>
                    )}
                  </div>
                  {faceUrl ? (
                    <div className="relative group">
                      <img src={faceUrl} alt={label} className="w-full h-16 object-cover rounded border border-white/10" />
                      <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer rounded">
                        <span className="text-[9px] text-white/80 uppercase tracking-widest font-black">Replace</span>
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={(e) => handleFaceUpload(key, e)}
                          disabled={isUploading}
                        />
                      </label>
                    </div>
                  ) : (
                    <label
                      className={`border border-dashed rounded p-3 text-center cursor-pointer transition-all block ${
                        isFaceBusy ? 'border-[#005e99] bg-[#005e99]/10' : 'border-white/10 bg-white/5 hover:border-white/20'
                      }`}
                    >
                      {isFaceBusy ? (
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 size={12} className="animate-spin text-[#005e99]" />
                          <span className="text-[9px] text-white/50 uppercase tracking-widest">{uploadProgress}%</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <Upload size={12} className="text-white/20" />
                          <span className="text-[9px] text-white/30 uppercase tracking-widest">Upload</span>
                        </div>
                      )}
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => handleFaceUpload(key, e)}
                        disabled={isUploading}
                      />
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Render Order */}
        <div>
          <label className="text-[9px] uppercase tracking-widest text-white/40 block mb-1 font-black">Render Order</label>
          <input
            type="number"
            className="w-full bg-black/40 border border-white/10 p-2.5 rounded-lg text-sm outline-none focus:border-[#005e99] transition-all text-white"
            value={formData.renderOrder ?? 0}
            onChange={(e) => setFormData((prev) => ({ ...prev, renderOrder: parseInt(e.target.value, 10) || 0 }))}
          />
        </div>

        {/* Transform Info */}
        <div className="bg-black/30 border border-white/5 rounded-lg p-3">
          <p className="text-[8px] uppercase tracking-widest text-white/20 font-black mb-1">Transform Info</p>
          <p className="text-[10px] text-white/40 font-mono">
            Position: ({formData.position[0].toFixed(1)}, {formData.position[1].toFixed(1)}, {formData.position[2].toFixed(1)})
          </p>
          <p className="text-[10px] text-white/40 font-mono">
            Scale: {formData.scale[0].toFixed(1)} × {formData.scale[1].toFixed(1)} × {formData.scale[2].toFixed(1)} ft
          </p>
          <p className="text-[10px] text-white/40 font-mono">
            Rotation: ({formData.rotation[0].toFixed(0)}°, {formData.rotation[1].toFixed(0)}°, {formData.rotation[2].toFixed(0)}°)
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

export default AdminCylinderEditor;
