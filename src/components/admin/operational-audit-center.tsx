'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  FileText,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Layers,
  Search,
  RefreshCw,
  ChevronRight,
  X,
  Hash,
  User,
  Link as LinkIcon,
  CheckCircle2,
  Calendar,
  Filter,
  Activity,
  AlertCircle,
  HelpCircle,
  Eye,
  SlidersHorizontal,
  Info,
} from 'lucide-react';

interface AuditEvent {
  id: string;
  eventType: string;
  actorUserId: string;
  actorRole: string;
  actorEmail?: string | null;
  actorName?: string | null;
  routeId?: string | null;
  routeCode?: string | null;
  routeName?: string | null;
  resourceType: string;
  resourceId?: string | null;
  action: string;
  description: string;
  previousStateJson?: string | null;
  resultingStateJson?: string | null;
  evidenceJson?: string | null;
  evidence?: Record<string, any>;
  previousState?: Record<string, any> | null;
  resultingState?: Record<string, any> | null;
  sourceModule: string;
  correlationId?: string | null;
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  integrityHash: string;
  previousEventHash?: string | null;
  createdAt: string;
}

interface AuditSummary {
  total: number;
  recommendations: number;
  alerts: number;
  incidents: number;
  decisionSupport: number;
  riskAnalysis: number;
}

