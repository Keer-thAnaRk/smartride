'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Car,
  CheckCircle2,
  XCircle,
  Shield,
  FileText,
  Phone,
  Mail,
  RefreshCw,
  Clock,
  AlertCircle,
  Star,
} from 'lucide-react';
import { updateDriverVerificationStatusInFirestore } from '@/lib/firebase';

export default function AdminDriversPage() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadDrivers = async () => {
    try {
      const res = await axios.get('/api/admin/drivers');
      if (res.data?.success) {
        setDrivers(res.data.drivers);
      }
    } catch (err) {
      console.error('Failed to load drivers for admin:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDrivers();
  }, []);

  const handleUpdateStatus = async (driverId: string, vehicleId: string, isVerified: boolean, isApproved: boolean) => {
    try {
      setActionLoading(driverId);
      const res = await axios.patch('/api/admin/drivers', {
        driverId,
        vehicleId,
        isVerified,
        isApproved,
        status: isVerified ? 'AVAILABLE' : 'OFFLINE',
      });

      // Synchronize in real time to Firestore
      await updateDriverVerificationStatusInFirestore(driverId, isVerified ? 'approved' : 'rejected');

      if (res.data?.success) {
        setToastMessage(`Driver and vehicle ${isVerified ? 'approved' : 'rejected'} successfully!`);
        await loadDrivers();
      }
    } catch (err: any) {
      setToastMessage(err.response?.data?.error || 'Failed to update driver status');
    } finally {
      setActionLoading(null);
      setTimeout(() => setToastMessage(null), 4000);
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
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div>
            <div className="flex items-center space-x-2">
              <Shield className="w-6 h-6 text-emerald-600" />
              <h1 className="text-2xl font-black text-slate-900">Driver & Vehicle Approvals</h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Verify commercial driver licenses, vehicle fitness certificates, and fleet compliance
            </p>
          </div>
          <button
            onClick={() => loadDrivers()}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center space-x-1.5 text-xs font-bold"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh Queue</span>
          </button>
        </div>

        {toastMessage && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Drivers List */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900">Registered Route Captains ({drivers.length})</h3>
            <span className="text-xs text-slate-500">
              {drivers.filter((d) => d.isVerified).length} Verified • {drivers.filter((d) => !d.isVerified).length} Pending
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {drivers.map((driver) => {
              const vehicle = driver.vehicles[0];
              const isVerified = driver.isVerified;

              return (
                <div
                  key={driver.id}
                  className="p-6 hover:bg-slate-50/60 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-6"
                >
                  {/* Left: Driver info */}
                  <div className="flex items-start space-x-4">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-800 font-bold overflow-hidden flex-shrink-0">
                      {driver.user?.avatar ? (
                        <img src={driver.user.avatar} alt={driver.user.name} className="w-full h-full object-cover" />
                      ) : (
                        driver.user?.name?.charAt(0) || 'D'
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <h4 className="text-base font-bold text-slate-900">{driver.user?.name}</h4>
                        <span
                          className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${
                            isVerified
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}
                        >
                          {isVerified ? 'Verified' : 'Action Required'}
                        </span>
                        <span className="text-xs text-amber-500 font-bold flex items-center">
                          <Star className="w-3 h-3 fill-amber-400 mr-0.5" /> {driver.rating}
                        </span>
                      </div>

                      <div className="text-xs text-slate-500 flex flex-wrap items-center gap-3">
                        <span>{driver.user?.email}</span>
                        <span>•</span>
                        <span>{driver.user?.phone || 'No phone'}</span>
                        <span>•</span>
                        <span>Exp: {driver.experienceYears} Years</span>
                      </div>

                      <div className="text-xs font-mono text-slate-600 pt-1">
                        License: <strong>{driver.licenseNumber || 'Not submitted'}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Middle: Vehicle details */}
                  {vehicle ? (
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1 text-xs min-w-[240px]">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">
                          {vehicle.make} {vehicle.model} ({vehicle.year})
                        </span>
                        <span className="text-[10px] font-bold uppercase bg-slate-200 px-1.5 py-0.2 rounded">
                          {vehicle.type}
                        </span>
                      </div>
                      <div className="font-mono text-slate-600 font-semibold">{vehicle.licensePlate}</div>
                      <div className="text-slate-500">Seating: {vehicle.capacity} Passenger Seats</div>
                      <div className="text-[11px] text-emerald-700 pt-1">
                        {vehicle.isApproved ? '✓ Vehicle Specs Approved' : '⏳ Pending Vehicle Approval'}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic">No vehicle attached</div>
                  )}

                  {/* Right: Approve / Reject Controls */}
                  <div className="flex items-center space-x-2 pt-2 lg:pt-0">
                    {!isVerified ? (
                      <button
                        onClick={() => handleUpdateStatus(driver.id, vehicle?.id, true, true)}
                        disabled={actionLoading === driver.id}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all flex items-center space-x-1.5 disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Approve KYC</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUpdateStatus(driver.id, vehicle?.id, false, false)}
                        disabled={actionLoading === driver.id}
                        className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 text-xs font-bold transition-all disabled:opacity-50"
                      >
                        Revoke Approval
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
