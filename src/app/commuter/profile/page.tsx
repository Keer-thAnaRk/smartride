'use client';

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Clock,
  Shield,
  Save,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  LogOut,
  Camera,
  Upload,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/components/auth-context';
import UserAvatar from '@/components/ui/UserAvatar';
import ImageCropperModal from '@/components/profile/ImageCropperModal';
import RemovePhotoModal from '@/components/profile/RemovePhotoModal';

export default function CommuterProfilePage() {
  const { user, logout, updateUserAvatar } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    defaultPickupAddress: '',
    defaultDropAddress: '',
    morningPickupTime: '08:30 AM',
    eveningDropTime: '06:00 PM',
    emergencyContact: '',
  });

  const [currentAvatar, setCurrentAvatar] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [photoMessage, setPhotoMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Photo management state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [removeModalOpen, setRemoveModalOpen] = useState(false);
  const [selectedImageSrc, setSelectedImageSrc] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [selectedFileSizeStr, setSelectedFileSizeStr] = useState<string>('');
  const [isPhotoUploading, setIsPhotoUploading] = useState(false);
  const [isPhotoRemoving, setIsPhotoRemoving] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await axios.get('/api/commuter/profile');
        if (res.data?.user) {
          const u = res.data.user;
          const cp = u.commuterProfile;
          setCurrentAvatar(u.avatar || null);
          setFormData({
            name: u.name || '',
            phone: u.phone || '',
            defaultPickupAddress: cp?.defaultPickupAddress || '',
            defaultDropAddress: cp?.defaultDropAddress || '',
            morningPickupTime: cp?.morningPickupTime || '08:30 AM',
            eveningDropTime: cp?.eveningDropTime || '06:00 PM',
            emergencyContact: cp?.emergencyContact || '',
          });
        }
      } catch (err) {
        console.error('Error loading profile:', err);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  // Sync avatar with auth session if changed externally
  useEffect(() => {
    if (user?.avatar !== undefined) {
      setCurrentAvatar(user.avatar);
    }
  }, [user?.avatar]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhotoMessage(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset native input so the same file can be re-selected if cancelled
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    // 1. Validation: Max 5 MB
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      setPhotoMessage({
        type: 'error',
        text: 'Please select a JPG, PNG, or WEBP image under 5 MB.',
      });
      return;
    }

    // 2. Validation: MIME types
    const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validMimeTypes.includes(file.type.toLowerCase())) {
      setPhotoMessage({
        type: 'error',
        text: 'Please select a JPG, PNG, or WEBP image under 5 MB.',
      });
      return;
    }

    // 3. Read image as Data URL for circular cropping preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedImageSrc(event.target?.result as string);
      setSelectedFileName(file.name);
      setSelectedFileSizeStr(formatFileSize(file.size));
      setCropperOpen(true);
    };
    reader.onerror = () => {
      setPhotoMessage({
        type: 'error',
        text: 'Unable to read the selected image. Please try another file.',
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSaveCroppedPhoto = async (_blob: Blob, croppedDataUrl: string) => {
    setIsPhotoUploading(true);
    setPhotoMessage(null);

    try {
      const res = await axios.post('/api/profile/photo', {
        dataUrl: croppedDataUrl,
        fileName: selectedFileName || 'avatar.jpg',
      });

      if (res.data?.success) {
        const newAvatar = res.data.avatarUrl;
        setCurrentAvatar(newAvatar);
        updateUserAvatar(newAvatar);
        setPhotoMessage({
          type: 'success',
          text: '✓ Profile photo updated',
        });
        setCropperOpen(false);
      } else {
        setPhotoMessage({
          type: 'error',
          text: res.data?.error || 'Unable to update profile photo. Please try again.',
        });
      }
    } catch (err: any) {
      console.error('Failed to upload profile photo:', err);
      setPhotoMessage({
        type: 'error',
        text: err.response?.data?.error || 'Unable to update profile photo. Please try again.',
      });
    } finally {
      setIsPhotoUploading(false);
    }
  };

  const handleRemovePhoto = async () => {
    setIsPhotoRemoving(true);
    setPhotoMessage(null);

    try {
      const res = await axios.delete('/api/profile/photo');
      if (res.data?.success) {
        setCurrentAvatar(null);
        updateUserAvatar(null);
        setPhotoMessage({
          type: 'success',
          text: '✓ Profile photo removed',
        });
        setRemoveModalOpen(false);
      } else {
        setPhotoMessage({
          type: 'error',
          text: res.data?.error || 'Unable to remove profile photo. Please try again.',
        });
      }
    } catch (err: any) {
      console.error('Failed to remove profile photo:', err);
      setPhotoMessage({
        type: 'error',
        text: err.response?.data?.error || 'Unable to remove profile photo. Please try again.',
      });
    } finally {
      setIsPhotoRemoving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMessage(null);

    try {
      const res = await axios.patch('/api/commuter/profile', formData);
      if (res.data?.success) {
        setStatusMessage({ type: 'success', text: 'Commute preferences and profile updated successfully!' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.response?.data?.error || 'Failed to update profile' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-slate-50">
        <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    );
  }

  const commuterDisplayName = formData.name || user?.name || 'Commuter';

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header Title Card */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-800 text-xl font-bold">
            {formData.name.charAt(0) || 'U'}
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900">Commuter Profile Settings</h1>
            <p className="text-xs text-slate-500">
              Manage your profile photo, default home/office pickup spots, and shift timings
            </p>
          </div>
        </div>

        {/* ================================================== */}
        {/* 📸 DEDICATED PROFILE PHOTO SECTION                  */}
        {/* ================================================== */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center space-x-1.5">
                <Camera className="w-4 h-4" />
                <span>PROFILE PHOTO</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Your profile picture is visible to your route captain and in the navigation header
              </p>
            </div>
            {currentAvatar && (
              <span className="hidden sm:inline-flex items-center space-x-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                <Sparkles className="w-3 h-3" />
                <span>Custom Avatar Active</span>
              </span>
            )}
          </div>

          {/* Photo Status Alert */}
          {photoMessage && (
            <div
              className={`p-4 rounded-2xl border flex items-center space-x-2 text-xs font-bold transition-all ${
                photoMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {photoMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              )}
              <span>{photoMessage.text}</span>
            </div>
          )}

          <div className="flex flex-col items-center justify-center py-4 space-y-4 text-center">
            {/* Circular Avatar Display */}
            <div className="relative group">
              <UserAvatar
                src={currentAvatar}
                name={commuterDisplayName}
                size="xl"
                alt={`${commuterDisplayName} profile picture`}
                className="shadow-md ring-4 ring-emerald-500/20"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Choose new photo"
                aria-label="Upload new profile photo"
                className="absolute bottom-0 right-0 p-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg border-2 border-white transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>

            {/* Commuter Name */}
            <div>
              <div className="text-base font-extrabold text-slate-900">
                {commuterDisplayName}
              </div>
              <div className="text-xs text-slate-400">COMMUTER</div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/jpg"
                onChange={handleFileSelect}
                className="hidden"
                aria-label="Upload profile image file"
              />

              {currentAvatar ? (
                <>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Change Photo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRemoveModalOpen(true)}
                    className="px-4 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove Photo</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm flex items-center space-x-2 transition-all transform hover:scale-[1.02]"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload Photo</span>
                </button>
              )}
            </div>

            <p className="text-[11px] text-slate-400 max-w-sm">
              Accepted formats: JPG, PNG, WEBP. Maximum file size: 5 MB.
            </p>
          </div>
        </div>

        {/* Global Preference Status Banner */}
        {statusMessage && (
          <div
            className={`p-4 rounded-2xl border flex items-center space-x-2 text-xs font-bold ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* ================================================== */}
        {/* 📝 COMMUTE PREFERENCES & PERSONAL DETAILS FORM       */}
        {/* ================================================== */}
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Personal Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Phone Number</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Default Commute Addresses & Timings
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Default Morning Pickup Address</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-emerald-600 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={formData.defaultPickupAddress}
                    onChange={(e) => setFormData({ ...formData, defaultPickupAddress: e.target.value })}
                    placeholder="e.g. HSR Layout 27th Main"
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Default Office Drop Destination</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-teal-600 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={formData.defaultDropAddress}
                    onChange={(e) => setFormData({ ...formData, defaultDropAddress: e.target.value })}
                    placeholder="e.g. ITPB Tech Park Whitefield"
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Preferred Morning Time</label>
                <div className="relative">
                  <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={formData.morningPickupTime}
                    onChange={(e) => setFormData({ ...formData, morningPickupTime: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Preferred Return Time</label>
                <div className="relative">
                  <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={formData.eveningDropTime}
                    onChange={(e) => setFormData({ ...formData, eveningDropTime: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Emergency Contact #</label>
                <div className="relative">
                  <Shield className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="tel"
                    value={formData.emergencyContact}
                    onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                    placeholder="+1 (555) 999-0000"
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => logout()}
              className="px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs shadow-xs flex items-center space-x-1.5 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out of Smart Ride</span>
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm flex items-center space-x-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Preferences'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Image Circular Crop Modal */}
      <ImageCropperModal
        isOpen={cropperOpen}
        imageSrc={selectedImageSrc}
        fileName={selectedFileName}
        fileSizeStr={selectedFileSizeStr}
        isSaving={isPhotoUploading}
        onClose={() => setCropperOpen(false)}
        onSave={handleSaveCroppedPhoto}
      />

      {/* Remove Confirmation Modal */}
      <RemovePhotoModal
        isOpen={removeModalOpen}
        isRemoving={isPhotoRemoving}
        onClose={() => setRemoveModalOpen(false)}
        onConfirm={handleRemovePhoto}
      />
    </div>
  );
}
