'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Users,
  Car,
  Compass,
  ArrowRightLeft,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  MapPin,
  Clock,
  Shield,
  Sparkles,
  Layers,
} from 'lucide-react';
import SeatOptimizationPreviewModal from '@/components/admin/seat-optimization-preview-modal';
import { OptimizationPreviewResult } from '@/lib/optimization/seat-optimization-types';

export default function AdminAllocationsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [selectedSub, setSelectedSub] = useState<any>(null);
  const [targetRouteId, setTargetRouteId] = useState<string>('');
  const [targetSeat, setTargetSeat] = useState<string>('1');
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [optimizationPreview, setOptimizationPreview] = useState<OptimizationPreviewResult | null>(null);
  const [optimizingRouteId, setOptimizingRouteId] = useState<string | null>(null);

  const handleOptimizeRoute = async (routeId: string) => {
    try {
      setOptimizingRouteId(routeId);
      const res = await axios.post('/api/admin/seat-optimization/analyze', { routeId });
      if (res.data?.success && res.data.preview) {
        setOptimizationPreview(res.data.preview);
      }
    } catch (err: any) {
      setToastMessage(err.response?.data?.error || 'Failed to analyze route for seat optimization');
      setTimeout(() => setToastMessage(null), 4000);
    } finally {
      setOptimizingRouteId(null);
    }
  };

  const loadAllocations = async () => {
    try {
      const res = await axios.get('/api/admin/allocations');
      if (res.data?.success) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Error loading allocations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllocations();
  }, []);

  const handleReassign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSub || !targetRouteId) return;

    try {
      setActionLoading(true);
      const res = await axios.post('/api/admin/allocations', {
        subscriptionId: selectedSub.id,
        routeId: targetRouteId,
        seatNumber: targetSeat,
      });

      if (res.data?.success) {
        setToastMessage(`Commuter ${selectedSub.commuter?.name} reassigned to route!`);
        setReassignModalOpen(false);
        await loadAllocations();
      }
    } catch (err: any) {
      setToastMessage(err.response?.data?.error || 'Failed to reassign commuter');
    } finally {
      setActionLoading(false);
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

  const routes = data?.routes || [];
  const subscriptions = data?.subscriptions || [];

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div>
            <div className="flex items-center space-x-2">
              <ArrowRightLeft className="w-6 h-6 text-emerald-600" />
              <h1 className="text-2xl font-black text-slate-900">Commuter & Fleet Seat Allocation</h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Automated load balancing, seat reservations, and commuter-to-shuttle manifest mapping
            </p>
          </div>
          <button
            onClick={() => loadAllocations()}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center space-x-1.5 text-xs font-bold"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh Allocations</span>
          </button>
        </div>

        {toastMessage && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Route Fleet Seat Capacity Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {routes.map((route: any) => {
            const assignedCount = route.subscriptions.length;
            const capacity = route.assignedVehicle?.capacity || 4;
            const utilizationPercent = Math.round((assignedCount / capacity) * 100);

            return (
              <div
                key={route.id}
                className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold bg-slate-900 text-white px-2 py-0.5 rounded">
                    {route.code}
                  </span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      utilizationPercent >= 100
                        ? 'bg-rose-100 text-rose-800'
                        : utilizationPercent >= 75
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {utilizationPercent}% Full ({assignedCount}/{capacity} Seats)
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-900">{route.name}</h3>
                  <div className="text-xs text-slate-500 mt-1">
                    Captain: <strong>{route.assignedDriver?.user?.name || 'Unassigned'}</strong> • {route.assignedVehicle?.make || 'Vehicle'} ({route.assignedVehicle?.licensePlate || 'N/A'})
                  </div>
                </div>

                {/* Visual Seat Grid */}
                <div className="pt-2">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Seat Occupancy Map
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {Array.from({ length: capacity }).map((_, seatIdx) => {
                      const seatNum = seatIdx + 1;
                      const commuterAtSeat = route.subscriptions.find((s: any) => s.seatNumber === seatNum) || route.subscriptions[seatIdx];

                      return (
                        <div
                          key={seatIdx}
                          title={commuterAtSeat ? `${commuterAtSeat.commuter.name} (Seat #${seatNum})` : `Seat #${seatNum} (Vacant)`}
                          className={`p-2 rounded-xl text-center border text-xs font-mono font-bold transition-all ${
                            commuterAtSeat
                              ? 'bg-emerald-600 border-emerald-700 text-white shadow-xs'
                              : 'bg-slate-50 border-dashed border-slate-300 text-slate-400'
                          }`}
                        >
                          #{seatNum}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Smart Optimize Button */}
                <div className="pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleOptimizeRoute(route.id)}
                    disabled={optimizingRouteId === route.id}
                    className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center space-x-1.5 transition-all shadow-xs disabled:opacity-50"
                  >
                    <Sparkles className={`w-3.5 h-3.5 text-emerald-400 ${optimizingRouteId === route.id ? 'animate-spin' : ''}`} />
                    <span>{optimizingRouteId === route.id ? 'Analyzing Route...' : 'Smart Optimize Seats'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Commuters Allocation Roster Table */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-emerald-600" />
              <h3 className="text-lg font-bold text-slate-900">
                Active Commuter Route Bindings ({subscriptions.length})
              </h3>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] font-bold tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-6">Commuter</th>
                  <th className="py-3.5 px-6">Assigned Route</th>
                  <th className="py-3.5 px-6">Seat #</th>
                  <th className="py-3.5 px-6">Boarding Spot</th>
                  <th className="py-3.5 px-6">Destination Hub</th>
                  <th className="py-3.5 px-6">Plan Status</th>
                  <th className="py-3.5 px-6 text-right">Reallocate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-xs">
                {subscriptions.map((sub: any) => (
                  <tr key={sub.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-6">
                      <div className="font-bold text-slate-900">{sub.commuter?.name}</div>
                      <div className="text-slate-400">{sub.commuter?.email}</div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="font-mono font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded mr-1.5">
                        {sub.route?.code}
                      </span>
                      <span className="text-slate-700">{sub.route?.name}</span>
                    </td>
                    <td className="py-4 px-6 font-mono font-bold text-emerald-700">
                      Seat #{sub.seatNumber || 1}
                    </td>
                    <td className="py-4 px-6 text-slate-700 truncate max-w-[150px]">
                      {sub.pickupAddress}
                    </td>
                    <td className="py-4 px-6 text-slate-700 truncate max-w-[150px]">
                      {sub.dropAddress}
                    </td>
                    <td className="py-4 px-6">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {sub.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => {
                          setSelectedSub(sub);
                          setTargetRouteId(sub.routeId);
                          setTargetSeat(sub.seatNumber?.toString() || '1');
                          setReassignModalOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 text-xs font-bold transition-all shadow-xs"
                      >
                        Reassign
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Reassign Modal */}
      {reassignModalOpen && selectedSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl border border-slate-200 relative space-y-6">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900">Reassign Commuter Route</h3>
              <p className="text-xs text-slate-500">
                Transfer <strong>{selectedSub.commuter?.name}</strong> to a different corridor shuttle and seat.
              </p>
            </div>

            <form onSubmit={handleReassign} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Target Route Corridor
                </label>
                <select
                  value={targetRouteId}
                  onChange={(e) => setTargetRouteId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-sm"
                >
                  {routes.map((r: any) => (
                    <option key={r.id} value={r.id}>
                      {r.code} - {r.name} ({r.subscriptions.length}/{r.assignedVehicle?.capacity || 4} Seats)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Seat Number
                </label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={targetSeat}
                  onChange={(e) => setTargetSeat(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setReassignModalOpen(false)}
                  className="w-full py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all"
                >
                  {actionLoading ? 'Saving...' : 'Confirm Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Smart Seat Optimization Preview Modal */}
      {optimizationPreview && (
        <SeatOptimizationPreviewModal
          preview={optimizationPreview}
          onClose={() => setOptimizationPreview(null)}
          onApplied={async () => {
            setToastMessage('Seat optimization applied successfully!');
            setTimeout(() => setToastMessage(null), 4000);
            await loadAllocations();
          }}
        />
      )}
    </div>
  );
}
