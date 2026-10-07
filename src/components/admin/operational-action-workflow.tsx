'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Play,
  RotateCw,
  Search,
  Filter,
  Eye,
  FileText,
  AlertOctagon,
  ArrowRight,
  TrendingUp,
  Activity,
  Layers,
  Sparkles,
  Database,
  Info,
  ChevronRight,
  X,
  History,
  CheckSquare,
} from 'lucide-react';

export type ActionPlanStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'EXECUTION_REQUESTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'REJECTED';

export type ActionPlanPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface ActionPlanItem {
  id: string;
  routeId: string;
  routeCode: string;
  routeName: string;
  recommendationId: string;
  actionType: string;
  title: string;
  description: string;
  priority: ActionPlanPriority;
  status: ActionPlanStatus;
  requestedByUserName?: string | null;
  approvedByUserName?: string | null;
  executedByUserName?: string | null;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string | null;
  executionStartedAt?: string | null;
  completedAt?: string | null;
  executionResult?: string | null;
  failureReason?: string | null;
  evidence: Record<string, any>;
  approvalNote?: string | null;
  executionNote?: string | null;
  rejectionReason?: string | null;
  cancellationReason?: string | null;
  correlationId?: string | null;
  staleIntelligenceDetected?: boolean;
  staleReasons?: string[];
}

export interface ActionWorkflowKPIs {
  total: number;
  pendingApproval: number;
  approved: number;
  executionRequested: number;
  inProgress: number;
  completed: number;
  failed: number;
  rejected: number;
  cancelled: number;
}

