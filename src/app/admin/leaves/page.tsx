'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Calendar,
  CalendarDays,
  Shield,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Car,
  User,
  Phone,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Users,
  X,
  Star,
  Check,
} from 'lucide-react';
import { updateLeaveRequestInFirestore, listenToLeaveRequests } from '@/lib/firebase';
import { LeaveRequest, StandbyDriver } from '@/types';

export default function AdminLeavesPage() {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [standbyDrivers, setStandbyDrivers] = useState<StandbyDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'all'>('pending');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Approval Modal State
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);
  const [selectedSubstituteId, setSelectedSubstituteId] = useState<string>('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/admin/leaves?status=all');
      if (res.data?.success) {
        setLeaves(res.data.leaves || []);
        setStandbyDrivers(res.data.standbyDrivers || []);
      }
    } catch (err) {
      console.error('Error loading admin leaves:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const unsubscribe = listenToLeaveRequests(() => {
      loadData();
    });

    const handleRefresh = () => {
      loadData();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('refresh-leaves-list', handleRefresh);
      window.addEventListener('driver-leave-updated', handleRefresh);
    }

    return () => {
      if (unsubscribe) unsubscribe();
      if (typeof window !== 'undefined') {
        window.removeEventListener('refresh-leaves-list', handleRefresh);
        window.removeEventListener('driver-leave-updated', handleRefresh);
      }
    };
  }, []);

  const openApproveModal = (leave: LeaveRequest) => {
    setSelectedLeave(leave);
    // Find verified standby driver not equal to requesting driver
    const available = standbyDrivers.filter(
      (d) => d.id !== leave.driverId && d.isVerified
    );
    // Prefer standby drivers without permanent route if available, or first available
    const preferred = available.find((d: any) => !d.hasPermanentRoute) || available[0];
    setSelectedSubstituteId(preferred ? preferred.id : (available[0]?.id || ''));
  };

  const handleConfirmApproval = async () => {
    if (!selectedLeave || !selectedSubstituteId) return;

    try {
      setActionLoading(true);
      const selectedDriver = standbyDrivers.find((d) => d.id === selectedSubstituteId);

      const res = await axios.post('/api/admin/leaves', {
        requestId: selectedLeave.id,
        action: 'approve',
        replacementDriverId: selectedSubstituteId,
      });

      if (res.data?.success) {
        // Sync to Firestore
        await updateLeaveRequestInFirestore(selectedLeave.id, {
          status: 'approved',
          replacementDriverId: selectedSubstituteId,
          replacementDriverName: selectedDriver?.name || 'Standby Captain',
        });

        // Broadcast to trigger instant update on commuter dashboards
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('driver-leave-updated', {
              detail: {
                requestId: selectedLeave.id,
                routeId: selectedLeave.assignedRouteId,
                replacementDriverId: selectedSubstituteId,
                replacementDriverName: selectedDriver?.name,
                status: 'approved',
              },
            })
          );
        }

        setToastMessage(`Leave approved! Standby Captain ${selectedDriver?.name} assigned to Route ${selectedLeave.assignedRouteCode || 'Corridor'}.`);
        setSelectedLeave(null);
        await loadData();
      }
    } catch (err: any) {
      setToastMessage(err.response?.data?.error || 'Failed to approve leave request');
    } finally {
      setActionLoading(false);
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  const handleRejectLeave = async (leave: LeaveRequest) => {
    if (!confirm(`Are you sure you want to decline ${leave.driverName}'s leave request?`)) return;

    try {
      setActionLoading(true);
      const res = await axios.post('/api/admin/leaves', {
        requestId: leave.id,
        action: 'reject',
      });

      if (res.data?.success) {
        await updateLeaveRequestInFirestore(leave.id, {
          status: 'rejected',
        });

        setToastMessage(`Leave request for ${leave.driverName} has been declined.`);
        await loadData();
      }
    } catch (err: any) {
      setToastMessage(err.response?.data?.error || 'Failed to decline leave');
    } finally {
      setActionLoading(false);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const pendingLeaves = leaves.filter((l) => l.status === 'pending');
  const displayedLeaves = activeTab === 'pending' ? pendingLeaves : leaves;

  const currentSelectedDriver = standbyDrivers.find((d) => d.id === selectedSubstituteId);

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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div>
            <div className="flex items-center space-x-2.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                <CalendarDays className="w-5 h-5 text-amber-600" />
              </div>
              <h1 className="text-2xl font-black text-slate-900">
                Driver Leave & Substitution Hub
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Review driver leave requests, assign verified standby route captains, and notify commuters
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => loadData()}
              className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center space-x-1.5 text-xs font-bold transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh Requests</span>
            </button>
          </div>
        </div>

        {/* Toast Alert */}
        {toastMessage && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold flex items-center justify-between animate-in fade-in">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <span>{toastMessage}</span>
            </div>
            <button onClick={() => setToastMessage(null)} className="text-xs underline font-bold">
              Dismiss
            </button>
          </div>
        )}

        {/* Tabs Bar */}
        <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex items-center space-x-2 px-5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
              activeTab === 'pending'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span>⏳ Pending Review</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === 'pending' ? 'bg-slate-950 text-white' : 'bg-amber-100 text-amber-800'
            }`}>
              {pendingLeaves.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('all')}
            className={`flex items-center space-x-2 px-5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
              activeTab === 'all'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span>All Leave History</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {leaves.length}
            </span>
          </button>
        </div>

        {/* Leave Requests Cards / List */}
        {displayedLeaves.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 space-y-3">
            <CalendarDays className="w-12 h-12 mx-auto text-slate-300" />
            <h3 className="text-base font-bold text-slate-700">No {activeTab === 'pending' ? 'Pending' : ''} Leave Requests</h3>
            <p className="text-xs text-slate-400">
              {activeTab === 'pending'
                ? 'All route captains are actively operating their assigned corridor routes.'
                : 'No historical leaves have been recorded yet.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayedLeaves.map((leave) => {
              const isPending = leave.status === 'pending';
              const isApproved = leave.status === 'approved';
              const isRejected = leave.status === 'rejected';

              return (
                <div
                  key={leave.id}
                  className={`bg-white rounded-3xl border p-6 sm:p-7 shadow-xs hover:shadow-md transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-6 ${
                    isPending
                      ? 'border-amber-200/80 bg-gradient-to-r from-amber-50/20 to-white'
                      : isApproved
                      ? 'border-emerald-200/80'
                      : 'border-slate-200'
                  }`}
                >
                  {/* Left: Driver & Route Details */}
                  <div className="flex items-start space-x-4">
                    <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold text-lg flex-shrink-0 overflow-hidden shadow-sm">
                      {leave.driverAvatar ? (
                        <img src={leave.driverAvatar} alt={leave.driverName} className="w-full h-full object-cover" />
                      ) : (
                        leave.driverName?.charAt(0) || 'D'
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900">{leave.driverName}</h3>
                        <span className="font-mono text-xs font-bold bg-slate-100 text-slate-800 px-2.5 py-0.5 rounded border border-slate-200">
                          Route {leave.assignedRouteCode}
                        </span>

                        {isPending && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            <span>⏳ Pending Review</span>
                          </span>
                        )}
                        {isApproved && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <span>✓ Approved</span>
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                            <span>✕ Declined</span>
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-600 flex items-center space-x-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          Leave Period: <strong>{leave.startDate}</strong> to <strong>{leave.endDate}</strong>
                        </span>
                      </div>

                      <div className="text-xs text-slate-700 bg-slate-50 p-2 rounded-xl border border-slate-100 max-w-xl">
                        <span className="font-bold text-slate-900">Reason:</span> {leave.reason}
                      </div>

                      {/* Standby Driver assignment details if approved */}
                      {isApproved && leave.replacementDriverName && (
                        <div className="flex items-center space-x-2 pt-1 text-xs text-emerald-800 font-bold">
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          <span>
                            Operating Standby Captain: {leave.replacementDriverName}
                            {leave.replacementVehicleModel && ` • ${leave.replacementVehicleModel} (${leave.replacementLicensePlate})`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center space-x-3 pt-4 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                    {isPending ? (
                      <>
                        <button
                          onClick={() => handleRejectLeave(leave)}
                          disabled={actionLoading}
                          className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-rose-50 hover:text-rose-700 text-slate-600 text-xs font-bold transition-all"
                        >
                          Decline
                        </button>
                        <button
                          onClick={() => openApproveModal(leave)}
                          disabled={actionLoading}
                          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-600/20 transition-all flex items-center space-x-2 cursor-pointer"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          <span>Approve & Assign Replacement</span>
                        </button>
                      </>
                    ) : (
                      <div className="text-right text-xs text-slate-400">
                        Reviewed on {leave.reviewedAt ? new Date(leave.reviewedAt).toLocaleDateString() : 'N/A'}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Approval & Driver Replacement Modal */}
      {selectedLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Approve Leave & Assign Standby Captain
                  </h3>
                  <p className="text-xs text-slate-500">
                    Map standby driver to route {selectedLeave.assignedRouteCode} for requested dates
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLeave(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Leave Summary Info Box */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Regular Captain:</span>
                <span className="font-bold text-slate-900">{selectedLeave.driverName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Assigned Route:</span>
                <span className="font-bold text-slate-900">
                  {selectedLeave.assignedRouteCode} – {selectedLeave.assignedRouteName}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Requested Leave Window:</span>
                <span className="font-bold text-emerald-700 font-mono">
                  {selectedLeave.startDate} → {selectedLeave.endDate}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200/60 pt-2">
                <span className="text-slate-500">Reason:</span>
                <span className="font-medium text-slate-800">{selectedLeave.reason}</span>
              </div>
            </div>

            {/* Standby Captain Dropdown */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Select Available Standby Captain:
              </label>

              <select
                value={selectedSubstituteId}
                onChange={(e) => setSelectedSubstituteId(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-slate-300 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden bg-white shadow-xs"
              >
                {standbyDrivers
                  .filter((d) => d.id !== selectedLeave.driverId && d.isVerified)
                  .map((d: any) => (
                    <option key={d.id} value={d.id}>
                      Captain {d.name} • ★ {d.rating} {d.vehicle ? `(${d.vehicle.make} ${d.vehicle.model} - ${d.vehicle.licensePlate})` : ''} {d.hasPermanentRoute ? `[Active on ${d.assignedRouteCode}]` : '[Standby Fleet Captain]'}
                    </option>
                  ))}
              </select>
            </div>

            {/* Standby Driver Preview Card */}
            {currentSelectedDriver && (
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-center space-x-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-200 text-emerald-800 flex items-center justify-center font-bold text-base flex-shrink-0 overflow-hidden">
                  {currentSelectedDriver.avatar ? (
                    <img src={currentSelectedDriver.avatar} alt={currentSelectedDriver.name} className="w-full h-full object-cover" />
                  ) : (
                    currentSelectedDriver.name.charAt(0)
                  )}
                </div>

                <div className="flex-1 min-w-0 text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-900 text-sm">
                      Captain {currentSelectedDriver.name}
                    </span>
                    <span className="flex items-center text-amber-600 font-bold">
                      <Star className="w-3 h-3 fill-amber-400 mr-0.5" />
                      {currentSelectedDriver.rating}
                    </span>
                  </div>

                  <div className="text-slate-600 mt-0.5">
                    Vehicle: <strong>{currentSelectedDriver.vehicle?.make} {currentSelectedDriver.vehicle?.model}</strong> ({currentSelectedDriver.vehicle?.licensePlate || 'Standby Fleet'})
                  </div>
                  <div className="text-emerald-700 font-semibold mt-0.5 flex items-center space-x-1">
                    <Check className="w-3.5 h-3.5" />
                    <span>Verified Commercial Driver • Capacity: {currentSelectedDriver.vehicle?.capacity || 6} Seats</span>
                  </div>
                </div>
              </div>
            )}

            {/* Notice */}
            <div className="p-3.5 rounded-2xl bg-slate-100 text-slate-600 text-xs">
              <strong>Automated Workflow:</strong> Confirming approval will update the leave status to <span className="text-emerald-700 font-bold">approved</span>, map Captain {currentSelectedDriver?.name || 'Substitute'} to Route {selectedLeave.assignedRouteCode} for {selectedLeave.startDate} to {selectedLeave.endDate}, and trigger in-app notices for all commuters on this corridor.
            </div>

            {/* Action Buttons */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setSelectedLeave(null)}
                disabled={actionLoading}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmApproval}
                disabled={actionLoading || !selectedSubstituteId}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center space-x-2 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{actionLoading ? 'Approving...' : 'Confirm Approval'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
