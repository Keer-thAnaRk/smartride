'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  ShieldAlert,
  AlertTriangle,
  TrendingUp,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  Info,
  ChevronRight,
  X,
  FileCheck,
  Check,
  Ban,
  Bus,
  Shield,
  Activity,
  Users,
  Sparkles,
} from 'lucide-react';

interface OperationalRecommendation {
  id: string;
  routeId: string;
  routeCode: string;
  routeName: string;
  type: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  recommendation: string;
  rationale: string;
  evidence: Record<string, any>;
  status: 'PENDING' | 'APPROVED' | 'DISMISSED' | 'COMPLETED';
  dedupKey: string;
  sourceSnapshotId: string | null;
  sourceDecisionState: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  dismissedAt: string | null;
  dismissedBy: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RecommendationsSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  pending: number;
  approved: number;
  dismissed: number;
  completed: number;
}

export default function OperationalRecommendationCenter() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<OperationalRecommendation[]>([]);
  const [summary, setSummary] = useState<RecommendationsSummary | null>(null);
  const [filter, setFilter] = useState<string>('ALL');
  const [selectedRec, setSelectedRec] = useState<OperationalRecommendation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const fetchRecommendations = async () => {
    try {
      setError(null);
      const res = await axios.get('/api/operations/recommendations');
      if (res.data?.success) {
        setRecommendations(res.data.recommendations || []);
        setSummary(res.data.summary);
      }
    } catch (err: any) {
      console.error('Failed to load operational recommendations:', err);
      setError(err.response?.data?.error || 'Failed to retrieve recommendations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchRecommendations();
  };

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const handleApprove = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActionLoading(id);
    try {
      const res = await axios.post(`/api/operations/recommendations/${id}/approve`);
      if (res.data?.success) {
        showToast('Recommendation approved for operational consideration.');
        await fetchRecommendations();
        if (selectedRec && selectedRec.id === id) {
          setSelectedRec(res.data.recommendation);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to approve recommendation');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDismiss = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActionLoading(id);
    try {
      const res = await axios.post(`/api/operations/recommendations/${id}/dismiss`);
      if (res.data?.success) {
        showToast('Recommendation dismissed by operations admin.');
        await fetchRecommendations();
        if (selectedRec && selectedRec.id === id) {
          setSelectedRec(res.data.recommendation);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to dismiss recommendation');
    } finally {
      setActionLoading(null);
    }
  };

  const handleComplete = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActionLoading(id);
    try {
      const res = await axios.post(`/api/operations/recommendations/${id}/complete`);
      if (res.data?.success) {
        showToast('Operational action marked as completed.');
        await fetchRecommendations();
        if (selectedRec && selectedRec.id === id) {
          setSelectedRec(res.data.recommendation);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to complete recommendation');
    } finally {
      setActionLoading(null);
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/40">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5 animate-pulse" />
            Critical
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/40">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" />
            High
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/40">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 mr-1.5" />
            Medium
          </span>
        );
      case 'LOW':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
            Low
          </span>
        );
      default:
        return <span className="text-xs text-slate-400">{priority}</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
            Pending Review
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
            Approved
          </span>
        );
      case 'DISMISSED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700">
            Dismissed
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            Completed
          </span>
        );
      default:
        return <span className="text-xs text-slate-400">{status}</span>;
    }
  };

  const filteredRecommendations = recommendations.filter((r) => {
    if (filter === 'ALL') return true;
    if (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(filter)) {
      return r.priority === filter;
    }
    if (['PENDING', 'APPROVED', 'DISMISSED', 'COMPLETED'].includes(filter)) {
      return r.status === filter;
    }
    return true;
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/30 text-violet-400">
              <FileCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold tracking-tight">
                  Operational Recommendation & Action Planning Center
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  Phase 3 • Step 7
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Deterministic advisory recommendations and structured action planning based on verified platform intelligence.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition flex items-center space-x-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-violet-400' : ''}`} />
            <span>Refresh Recommendations</span>
          </button>
        </div>
      </div>

      {/* Mandatory Human-in-the-Loop Advisory Notice */}
      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start space-x-3">
        <Info className="w-4 h-4 text-violet-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-slate-300 leading-relaxed">
          <strong className="text-white font-semibold">Human-in-the-Loop Notice:</strong> Recommendations are advisory. Approval does not automatically modify routes, schedules, vehicles, drivers, bookings, or subscriptions. The operations administrator retains authoritative operational control.
        </p>
      </div>

      {/* Success Toast */}
      {successToast && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center space-x-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center space-x-2">
          <XCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Top KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Plans</div>
          <div className="text-xl font-black text-white mt-1">{loading ? '—' : summary?.total ?? 0}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">All generated</div>
        </div>

        <div className="p-3.5 rounded-xl bg-rose-500/5 border border-rose-500/20">
          <div className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Critical</div>
          <div className="text-xl font-black text-rose-400 mt-1">{loading ? '—' : summary?.critical ?? 0}</div>
          <div className="text-[10px] text-rose-500/80 mt-0.5">Emergency / severe</div>
        </div>

        <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">High Priority</div>
          <div className="text-xl font-black text-amber-400 mt-1">{loading ? '—' : summary?.high ?? 0}</div>
          <div className="text-[10px] text-amber-500/80 mt-0.5">Risk & compliance</div>
        </div>

        <div className="p-3.5 rounded-xl bg-sky-500/5 border border-sky-500/20">
          <div className="text-[10px] font-bold uppercase tracking-wider text-sky-400">Medium Priority</div>
          <div className="text-xl font-black text-sky-400 mt-1">{loading ? '—' : summary?.medium ?? 0}</div>
          <div className="text-[10px] text-sky-500/80 mt-0.5">Demand & trend</div>
        </div>

        <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300">Pending</div>
          <div className="text-xl font-black text-amber-300 mt-1">{loading ? '—' : summary?.pending ?? 0}</div>
          <div className="text-[10px] text-amber-400/80 mt-0.5">Awaiting review</div>
        </div>

        <div className="p-3.5 rounded-xl bg-indigo-500/5 border border-indigo-500/20">
          <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Approved</div>
          <div className="text-xl font-black text-indigo-400 mt-1">{loading ? '—' : summary?.approved ?? 0}</div>
          <div className="text-[10px] text-indigo-400/80 mt-0.5">Accepted plans</div>
        </div>

        <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Completed</div>
          <div className="text-xl font-black text-emerald-400 mt-1">{loading ? '—' : summary?.completed ?? 0}</div>
          <div className="text-[10px] text-emerald-500/80 mt-0.5">Action executed</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs">
          {[
            { id: 'ALL', label: 'All Plans' },
            { id: 'CRITICAL', label: 'Critical' },
            { id: 'HIGH', label: 'High' },
            { id: 'MEDIUM', label: 'Medium' },
            { id: 'PENDING', label: 'Pending' },
            { id: 'APPROVED', label: 'Approved' },
            { id: 'COMPLETED', label: 'Completed' },
            { id: 'DISMISSED', label: 'Dismissed' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                filter === tab.id
                  ? 'bg-violet-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="text-xs text-slate-400">
          Showing <span className="font-semibold text-slate-200">{filteredRecommendations.length}</span> of{' '}
          <span className="font-semibold text-slate-200">{recommendations.length}</span> recommendations
        </div>
      </div>

      {/* Recommendations Table */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/50">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800 text-[10px]">
              <tr>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Recommendation Title</th>
                <th className="py-3 px-3">Corridor</th>
                <th className="py-3 px-3">Operational Rationale</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Created</th>
                <th className="py-3 px-4 text-right">Administrative Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    <div className="flex items-center justify-center space-x-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-violet-400" />
                      <span>Synthesizing operational recommendations...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredRecommendations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500/60" />
                      <span className="font-semibold text-sm text-slate-300">
                        No additional operational recommendation is currently required based on available verified intelligence.
                      </span>
                      <span className="text-xs text-slate-500">
                        Corridor safety telemetry, compliance, and capacity indicators are operating within stable parameters.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecommendations.map((r) => (
                  <tr
                    key={r.id}
                    className="hover:bg-slate-900/60 transition cursor-pointer"
                    onClick={() => setSelectedRec(r)}
                  >
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getPriorityBadge(r.priority)}
                    </td>

                    <td className="py-3.5 px-4 font-bold text-white max-w-xs">
                      <div className="truncate">{r.title}</div>
                      <div className="text-[11px] text-slate-400 font-normal truncate mt-0.5">
                        {r.recommendation}
                      </div>
                    </td>

                    <td className="py-3.5 px-3 whitespace-nowrap font-mono text-slate-300">
                      <div className="flex items-center space-x-1.5">
                        <Bus className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
                        <span>{r.routeCode}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-slate-400 max-w-sm truncate">
                      {r.rationale}
                    </td>

                    <td className="py-3.5 px-3 whitespace-nowrap">
                      {getStatusBadge(r.status)}
                    </td>

                    <td className="py-3.5 px-3 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-1.5" onClick={(e) => e.stopPropagation()}>
                        {r.status === 'PENDING' && (
                          <>
                            <button
                              onClick={(e) => handleApprove(r.id, e)}
                              disabled={actionLoading === r.id}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-semibold text-xs transition flex items-center space-x-1 disabled:opacity-50"
                              title="Approve for operational consideration"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={(e) => handleDismiss(r.id, e)}
                              disabled={actionLoading === r.id}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-slate-200 font-medium text-xs transition flex items-center space-x-1 disabled:opacity-50"
                              title="Dismiss recommendation"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              <span>Dismiss</span>
                            </button>
                          </>
                        )}

                        {r.status === 'APPROVED' && (
                          <button
                            onClick={(e) => handleComplete(r.id, e)}
                            disabled={actionLoading === r.id}
                            className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 font-semibold text-xs transition flex items-center space-x-1 disabled:opacity-50"
                            title="Mark administrative action completed"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Mark Completed</span>
                          </button>
                        )}

                        {r.status === 'DISMISSED' && (
                          <span className="text-[11px] text-slate-500 italic">Dismissed</span>
                        )}

                        {r.status === 'COMPLETED' && (
                          <span className="text-[11px] text-emerald-400 font-semibold flex items-center space-x-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Done</span>
                          </span>
                        )}

                        <button
                          onClick={() => setSelectedRec(r)}
                          className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition ml-1"
                          title="View Details & Evidence"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recommendation Details Slide-Out Drawer */}
      {selectedRec && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/80 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-full overflow-y-auto p-6 space-y-6 shadow-2xl">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-lg font-bold text-white">{selectedRec.title}</h3>
                </div>
                <div className="mt-1 flex items-center space-x-2">
                  {getPriorityBadge(selectedRec.priority)}
                  {getStatusBadge(selectedRec.status)}
                  <span className="text-xs font-mono text-slate-400">
                    {selectedRec.routeCode} • {selectedRec.routeName}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedRec(null)}
                className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Advisory Recommendation Box */}
            <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/30 space-y-2">
              <div className="flex items-center space-x-2 text-violet-300 font-bold text-xs uppercase tracking-wider">
                <FileCheck className="w-4 h-4" />
                <span>Actionable Advisory Recommendation</span>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed font-semibold">
                {selectedRec.recommendation}
              </p>
            </div>

            {/* Operational Rationale */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Operational Rationale
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3 rounded-lg border border-slate-800">
                {selectedRec.rationale}
              </p>
            </div>

            {/* Supporting Evidence Breakdown */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                <Shield className="w-4 h-4 text-violet-400" />
                <span>Verified Supporting Evidence</span>
              </h4>
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 font-mono text-xs">
                {Object.entries(selectedRec.evidence || {}).map(([key, val]) => (
                  <div key={key} className="flex justify-between items-start border-b border-slate-900 pb-1.5">
                    <span className="text-slate-400 capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>
                    <span className="font-bold text-slate-200 text-right">
                      {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Audit & Lifecycle State Card */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs text-slate-400">
              <div className="font-bold uppercase tracking-wider text-slate-300 text-[11px] mb-2 flex items-center space-x-1.5">
                <Clock className="w-3.5 h-3.5 text-violet-400" />
                <span>Audit & Human-in-the-Loop History</span>
              </div>
              <div className="flex justify-between">
                <span>Created At:</span>
                <span className="text-slate-200 font-mono">
                  {new Date(selectedRec.createdAt).toLocaleString()}
                </span>
              </div>
              {selectedRec.approvedAt && (
                <div className="flex justify-between text-indigo-300">
                  <span>Approved By:</span>
                  <span className="font-semibold">
                    {selectedRec.approvedBy} ({new Date(selectedRec.approvedAt).toLocaleString()})
                  </span>
                </div>
              )}
              {selectedRec.dismissedAt && (
                <div className="flex justify-between text-slate-400">
                  <span>Dismissed By:</span>
                  <span className="font-semibold">
                    {selectedRec.dismissedBy} ({new Date(selectedRec.dismissedAt).toLocaleString()})
                  </span>
                </div>
              )}
              {selectedRec.completedAt && (
                <div className="flex justify-between text-emerald-300">
                  <span>Completed At:</span>
                  <span className="font-semibold font-mono">
                    {new Date(selectedRec.completedAt).toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="border-t border-slate-800 pt-4 flex items-center justify-end space-x-3">
              {selectedRec.status === 'PENDING' && (
                <>
                  <button
                    onClick={() => handleDismiss(selectedRec.id)}
                    disabled={actionLoading === selectedRec.id}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-300 transition"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() => handleApprove(selectedRec.id)}
                    disabled={actionLoading === selectedRec.id}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition flex items-center space-x-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>Approve Recommendation</span>
                  </button>
                </>
              )}

              {selectedRec.status === 'APPROVED' && (
                <button
                  onClick={() => handleComplete(selectedRec.id)}
                  disabled={actionLoading === selectedRec.id}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition flex items-center space-x-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Mark Completed</span>
                </button>
              )}

              <button
                onClick={() => setSelectedRec(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-400 hover:text-white transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
