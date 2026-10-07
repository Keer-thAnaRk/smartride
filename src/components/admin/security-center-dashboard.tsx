'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  Key,
  AlertTriangle,
  Users,
  Search,
  RefreshCw,
  Clock,
  Download,
  Filter,
  CheckCircle2,
  XCircle,
  Eye,
  Sliders,
  Sparkles,
  Info,
  ChevronRight,
  X,
  FileDown,
  Activity,
  Terminal,
} from 'lucide-react';

interface SecuritySummary {
  posture: {
    score: number;
    statusLevel: 'SECURE' | 'MONITOR' | 'ELEVATED' | 'CRITICAL';
    badgeLabel: string;
    themeColor: 'emerald' | 'amber' | 'orange' | 'rose';
    unresolvedCounts: {
      critical: number;
      high: number;
      medium: number;
      low: number;
      total: number;
    };
    factorBreakdown: {
      authenticationPenalties: number;
      authorizationPenalties: number;
      incidentPenalties: number;
      anomalyPenalties: number;
    };
  };
  kpis: {
    failedLoginAttempts: number;
    failedOtpAttempts: number;
    suspiciousSessions: number;
    routeAnomalies: number;
    unauthorizedApiAttempts: number;
    totalEventsRecorded: number;
    openIncidentsCount: number;
  };
  severityDistribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  recentTimeline: any[];
}

