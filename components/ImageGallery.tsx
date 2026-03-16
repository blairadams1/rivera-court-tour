import React, { useState } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { GalleryImage } from '../types';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ImageGalleryProps {
  images: GalleryImage[];
}

const SWIPE_THRESHOLD = 50;

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? '100%' : '-100%',
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? '-100%' : '100%',
    opacity: 0,
  }),
};

const ImageGallery: React.FC<ImageGalleryProps> = ({ images }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const [direction, setDirection] = useState(0);

  if (!images || images.length === 0) return null;

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const handlePrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDirection(-1);
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleDragEnd = (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x < -SWIPE_THRESHOLD) {
      handleNext();
    } else if (info.offset.x > SWIPE_THRESHOLD) {
      handlePrev();
    }
  };

  const currentImage = images[currentIndex];

  return (
    <div className="relative group w-full overflow-hidden bg-black/40">
      
      {/* Image Container */}
      <div className="relative flex items-center justify-center overflow-hidden aspect-[3/2] w-full">
        <AnimatePresence mode="popLayout" custom={direction} initial={false}>
          <motion.img
            key={currentImage.id}
            src={currentImage.url}
            alt={currentImage.caption || `Image ${currentIndex + 1}`}
            className="shadow-2xl object-cover absolute inset-0 w-full h-full"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'tween', duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
            drag={images.length > 1 ? 'x' : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.3}
            onDragEnd={handleDragEnd}
            style={{ cursor: images.length > 1 ? 'grab' : 'default' }}
          />
        </AnimatePresence>
        
        {/* Navigation Buttons */}
        {images.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              title="Previous image"
              className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white backdrop-blur flex items-center justify-center hover:bg-black/80 transition-all opacity-0 group-hover:opacity-100 z-10"
            >
              <ChevronLeft size={24} />
            </button>
            <button
              onClick={handleNext}
              title="Next image"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white backdrop-blur flex items-center justify-center hover:bg-black/80 transition-all opacity-0 group-hover:opacity-100 z-10"
            >
              <ChevronRight size={24} />
            </button>
          </>
        )}

      </div>

      {/* Caption & Indicators */}
      <div className="mt-4 flex flex-col items-center p-4">
        {currentImage.caption && (
          <p className="text-white/80 text-sm md:text-base text-center italic font-serif">
            {currentImage.caption}
          </p>
        )}
        
        {images.length > 1 && (
          <div className="flex gap-2 mt-4 justify-center">
            {images.map((_, idx) => (
              <button
                key={idx}
                title={`Go to image ${idx + 1}`}
                onClick={(e) => { e.stopPropagation(); setDirection(idx > currentIndex ? 1 : -1); setCurrentIndex(idx); }}
                className={`h-1.5 rounded-full transition-all ${idx === currentIndex ? 'w-6 bg-[#005e99]' : 'w-1.5 bg-white/20'}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageGallery;
