'use client';

import React, { useState } from 'react';
import axios from 'axios';
import {
  X,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Users,
  Layers,
  ArrowRightLeft,
  Check,
} from 'lucide-react';
import { OptimizationPreviewResult } from '@/lib/optimization/seat-optimization-types';

interface SeatOptimizationPreviewModalProps {
  preview: OptimizationPreviewResult;
  onClose: () => void;
  onApplied: () => void;
}

export default function SeatOptimizationPreviewModal({
  preview,
  onClose,
  onApplied,
}: SeatOptimizationPreviewModalProps) {
  const [applying, setApplying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [appliedSuccess, setAppliedSuccess] = useState(false);

  const handleApply = async () => {
    try {
      setApplying(true);
      setErrorMessage(null);

      const res = await axios.post('/api/admin/seat-optimization/apply', {
        runId: preview.runId,
        routeId: preview.routeId,
        checksum: preview.checksum,
        changes: preview.reassignments,
      });

      if (res.data?.success) {
        setAppliedSuccess(true);
        setTimeout(() => {
          onApplied();
          onClose();
        }, 1500);
      }
    } catch (err: any) {
      if (err.response?.status === 409) {
        setErrorMessage(
          err.response?.data?.error ||
            '⚠️ Allocation changed: The underlying bookings changed since this optimization was calculated. Please run optimization again.'
        );
      } else {
        setErrorMessage(err.response?.data?.error || 'Failed to apply seat optimization');
      }
    } finally {
      setApplying(false);
    }
  };

  const bMetrics = preview.beforeMetrics;
  const aMetrics = preview.afterMetrics;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white max-w-4xl w-full rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 my-8 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-xs">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-black text-slate-900">
                  💺 Seat Optimization Preview
                </h2>
                <span className="font-mono text-xs font-bold bg-slate-900 text-white px-2 py-0.5 rounded">
                  {preview.routeCode}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {preview.routeName} • Vehicle: {preview.vehicleModel} ({preview.vehicleCapacity} Seats)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Scrollable */}
        <div className="overflow-y-auto space-y-6 pr-1 flex-1">
          {/* Status Alert or Optimal Notice */}
          {preview.isOptimal ? (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start space-x-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-emerald-900">
                  ✓ Allocation Already Optimal
                </h4>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Current arrangement is optimal under existing capacity and route constraints. No seat reassignments are recommended.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-start space-x-3">
              <Sparkles className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5 animate-pulse" />
              <div>
                <h4 className="text-sm font-bold text-indigo-950">
                  Optimization Opportunity Detected (+{preview.improvementPercent}% Efficiency)
                </h4>
                <p className="text-xs text-indigo-800 mt-0.5">
                  Reorganizing {preview.reassignments.length} passengers reduces fragmentation score from {bMetrics.fragmentationScore} down to {aMetrics.fragmentationScore} without increasing vehicle crowding.
                </p>
              </div>
            </div>
          )}

          {/* Metrics Comparison Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] uppercase font-bold text-slate-400">Current Utilization</div>
              <div className="text-xl font-black text-slate-800 font-mono mt-0.5">
                {bMetrics.utilizationPercent}%
              </div>
              <div className="text-[10px] text-slate-500">
                {bMetrics.bookedCount}/{preview.vehicleCapacity} Seats
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] uppercase font-bold text-slate-400">Fragmentation Score</div>
              <div className="text-xl font-black text-slate-800 font-mono mt-0.5 flex items-center justify-center space-x-1.5">
                <span className="text-rose-600 line-through opacity-70">{bMetrics.fragmentationScore}</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-emerald-600">{aMetrics.fragmentationScore}</span>
              </div>
              <div className="text-[10px] text-emerald-700 font-bold">
                -{Math.max(0, bMetrics.fragmentationScore - aMetrics.fragmentationScore)} pts
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] uppercase font-bold text-slate-400">Empty Gaps / Holes</div>
              <div className="text-xl font-black text-slate-800 font-mono mt-0.5 flex items-center justify-center space-x-1.5">
                <span className="text-rose-600">{bMetrics.emptyHolesCount}</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-emerald-600">{aMetrics.emptyHolesCount}</span>
              </div>
              <div className="text-[10px] text-slate-500">Contiguous packing</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] uppercase font-bold text-slate-400">Reassignments</div>
              <div className="text-xl font-black text-indigo-700 font-mono mt-0.5">
                {preview.reassignments.length}
              </div>
              <div className="text-[10px] text-slate-500">Stable allocation</div>
            </div>
          </div>

          {/* Before vs After Visual Seat Map */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Visual Seat Map Comparison
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* CURRENT SEAT MAP */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>CURRENT ALLOCATION</span>
                  <span className="text-rose-600">Frag: {bMetrics.fragmentationScore}</span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {preview.beforeSeatMap.map((seat) => (
                    <div
                      key={seat.seatNumber}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        seat.isOccupied
                          ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                          : 'bg-white border-dashed border-slate-300 text-slate-400'
                      }`}
                    >
                      <div className="text-[10px] font-mono font-bold opacity-70">
                        #{seat.seatNumber}
                      </div>
                      <div className="text-xs font-black truncate max-w-[80px] mx-auto">
                        {seat.passengers[0]?.name.split(' ')[0] || 'VACANT'}
                      </div>
                      <div className="text-[9px] truncate opacity-75">
                        {seat.isOccupied ? `${seat.utilizationPercent}% leg` : 'Free'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* OPTIMIZED SEAT MAP */}
              <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
                  <span className="flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>OPTIMIZED ALLOCATION</span>
                  </span>
                  <span className="text-emerald-700">Frag: {aMetrics.fragmentationScore}</span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {preview.afterSeatMap.map((seat) => {
                    const wasMovedToHere = preview.reassignments.some((r) => r.newSeat === seat.seatNumber);

                    return (
                      <div
                        key={seat.seatNumber}
                        className={`p-2.5 rounded-xl border text-center transition-all ${
                          seat.isOccupied
                            ? wasMovedToHere
                              ? 'bg-emerald-600 border-emerald-700 text-white shadow-md ring-2 ring-emerald-400'
                              : 'bg-slate-900 border-slate-900 text-white shadow-xs'
                            : 'bg-white border-dashed border-emerald-300 text-slate-400'
                        }`}
                      >
                        <div className="text-[10px] font-mono font-bold opacity-70">
                          #{seat.seatNumber}
                        </div>
                        <div className="text-xs font-black truncate max-w-[80px] mx-auto">
                          {seat.passengers[0]?.name.split(' ')[0] || 'VACANT'}
                        </div>
                        <div className="text-[9px] truncate opacity-75">
                          {seat.isOccupied ? `${seat.utilizationPercent}% leg` : 'Free'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Explainable Causal Changes Roster */}
          {preview.reassignments.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
                <span>Recommended Passenger Seat Reassignments ({preview.reassignments.length})</span>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 text-xs">
                {preview.reassignments.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="space-y-1 max-w-md">
                      <div className="flex items-center space-x-2">
                        <span className="font-black text-slate-900">{item.passengerName}</span>
                        <span className="text-slate-400">•</span>
                        <span className="text-slate-500 text-[11px]">
                          {item.pickupStop} → {item.dropStop}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-snug">
                        <strong className="text-indigo-900">Reason:</strong> {item.reason}
                      </p>
                    </div>

                    <div className="flex items-center space-x-2 self-start sm:self-auto bg-slate-100 px-3 py-1.5 rounded-xl font-mono text-xs">
                      <span className="text-rose-700 font-bold">Seat #{item.previousSeat}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-emerald-700 font-bold">Seat #{item.newSeat}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error Notice if Concurrency / Validation Failed */}
          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start space-x-3 text-xs text-rose-800 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {appliedSuccess && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center space-x-2 text-xs font-bold text-emerald-800 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>✓ Seat optimization successfully committed to route subscriptions!</span>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-4 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={applying}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition-all cursor-pointer"
          >
            Cancel
          </button>

          {!preview.isOptimal && (
            <button
              type="button"
              onClick={handleApply}
              disabled={applying || appliedSuccess}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md shadow-indigo-500/20 flex items-center space-x-2 transition-all cursor-pointer"
            >
              {applying ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Applying Allocations...</span>
                </>
              ) : appliedSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Applied!</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Apply Optimization</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