export default function SecurityCenterDashboard() {
  const [summary, setSummary] = useState<SecuritySummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Filter state for audit logs
  const [events, setEvents] = useState<any[]>([]);
  const [selectedSeverity, setSelectedSeverity] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingEvents, setLoadingEvents] = useState(false);

  // Selected incident modal
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [resolving, setResolving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadSummary = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/admin/security');
      if (res.data?.success) {
        setSummary(res.data);
      }
    } catch (err) {
      console.error('Failed to load security summary:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async () => {
    try {
      setLoadingEvents(true);
      const params = new URLSearchParams();
      if (selectedSeverity !== 'ALL') params.append('severity', selectedSeverity);
      if (selectedType !== 'ALL') params.append('eventType', selectedType);
      if (selectedStatus !== 'ALL') params.append('status', selectedStatus);
      if (searchTerm) params.append('search', searchTerm);

      const res = await axios.get(`/api/admin/security/events?${params.toString()}`);
      if (res.data?.success) {
        setEvents(res.data.events);
      }
    } catch (err) {
      console.error('Failed to load security events:', err);
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => {
    loadSummary();
    loadEvents();
  }, [selectedSeverity, selectedType, selectedStatus]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadEvents();
  };

  const handleResolveEvent = async (status: 'INVESTIGATING' | 'RESOLVED' | 'DISMISSED') => {
    if (!selectedEvent) return;
    try {
      setResolving(true);
      const res = await axios.post(`/api/admin/security/events/${selectedEvent.id}/resolve`, {
        status,
        resolutionNote: resolutionNote.trim() || 'Resolved via Security Center console.',
      });

      if (res.data?.success) {
        setToast({ type: 'success', message: `Event updated to ${status}` });
        setSelectedEvent(null);
        setResolutionNote('');
        loadSummary();
        loadEvents();
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err: any) {
      setToast({ type: 'error', message: err.response?.data?.error || 'Failed to update event' });
    } finally {
      setResolving(false);
    }
  };

  const handleExport = (format: 'json' | 'csv') => {
    window.open(`/api/admin/security/export?format=${format}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between text-xs font-bold border transition ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Header with Security Posture Dial */}
      <div className="bg-slate-950 rounded-3xl p-6 sm:p-7 text-white border border-slate-800 shadow-xl relative overflow-hidden space-y-6">
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-400 flex items-center justify-center font-black">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    SmartRide Security Center
                  </h1>
                  <span className="text-[10px] font-black uppercase tracking-wider bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded-full border border-slate-700">
                    SOC v1.0
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Real-time authentication monitoring, RBAC enforcement & telemetry incident triage
                </p>
              </div>
            </div>
          </div>

          {/* Posture Status Badge & Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-3 px-4 py-2.5 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="space-y-0.5 text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Security Posture
                </span>
                <span className="font-mono text-xl font-black text-white">
                  {summary?.posture.score ?? 100} / 100
                </span>
              </div>
              <span
                className={`px-3 py-1.5 rounded-xl text-xs font-black tracking-wide ${
                  summary?.posture.statusLevel === 'CRITICAL'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : summary?.posture.statusLevel === 'ELEVATED'
                    ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                    : summary?.posture.statusLevel === 'MONITOR'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}
              >
                {summary?.posture.badgeLabel || '🟢 SECURE'}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleExport('json')}
                className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold transition flex items-center space-x-1"
                title="Export JSON"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">JSON</span>
              </button>
              <button
                onClick={() => handleExport('csv')}
                className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold transition flex items-center space-x-1"
                title="Export CSV"
              >
                <FileDown className="w-4 h-4" />
                <span className="hidden sm:inline">CSV</span>
              </button>
              <button
                onClick={() => {
                  loadSummary();
                  loadEvents();
                }}
                disabled={loading}
                className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-50"
                title="Refresh Metrics"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* 5 Dynamic Security KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
          {/* KPI 1 */}
          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Key className="w-3.5 h-3.5 text-indigo-400" />
              Failed Logins
            </span>
            <div className="mt-2">
              <span className="text-2xl sm:text-3xl font-black text-white font-mono">
                {summary?.kpis.failedLoginAttempts ?? 0}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1">auth denials</span>
          </div>

          {/* KPI 2 */}
          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              Failed OTPs
            </span>
            <div className="mt-2">
              <span className="text-2xl sm:text-3xl font-black text-white font-mono">
                {summary?.kpis.failedOtpAttempts ?? 0}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1">code attempts</span>
          </div>

          {/* KPI 3 */}
          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
              Suspicious Sessions
            </span>
            <div className="mt-2">
              <span className="text-2xl sm:text-3xl font-black text-white font-mono">
                {summary?.kpis.suspiciousSessions ?? 0}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1">probes flagged</span>
          </div>

          {/* KPI 4 */}
          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-rose-400" />
              Route Anomalies
            </span>
            <div className="mt-2">
              <span className="text-2xl sm:text-3xl font-black text-white font-mono">
                {summary?.kpis.routeAnomalies ?? 0}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1">corridor alerts</span>
          </div>

          {/* KPI 5 */}
          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between col-span-2 sm:col-span-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
              API Denials
            </span>
            <div className="mt-2">
              <span className="text-2xl sm:text-3xl font-black text-white font-mono">
                {summary?.kpis.unauthorizedApiAttempts ?? 0}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1">401/403 attempts</span>
          </div>
        </div>
      </div>

      {/* 2-Column Section: Real-time Timeline & Severity Mix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Real-time Security Timeline */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">Live Security Event Timeline</h3>
            </div>
            <span className="text-[11px] text-slate-400">Chronological activity</span>
          </div>

          {summary?.recentTimeline && summary.recentTimeline.length > 0 ? (
            <div className="space-y-3">
              {summary.recentTimeline.map((evt) => (
                <div
                  key={evt.id}
                  onClick={() => setSelectedEvent(evt)}
                  className="p-3.5 rounded-2xl border border-slate-200/80 hover:border-indigo-300 bg-slate-50/50 hover:bg-indigo-50/30 transition cursor-pointer flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          evt.severity === 'CRITICAL'
                            ? 'bg-rose-500 animate-ping'
                            : evt.severity === 'HIGH'
                            ? 'bg-rose-500'
                            : evt.severity === 'MEDIUM'
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                      />
                      <span className="font-bold text-xs text-slate-900">{evt.eventType}</span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md ${
                          evt.severity === 'CRITICAL'
                            ? 'bg-rose-100 text-rose-800'
                            : evt.severity === 'HIGH'
                            ? 'bg-orange-100 text-orange-800'
                            : evt.severity === 'MEDIUM'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {evt.severity}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {evt.action} • Actor: {evt.actorRole} • Resource: {evt.resourceType}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">
                      {new Date(evt.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span
                      className={`text-[9px] font-bold uppercase ${
                        evt.status === 'RESOLVED' ? 'text-emerald-600' : 'text-amber-600'
                      }`}
                    >
                      {evt.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-slate-400">
              No recent security events recorded.
            </div>
          )}
        </div>

        {/* Educational Cybersecurity Controls Panel */}
        <div className="bg-slate-50 rounded-3xl p-6 border border-slate-200 space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-200 pb-3">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">Implemented Controls</h3>
          </div>

          <div className="space-y-2 text-xs">
            {[
              { name: 'Authentication & bcryptjs Hashing', status: 'ACTIVE' },
              { name: 'JWT Session Token Verification', status: 'ACTIVE' },
              { name: 'Role-Based Access Control (RBAC)', status: 'ACTIVE' },
              { name: 'Passenger Ride Start OTP Security', status: 'ACTIVE' },
              { name: 'Append-Only Security Audit Trail', status: 'ACTIVE' },
              { name: 'Corridor Route Anomaly Detection', status: 'ACTIVE' },
              { name: 'Brute-Force & Guessing Protections', status: 'ACTIVE' },
              { name: 'Sliding-Window Rate Limiting Utility', status: 'ACTIVE' },
              { name: 'SIEM-Style Structured Export (JSON/CSV)', status: 'ACTIVE' },
            ].map((ctrl, i) => (
              <div
                key={i}
                className="p-2.5 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between"
              >
                <span className="text-slate-800 font-medium text-[11px]">{ctrl.name}</span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  {ctrl.status}
                </span>
              </div>
            ))}
          </div>

          <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-900 text-[11px] leading-relaxed">
            <strong>Security Invariant:</strong> Normal admin interfaces contain zero edit or delete buttons for security logs to preserve evidentiary integrity.
          </div>
        </div>
      </div>

      {/* Filterable Audit Log Table */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Security Audit Log</h3>
            <p className="text-xs text-slate-500">Searchable and filterable append-only security records</p>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="INVESTIGATING">Investigating</option>
              <option value="RESOLVED">Resolved</option>
              <option value="DISMISSED">Dismissed</option>
            </select>

            <form onSubmit={handleSearch} className="relative">
              <input
                type="text"
                placeholder="Search action or user..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 w-44 sm:w-56"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </form>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Event Type</th>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Result</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loadingEvents ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Loading security records...
                  </td>
                </tr>
              ) : events.length > 0 ? (
                events.map((evt) => (
                  <tr key={evt.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(evt.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">{evt.eventType}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          evt.severity === 'CRITICAL'
                            ? 'bg-rose-100 text-rose-800'
                            : evt.severity === 'HIGH'
                            ? 'bg-orange-100 text-orange-800'
                            : evt.severity === 'MEDIUM'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {evt.severity}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-semibold">{evt.actorRole || 'GUEST'}</td>
                    <td className="py-3 px-4 text-slate-700 max-w-xs truncate">{evt.action}</td>
                    <td className="py-3 px-4 font-bold">
                      <span
                        className={
                          evt.result === 'SUCCESS'
                            ? 'text-emerald-600'
                            : evt.result === 'DENIED' || evt.result === 'FAILED'
                            ? 'text-rose-600'
                            : 'text-amber-600'
                        }
                      >
                        {evt.result}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          evt.status === 'RESOLVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : evt.status === 'INVESTIGATING'
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {evt.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedEvent(evt)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No security events found matching the criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Incident Detail & Resolution Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-slate-200 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Security Incident Triage</h3>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Event Type</span>
                  <span className="font-bold text-slate-900 text-xs mt-1 block">{selectedEvent.eventType}</span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Severity</span>
                  <span className="font-bold text-xs mt-1 block text-rose-600">{selectedEvent.severity}</span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Action Details</span>
                <p className="text-slate-700 leading-snug">{selectedEvent.action}</p>
                <div className="text-[11px] text-slate-400 pt-1">
                  Actor: <strong>{selectedEvent.actorRole}</strong> ({selectedEvent.actorUserId || 'Anonymous'}) • IP: {selectedEvent.ipAddress}
                </div>
              </div>

              {selectedEvent.metadata && Object.keys(selectedEvent.metadata).length > 0 && (
                <div className="p-3 rounded-2xl bg-slate-900 text-slate-200 font-mono text-[11px] space-y-1 overflow-x-auto">
                  <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">Sanitized Metadata</span>
                  <pre>{JSON.stringify(selectedEvent.metadata, null, 2)}</pre>
                </div>
              )}

              {/* Resolution Note Input */}
              <div className="space-y-1.5 pt-1">
                <label className="font-bold text-slate-700">Triage Note / Resolution Justification</label>
                <textarea
                  rows={2}
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="Document actions taken or verification summary..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => handleResolveEvent('INVESTIGATING')}
                  disabled={resolving}
                  className="px-3 py-2 rounded-xl border border-indigo-200 text-indigo-700 font-bold hover:bg-indigo-50 transition"
                >
                  Mark Investigating
                </button>
                <button
                  type="button"
                  onClick={() => handleResolveEvent('RESOLVED')}
                  disabled={resolving}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition shadow-xs disabled:opacity-50"
                >
                  Resolve Incident
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
