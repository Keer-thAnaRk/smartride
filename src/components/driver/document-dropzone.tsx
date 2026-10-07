'use client';

import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Trash2,
  FileCheck,
  Eye,
} from 'lucide-react';
import { uploadDriverDocument } from '@/lib/firebase';

interface DocumentDropzoneProps {
  label: string;
  docType: 'rc_document' | 'insurance_policy';
  currentUrl?: string | null;
  driverId: string;
  onUrlChange: (url: string) => void;
  onUploadingChange?: (isUploading: boolean) => void;
}

export default function DocumentDropzone({
  label,
  docType,
  currentUrl,
  driverId,
  onUrlChange,
  onUploadingChange,
}: DocumentDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState<string>('');
  const [fileSizeStr, setFileSizeStr] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const handleFileProcess = async (file: File) => {
    setErrorMessage(null);

    // 1. Validation: Max Size 5MB
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setErrorMessage(`File size exceeds 5MB limit (${formatFileSize(file.size)}). Please choose a smaller file.`);
      return;
    }

    // 2. Validation: MIME Types (.pdf, .jpg, .jpeg, .png)
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      setErrorMessage('Invalid file format. Only PDF, JPG, and PNG files are permitted.');
      return;
    }

    // 3. Initiate Upload
    try {
      setUploading(true);
      setProgress(0);
      setFileName(file.name);
      setFileSizeStr(formatFileSize(file.size));
      if (onUploadingChange) onUploadingChange(true);

      const downloadUrl = await uploadDriverDocument(
        file,
        driverId || 'temp_driver',
        docType,
        (percent) => {
          setProgress(percent);
        }
      );

      onUrlChange(downloadUrl);
    } catch (err: any) {
      console.error('File upload failed:', err);
      setErrorMessage('Upload failed. Please check your connection and try again.');
    } finally {
      setUploading(false);
      if (onUploadingChange) onUploadingChange(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUrlChange('');
    setFileName('');
    setFileSizeStr('');
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const hasDocument = Boolean(currentUrl);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
          {label}
        </label>
        <span className="text-[11px] text-slate-400 font-medium">PDF, JPG, PNG (Max 5MB)</span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFileProcess(e.target.files[0]);
          }
        }}
      />

      {errorMessage && (
        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 1. Uploading State */}
      {uploading && (
        <div className="p-5 rounded-2xl border-2 border-emerald-500 bg-emerald-50/50 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <RefreshCw className="w-4 h-4 text-emerald-600 animate-spin" />
              <span className="text-xs font-bold text-slate-800 truncate max-w-[200px]">
                {fileName || 'Uploading document...'}
              </span>
            </div>
            <span className="text-xs font-black font-mono text-emerald-700">{progress}%</span>
          </div>

          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
            <div
              className="bg-emerald-600 h-full rounded-full transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-500 text-center">
            Streaming to Firebase Cloud Storage...
          </div>
        </div>
      )}

      {/* 2. Uploaded State */}
      {!uploading && hasDocument && (
        <div className="p-4 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-teal-50/40 shadow-xs space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                <FileCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-slate-900 truncate max-w-[220px]">
                    {fileName || (docType === 'rc_document' ? 'Registration_Certificate_RC.pdf' : 'Comprehensive_Insurance_Policy.pdf')}
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase bg-emerald-200 text-emerald-900 rounded-full flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                    <span>Uploaded</span>
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 font-mono truncate max-w-[240px]">
                  {fileSizeStr || 'Verified Document'}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <a
                href={currentUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center space-x-1 shadow-xs transition-colors"
                title="Preview Document"
              >
                <Eye className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Preview</span>
              </a>

              <button
                type="button"
                onClick={handleRemove}
                className="p-1.5 rounded-lg bg-white border border-rose-200 hover:bg-rose-50 text-rose-600 text-xs font-bold flex items-center space-x-1 shadow-xs transition-colors"
                title="Remove / Replace Document"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Replace</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Empty / Default Drag & Drop State */}
      {!uploading && !hasDocument && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`p-6 rounded-2xl border-2 border-dashed cursor-pointer text-center transition-all ${
            isDragging
              ? 'border-emerald-500 bg-emerald-50/70 scale-[1.01]'
              : 'border-slate-300 hover:border-emerald-500 bg-slate-50/60 hover:bg-slate-50'
          }`}
        >
          <div className="w-10 h-10 rounded-full bg-emerald-100/80 text-emerald-700 flex items-center justify-center mx-auto mb-2">
            <UploadCloud className="w-5 h-5" />
          </div>
          <div className="text-xs font-bold text-slate-800">
            Click to browse or drag & drop
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Upload Vehicle RC or Insurance (PDF, JPG, PNG up to 5MB)
          </div>
        </div>
      )}
    </div>
  );
}
