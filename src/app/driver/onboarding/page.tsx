'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Car,
  CheckCircle2,
  FileCheck,
  Shield,
  Upload,
  AlertCircle,
  Clock,
  RefreshCw,
  Save,
  LogOut,
  Sparkles,
  XCircle,
  AlertTriangle,
  X,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/components/auth-context';
import DocumentDropzone from '@/components/driver/document-dropzone';
import {
  syncDriverToFirestore,
  listenToDriverVerificationStatus,
} from '@/lib/firebase';

type VerificationStatus = 'pending' | 'approved' | 'rejected';

export default function DriverDocumentsPage() {
  const { user, logout } = useAuth();
  const [driverProfile, setDriverProfile] = useState<any>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('pending');

  const [formData, setFormData] = useState({
    licenseNumber: '',
    experienceYears: '',
    make: '',
    model: '',
    year: '',
    licensePlate: '',
    capacity: '',
    type: 'SEDAN',
    rcDocUrl: '',
    insuranceDocUrl: '',
  });

  // Track validation error flags for individual fields
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});

  // Modals state
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const [isRcUploading, setIsRcUploading] = useState(false);
  const [isInsuranceUploading, setIsInsuranceUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const driverId = driverProfile?.id || (user ? `driver_${user.id}` : '');

  useEffect(() => {
    async function loadData() {
      try {
        const res = await axios.get('/api/driver/onboarding');
        if (res.data?.driverProfile) {
          const dp = res.data.driverProfile;
          const v = dp.vehicles?.[0];
          setDriverProfile(dp);

          // Determine initial verification status
          if (dp.isVerified) {
            setVerificationStatus('approved');
          } else if (dp.status === 'REJECTED') {
            setVerificationStatus('rejected');
          } else {
            setVerificationStatus('pending');
          }

          setFormData({
            licenseNumber: dp.licenseNumber || '',
            experienceYears: dp.experienceYears ? dp.experienceYears.toString() : '',
            make: v?.make || '',
            model: v?.model || '',
            year: v?.year ? v.year.toString() : '',
            licensePlate: v?.licensePlate || '',
            capacity: v?.capacity ? v.capacity.toString() : '',
            type: v?.type || 'SEDAN',
            rcDocUrl: v?.rcDocUrl || '',
            insuranceDocUrl: v?.insuranceDocUrl || '',
          });
        }
      } catch (err) {
        console.error('Failed to load driver onboarding info:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Real-time Firestore & Event listener for verification status changes
  useEffect(() => {
    if (!driverId) return;

    const unsubscribe = listenToDriverVerificationStatus(driverId, (newStatus) => {
      console.log(`[RealTime KYC] Driver ${driverId} status updated:`, newStatus);
      setVerificationStatus(newStatus);
    });

    return () => {
      unsubscribe();
    };
  }, [driverId]);

  const isAnyUploading = isRcUploading || isInsuranceUploading;

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear validation error when user enters a value
    if (validationErrors[field]) {
      setValidationErrors((prev) => ({ ...prev, [field]: false }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAnyUploading) return;

    // 1. Form Validation Check
    const errors: Record<string, boolean> = {};

    if (!formData.licenseNumber.trim()) errors.licenseNumber = true;
    if (!formData.experienceYears.trim() || parseInt(formData.experienceYears) <= 0) errors.experienceYears = true;
    if (!formData.make.trim()) errors.make = true;
    if (!formData.model.trim()) errors.model = true;
    if (!formData.year.trim()) errors.year = true;
    if (!formData.licensePlate.trim()) errors.licensePlate = true;
    if (!formData.type.trim()) errors.type = true;
    if (!formData.capacity.trim() || parseInt(formData.capacity) <= 0) errors.capacity = true;
    if (!formData.rcDocUrl || !formData.rcDocUrl.trim()) errors.rcDocUrl = true;
    if (!formData.insuranceDocUrl || !formData.insuranceDocUrl.trim()) errors.insuranceDocUrl = true;

    setValidationErrors(errors);

    // If any required field is missing or invalid: Abort and trigger Error Modal Popup
    if (Object.keys(errors).length > 0) {
      setShowErrorModal(true);
      return;
    }

    setSaving(true);

    try {
      // 2. Save/Update in Firestore with verificationStatus: 'pending'
      if (driverId) {
        await syncDriverToFirestore(driverId, {
          commercialLicense: formData.licenseNumber,
          experienceYears: parseInt(formData.experienceYears) || 3,
          vehicleMake: formData.make,
          vehicleModel: formData.model,
          vehicleYear: formData.year,
          licensePlate: formData.licensePlate,
          vehicleCategory: formData.type,
          seatCapacity: parseInt(formData.capacity) || 6,
          rcDocumentUrl: formData.rcDocUrl,
          insurancePolicyUrl: formData.insuranceDocUrl,
          verificationStatus: 'pending',
        });
      }

      // 3. Sync to Database API
      const res = await axios.post('/api/driver/onboarding', formData);
      if (res.data?.success) {
        setVerificationStatus('pending');
        setShowSuccessModal(true);
      }
    } catch (err: any) {
      console.error('Failed to submit driver KYC:', err);
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

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header & Dynamic Verification Status Badge */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-800 text-xl font-bold">
              <Shield className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900">Vehicle & KYC Verification</h1>
              <p className="text-xs text-slate-500">
                Official licensing, vehicle roadworthiness, and document approvals
              </p>
            </div>
          </div>

          {/* Dynamic Status Badge (Real-time Firestore sync) */}
          <div className="flex items-center space-x-2">
            {verificationStatus === 'approved' && (
              <span className="px-4 py-2 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center space-x-2 shadow-xs transition-all animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>✓ Verified & Approved</span>
              </span>
            )}

            {verificationStatus === 'pending' && (
              <span className="px-4 py-2 rounded-full text-xs font-extrabold bg-amber-100 text-amber-900 border border-amber-300 flex items-center space-x-2 shadow-xs transition-all animate-in fade-in">
                <Clock className="w-4 h-4 text-amber-600 animate-spin" />
                <span>⏳ Verification Pending</span>
              </span>
            )}

            {verificationStatus === 'rejected' && (
              <span className="px-4 py-2 rounded-full text-xs font-extrabold bg-rose-100 text-rose-800 border border-rose-300 flex items-center space-x-2 shadow-xs transition-all animate-in fade-in">
                <XCircle className="w-4 h-4 text-rose-600" />
                <span>✕ Verification Rejected (Please Resubmit)</span>
              </span>
            )}
          </div>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} noValidate className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          {/* Section 1: Driver Licensing */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
              <span>1. Commercial Driver Credentials</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Commercial Driver License # <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.licenseNumber}
                  onChange={(e) => handleInputChange('licenseNumber', e.target.value)}
                  placeholder="DL-BLR-2026-8886"
                  className={`w-full px-3 py-2 rounded-xl border text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none uppercase font-mono transition-all ${
                    validationErrors.licenseNumber
                      ? 'border-red-500 ring-1 ring-red-500 bg-red-50/20'
                      : 'border-slate-300'
                  }`}
                />
                {validationErrors.licenseNumber && (
                  <p className="text-[11px] text-red-500 mt-1 font-medium">License number is required</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Commercial Driving Experience (Years) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="40"
                  value={formData.experienceYears}
                  onChange={(e) => handleInputChange('experienceYears', e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all ${
                    validationErrors.experienceYears
                      ? 'border-red-500 ring-1 ring-red-500 bg-red-50/20'
                      : 'border-slate-300'
                  }`}
                />
                {validationErrors.experienceYears && (
                  <p className="text-[11px] text-red-500 mt-1 font-medium">Valid experience is required</p>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Vehicle Specifications */}
          <div className="pt-4 border-t border-slate-100 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
              <span>2. Assigned Vehicle Specifications</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Vehicle Make <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.make}
                  onChange={(e) => handleInputChange('make', e.target.value)}
                  placeholder="Toyota"
                  className={`w-full px-3 py-2 rounded-xl border text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all ${
                    validationErrors.make
                      ? 'border-red-500 ring-1 ring-red-500 bg-red-50/20'
                      : 'border-slate-300'
                  }`}
                />
                {validationErrors.make && (
                  <p className="text-[11px] text-red-500 mt-1 font-medium">Vehicle make is required</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Vehicle Model <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.model}
                  onChange={(e) => handleInputChange('model', e.target.value)}
                  placeholder="Innova Crysta"
                  className={`w-full px-3 py-2 rounded-xl border text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all ${
                    validationErrors.model
                      ? 'border-red-500 ring-1 ring-red-500 bg-red-50/20'
                      : 'border-slate-300'
                  }`}
                />
                {validationErrors.model && (
                  <p className="text-[11px] text-red-500 mt-1 font-medium">Vehicle model is required</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Manufacturing Year <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="2015"
                  max="2027"
                  value={formData.year}
                  onChange={(e) => handleInputChange('year', e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all ${
                    validationErrors.year
                      ? 'border-red-500 ring-1 ring-red-500 bg-red-50/20'
                      : 'border-slate-300'
                  }`}
                />
                {validationErrors.year && (
                  <p className="text-[11px] text-red-500 mt-1 font-medium">Year is required</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  License Plate # <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.licensePlate}
                  onChange={(e) => handleInputChange('licensePlate', e.target.value)}
                  placeholder="KA-04-AB-2552"
                  className={`w-full px-3 py-2 rounded-xl border text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none uppercase font-mono transition-all ${
                    validationErrors.licensePlate
                      ? 'border-red-500 ring-1 ring-red-500 bg-red-50/20'
                      : 'border-slate-300'
                  }`}
                />
                {validationErrors.licensePlate && (
                  <p className="text-[11px] text-red-500 mt-1 font-medium">License plate is required</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Vehicle Category <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => handleInputChange('type', e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all ${
                    validationErrors.type
                      ? 'border-red-500 ring-1 ring-red-500 bg-red-50/20'
                      : 'border-slate-300'
                  }`}
                >
                  <option value="SEDAN">Premium Sedan (4 Seats)</option>
                  <option value="SUV">Spacious SUV (6 Seats)</option>
                  <option value="MINI_BUS">Urban Shuttle Bus (12 Seats)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Seat Capacity <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="2"
                  max="20"
                  value={formData.capacity}
                  onChange={(e) => handleInputChange('capacity', e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all ${
                    validationErrors.capacity
                      ? 'border-red-500 ring-1 ring-red-500 bg-red-50/20'
                      : 'border-slate-300'
                  }`}
                />
                {validationErrors.capacity && (
                  <p className="text-[11px] text-red-500 mt-1 font-medium">Seat capacity is required</p>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Dynamic Firebase Storage Document Dropzones */}
          <div className="pt-4 border-t border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                3. Registration Certificate (RC) & Insurance <span className="text-rose-500">*</span>
              </h3>
              <span className="text-xs text-emerald-700 font-semibold flex items-center space-x-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Direct Firebase Storage Sync</span>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Dropzone 1: Vehicle RC Document */}
              <div className={validationErrors.rcDocUrl ? 'p-2 rounded-3xl border-2 border-red-500 bg-red-50/20 ring-2 ring-red-500/20' : ''}>
                <DocumentDropzone
                  label="Vehicle RC Document"
                  docType="rc_document"
                  currentUrl={formData.rcDocUrl}
                  driverId={driverId}
                  onUrlChange={(url) => {
                    setFormData((prev) => ({ ...prev, rcDocUrl: url }));
                    if (url) setValidationErrors((prev) => ({ ...prev, rcDocUrl: false }));
                  }}
                  onUploadingChange={setIsRcUploading}
                />
                {validationErrors.rcDocUrl && (
                  <p className="text-[11px] text-red-500 mt-1.5 font-semibold flex items-center space-x-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Please upload the Vehicle RC Document</span>
                  </p>
                )}
              </div>

              {/* Dropzone 2: Comprehensive Insurance Policy */}
              <div className={validationErrors.insuranceDocUrl ? 'p-2 rounded-3xl border-2 border-red-500 bg-red-50/20 ring-2 ring-red-500/20' : ''}>
                <DocumentDropzone
                  label="Comprehensive Insurance Policy"
                  docType="insurance_policy"
                  currentUrl={formData.insuranceDocUrl}
                  driverId={driverId}
                  onUrlChange={(url) => {
                    setFormData((prev) => ({ ...prev, insuranceDocUrl: url }));
                    if (url) setValidationErrors((prev) => ({ ...prev, insuranceDocUrl: false }));
                  }}
                  onUploadingChange={setIsInsuranceUploading}
                />
                {validationErrors.insuranceDocUrl && (
                  <p className="text-[11px] text-red-500 mt-1.5 font-semibold flex items-center space-x-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Please upload the Comprehensive Insurance Policy</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => logout()}
              className="px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs shadow-xs flex items-center space-x-1.5 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out of Smart Ride</span>
            </button>

            <div className="flex items-center space-x-3">
              {isAnyUploading && (
                <span className="text-xs text-amber-700 font-medium flex items-center space-x-1.5 animate-pulse">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Uploading files to storage...</span>
                </span>
              )}

              <button
                type="submit"
                disabled={saving || isAnyUploading}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Submitting...' : 'Update & Resubmit Documents'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* 1. Error Modal / Alert Popup */}
      {showErrorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 sm:p-8 shadow-2xl border border-rose-100 space-y-5 animate-in zoom-in-95 duration-200 text-center">
            <div className="w-16 h-16 rounded-3xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto shadow-sm">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-extrabold text-slate-900">
                Incomplete KYC Details
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Please fill in all vehicle specifications and upload both the RC and Insurance documents before submitting.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowErrorModal(false)}
                className="w-full py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-md shadow-rose-600/20 transition-all"
              >
                Review Details & Complete Form
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Success Modal Popup */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 sm:p-8 shadow-2xl border border-emerald-100 space-y-5 animate-in zoom-in-95 duration-200 text-center">
            <div className="w-16 h-16 rounded-3xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-extrabold text-slate-900">
                Documents Submitted Successfully!
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Your vehicle credentials and KYC documents have been submitted for review. Your status is currently Pending Verification.
              </p>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center space-x-2 text-xs font-bold text-amber-800">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>Current Status: ⏳ Verification Pending</span>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowSuccessModal(false)}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-600/20 transition-all"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