export default function OperationalActionWorkflow() {
  const [actionPlans, setActionPlans] = useState<ActionPlanItem[]>([]);
  const [kpis, setKpis] = useState<ActionWorkflowKPIs>({
    total: 0,
    pendingApproval: 0,
    approved: 0,
    executionRequested: 0,
    inProgress: 0,
    completed: 0,
    failed: 0,
    rejected: 0,
    cancelled: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [actionTypeFilter, setActionTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected for Drawer
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [detailTab, setDetailTab] = useState<string>('A');

  // Confirmation Modals State
  const [confirmModal, setConfirmModal] = useState<{
    type: 'APPROVE' | 'REJECT' | 'REQUEST_EXECUTION' | 'START' | 'COMPLETE' | 'FAIL' | 'CANCEL';
    plan: ActionPlanItem;
  } | null>(null);

  // Modal form inputs
  const [modalNote, setModalNote] = useState<string>('');
  const [modalReason, setModalReason] = useState<string>('');
  const [modalResult, setModalResult] = useState<string>('SUCCESS_VERIFIED');
  const [acknowledgeStale, setAcknowledgeStale] = useState<boolean>(false);
  const [actionProcessing, setActionProcessing] = useState<boolean>(false);

  const fetchActionPlans = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (priorityFilter !== 'ALL') params.set('priority', priorityFilter);
      if (actionTypeFilter !== 'ALL') params.set('actionType', actionTypeFilter);

      const res = await fetch(`/api/operations/action-workflow?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to load action plans (Status ${res.status})`);
      }
      const json = await res.json();
      if (json.success && json.data) {
        setActionPlans(json.data.actionPlans || []);
        if (json.data.kpis) setKpis(json.data.kpis);
      }
    } catch (err: any) {
      setError(err?.message || 'Error loading action plans');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, actionTypeFilter]);

  useEffect(() => {
    fetchActionPlans();
  }, [fetchActionPlans]);

  // Load deep-dive drawer details
  const openDetailDrawer = async (planId: string) => {
    setSelectedPlanId(planId);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/operations/action-workflow/${planId}`);
      if (res.ok) {
        const json = await res.json();
        setDetailData(json.data);
      }
    } catch (err) {
      console.error('Error fetching detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeDetailDrawer = () => {
    setSelectedPlanId(null);
    setDetailData(null);
    setDetailTab('A');
  };

  // Open modal
  const openActionModal = (
    type: 'APPROVE' | 'REJECT' | 'REQUEST_EXECUTION' | 'START' | 'COMPLETE' | 'FAIL' | 'CANCEL',
    plan: ActionPlanItem
  ) => {
    setConfirmModal({ type, plan });
    setModalNote('');
    setModalReason('');
    setModalResult('SUCCESS_VERIFIED');
    setAcknowledgeStale(false);
  };

  const closeActionModal = () => {
    setConfirmModal(null);
    setModalNote('');
    setModalReason('');
    setModalResult('SUCCESS_VERIFIED');
    setAcknowledgeStale(false);
  };

  // Submit Modal Action
  const handleModalSubmit = async () => {
    if (!confirmModal) return;
    const { type, plan } = confirmModal;
    setActionProcessing(true);

    try {
      let endpoint = '';
      let payload: any = {};

      switch (type) {
        case 'APPROVE':
          endpoint = `/api/operations/action-workflow/${plan.id}/approve`;
          payload = { approvalNote: modalNote, acknowledgeStale };
          break;
        case 'REJECT':
          endpoint = `/api/operations/action-workflow/${plan.id}/reject`;
          payload = { rejectionReason: modalReason };
          break;
        case 'REQUEST_EXECUTION':
          endpoint = `/api/operations/action-workflow/${plan.id}/request-execution`;
          payload = { executionNote: modalNote };
          break;
        case 'START':
          endpoint = `/api/operations/action-workflow/${plan.id}/start`;
          payload = { executionNote: modalNote };
          break;
        case 'COMPLETE':
          endpoint = `/api/operations/action-workflow/${plan.id}/complete`;
          payload = { completionNote: modalNote, executionResult: modalResult };
          break;
        case 'FAIL':
          endpoint = `/api/operations/action-workflow/${plan.id}/fail`;
          payload = { failureReason: modalReason };
          break;
        case 'CANCEL':
          endpoint = `/api/operations/action-workflow/${plan.id}/cancel`;
          payload = { cancellationReason: modalReason };
          break;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `Action failed with status ${res.status}`);
      }

      closeActionModal();
      await fetchActionPlans();
      if (selectedPlanId === plan.id) {
        await openDetailDrawer(plan.id);
      }
    } catch (err: any) {
      alert(`Action error: ${err.message}`);
    } finally {
      setActionProcessing(false);
    }
  };

  // Filtered by Search
  const filteredPlans = actionPlans.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.id.toLowerCase().includes(q) ||
      p.routeCode.toLowerCase().includes(q) ||
      p.title.toLowerCase().includes(q) ||
      p.actionType.toLowerCase().includes(q)
    );
  });

  const getStatusBadge = (status: ActionPlanStatus) => {
    switch (status) {
      case 'PENDING_APPROVAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950/40 text-amber-400 border border-amber-800/50">
            <Clock className="w-3 h-3" /> Pending Approval
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/40 text-emerald-400 border border-emerald-800/50">
            <CheckCircle2 className="w-3 h-3" /> Approved
          </span>
        );
      case 'EXECUTION_REQUESTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-950/40 text-cyan-400 border border-cyan-800/50">
            <Play className="w-3 h-3" /> Execution Requested
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-950/40 text-indigo-400 border border-indigo-800/50 animate-pulse">
            <RotateCw className="w-3 h-3 animate-spin" /> In Progress
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-950/40 text-teal-400 border border-teal-800/50">
            <CheckSquare className="w-3 h-3" /> Completed
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-950/40 text-rose-400 border border-rose-800/50">
            <XCircle className="w-3 h-3" /> Failed
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-950/40 text-red-400 border border-red-800/50">
            <XCircle className="w-3 h-3" /> Rejected
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700">
            <X className="w-3 h-3" /> Cancelled
          </span>
        );
      case 'DRAFT':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
            Draft
          </span>
        );
    }
  };

  const getPriorityBadge = (priority: ActionPlanPriority) => {
    switch (priority) {
      case 'CRITICAL':
        return (
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-rose-950/60 text-rose-300 border border-rose-700/60">
            CRITICAL
          </span>
        );
      case 'HIGH':
        return (
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-orange-950/60 text-orange-300 border border-orange-700/60">
            HIGH
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-950/60 text-amber-300 border border-amber-700/60">
            MEDIUM
          </span>
        );
      case 'LOW':
      default:
        return (
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
            LOW
          </span>
        );
    }
  };

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl mb-8 relative">
      {/* Header & Mandatory Notice */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded">
              Phase 3 · Step 17
            </span>
            <span className="px-2 py-0.5 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Human-in-the-Loop Enforced
            </span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight mt-1 flex items-center gap-2">
            Controlled Operational Action Workflow & Execution Center
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Governed administrative workflow converting verified recommendations into auditable, authorized action plans.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchActionPlans()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Mandatory Safety Notice Banner */}
      <div className="mt-4 p-3.5 rounded-lg bg-amber-950/30 border border-amber-800/40 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-200/90 leading-relaxed">
          <span className="font-semibold text-amber-300">Mandatory Operational Governance Notice: </span>
          Operational actions require explicit administrator authorization. This system never automatically changes routes,
          schedules, vehicles, drivers, subscriptions, bookings, seat allocations, or dispatch assignments. Recommendations
          and action plans are strictly advisory until approved by an authorized administrator.
        </div>
      </div>

      {/* Top 8 KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mt-5">
        <div className="p-3 bg-slate-800/60 border border-slate-700/50 rounded-lg">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Pending</div>
          <div className="text-xl font-bold text-amber-400 mt-1">{kpis.pendingApproval}</div>
        </div>
        <div className="p-3 bg-slate-800/60 border border-slate-700/50 rounded-lg">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Approved</div>
          <div className="text-xl font-bold text-emerald-400 mt-1">{kpis.approved}</div>
        </div>
        <div className="p-3 bg-slate-800/60 border border-slate-700/50 rounded-lg">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Requested</div>
          <div className="text-xl font-bold text-cyan-400 mt-1">{kpis.executionRequested}</div>
        </div>
        <div className="p-3 bg-slate-800/60 border border-slate-700/50 rounded-lg">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">In Progress</div>
          <div className="text-xl font-bold text-indigo-400 mt-1">{kpis.inProgress}</div>
        </div>
        <div className="p-3 bg-slate-800/60 border border-slate-700/50 rounded-lg">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Completed</div>
          <div className="text-xl font-bold text-teal-400 mt-1">{kpis.completed}</div>
        </div>
        <div className="p-3 bg-slate-800/60 border border-slate-700/50 rounded-lg">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Failed</div>
          <div className="text-xl font-bold text-rose-400 mt-1">{kpis.failed}</div>
        </div>
        <div className="p-3 bg-slate-800/60 border border-slate-700/50 rounded-lg">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Rejected</div>
          <div className="text-xl font-bold text-red-400 mt-1">{kpis.rejected}</div>
        </div>
        <div className="p-3 bg-slate-800/60 border border-slate-700/50 rounded-lg">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Cancelled</div>
          <div className="text-xl font-bold text-zinc-400 mt-1">{kpis.cancelled}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mt-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Filter Status:
          </span>
          {[
            'ALL',
            'PENDING_APPROVAL',
            'APPROVED',
            'EXECUTION_REQUESTED',
            'IN_PROGRESS',
            'COMPLETED',
            'FAILED',
            'REJECTED',
            'CANCELLED',
          ].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white shadow'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
              }`}
            >
              {st === 'ALL' ? 'All' : st.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        <div className="relative min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search action plans..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/40">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-800/80 text-slate-400 uppercase text-[11px] font-semibold border-b border-slate-800">
            <tr>
              <th className="py-3 px-4">Action ID & Route</th>
              <th className="py-3 px-4">Action Type</th>
              <th className="py-3 px-4">Priority</th>
              <th className="py-3 px-4">Originating Recommendation</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Freshness</th>
              <th className="py-3 px-4">Created</th>
              <th className="py-3 px-4 text-right">Governed Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {loading ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-400">
                  <RotateCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-400" />
                  Loading controlled action plans...
                </td>
              </tr>
            ) : filteredPlans.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-400">
                  <FileText className="w-6 h-6 mx-auto mb-2 text-slate-600" />
                  No action plans found matching the active criteria.
                </td>
              </tr>
            ) : (
              filteredPlans.map((plan) => (
                <tr key={plan.id} className="hover:bg-slate-800/30 transition">
                  <td className="py-3 px-4">
                    <div className="font-mono text-[11px] text-indigo-400 font-semibold">{plan.id}</div>
                    <div className="text-slate-200 font-medium mt-0.5">
                      {plan.routeCode} · <span className="text-slate-400">{plan.routeName}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-mono text-xs text-slate-200">
                      {plan.actionType.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-4">{getPriorityBadge(plan.priority)}</td>
                  <td className="py-3 px-4 max-w-xs">
                    <div className="truncate text-slate-200 font-medium">{plan.title}</div>
                    <div className="text-[11px] text-slate-500 truncate">{plan.description}</div>
                  </td>
                  <td className="py-3 px-4">{getStatusBadge(plan.status)}</td>
                  <td className="py-3 px-4">
                    {plan.staleIntelligenceDetected ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/50">
                        <AlertTriangle className="w-3 h-3" /> Changed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/50">
                        <CheckCircle2 className="w-3 h-3" /> Fresh
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-400 text-[11px]">
                    {new Date(plan.createdAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => openDetailDrawer(plan.id)}
                        className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                        title="View Full Detail & Evidence Drawer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      {/* State-Aware Action Buttons */}
                      {plan.status === 'PENDING_APPROVAL' && (
                        <>
                          <button
                            onClick={() => openActionModal('APPROVE', plan)}
                            className="px-2.5 py-1 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => openActionModal('REJECT', plan)}
                            className="px-2.5 py-1 text-xs font-semibold rounded bg-rose-600/80 hover:bg-rose-600 text-white transition"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => openActionModal('CANCEL', plan)}
                            className="px-2 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition"
                          >
                            Cancel
                          </button>
                        </>
                      )}

                      {plan.status === 'APPROVED' && (
                        <>
                          <button
                            onClick={() => openActionModal('REQUEST_EXECUTION', plan)}
                            className="px-2.5 py-1 text-xs font-semibold rounded bg-cyan-600 hover:bg-cyan-500 text-white transition shadow-sm flex items-center gap-1"
                          >
                            <Play className="w-3 h-3" /> Request Execution
                          </button>
                          <button
                            onClick={() => openActionModal('CANCEL', plan)}
                            className="px-2 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition"
                          >
                            Cancel
                          </button>
                        </>
                      )}

                      {plan.status === 'EXECUTION_REQUESTED' && (
                        <button
                          onClick={() => openActionModal('START', plan)}
                          className="px-2.5 py-1 text-xs font-semibold rounded bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm flex items-center gap-1"
                        >
                          <Play className="w-3 h-3" /> Mark Started
                        </button>
                      )}

                      {plan.status === 'IN_PROGRESS' && (
                        <>
                          <button
                            onClick={() => openActionModal('COMPLETE', plan)}
                            className="px-2.5 py-1 text-xs font-semibold rounded bg-teal-600 hover:bg-teal-500 text-white transition shadow-sm"
                          >
                            Complete
                          </button>
                          <button
                            onClick={() => openActionModal('FAIL', plan)}
                            className="px-2.5 py-1 text-xs font-semibold rounded bg-rose-700 hover:bg-rose-600 text-white transition"
                          >
                            Mark Failed
                          </button>
                        </>
                      )}

                      {(plan.status === 'COMPLETED' || plan.status === 'FAILED' || plan.status === 'REJECTED' || plan.status === 'CANCELLED') && (
                        <span className="text-[11px] text-slate-500 italic">No further actions</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={closeActionModal}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-xs font-bold rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                Action: {confirmModal.type.replace(/_/g, ' ')}
              </span>
              <span className="text-xs text-slate-400 font-mono">{confirmModal.plan.id}</span>
            </div>

            <h3 className="text-lg font-bold text-white mt-2">
              Confirm {confirmModal.type.replace(/_/g, ' ')}
            </h3>

            {/* Context details */}
            <div className="mt-3 p-3 bg-slate-950/60 rounded-lg border border-slate-800 text-xs text-slate-300 space-y-1">
              <div>
                <span className="text-slate-500">Route: </span>
                <span className="font-semibold text-slate-200">
                  {confirmModal.plan.routeCode} ({confirmModal.plan.routeName})
                </span>
              </div>
              <div>
                <span className="text-slate-500">Action Plan: </span>
                <span className="font-semibold text-slate-200">{confirmModal.plan.title}</span>
              </div>
              <div>
                <span className="text-slate-500">Current Status: </span>
                {getStatusBadge(confirmModal.plan.status)}
              </div>
            </div>

            {/* Warning for REQUEST_EXECUTION */}
            {confirmModal.type === 'REQUEST_EXECUTION' && (
              <div className="mt-3 p-3 bg-cyan-950/30 border border-cyan-800/40 rounded-lg text-xs text-cyan-200 flex items-start gap-2">
                <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-cyan-300">Execution Request Only: </span>
                  This records an execution request in the governed workflow. It does not automatically modify routes, schedules, vehicles, or drivers.
                </div>
              </div>
            )}

            {/* Stale Warning for APPROVE */}
            {confirmModal.type === 'APPROVE' && confirmModal.plan.staleIntelligenceDetected && (
              <div className="mt-3 p-3 bg-amber-950/40 border border-amber-800/50 rounded-lg text-xs text-amber-200 space-y-1">
                <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  Source Intelligence Has Changed
                </div>
                <div className="text-[11px] text-amber-200/90">
                  {confirmModal.plan.staleReasons?.join(' ') || 'Underlying corridor risk or recommendation state has shifted since creation.'}
                </div>
                <label className="flex items-center gap-2 mt-2 pt-2 border-t border-amber-800/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acknowledgeStale}
                    onChange={(e) => setAcknowledgeStale(e.target.checked)}
                    className="rounded bg-slate-900 border-amber-700 text-indigo-600 focus:ring-0"
                  />
                  <span className="text-xs font-semibold text-amber-200">
                    I acknowledge intelligence changes and approve anyway
                  </span>
                </label>
              </div>
            )}

            {/* Form Inputs */}
            <div className="mt-4 space-y-3">
              {(confirmModal.type === 'APPROVE' ||
                confirmModal.type === 'REQUEST_EXECUTION' ||
                confirmModal.type === 'START' ||
                confirmModal.type === 'COMPLETE') && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Administrative Note {confirmModal.type === 'COMPLETE' && <span className="text-rose-400">*</span>}
                  </label>
                  <textarea
                    rows={3}
                    value={modalNote}
                    onChange={(e) => setModalNote(e.target.value)}
                    placeholder="Enter explicit administrative justification..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              {(confirmModal.type === 'REJECT' ||
                confirmModal.type === 'FAIL' ||
                confirmModal.type === 'CANCEL') && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Reason <span className="text-rose-400">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={modalReason}
                    onChange={(e) => setModalReason(e.target.value)}
                    placeholder="Enter required reason..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              {confirmModal.type === 'COMPLETE' && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Execution Result
                  </label>
                  <input
                    type="text"
                    value={modalResult}
                    onChange={(e) => setModalResult(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                onClick={closeActionModal}
                disabled={actionProcessing}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleModalSubmit}
                disabled={
                  actionProcessing ||
                  (confirmModal.type === 'REJECT' && modalReason.trim().length < 3) ||
                  (confirmModal.type === 'FAIL' && modalReason.trim().length < 1)
                }
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition shadow disabled:opacity-50"
              >
                {actionProcessing ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deep-Dive Inspection Drawer (Sections A through J) */}
      {selectedPlanId && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col">
          {/* Drawer Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-xs font-mono font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded">
                  {selectedPlanId}
                </span>
                <span className="text-xs text-slate-400">Deep-Dive Inspection</span>
              </div>
              <h3 className="text-base font-bold text-white mt-1">
                {detailData?.actionPlan?.title || 'Operational Action Plan'}
              </h3>
            </div>
            <button
              onClick={closeDetailDrawer}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Tabs (Sections A-J) */}
          <div className="flex overflow-x-auto border-b border-slate-800 bg-slate-900/90 text-xs px-2 py-1.5 gap-1 shrink-0">
            {[
              { id: 'A', label: 'Summary' },
              { id: 'B', label: 'Recommendation' },
              { id: 'C', label: 'Snapshot' },
              { id: 'D', label: 'Current' },
              { id: 'E', label: 'Deltas' },
              { id: 'F', label: 'Approval' },
              { id: 'G', label: 'Execution' },
              { id: 'H', label: 'Audit' },
              { id: 'I', label: 'Evidence' },
              { id: 'J', label: 'Governance' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setDetailTab(tab.id)}
                className={`px-3 py-1.5 rounded font-medium whitespace-nowrap transition ${
                  detailTab === tab.id
                    ? 'bg-indigo-600 text-white font-semibold shadow'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {tab.id}. {tab.label}
              </button>
            ))}
          </div>

          {/* Drawer Content */}
          <div className="p-6 overflow-y-auto flex-1 space-y-4">
            {loadingDetail ? (
              <div className="py-12 text-center text-slate-400">
                <RotateCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                Aggregating deep-dive action evidence...
              </div>
            ) : !detailData ? (
              <div className="py-12 text-center text-slate-400">
                Failed to load action plan details.
              </div>
            ) : (
              <>
                {/* SECTION A: Action Summary */}
                {detailTab === 'A' && (
                  <div className="space-y-4 text-xs">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-slate-950/60 rounded border border-slate-800">
                        <span className="text-slate-500 block">Status:</span>
                        <div className="mt-1">{getStatusBadge(detailData.actionPlan.status)}</div>
                      </div>
                      <div className="p-3 bg-slate-950/60 rounded border border-slate-800">
                        <span className="text-slate-500 block">Priority:</span>
                        <div className="mt-1">{getPriorityBadge(detailData.actionPlan.priority)}</div>
                      </div>
                      <div className="p-3 bg-slate-950/60 rounded border border-slate-800">
                        <span className="text-slate-500 block">Action Type:</span>
                        <div className="font-mono text-slate-200 mt-1">{detailData.actionPlan.actionType}</div>
                      </div>
                      <div className="p-3 bg-slate-950/60 rounded border border-slate-800">
                        <span className="text-slate-500 block">Corridor:</span>
                        <div className="text-slate-200 mt-1 font-semibold">
                          {detailData.actionPlan.routeCode} ({detailData.actionPlan.routeName})
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-950/60 rounded border border-slate-800">
                      <span className="text-slate-500 block">Description:</span>
                      <p className="text-slate-300 mt-1 leading-relaxed">{detailData.actionPlan.description}</p>
                    </div>

                    <div className="p-3 bg-slate-950/60 rounded border border-slate-800 space-y-1">
                      <div>
                        <span className="text-slate-500">Created: </span>
                        <span className="text-slate-200">{new Date(detailData.actionPlan.createdAt).toLocaleString()}</span>
                        {detailData.actionPlan.requestedByUserName && (
                          <span className="text-slate-400"> by {detailData.actionPlan.requestedByUserName}</span>
                        )}
                      </div>
                      <div>
                        <span className="text-slate-500">Correlation ID: </span>
                        <span className="font-mono text-slate-300">{detailData.actionPlan.correlationId}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* SECTION B: Originating Recommendation */}
                {detailTab === 'B' && (
                  <div className="space-y-3 text-xs">
                    <div className="p-4 bg-slate-950/60 rounded border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-indigo-400 font-semibold">
                          {detailData.actionPlan.recommendationId}
                        </span>
                        {getPriorityBadge(detailData.staleIntelligence?.snapshot?.recommendation?.priority || 'MEDIUM')}
                      </div>
                      <h4 className="text-sm font-bold text-white">
                        {detailData.staleIntelligence?.snapshot?.recommendation?.title || 'Originating Recommendation'}
                      </h4>
                      <p className="text-slate-300 leading-relaxed">
                        {detailData.staleIntelligence?.snapshot?.recommendation?.rationale || 'Recommendation rationale.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* SECTION C: Intelligence Snapshot */}
                {detailTab === 'C' && (
                  <div className="space-y-3 text-xs">
                    <div className="p-3 bg-slate-950/60 rounded border border-slate-800">
                      <span className="text-slate-500 block">Snapshot Captured At:</span>
                      <span className="text-slate-200">
                        {detailData.staleIntelligence?.snapshot?.capturedAt
                          ? new Date(detailData.staleIntelligence.snapshot.capturedAt).toLocaleString()
                          : 'N/A'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-slate-950/60 rounded border border-slate-800">
                        <span className="text-slate-500">Risk Score at Creation:</span>
                        <div className="text-lg font-bold text-slate-200 mt-1">
                          {detailData.staleIntelligence?.snapshot?.riskSnapshot?.score ?? 'N/A'}
                        </div>
                      </div>
                      <div className="p-3 bg-slate-950/60 rounded border border-slate-800">
                        <span className="text-slate-500">Operational Status:</span>
                        <div className="font-bold text-slate-200 mt-1">
                          {detailData.staleIntelligence?.snapshot?.decisionSupport?.operationalStatus ?? 'N/A'}
                        </div>
                      </div>
                      <div className="p-3 bg-slate-950/60 rounded border border-slate-800">
                        <span className="text-slate-500">Active Alerts:</span>
                        <div className="text-slate-200 font-semibold mt-1">
                          {detailData.staleIntelligence?.snapshot?.alerts?.active ?? 0} (Critical: {detailData.staleIntelligence?.snapshot?.alerts?.critical ?? 0})
                        </div>
                      </div>
                      <div className="p-3 bg-slate-950/60 rounded border border-slate-800">
                        <span className="text-slate-500">Occupancy:</span>
                        <div className="text-slate-200 font-semibold mt-1">
                          {detailData.staleIntelligence?.snapshot?.demand?.projectedOccupancy !== null
                            ? `${detailData.staleIntelligence?.snapshot?.demand?.projectedOccupancy}%`
                            : 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* SECTION D: Current Intelligence */}
                {detailTab === 'D' && (
                  <div className="space-y-3 text-xs">
                    <div className="p-3 bg-slate-950/60 rounded border border-slate-800">
                      <span className="text-slate-500 block">Current Authoritative State:</span>
                      <div className="grid grid-cols-2 gap-3 mt-2">
                        <div>
                          <span className="text-slate-400">Current Risk Score: </span>
                          <span className="font-bold text-white">{detailData.staleIntelligence?.current?.riskScore ?? 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Current Status: </span>
                          <span className="font-bold text-white">{detailData.staleIntelligence?.current?.operationalStatus ?? 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Critical Alerts: </span>
                          <span className="font-bold text-white">{detailData.staleIntelligence?.current?.criticalAlerts ?? 0}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Recommendation Status: </span>
                          <span className="font-bold text-white">{detailData.staleIntelligence?.current?.recommendationStatus ?? 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* SECTION E: Change Detection */}
                {detailTab === 'E' && (
                  <div className="space-y-3 text-xs">
                    {detailData.staleIntelligence?.isStale ? (
                      <div className="p-4 bg-amber-950/40 rounded border border-amber-800/50 space-y-2">
                        <div className="font-bold text-amber-300 flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-amber-400" /> Changes Detected
                        </div>
                        <ul className="list-disc pl-5 text-amber-200/90 space-y-1">
                          {detailData.staleIntelligence.reasons.map((r: string, idx: number) => (
                            <li key={idx}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <div className="p-4 bg-emerald-950/40 rounded border border-emerald-800/50 text-emerald-300 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        <div>
                          <div className="font-bold">Intelligence Fully Consistent</div>
                          <div className="text-[11px] text-emerald-400/80">
                            Current corridor conditions match original action plan evidence snapshot.
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* SECTION F: Approval History */}
                {detailTab === 'F' && (
                  <div className="space-y-3 text-xs">
                    <div className="p-3 bg-slate-950/60 rounded border border-slate-800 space-y-2">
                      <div>
                        <span className="text-slate-500">Approved By: </span>
                        <span className="text-slate-200 font-semibold">{detailData.actionPlan.approvedByUserName || 'Pending'}</span>
                      </div>
                      {detailData.actionPlan.approvedAt && (
                        <div>
                          <span className="text-slate-500">Approved At: </span>
                          <span className="text-slate-200">{new Date(detailData.actionPlan.approvedAt).toLocaleString()}</span>
                        </div>
                      )}
                      {detailData.actionPlan.approvalNote && (
                        <div>
                          <span className="text-slate-500">Approval Note: </span>
                          <p className="text-slate-300 mt-0.5">{detailData.actionPlan.approvalNote}</p>
                        </div>
                      )}
                      {detailData.actionPlan.rejectionReason && (
                        <div className="pt-2 border-t border-slate-800 text-rose-300">
                          <span className="font-bold">Rejection Reason: </span>
                          <p className="mt-0.5">{detailData.actionPlan.rejectionReason}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* SECTION G: Execution History */}
                {detailTab === 'G' && (
                  <div className="space-y-3 text-xs">
                    <div className="p-3 bg-slate-950/60 rounded border border-slate-800 space-y-2">
                      <div>
                        <span className="text-slate-500">Executed By: </span>
                        <span className="text-slate-200 font-semibold">{detailData.actionPlan.executedByUserName || 'N/A'}</span>
                      </div>
                      {detailData.actionPlan.executionStartedAt && (
                        <div>
                          <span className="text-slate-500">Started At: </span>
                          <span className="text-slate-200">{new Date(detailData.actionPlan.executionStartedAt).toLocaleString()}</span>
                        </div>
                      )}
                      {detailData.actionPlan.completedAt && (
                        <div>
                          <span className="text-slate-500">Completed At: </span>
                          <span className="text-slate-200">{new Date(detailData.actionPlan.completedAt).toLocaleString()}</span>
                        </div>
                      )}
                      {detailData.actionPlan.executionResult && (
                        <div>
                          <span className="text-slate-500">Result: </span>
                          <span className="font-mono text-emerald-400">{detailData.actionPlan.executionResult}</span>
                        </div>
                      )}
                      {detailData.actionPlan.failureReason && (
                        <div className="text-rose-400">
                          <span className="font-bold">Failure Reason: </span>
                          <span>{detailData.actionPlan.failureReason}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* SECTION H: Audit Events */}
                {detailTab === 'H' && (
                  <div className="space-y-2 text-xs">
                    {detailData.auditEvents?.length === 0 ? (
                      <div className="text-slate-500 text-center py-4">No audit events recorded yet.</div>
                    ) : (
                      detailData.auditEvents.map((evt: any) => (
                        <div key={evt.id} className="p-2.5 bg-slate-950/60 rounded border border-slate-800 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[11px] text-indigo-400 font-semibold">{evt.eventType}</span>
                            <span className="text-[10px] text-slate-500">{new Date(evt.createdAt).toLocaleTimeString()}</span>
                          </div>
                          <p className="text-slate-300 text-[11px]">{evt.description}</p>
                          <div className="text-[10px] text-slate-500 font-mono">Actor: {evt.actorName || evt.actorUserId}</div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* SECTION I: Evidence */}
                {detailTab === 'I' && (
                  <div className="text-xs">
                    <pre className="p-3 bg-slate-950 rounded border border-slate-800 text-slate-300 font-mono text-[11px] overflow-x-auto max-h-96">
                      {JSON.stringify(detailData.actionPlan.evidence, null, 2)}
                    </pre>
                  </div>
                )}

                {/* SECTION J: Governance Warnings */}
                {detailTab === 'J' && (
                  <div className="space-y-3 text-xs">
                    <div className="p-3 bg-slate-950/60 rounded border border-slate-800 space-y-1">
                      <div className="text-slate-400">Compliance Status:</div>
                      <div className="text-emerald-400 font-semibold">
                        {detailData.staleIntelligence?.snapshot?.governance?.complianceStatus || 'COMPLIANT'} (Score: {detailData.staleIntelligence?.snapshot?.governance?.complianceScore || 100})
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
