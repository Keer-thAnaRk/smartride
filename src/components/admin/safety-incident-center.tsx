'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  ShieldAlert,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  UserCheck,
  Search,
  Filter,
  RefreshCw,
  Eye,
  MessageSquare,
  FileText,
  User,
  Activity,
  ArrowRight,
  ShieldCheck,
  FolderOpen,
  RotateCcw,
  Check,
} from 'lucide-react';

interface IncidentActivity {
  id: string;
  caseId: string;
  actionType: string;
  message: string;
  metadataJson: string | null;
  performedBy: string;
  createdAt: string;
}

interface IncidentCase {
  id: string;
  alertId: string;
  routeId: string;
  routeCode: string;
  routeName: string;
  title: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'OPEN' | 'ACKNOWLEDGED' | 'INVESTIGATING' | 'MITIGATED' | 'RESOLVED' | 'CLOSED';
  assignedAdminId: string | null;
  assignedAdminName?: string | null;
  createdByAdminId: string;
  currentRiskScore: number;
  previousRiskScore: number | null;
  scoreDelta: number | null;
  sourceAlertType: string;
  sourceAlertSeverity: string;
  evidenceJson: string;
  evidence?: any;
  resolutionSummary: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
  activities?: IncidentActivity[];
}

interface IncidentSummary {
  total: number;
  open: number;
  acknowledged: number;
  investigating: number;
  mitigated: number;
  resolved: number;
  closed: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export default function SafetyIncidentCenter() {
  const [incidents, setIncidents] = useState<IncidentCase[]>([]);
  const [summary, setSummary] = useState<IncidentSummary>({
    total: 0,
    open: 0,
    acknowledged: 0,
    investigating: 0,
    mitigated: 0,
    resolved: 0,
    closed: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected incident for detail view
  const [selectedIncident, setSelectedIncident] = useState<IncidentCase | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);

  // Form states for modal actions
  const [actionType, setActionType] = useState<
    'NOTE' | 'ASSIGN' | 'MITIGATE' | 'RESOLVE' | 'CLOSE' | 'REOPEN' | null
  >(null);
  const [actionInput, setActionInput] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string>('');

  useEffect(() => {
    fetchIncidents();
  }, [statusFilter, severityFilter]);

  async function fetchIncidents() {
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (severityFilter !== 'ALL') params.severity = severityFilter;

      const res = await axios.get('/api/safety/incidents', { params });
      if (res.data?.success) {
        setIncidents(res.data.incidents || []);
        if (res.data.summary) {
          setSummary(res.data.summary);
        }
      }
    } catch (err) {
      console.error('Failed to load safety incidents:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await fetchIncidents();
    if (selectedIncident) {
      await loadIncidentDetail(selectedIncident.id);
    }
    setRefreshing(false);
  }

  async function loadIncidentDetail(id: string) {
    setDetailLoading(true);
    setActionError('');
    try {
      const res = await axios.get(`/api/safety/incidents/${id}`);
      if (res.data?.success) {
        setSelectedIncident(res.data.incident);
      }
    } catch (err) {
      console.error('Failed to load incident detail:', err);
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleAcknowledge(id: string) {
    setActionLoading(true);
    setActionError('');
    try {
      const res = await axios.post(`/api/safety/incidents/${id}/acknowledge`);
      if (res.data?.success) {
        await loadIncidentDetail(id);
        await fetchIncidents();
      }
    } catch (err: any) {
      setActionError(err.response?.data?.error || 'Failed to acknowledge incident');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStartInvestigation(id: string) {
    setActionLoading(true);
    setActionError('');
    try {
      const res = await axios.post(`/api/safety/incidents/${id}/investigate`);
      if (res.data?.success) {
        await loadIncidentDetail(id);
        await fetchIncidents();
      }
    } catch (err: any) {
      setActionError(err.response?.data?.error || 'Failed to start investigation');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleModalSubmit() {
    if (!selectedIncident || !actionType) return;
    setActionLoading(true);
    setActionError('');

    try {
      const id = selectedIncident.id;
      let endpoint = '';
      let payload: any = {};

      switch (actionType) {
        case 'ASSIGN':
          endpoint = `/api/safety/incidents/${id}/assign`;
          payload = { adminId: actionInput.trim() };
          break;
        case 'NOTE':
          endpoint = `/api/safety/incidents/${id}/notes`;
          payload = { message: actionInput.trim() };
          break;
        case 'MITIGATE':
          endpoint = `/api/safety/incidents/${id}/mitigate`;
          payload = { summary: actionInput.trim() };
          break;
        case 'RESOLVE':
          endpoint = `/api/safety/incidents/${id}/resolve`;
          payload = { summary: actionInput.trim() };
          break;
        case 'CLOSE':
          endpoint = `/api/safety/incidents/${id}/close`;
          payload = { summary: actionInput.trim() };
          break;
        case 'REOPEN':
          endpoint = `/api/safety/incidents/${id}/reopen`;
          payload = { reason: actionInput.trim() };
          break;
      }

      const res = await axios.post(endpoint, payload);
      if (res.data?.success) {
        setActionType(null);
        setActionInput('');
        await loadIncidentDetail(id);
        await fetchIncidents();
      }
    } catch (err: any) {
      setActionError(err.response?.data?.error || 'Action failed to execute');
    } finally {
      setActionLoading(false);
    }
  }

  const filteredIncidents = incidents.filter((inc) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      inc.id.toLowerCase().includes(q) ||
      inc.routeCode.toLowerCase().includes(q) ||
      inc.routeName.toLowerCase().includes(q) ||
      inc.sourceAlertType.toLowerCase().includes(q) ||
      inc.title.toLowerCase().includes(q)
    );
  });

  function getSeverityBadge(severity: string) {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      case 'HIGH':
        return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
      case 'MEDIUM':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      default:
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'OPEN':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'ACKNOWLEDGED':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'INVESTIGATING':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      case 'MITIGATED':
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40';
      case 'RESOLVED':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'CLOSED':
        return 'bg-slate-700/50 text-slate-400 border-slate-600/40';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  }

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-800/80 bg-slate-950/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white tracking-tight">
                Safety Incident & Operational Case Management
              </h2>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30">
                Phase 3 · Step 4
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Traceable operational response cases converted from SafetyAlerts with assignment, lifecycle workflows, and immutable audit history.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh Cases</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="p-6 border-b border-slate-800/60 bg-slate-950/20 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Total Cases
          </div>
          <div className="mt-1 text-2xl font-bold text-white">{summary.total}</div>
        </div>
        <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-900/40">
          <div className="text-[10px] font-semibold text-rose-300 uppercase tracking-wider">
            Open Cases
          </div>
          <div className="mt-1 text-2xl font-bold text-rose-400">{summary.open}</div>
        </div>
        <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-900/40">
          <div className="text-[10px] font-semibold text-amber-300 uppercase tracking-wider">
            Acknowledged
          </div>
          <div className="mt-1 text-2xl font-bold text-amber-400">{summary.acknowledged}</div>
        </div>
        <div className="p-3 rounded-xl bg-blue-950/20 border border-blue-900/40">
          <div className="text-[10px] font-semibold text-blue-300 uppercase tracking-wider">
            Investigating
          </div>
          <div className="mt-1 text-2xl font-bold text-blue-400">{summary.investigating}</div>
        </div>
        <div className="p-3 rounded-xl bg-indigo-950/20 border border-indigo-900/40">
          <div className="text-[10px] font-semibold text-indigo-300 uppercase tracking-wider">
            Mitigated
          </div>
          <div className="mt-1 text-2xl font-bold text-indigo-400">{summary.mitigated}</div>
        </div>
        <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-900/40">
          <div className="text-[10px] font-semibold text-emerald-300 uppercase tracking-wider">
            Resolved
          </div>
          <div className="mt-1 text-2xl font-bold text-emerald-400">{summary.resolved}</div>
        </div>
        <div className="p-3 rounded-xl bg-slate-800/20 border border-slate-700/40">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Closed
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-300">{summary.closed}</div>
        </div>
      </div>

      {/* Filters & Search Row */}
      <div className="p-6 border-b border-slate-800/60 bg-slate-900/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {['ALL', 'OPEN', 'ACKNOWLEDGED', 'INVESTIGATING', 'MITIGATED', 'RESOLVED', 'CLOSED'].map(
            (st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  statusFilter === st
                    ? 'bg-indigo-600 text-white shadow'
                    : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                {st}
              </button>
            )
          )}
        </div>

        {/* Severity Filter & Search Input */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-slate-800 text-slate-300 text-xs rounded-xl px-3 py-1.5 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search case, route, alert..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-800 text-slate-200 text-xs rounded-xl pl-9 pr-3 py-1.5 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48 sm:w-64"
            />
          </div>
        </div>
      </div>

      {/* Main Content Area: Cases Table / List */}
      <div className="p-6">
        {loading ? (
          <div className="py-16 text-center">
            <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-400">Loading operational incident cases...</p>
          </div>
        ) : filteredIncidents.length === 0 ? (
          <div className="py-16 text-center rounded-2xl border border-dashed border-slate-800 p-8">
            <FolderOpen className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-300">No Incident Cases Found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              No operational incident cases match the selected status and severity filters. When an active safety alert requires action, operations admins can open a case.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Case ID</th>
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3">Source Alert</th>
                  <th className="px-4 py-3">Route Corridor</th>
                  <th className="px-4 py-3">Risk Impact</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Assigned Admin</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 bg-slate-900/50">
                {filteredIncidents.map((inc) => (
                  <tr
                    key={inc.id}
                    className="hover:bg-slate-800/50 transition cursor-pointer"
                    onClick={() => loadIncidentDetail(inc.id)}
                  >
                    <td className="px-4 py-3 font-mono font-medium text-indigo-300">
                      {inc.id.length > 14 ? `${inc.id.substring(0, 14)}...` : inc.id}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${getSeverityBadge(
                          inc.severity
                        )}`}
                      >
                        {inc.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-white truncate max-w-[180px]" title={inc.title}>
                        {inc.sourceAlertType}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {inc.alertId.substring(0, 10)}...
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-200">{inc.routeCode}</div>
                      <div className="text-[10px] text-slate-400 truncate max-w-[150px]">{inc.routeName}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-white">{inc.currentRiskScore} pt</span>
                      {inc.scoreDelta !== null && inc.scoreDelta !== 0 && (
                        <span
                          className={`ml-1.5 text-[10px] font-mono font-bold ${
                            inc.scoreDelta > 0 ? 'text-rose-400' : 'text-emerald-400'
                          }`}
                        >
                          {inc.scoreDelta > 0 ? `+${inc.scoreDelta}` : inc.scoreDelta}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadge(
                          inc.status
                        )}`}
                      >
                        {inc.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {inc.assignedAdminId ? (
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                          <span className="truncate max-w-[120px]">
                            {inc.assignedAdminName || inc.assignedAdminId.substring(0, 8)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-[11px]">
                      {new Date(inc.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          loadIncidentDetail(inc.id);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white transition text-[11px] font-semibold"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Case Detail Modal View */}
      {selectedIncident && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 bg-slate-950 flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white">{selectedIncident.title}</h3>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getSeverityBadge(
                        selectedIncident.severity
                      )}`}
                    >
                      {selectedIncident.severity}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadge(
                        selectedIncident.status
                      )}`}
                    >
                      {selectedIncident.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Case ID: {selectedIncident.id} · Route: {selectedIncident.routeCode} ({selectedIncident.routeName})
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedIncident(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 flex-1">
              {actionError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                  {actionError}
                </div>
              )}

              {/* Action Controls Bar */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center gap-2.5">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1">
                  Operational Actions:
                </span>

                {selectedIncident.status === 'OPEN' && (
                  <button
                    onClick={() => handleAcknowledge(selectedIncident.id)}
                    disabled={actionLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Acknowledge Case</span>
                  </button>
                )}

                {['OPEN', 'ACKNOWLEDGED'].includes(selectedIncident.status) && (
                  <button
                    onClick={() => handleStartInvestigation(selectedIncident.id)}
                    disabled={actionLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow"
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>Start Investigation</span>
                  </button>
                )}

                {selectedIncident.status !== 'CLOSED' && (
                  <button
                    onClick={() => {
                      setActionType('ASSIGN');
                      setActionInput(selectedIncident.assignedAdminId || '');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{selectedIncident.assignedAdminId ? 'Reassign' : 'Assign Admin'}</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setActionType('NOTE');
                    setActionInput('');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Add Note</span>
                </button>

                {['OPEN', 'ACKNOWLEDGED', 'INVESTIGATING'].includes(selectedIncident.status) && (
                  <button
                    onClick={() => {
                      setActionType('MITIGATE');
                      setActionInput('');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Record Mitigation</span>
                  </button>
                )}

                {['INVESTIGATING', 'MITIGATED', 'ACKNOWLEDGED'].includes(selectedIncident.status) && (
                  <button
                    onClick={() => {
                      setActionType('RESOLVE');
                      setActionInput('');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Resolve Case</span>
                  </button>
                )}

                {['RESOLVED', 'MITIGATED'].includes(selectedIncident.status) && (
                  <button
                    onClick={() => {
                      setActionType('CLOSE');
                      setActionInput('');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold shadow"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Close Case</span>
                  </button>
                )}

                {['RESOLVED', 'CLOSED'].includes(selectedIncident.status) && (
                  <button
                    onClick={() => {
                      setActionType('REOPEN');
                      setActionInput('');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-600 text-white text-xs font-semibold shadow"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reopen Case</span>
                  </button>
                )}
              </div>

              {/* Action Form Expansion */}
              {actionType && (
                <div className="p-4 rounded-xl bg-slate-800/80 border border-indigo-500/40 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-white">
                    <span>
                      {actionType === 'ASSIGN' && 'Assign Operational Case'}
                      {actionType === 'NOTE' && 'Add Investigation Note'}
                      {actionType === 'MITIGATE' && 'Record Operational Mitigation'}
                      {actionType === 'RESOLVE' && 'Resolve Operational Case'}
                      {actionType === 'CLOSE' && 'Close Operational Case'}
                      {actionType === 'REOPEN' && 'Reopen Operational Case'}
                    </span>
                    <button
                      onClick={() => setActionType(null)}
                      className="text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>

                  {actionType === 'ASSIGN' ? (
                    <div>
                      <label className="text-[11px] text-slate-300 block mb-1">
                        Enter Admin User ID:
                      </label>
                      <input
                        type="text"
                        placeholder="Admin User ID (e.g. admin-user-id)"
                        value={actionInput}
                        onChange={(e) => setActionInput(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="text-[11px] text-slate-300 block mb-1">
                        {actionType === 'NOTE' && 'Investigation Observation / Note:'}
                        {actionType === 'MITIGATE' && 'Mitigation Action Summary:'}
                        {actionType === 'RESOLVE' && 'Resolution Justification Summary:'}
                        {actionType === 'CLOSE' && 'Formal Closure Review Note:'}
                        {actionType === 'REOPEN' && 'Reason for Reopening:'}
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Enter detailed operational message..."
                        value={actionInput}
                        onChange={(e) => setActionInput(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setActionType(null)}
                      className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 text-xs font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleModalSubmit}
                      disabled={actionLoading || !actionInput.trim()}
                      className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow"
                    >
                      {actionLoading ? 'Executing...' : 'Submit Action'}
                    </button>
                  </div>
                </div>
              )}

              {/* Case Details & Risk Context Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Source Alert Card */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Source Safety Alert
                  </div>
                  <div className="mt-2 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Alert ID:</span>
                      <span className="font-mono text-slate-200">{selectedIncident.alertId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Alert Type:</span>
                      <span className="font-bold text-white">{selectedIncident.sourceAlertType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Alert Severity:</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${getSeverityBadge(
                          selectedIncident.sourceAlertSeverity
                        )}`}
                      >
                        {selectedIncident.sourceAlertSeverity}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-slate-800/80 text-slate-300 leading-relaxed">
                      {selectedIncident.description}
                    </div>
                  </div>
                </div>

                {/* Risk Context Card */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Corridor Risk Context
                  </div>
                  <div className="mt-2 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Current Risk Score:</span>
                      <span className="font-bold text-white">
                        {selectedIncident.currentRiskScore} / 100
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Previous Score:</span>
                      <span className="text-slate-300">
                        {selectedIncident.previousRiskScore !== null
                          ? `${selectedIncident.previousRiskScore} / 100`
                          : 'Baseline'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Observed Delta:</span>
                      <span
                        className={`font-mono font-bold ${
                          (selectedIncident.scoreDelta || 0) > 0
                            ? 'text-rose-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {selectedIncident.scoreDelta !== null
                          ? selectedIncident.scoreDelta > 0
                            ? `+${selectedIncident.scoreDelta} pts`
                            : `${selectedIncident.scoreDelta} pts`
                          : '0 pts'}
                      </span>
                    </div>
                    {selectedIncident.resolutionSummary && (
                      <div className="pt-2 border-t border-slate-800/80">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block mb-1">
                          Mitigation / Resolution Summary:
                        </span>
                        <p className="text-slate-200 text-xs italic">
                          "{selectedIncident.resolutionSummary}"
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Evidence Section */}
              {selectedIncident.evidence && (
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Server-Derived Alert Evidence
                  </div>
                  <pre className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-cyan-300 overflow-x-auto">
                    {JSON.stringify(selectedIncident.evidence, null, 2)}
                  </pre>
                </div>
              )}

              {/* Operational Activity Timeline */}
              <div>
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  Chronological Operational Audit Trail
                </div>

                <div className="space-y-3 pl-2 border-l-2 border-slate-800">
                  {selectedIncident.activities && selectedIncident.activities.length > 0 ? (
                    selectedIncident.activities.map((act) => (
                      <div key={act.id} className="relative pl-5">
                        <div className="absolute -left-[17px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-500 border-2 border-slate-900" />
                        <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white">{act.actionType}</span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {new Date(act.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-slate-300 text-xs">{act.message}</p>
                          <div className="text-[10px] text-slate-400">
                            Performed by: <span className="font-semibold text-slate-300">{act.performedBy}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-500 italic pl-4">
                      No operational activities recorded yet.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end">
              <button
                onClick={() => setSelectedIncident(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