export default function OperationalAuditCenter() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [summary, setSummary] = useState<AuditSummary>({
    total: 0,
    recommendations: 0,
    alerts: 0,
    incidents: 0,
    decisionSupport: 0,
    riskAnalysis: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'TABLE' | 'TIMELINE'>('TABLE');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  const fetchAuditEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get('/api/operations/audit?limit=100');
      if (res.data?.success) {
        setEvents(res.data.events || []);
        if (res.data.summary) {
          setSummary(res.data.summary);
        }
      }
    } catch (err: any) {
      console.error('[OperationalAuditCenter] Fetch error:', err);
      setError(err.response?.data?.error || 'Failed to load operational audit events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditEvents();
  }, []);

  const openDrawer = (event: AuditEvent) => {
    setSelectedEvent(event);
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedEvent(null);
  };

  // Filter events based on active category tab and search query
  const filteredEvents = events.filter((ev) => {
    if (activeTab === 'RECOMMENDATIONS') {
      if (ev.sourceModule !== 'RECOMMENDATIONS' && !ev.eventType.startsWith('RECOMMENDATION_')) return false;
    } else if (activeTab === 'SAFETY ALERTS') {
      if (ev.sourceModule !== 'SAFETY_ALERTS' && !ev.eventType.startsWith('SAFETY_ALERT_')) return false;
    } else if (activeTab === 'INCIDENTS') {
      if (ev.sourceModule !== 'INCIDENTS' && !ev.eventType.startsWith('INCIDENT_')) return false;
    } else if (activeTab === 'DECISION SUPPORT') {
      if (
        ev.sourceModule !== 'DECISION_SUPPORT' &&
        !ev.eventType.startsWith('DECISION_SUPPORT_') &&
        ev.eventType !== 'AUDIT_LOG_VIEWED'
      )
        return false;
    } else if (activeTab === 'RISK ANALYSIS') {
      if (ev.sourceModule !== 'ROUTE_RISK' && !ev.eventType.startsWith('ROUTE_RISK_')) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchRoute = ev.routeCode?.toLowerCase().includes(q) || ev.routeName?.toLowerCase().includes(q);
      const matchType = ev.eventType.toLowerCase().includes(q);
      const matchAction = ev.action.toLowerCase().includes(q);
      const matchDesc = ev.description.toLowerCase().includes(q);
      const matchAdmin = ev.actorName?.toLowerCase().includes(q) || ev.actorEmail?.toLowerCase().includes(q);
      const matchId = ev.id.toLowerCase().includes(q) || ev.correlationId?.toLowerCase().includes(q);
      return matchRoute || matchType || matchAction || matchDesc || matchAdmin || matchId;
    }

    return true;
  });

  const getEventBadge = (eventType: string) => {
    if (eventType.includes('CRITICAL') || eventType.includes('EMERGENCY')) {
      return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
    }
    if (eventType.includes('APPROVED') || eventType.includes('RESOLVED') || eventType.includes('COMPLETED')) {
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    }
    if (eventType.includes('DISMISSED')) {
      return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
    if (eventType.includes('EVALUATED') || eventType.includes('UPDATED')) {
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    }
    return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
  };

  const getModuleBadge = (sourceModule: string) => {
    switch (sourceModule) {
      case 'RECOMMENDATIONS':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'SAFETY_ALERTS':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'INCIDENTS':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'DECISION_SUPPORT':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'ROUTE_RISK':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      {/* Header Banner */}
      <div className="p-6 border-b border-slate-800 bg-slate-950/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-black text-white tracking-tight">
              Operational Action Audit & Governance Center
            </h2>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
              Phase 3 Step 8
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <Hash className="w-3 h-3" /> SHA-256 Chained
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Immutable, server-authoritative audit trail tracking operational intelligence and human administrative decisions.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
            <button
              onClick={() => setViewMode('TABLE')}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                viewMode === 'TABLE' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Table View
            </button>
            <button
              onClick={() => setViewMode('TIMELINE')}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                viewMode === 'TIMELINE' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Timeline View
            </button>
          </div>

          <button
            onClick={fetchAuditEvents}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-750 text-xs font-bold transition flex items-center space-x-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Mandatory Human-in-the-Loop Governance Notice */}
      <div className="bg-indigo-950/40 border-b border-indigo-900/30 px-6 py-3 flex items-start space-x-3">
        <Info className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-indigo-200/90 leading-relaxed">
          <strong className="font-semibold text-indigo-100">Governance Policy:</strong> Audit records document administrative actions and operational intelligence. They do not automatically execute operational changes. Recommendations remain advisory. Administrative approval does not automatically modify routes, vehicles, schedules, drivers, subscriptions, bookings, or dispatch.
        </p>
      </div>

      {/* Top 6 KPI Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 p-6 border-b border-slate-800/80 bg-slate-950/20">
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Audit Events</span>
          <span className="text-2xl font-black text-white mt-1">{summary.total}</span>
          <span className="text-[10px] text-slate-500 mt-0.5">Immutable records</span>
        </div>

        <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-900/30 flex flex-col">
          <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400">Recommendations</span>
          <span className="text-2xl font-black text-purple-300 mt-1">{summary.recommendations}</span>
          <span className="text-[10px] text-purple-400/60 mt-0.5">Evaluated, approved, completed</span>
        </div>

        <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-900/30 flex flex-col">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">Safety Alerts</span>
          <span className="text-2xl font-black text-amber-300 mt-1">{summary.alerts}</span>
          <span className="text-[10px] text-amber-400/60 mt-0.5">Evaluated & resolved</span>
        </div>

        <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-900/30 flex flex-col">
          <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400">Incidents</span>
          <span className="text-2xl font-black text-rose-300 mt-1">{summary.incidents}</span>
          <span className="text-[10px] text-rose-400/60 mt-0.5">Reviewed & updated</span>
        </div>

        <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-900/30 flex flex-col">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400">Decision Support</span>
          <span className="text-2xl font-black text-blue-300 mt-1">{summary.decisionSupport}</span>
          <span className="text-[10px] text-blue-400/60 mt-0.5">Explicit admin reviews</span>
        </div>

        <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-900/30 flex flex-col">
          <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">Risk Analysis</span>
          <span className="text-2xl font-black text-cyan-300 mt-1">{summary.riskAnalysis}</span>
          <span className="text-[10px] text-cyan-400/60 mt-0.5">Route score & trends</span>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {['ALL', 'RECOMMENDATIONS', 'SAFETY ALERTS', 'INCIDENTS', 'DECISION SUPPORT', 'RISK ANALYSIS'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === tab
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative min-w-[260px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search route, admin, event, action..."
            className="w-full bg-slate-950/70 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
          />
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="m-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Content Area: Table vs Timeline */}
      {viewMode === 'TABLE' ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4 font-bold">Timestamp</th>
                <th className="py-3 px-4 font-bold">Admin</th>
                <th className="py-3 px-4 font-bold">Event Type</th>
                <th className="py-3 px-4 font-bold">Resource & Route</th>
                <th className="py-3 px-4 font-bold">Action / Description</th>
                <th className="py-3 px-4 font-bold">Source</th>
                <th className="py-3 px-4 font-bold">Integrity</th>
                <th className="py-3 px-4 font-bold text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <p className="font-medium">No operational audit events found</p>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Audit events are recorded when administrators perform operational reviews, approvals, or resolutions.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredEvents.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-850/50 transition group">
                    {/* Timestamp */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-400">
                      <div className="font-mono text-[11px] text-slate-300">
                        {new Date(ev.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {new Date(ev.createdAt).toLocaleDateString()}
                      </div>
                    </td>

                    {/* Admin */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{ev.actorName || ev.actorEmail || ev.actorUserId}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {ev.actorRole}
                      </div>
                    </td>

                    {/* Event Type */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getEventBadge(
                          ev.eventType
                        )}`}
                      >
                        {ev.eventType}
                      </span>
                    </td>

                    {/* Resource & Route */}
                    <td className="py-3.5 px-4">
                      {ev.routeCode ? (
                        <div className="font-bold text-white flex items-center gap-1">
                          <span className="text-indigo-400">{ev.routeCode}</span>
                          {ev.routeName && <span className="text-slate-400 text-[11px]">({ev.routeName})</span>}
                        </div>
                      ) : (
                        <div className="font-mono text-slate-400 text-[11px]">Fleet / System</div>
                      )}
                      <div className="text-[10px] text-slate-500 font-mono">
                        {ev.resourceType}: {ev.resourceId ? `${ev.resourceId.substring(0, 12)}...` : 'N/A'}
                      </div>
                    </td>

                    {/* Description */}
                    <td className="py-3.5 px-4 max-w-xs">
                      <p className="font-semibold text-slate-200 line-clamp-1">{ev.description}</p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">{ev.action}</p>
                    </td>

                    {/* Source Module */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getModuleBadge(
                          ev.sourceModule
                        )}`}
                      >
                        {ev.sourceModule}
                      </span>
                    </td>

                    {/* Integrity */}
                    <td className="py-3.5 px-4 whitespace-nowrap font-mono">
                      <div className="flex items-center space-x-1 text-emerald-400 text-[10px]">
                        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                        <span title={ev.integrityHash}>{ev.integrityHash.substring(0, 8)}...</span>
                      </div>
                    </td>

                    {/* Details Action */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => openDrawer(ev)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition inline-flex items-center space-x-1 text-xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Timeline View */
        <div className="p-6 space-y-6">
          {filteredEvents.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <p className="font-medium">No timeline entries found</p>
            </div>
          ) : (
            <div className="relative pl-6 space-y-8 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
              {filteredEvents.map((ev) => (
                <div key={ev.id} className="relative group">
                  {/* Timeline Node Icon */}
                  <div className="absolute -left-[27px] top-1.5 w-4 h-4 rounded-full bg-slate-900 border-2 border-indigo-500 shadow-sm" />

                  {/* Card Content */}
                  <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 hover:border-slate-700 transition">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getEventBadge(
                            ev.eventType
                          )}`}
                        >
                          {ev.eventType}
                        </span>
                        {ev.routeCode && (
                          <span className="text-xs font-bold text-indigo-400">
                            Route {ev.routeCode}
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getModuleBadge(
                            ev.sourceModule
                          )}`}
                        >
                          {ev.sourceModule}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2 text-xs text-slate-400">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span className="font-mono">
                          {new Date(ev.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <p className="text-sm font-semibold text-slate-200">{ev.description}</p>

                    <div className="mt-3 flex flex-wrap items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-850">
                      <div className="flex items-center space-x-3">
                        <span className="flex items-center gap-1 text-slate-300">
                          <User className="w-3 h-3 text-indigo-400" />
                          {ev.actorName || ev.actorEmail || ev.actorUserId}
                        </span>
                        <span className="font-mono text-[10px] text-slate-500">
                          ID: {ev.id}
                        </span>
                      </div>

                      <button
                        onClick={() => openDrawer(ev)}
                        className="text-indigo-400 hover:text-indigo-300 text-xs font-bold flex items-center gap-1 transition"
                      >
                        <span>View Evidence & Hash</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Slide-out Evidence & Audit Detail Drawer */}
      {isDrawerOpen && selectedEvent && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-full overflow-y-auto flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-6 border-b border-slate-800 bg-slate-950/80 sticky top-0 z-10 flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2 mb-1">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${getEventBadge(
                      selectedEvent.eventType
                    )}`}
                  >
                    {selectedEvent.eventType}
                  </span>
                  <span className="text-xs font-mono text-slate-500">
                    {selectedEvent.id}
                  </span>
                </div>
                <h3 className="text-lg font-black text-white">Operational Audit Event</h3>
              </div>

              <button
                onClick={closeDrawer}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-6 space-y-6 flex-1">
              {/* Event Description */}
              <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Action Summary
                </span>
                <p className="text-sm font-semibold text-slate-200">{selectedEvent.description}</p>
                <div className="mt-2 text-xs font-mono text-indigo-400">
                  Action: {selectedEvent.action}
                </div>
              </div>

              {/* Administrative Actor Details */}
              <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Authenticated Administrator
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500 text-[11px]">Name:</span>
                    <p className="font-semibold text-white">{selectedEvent.actorName || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px]">Email:</span>
                    <p className="font-semibold text-white">{selectedEvent.actorEmail || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px]">User ID:</span>
                    <p className="font-mono text-slate-300">{selectedEvent.actorUserId}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px]">Verified Role:</span>
                    <p className="font-bold text-emerald-400">{selectedEvent.actorRole}</p>
                  </div>
                </div>
              </div>

              {/* Target Corridor & Resource Details */}
              <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Target Resource & Route
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500 text-[11px]">Route Code:</span>
                    <p className="font-bold text-indigo-400">{selectedEvent.routeCode || 'Fleet / System'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px]">Route Name:</span>
                    <p className="font-semibold text-slate-300">{selectedEvent.routeName || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px]">Resource Type:</span>
                    <p className="font-mono text-slate-300">{selectedEvent.resourceType}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px]">Resource ID:</span>
                    <p className="font-mono text-slate-300">{selectedEvent.resourceId || 'N/A'}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 text-[11px]">Correlation ID:</span>
                    <p className="font-mono text-indigo-300 text-[11px]">{selectedEvent.correlationId || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* State Transitions: Previous vs Resulting */}
              {(selectedEvent.previousState || selectedEvent.resultingState) && (
                <div className="space-y-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Authoritative State Transition
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block mb-1">
                        Previous State
                      </span>
                      <pre className="font-mono text-[11px] text-slate-300 overflow-x-auto whitespace-pre-wrap">
                        {selectedEvent.previousState
                          ? JSON.stringify(selectedEvent.previousState, null, 2)
                          : 'null'}
                      </pre>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block mb-1">
                        Resulting State
                      </span>
                      <pre className="font-mono text-[11px] text-slate-300 overflow-x-auto whitespace-pre-wrap">
                        {selectedEvent.resultingState
                          ? JSON.stringify(selectedEvent.resultingState, null, 2)
                          : 'null'}
                      </pre>
                    </div>
                  </div>
                </div>
              )}

              {/* Evidence Payload */}
              {selectedEvent.evidence && Object.keys(selectedEvent.evidence).length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Operational Evidence Payload
                  </span>
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 font-mono text-xs text-indigo-300 overflow-x-auto">
                    <pre>{JSON.stringify(selectedEvent.evidence, null, 2)}</pre>
                  </div>
                </div>
              )}

              {/* Cryptographic Integrity & Chain Details */}
              <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-900/40 space-y-3">
                <div className="flex items-center space-x-2 text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Cryptographic Integrity Verification
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">
                      SHA-256 Event Fingerprint:
                    </span>
                    <p className="font-mono text-[11px] text-emerald-300 break-all bg-slate-950/60 p-2 rounded-lg border border-emerald-900/30">
                      {selectedEvent.integrityHash}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">
                      Previous Event Hash (Chained):
                    </span>
                    <p className="font-mono text-[11px] text-slate-400 break-all bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                      {selectedEvent.previousEventHash || 'GENESIS'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950 text-right">
              <button
                onClick={closeDrawer}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
