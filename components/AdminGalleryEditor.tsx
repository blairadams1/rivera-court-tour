import React, { useState, useRef, useCallback } from 'react';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors, 
  DragEndEvent 
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  rectSortingStrategy, 
  useSortable 
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GalleryImage } from '../types';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import { v4 as uuidv4 } from 'uuid';
import { X, GripVertical, Image as ImageIcon, Loader2, Upload } from 'lucide-react';

interface SortablePhotoProps {
  image: GalleryImage;
  onUpdate: (id: string, newCaption: string) => void;
  onRemove: (id: string) => void;
}

const SortablePhoto = ({ image, onUpdate, onRemove }: SortablePhotoProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: image.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={`bg-zinc-900/50 border ${isDragging ? 'border-[#005e99] shadow-inner shadow-[#005e99]/20' : 'border-white/10'} rounded-lg p-3 flex flex-col gap-2 relative group`}
    >
      <div className="flex items-start gap-2">
        {/* Drag Handle */}
        <button 
          className="text-white/40 hover:text-white pt-1 cursor-grab active:cursor-grabbing" 
          {...attributes} 
          {...listeners}
          title="Drag to reorder"
        >
          <GripVertical size={16} />
        </button>
        
        {/* Thumbnail preview */}
        <div className="w-16 h-16 rounded overflow-hidden bg-black shrink-0 relative flex items-center justify-center">
          <img src={image.url} alt={image.caption} className="w-full h-full object-cover" />
        </div>
        
        {/* Caption Input */}
        <textarea 
          placeholder="Caption for this image..."
          value={image.caption} 
          onChange={(e) => onUpdate(image.id, e.target.value)}
          className="bg-black/40 text-white text-[11px] p-2 rounded border border-white/5 outline-none focus:border-[#005e99]/50 flex-1 h-16 resize-none"
        />
        
        {/* Remove Button */}
        <button 
          onClick={() => onRemove(image.id)}
          className="text-white/30 hover:text-red-400 p-1 transition-colors"
          title="Remove image"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

interface AdminGalleryEditorProps {
  gallery: GalleryImage[];
  onChange: (gallery: GalleryImage[]) => void;
  hotspotId: string;
}

export const AdminGalleryEditor: React.FC<AdminGalleryEditorProps> = ({ gallery, onChange, hotspotId }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = gallery.findIndex((item) => item.id === active.id);
      const newIndex = gallery.findIndex((item) => item.id === over.id);
      onChange(arrayMove(gallery, oldIndex, newIndex));
    }
  };

  const handleUpdateCaption = (id: string, newCaption: string) => {
    onChange(gallery.map(img => img.id === id ? { ...img, caption: newCaption } : img));
  };

  const handleRemoveImage = (id: string) => {
    onChange(gallery.filter(img => img.id !== id));
  };

  // --- Shared upload logic ---
  const processFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);
    const newImages: GalleryImage[] = [];

    const totalFiles = files.length;
    let processedCount = 0;

    for (let i = 0; i < totalFiles; i++) {
      const file = files[i];
      const imageId = uuidv4();
      const storageRef = ref(storage, `hotspots/${hotspotId}/${imageId}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      try {
        await new Promise<void>((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            (snapshot) => {
               const individualProgress = (snapshot.bytesTransferred / snapshot.totalBytes);
               setUploadProgress(Math.round(((processedCount + individualProgress) / totalFiles) * 100));
            },
            (error) => {
              console.error("Upload failed", error);
              reject(error);
            },
            async () => {
              try {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                newImages.push({
                  id: imageId,
                  url: downloadURL,
                  caption: ''
                });
                processedCount++;
                resolve();
              } catch (error) {
                console.error("Failed to get download URL", error);
                reject(error);
              }
            }
          );
        });
      } catch (error) {
        console.error(`Skipping file ${file.name} due to upload error`, error);
      }
    }

    if (newImages.length > 0) {
      onChange([...gallery, ...newImages]);
    }
    
    setIsUploading(false);
    setUploadProgress(0);
  }, [gallery, hotspotId, onChange]);

  // --- Input change handler ---
  const handleFileInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    await processFiles(Array.from(files));
    event.target.value = '';
  };

  // --- OS Drag & Drop handlers ---
  const handleFileDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleFileDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true);
    }
  }, []);

  const handleFileDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleFileDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragOver(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (droppedFiles.length > 0) {
      await processFiles(droppedFiles);
    }
  }, [processFiles]);

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <label className="text-[9px] uppercase tracking-widest text-white/40 block font-black">Image Gallery ({gallery.length})</label>
        
        {/* Upload Button */}
        <label className={`cursor-pointer bg-[#005e99]/20 hover:bg-[#005e99]/40 text-[#4ca6ff] text-[10px] px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
          {isUploading ? <Loader2 size={12} className="animate-spin" /> : <ImageIcon size={12} />}
          <span className="font-bold tracking-wider">{isUploading ? `UPLOADING ${uploadProgress}%` : 'ADD IMAGES'}</span>
          <input 
            ref={fileInputRef}
            type="file" 
            className="hidden" 
            accept="image/*" 
            multiple 
            onChange={handleFileInputChange}
            disabled={isUploading}
          />
        </label>
      </div>

      {/* Drop zone wrapper */}
      <div
        onDragOver={handleFileDragOver}
        onDragEnter={handleFileDragEnter}
        onDragLeave={handleFileDragLeave}
        onDrop={handleFileDrop}
        className="relative"
      >
        {/* Drag-over overlay */}
        {isDragOver && (
          <div className="absolute inset-0 z-10 bg-[#005e99]/10 border-2 border-dashed border-[#005e99] rounded-lg flex flex-col items-center justify-center gap-2 backdrop-blur-sm pointer-events-none">
            <Upload size={24} className="text-[#005e99] animate-bounce" />
            <span className="text-[11px] text-[#4ca6ff] font-bold uppercase tracking-widest">Drop images here</span>
          </div>
        )}

        {gallery.length > 0 ? (
          <DndContext 
            sensors={sensors} 
            collisionDetection={closestCenter} 
            onDragEnd={handleDragEnd}
          >
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
              <SortableContext items={gallery.map(g => g.id)} strategy={rectSortingStrategy}>
                {gallery.map(image => (
                  <SortablePhoto 
                    key={image.id} 
                    image={image} 
                    onUpdate={handleUpdateCaption} 
                    onRemove={handleRemoveImage} 
                  />
                ))}
              </SortableContext>
            </div>
          </DndContext>
        ) : (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className={`border border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200 ${
              isDragOver 
                ? 'border-[#005e99] bg-[#005e99]/10' 
                : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/[0.07]'
            }`}
          >
            <Upload size={20} className="mx-auto mb-2 text-white/20" />
            <p className="text-[10px] text-white/30 uppercase tracking-widest">No images added yet</p>
            <p className="text-[9px] text-white/20 mt-1">Drag & drop images here or click to browse</p>
          </div>
        )}
      </div>
    </div>
  );
};
