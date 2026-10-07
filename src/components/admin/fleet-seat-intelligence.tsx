'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Layers,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
  ChevronRight,
  Users,
  Car,
  History,
  Info,
} from 'lucide-react';
import { FleetSeatSummary, OptimizationPreviewResult } from '@/lib/optimization/seat-optimization-types';
import SeatOptimizationPreviewModal from './seat-optimization-preview-modal';

export default function FleetSeatIntelligence() {
  const [summary, setSummary] = useState<FleetSeatSummary | null>(null);
  const [historyRuns, setHistoryRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzingRouteId, setAnalyzingRouteId] = useState<string | null>(null);
  const [activePreview, setActivePreview] = useState<OptimizationPreviewResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadFleetData = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const [summaryRes, historyRes] = await Promise.allSettled([
        axios.get('/api/admin/seat-optimization/fleet-summary'),
        axios.get('/api/admin/seat-optimization/history'),
      ]);

      if (summaryRes.status === 'fulfilled' && summaryRes.value.data?.success) {
        setSummary(summaryRes.value.data.summary);
      }
      if (historyRes.status === 'fulfilled' && historyRes.value.data?.success) {
        setHistoryRuns(historyRes.value.data.runs || []);
      }
    } catch (err: any) {
      console.error('Failed to load fleet seat intelligence:', err);
      setErrorMessage('Failed to fetch fleet seat intelligence data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFleetData();
  }, []);

  const handleAnalyzeRoute = async (routeId: string) => {
    try {
      setAnalyzingRouteId(routeId);
      setErrorMessage(null);
      const res = await axios.post('/api/admin/seat-optimization/analyze', { routeId });
      if (res.data?.success && res.data.preview) {
        setActivePreview(res.data.preview);
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || 'Failed to analyze route for seat optimization');
    } finally {
      setAnalyzingRouteId(null);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xl">💺</span>
            <h3 className="text-lg font-bold text-slate-900">Fleet Seat Intelligence & Optimization</h3>
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
              Corridor Packing Engine
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Algorithmic seat consolidation and segment defragmentation based on multi-objective cost minimization.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={loadFleetData}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center space-x-1.5 text-xs font-bold transition-all disabled:opacity-50"
            title="Refresh Fleet Seat Intelligence"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Fleet Capacity</div>
          <div className="text-2xl font-black text-slate-900">{summary?.totalFleetSeats ?? '—'}</div>
          <div className="text-[11px] text-slate-400 font-medium">Total physical seats</div>
        </div>

        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Allocated</div>
          <div className="text-2xl font-black text-slate-900">{summary?.totalOccupiedSeats ?? '—'}</div>
          <div className="text-[11px] text-slate-400 font-medium">Active passenger seats</div>
        </div>

        <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 space-y-1">
          <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Fleet Utilization</div>
          <div className="text-2xl font-black text-emerald-700">
            {summary ? `${summary.overallUtilizationPercent}%` : '—'}
          </div>
          <div className="text-[11px] text-emerald-600 font-medium">Seat occupancy ratio</div>
        </div>

        <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200 space-y-1">
          <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Fragmented Corridors</div>
          <div className="text-2xl font-black text-amber-700">{summary?.fragmentedRoutesCount ?? '—'}</div>
          <div className="text-[11px] text-amber-600 font-medium">Routes with seat gaps</div>
        </div>

        <div className="bg-indigo-50/70 p-4 rounded-2xl border border-indigo-200 space-y-1 col-span-2 md:col-span-1">
          <div className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider">Opportunities</div>
          <div className="text-2xl font-black text-indigo-700">
            {summary?.optimizationOpportunitiesCount ?? '—'}
          </div>
          <div className="text-[11px] text-indigo-600 font-medium">Pre-departure optimizable</div>
        </div>
      </div>

      {/* Routes Grid */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Corridor Route Seat Allocations ({summary?.routes.length || 0})
          </div>
          <span className="text-[11px] text-slate-500">
            Min improvement gate: <strong>5.0%</strong>
          </span>
        </div>

        {summary && summary.routes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {summary.routes.map((rt) => {
              const fragColor =
                rt.fragmentationScore >= 50
                  ? 'bg-rose-100 text-rose-800 border-rose-200'
                  : rt.fragmentationScore >= 25
                  ? 'bg-amber-100 text-amber-800 border-amber-200'
                  : 'bg-emerald-100 text-emerald-800 border-emerald-200';

              return (
                <div
                  key={rt.routeId}
                  className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition-all space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-black bg-slate-900 text-white px-2 py-0.5 rounded">
                        {rt.routeCode}
                      </span>
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${fragColor}`}
                      >
                        Frag: {rt.fragmentationScore}/100
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-slate-900 leading-snug">{rt.routeName}</h4>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Occupancy: <strong>{rt.assignedCount}/{rt.capacity}</strong> seats ({rt.occupancyPercent}%)
                      </div>
                    </div>

                    {/* Utilization Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-medium text-slate-500">
                        <span>Current Occupancy: {rt.occupancyPercent}%</span>
                        <span className="font-semibold text-slate-700">{rt.fragmentationLevel} Frag</span>
                      </div>
                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-600 h-full rounded-full transition-all"
                          style={{ width: `${Math.min(100, rt.occupancyPercent)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
                    {rt.canOptimize ? (
                      <span className="text-[11px] font-bold text-indigo-700 flex items-center space-x-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Optimization available</span>
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-slate-500 flex items-center space-x-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Optimal</span>
                      </span>
                    )}

                    <button
                      onClick={() => handleAnalyzeRoute(rt.routeId)}
                      disabled={analyzingRouteId === rt.routeId}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1 ${
                        rt.canOptimize
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {analyzingRouteId === rt.routeId ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>Analyzing...</span>
                        </>
                      ) : (
                        <>
                          <span>Inspect</span>
                          <ArrowRight className="w-3 h-3" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500">
            {loading ? 'Analyzing fleet corridor allocations...' : 'No route allocations found.'}
          </div>
        )}
      </div>

      {/* Optimization History Audit Trail */}
      {historyRuns.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-700">
              <History className="w-4 h-4 text-emerald-600" />
              <span>Recent Optimization Audit Log</span>
            </div>
            <span className="text-[11px] text-slate-400">Total logged runs: {historyRuns.length}</span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-4">Route</th>
                  <th className="py-2.5 px-4">Improvement</th>
                  <th className="py-2.5 px-4">Moved Seats</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Applied By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {historyRuns.slice(0, 5).map((run) => (
                  <tr key={run.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-600">
                      {new Date(run.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-slate-900">
                      <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded mr-1">
                        {run.route?.code}
                      </span>
                      {run.route?.name}
                    </td>
                    <td className="py-2.5 px-4 text-emerald-700 font-bold">
                      +{run.improvementPercent.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 font-semibold">
                      {run.reassignmentsCount} {run.reassignmentsCount === 1 ? 'passenger' : 'passengers'}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                          run.status === 'APPLIED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {run.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 truncate max-w-[120px]">
                      {run.appliedBy || 'System Admin'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Optimization Modal */}
      {activePreview && (
        <SeatOptimizationPreviewModal
          preview={activePreview}
          onClose={() => setActivePreview(null)}
          onApplied={() => {
            loadFleetData();
          }}
        />
      )}
    </div>
  );
}
