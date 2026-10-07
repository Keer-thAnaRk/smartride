'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Check, X, Move, Sparkles } from 'lucide-react';

interface ImageCropperModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  fileName: string;
  fileSizeStr: string;
  isSaving: boolean;
  onClose: () => void;
  onSave: (croppedBlob: Blob, croppedDataUrl: string) => Promise<void>;
}

export default function ImageCropperModal({
  isOpen,
  imageSrc,
  fileName,
  fileSizeStr,
  isSaving,
  onClose,
  onSave,
}: ImageCropperModalProps) {
  const [zoom, setZoom] = useState<number>(1);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);

  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset controls when a new image is loaded
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setImageLoaded(false);
    }
  }, [isOpen, imageSrc]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSaving, onClose]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({ x: touch.clientX - offset.x, y: touch.clientY - offset.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setOffset({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleReset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const generateCrop = useCallback(async () => {
    if (!imgRef.current || !imageSrc) return;

    const img = imgRef.current;
    const canvas = document.createElement('canvas');
    const cropSize = 512; // Export high resolution 512x512
    canvas.width = cropSize;
    canvas.height = cropSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Smooth image rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Container visual crop circle is 256px diameter in preview
    const previewCropDiameter = 256;
    const scaleFactor = cropSize / previewCropDiameter;

    // Natural dimensions & aspect ratio
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;

    // Displayed dimension of the image in preview at zoom = 1
    // (Fit by cover into the 256px circle)
    const baseScale = Math.max(previewCropDiameter / naturalWidth, previewCropDiameter / naturalHeight);
    const displayedWidth = naturalWidth * baseScale * zoom;
    const displayedHeight = naturalHeight * baseScale * zoom;

    // Compute center and translation on canvas
    const drawX = (cropSize / 2) + (offset.x * scaleFactor) - ((displayedWidth * scaleFactor) / 2);
    const drawY = (cropSize / 2) + (offset.y * scaleFactor) - ((displayedHeight * scaleFactor) / 2);

    ctx.drawImage(
      img,
      drawX,
      drawY,
      displayedWidth * scaleFactor,
      displayedHeight * scaleFactor
    );

    // Convert canvas to Blob
    canvas.toBlob(
      async (blob) => {
        if (!blob) return;
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        await onSave(blob, dataUrl);
      },
      'image/jpeg',
      0.92
    );
  }, [imageSrc, offset, zoom, onSave]);

  if (!isOpen || !imageSrc) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cropper-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 id="cropper-title" className="text-lg font-black text-slate-900 flex items-center space-x-2">
              <span>Adjust Profile Photo</span>
              <Sparkles className="w-4 h-4 text-emerald-600" />
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Drag to reposition and zoom to frame your circular avatar
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close modal"
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewport / Crop Canvas Area */}
        <div className="relative p-6 bg-slate-950 flex flex-col items-center justify-center select-none overflow-hidden min-h-[340px]">
          {/* Circular Crop Frame (256x256) */}
          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className={`relative w-64 h-64 rounded-full overflow-hidden border-2 border-emerald-400 shadow-[0_0_0_9999px_rgba(15,23,42,0.85)] z-10 cursor-grab ${
              isDragging ? 'cursor-grabbing' : ''
            }`}
          >
            {/* The Image */}
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Crop preview"
              draggable={false}
              onLoad={() => setImageLoaded(true)}
              style={{
                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${zoom})`,
                position: 'absolute',
                top: '50%',
                left: '50%',
                minWidth: '100%',
                minHeight: '100%',
                width: 'auto',
                height: 'auto',
                maxWidth: 'none',
                maxHeight: 'none',
                pointerEvents: 'none',
                userSelect: 'none',
                transformOrigin: 'center center',
                transition: isDragging ? 'none' : 'transform 0.05s ease-out',
              }}
            />
          </div>

          {/* Hint Overlay */}
          <div className="absolute bottom-3 left-0 right-0 z-20 flex items-center justify-center space-x-1 text-slate-400 text-[11px] pointer-events-none">
            <Move className="w-3.5 h-3.5 text-emerald-400" />
            <span>Click or touch and drag to reposition image</span>
          </div>
        </div>

        {/* Controls: Zoom slider and reset */}
        <div className="p-5 bg-slate-50 border-t border-slate-100 space-y-4">
          <div className="flex items-center space-x-3">
            <ZoomOut className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              aria-label="Zoom photo"
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600 focus:outline-none"
            />
            <ZoomIn className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <button
              type="button"
              onClick={handleReset}
              title="Reset position and zoom"
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 transition-colors flex-shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* File Information */}
          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
            <div className="truncate max-w-[260px]">
              <span className="font-semibold text-slate-700">Selected: </span>
              <span className="truncate">{fileName}</span>
            </div>
            <span className="text-slate-400 flex-shrink-0">{fileSizeStr}</span>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={generateCrop}
              disabled={isSaving || !imageLoaded}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white shadow-sm flex items-center space-x-1.5 transition-all disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Photo</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
