import React, { useState } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ProductImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  productName: string;
}

export default function ProductImageModal({ isOpen, onClose, imageUrl, productName }: ProductImageModalProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));
  const handleReset = () => {
    setScale(1);
    setRotation(0);
  };
  const handleRotate = () => setRotation(prev => prev + 90);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
        {/* Backdrop close wrapper */}
        <div className="absolute inset-0" onClick={onClose} />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative bg-white dark:bg-gray-900 rounded-2xl overflow-hidden w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl z-10 border border-gray-100 dark:border-gray-800"
        >
          {/* Header */}
          <div className="p-4 border-b border-gray-150 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
            <h3 className="font-bold text-gray-900 dark:text-white line-clamp-1">{productName}</h3>
            <button 
              onClick={onClose} 
              className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Image Container */}
          <div className="flex-1 overflow-hidden relative min-h-[300px] md:min-h-[400px] flex items-center justify-center bg-gray-100 dark:bg-gray-950 p-6">
            <div className="w-full h-full flex items-center justify-center overflow-auto cursor-grab active:cursor-grabbing">
              <motion.img 
                src={imageUrl} 
                alt={productName}
                style={{ 
                  scale: scale,
                  rotate: `${rotation}deg`,
                }}
                transition={{ type: 'spring', damping: 25, stiffness: 150 }}
                className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-md select-none touch-none"
                referrerPolicy="no-referrer"
                drag={scale > 1}
                dragConstraints={{ left: -300, right: 300, top: -300, bottom: 300 }}
              />
            </div>
          </div>

          {/* Action Bar */}
          <div className="p-4 border-t border-gray-150 dark:border-gray-700 flex justify-center items-center gap-3 bg-gray-50/50 dark:bg-gray-900/50">
            <button 
              onClick={handleZoomOut} 
              disabled={scale <= 0.5}
              className="p-2 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
              title="Alejar (-)"
            >
              <ZoomOut className="w-5 h-5" />
            </button>
            <span className="text-sm font-semibold font-mono text-gray-600 dark:text-gray-300 w-16 text-center">
              {Math.round(scale * 100)}%
            </span>
            <button 
              onClick={handleZoomIn} 
              disabled={scale >= 3}
              className="p-2 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
              title="Acercar (+)"
            >
              <ZoomIn className="w-5 h-5" />
            </button>
            <div className="h-6 w-px bg-gray-250 dark:bg-gray-850" />
            <button 
              onClick={handleRotate} 
              className="p-2 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Rotar 90°"
            >
              <RotateCcw className="w-5 h-5 -scale-x-100" />
            </button>
            <button 
              onClick={handleReset} 
              className="p-2 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Restablecer vista"
            >
              <span className="text-xs font-semibold">1:1</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
