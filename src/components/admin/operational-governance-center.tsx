'use client';

import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Eye,
  RefreshCw,
  ChevronRight,
  X,
  AlertCircle,
  FileText,
  Activity,
  Layers,
  Filter,
  Info,
  BarChart3,
  Search,
  UserCheck,
  GitCommit,
  Check,
} from 'lucide-react';
import {
  CorridorGovernanceReport,
  FleetGovernanceSummary,
  GovernanceException,
  GovernanceStatus,
  GovernanceSeverity,
} from '@/lib/operations/governance-engine';

export default function OperationalGovernanceCenter() {
  const [corridors, setCorridors] = useState<CorridorGovernanceReport[]>([]);
  const [summary, setSummary] = useState<FleetGovernanceSummary>({
    totalRoutes: 0,
    compliantRoutes: 0,
    monitorRoutes: 0,
    atRiskRoutes: 0,
    criticalRoutes: 0,
    totalGovernanceExceptions: 0,
    criticalExceptions: 0,
    highExceptions: 0,
    mediumExceptions: 0,
    lowExceptions: 0,
    auditEventsReviewed: 0,
    auditIntegrityFailures: 0,
    auditChainBreaks: 0,
    pendingRecommendations: 0,
    stalePendingRecommendations: 0,
    approvedRecommendations: 0,
    overdueApprovedRecommendations: 0,
    openCriticalIncidents: 0,
    criticalAlertReviewGaps: 0,
    riskReviewGaps: 0,
    capacityReviewGaps: 0,
    evidenceCompletenessGaps: 0,
    actorIdentityGaps: 0,
    correlationTraceabilityGaps: 0,
    humanGovernanceViolations: 0,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCorridor, setSelectedCorridor] = useState<CorridorGovernanceReport | null>(null);
  const [activeTab, setActiveTab] = useState<'ALL' | GovernanceStatus>('ALL');
  const [viewMode, setViewMode] = useState<'CORRIDORS' | 'TIMELINE' | 'EXCEPTIONS'>('CORRIDORS');
  const [searchQuery, setSearchQuery] = useState('');
  const [timelineRouteFilter, setTimelineRouteFilter] = useState<string>('ALL');
  const [auditSuccessNotice, setAuditSuccessNotice] = useState<string | null>(null);

  // Fetch governance data
  const fetchGovernanceData = async (audit: boolean = false) => {
    try {
      setRefreshing(true);
      setError(null);
      const url = audit ? '/api/operations/governance?audit=true' : '/api/operations/governance';
      const res = await axios.get(url);
      if (res.data.success) {
        setCorridors(res.data.corridors || []);
        setSummary(res.data.summary);
        if (audit) {
          setAuditSuccessNotice('Authoritative GOVERNANCE_REVIEWED audit event recorded successfully.');
          setTimeout(() => setAuditSuccessNotice(null), 4000);
        }
      }
    } catch (err: any) {
      console.error('[OperationalGovernanceCenter] Fetch error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to load operational governance data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchGovernanceData(false);
  }, []);

  // Filter corridors by tab and search
  const filteredCorridors = useMemo(() => {
    return corridors.filter((c) => {
      const matchesTab = activeTab === 'ALL' || c.governanceStatus === activeTab;
      const matchesSearch =
        searchQuery === '' ||
        c.routeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.routeCode.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesTab && matchesSearch;
    });
  }, [corridors, activeTab, searchQuery]);

  // Aggregate all exceptions for Timeline & Exceptions view
  const allExceptions = useMemo(() => {
    const list: GovernanceException[] = [];
    for (const c of corridors) {
      list.push(...c.exceptions);
    }
    return list.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [corridors]);

  // Filter exceptions for timeline
  const timelineExceptions = useMemo(() => {
    if (timelineRouteFilter === 'ALL') return allExceptions;
    return allExceptions.filter((e) => e.routeId === timelineRouteFilter);
  }, [allExceptions, timelineRouteFilter]);

  const getStatusBadge = (status: GovernanceStatus) => {
    switch (status) {
      case 'GOVERNANCE_CRITICAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
            <XCircle className="w-3.5 h-3.5" />
            GOVERNANCE CRITICAL
          </span>
        );
      case 'GOVERNANCE_AT_RISK':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-3.5 h-3.5" />
            GOVERNANCE AT RISK
          </span>
        );
      case 'GOVERNANCE_MONITOR':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
            <Info className="w-3.5 h-3.5" />
            GOVERNANCE MONITOR
          </span>
        );
      case 'GOVERNANCE_COMPLIANT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            COMPLIANT
          </span>
        );
      default:
        return null;
    }
  };

  const getSeverityBadge = (sev: GovernanceSeverity) => {
    switch (sev) {
      case 'CRITICAL':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-900/40 text-rose-300 border border-rose-700/50">
            CRITICAL
          </span>
        );
      case 'HIGH':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-900/40 text-amber-300 border border-amber-700/50">
            HIGH
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-yellow-900/30 text-yellow-300 border border-yellow-700/40">
            MEDIUM
          </span>
        );
      case 'LOW':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-900/30 text-blue-300 border border-blue-700/40">
            LOW
          </span>
        );
      case 'INFO':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-slate-300 border border-slate-700">
            INFO
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden text-slate-100 mb-8">
      {/* ── HEADER ── */}
      <div className="p-6 border-b border-slate-800 bg-slate-950/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                SMART COMMUTE GOVERNANCE & COMPLIANCE REVIEW CENTER
                <span className="text-[10px] font-mono px-2 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-md">
                  PHASE 3 STEP 9
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Deterministic governance evaluation, recommendation lifecycle verification & audit coverage analysis.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchGovernanceData(false)}
            disabled={refreshing}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 transition disabled:opacity-50"
            title="Refresh without logging audit event"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-purple-400' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => fetchGovernanceData(true)}
            disabled={refreshing}
            className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-2 transition shadow-lg shadow-purple-900/30 disabled:opacity-50"
            title="Log authoritative administrative review event in immutable audit trail"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Audit & Review</span>
          </button>
        </div>
      </div>

      {/* ── MANDATORY SYSTEM SAFETY BANNER ── */}
      <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2.5 flex items-center gap-2.5 text-xs text-amber-300">
        <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-400" />
        <span className="font-medium">
          Governance monitoring is advisory and read-only. No routes, schedules, vehicles, drivers, subscriptions, bookings, or dispatch operations are automatically modified.
        </span>
      </div>

      {auditSuccessNotice && (
        <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-6 py-2.5 flex items-center gap-2 text-xs text-emerald-300 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{auditSuccessNotice}</span>
        </div>
      )}

      {error && (
        <div className="m-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── 8 KPI CARDS ── */}
      <div className="p-6 border-b border-slate-800/80 bg-slate-950/30">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {/* 1. Total Routes */}
          <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Routes</span>
            <div className="text-2xl font-black text-white mt-1">{summary.totalRoutes}</div>
            <span className="text-[10px] text-slate-500 mt-0.5">Active Corridors</span>
          </div>

          {/* 2. Compliant Routes */}
          <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-900/40 flex flex-col">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Compliant</span>
            <div className="text-2xl font-black text-emerald-400 mt-1">{summary.compliantRoutes}</div>
            <span className="text-[10px] text-emerald-500/80 mt-0.5">Zero Exceptions</span>
          </div>

          {/* 3. Routes At Risk */}
          <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-900/40 flex flex-col">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">At Risk</span>
            <div className="text-2xl font-black text-amber-400 mt-1">{summary.atRiskRoutes}</div>
            <span className="text-[10px] text-amber-500/80 mt-0.5">High Issues</span>
          </div>

          {/* 4. Critical Routes */}
          <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-900/40 flex flex-col">
            <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Critical</span>
            <div className="text-2xl font-black text-rose-400 mt-1">{summary.criticalRoutes}</div>
            <span className="text-[10px] text-rose-500/80 mt-0.5">Urgent Review</span>
          </div>

          {/* 5. Governance Exceptions */}
          <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-900/40 flex flex-col">
            <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Exceptions</span>
            <div className="text-2xl font-black text-purple-400 mt-1">{summary.totalGovernanceExceptions}</div>
            <span className="text-[10px] text-purple-400/70 mt-0.5">{summary.criticalExceptions} Critical</span>
          </div>

          {/* 6. Audit Integrity Failures */}
          <div className={`p-3.5 rounded-xl border flex flex-col ${summary.auditIntegrityFailures > 0 ? 'bg-rose-950/30 border-rose-700/60' : 'bg-slate-800/40 border-slate-800'}`}>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Audit Integrity</span>
            <div className={`text-2xl font-black mt-1 ${summary.auditIntegrityFailures > 0 ? 'text-rose-400' : 'text-slate-200'}`}>
              {summary.auditIntegrityFailures}
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5">SHA-256 Failures</span>
          </div>

          {/* 7. Open Critical Incidents */}
          <div className={`p-3.5 rounded-xl border flex flex-col ${summary.openCriticalIncidents > 0 ? 'bg-amber-950/30 border-amber-700/60' : 'bg-slate-800/40 border-slate-800'}`}>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Critical Incidents</span>
            <div className={`text-2xl font-black mt-1 ${summary.openCriticalIncidents > 0 ? 'text-amber-400' : 'text-slate-200'}`}>
              {summary.openCriticalIncidents}
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5">Unresolved</span>
          </div>

          {/* 8. Human-in-the-Loop Violations */}
          <div className={`p-3.5 rounded-xl border flex flex-col ${summary.humanGovernanceViolations > 0 ? 'bg-rose-950/40 border-rose-600' : 'bg-slate-800/40 border-slate-800'}`}>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">HITL Violations</span>
            <div className={`text-2xl font-black mt-1 ${summary.humanGovernanceViolations > 0 ? 'text-rose-400' : 'text-slate-200'}`}>
              {summary.humanGovernanceViolations}
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5">Bypassed Gates</span>
          </div>
        </div>
      </div>

      {/* ── CONTROLS & SUB-NAV ── */}
      <div className="p-6 pb-2 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* View Mode Switcher */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setViewMode('CORRIDORS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${viewMode === 'CORRIDORS' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Corridor Health</span>
          </button>
          <button
            onClick={() => setViewMode('TIMELINE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${viewMode === 'TIMELINE' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Governance Timeline</span>
          </button>
          <button
            onClick={() => setViewMode('EXCEPTIONS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${viewMode === 'EXCEPTIONS' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Exceptions ({allExceptions.length})</span>
          </button>
        </div>

        {/* Search & Route Filter */}
        <div className="flex items-center gap-3">
          {viewMode === 'CORRIDORS' && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search corridor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>
          )}

          {viewMode === 'TIMELINE' && (
            <select
              value={timelineRouteFilter}
              onChange={(e) => setTimelineRouteFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
            >
              <option value="ALL">All Corridors</option>
              {corridors.map((c) => (
                <option key={c.routeId} value={c.routeId}>
                  {c.routeCode} — {c.routeName}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* ── FILTER TABS (When viewing corridors) ── */}
      {viewMode === 'CORRIDORS' && (
        <div className="px-6 py-3 border-b border-slate-800 bg-slate-950/20 flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap ${activeTab === 'ALL' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            ALL ({corridors.length})
          </button>
          <button
            onClick={() => setActiveTab('GOVERNANCE_CRITICAL')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${activeTab === 'GOVERNANCE_CRITICAL' ? 'bg-rose-900/60 text-rose-300 border border-rose-700/50' : 'text-rose-400/70 hover:text-rose-300'}`}
          >
            <XCircle className="w-3 h-3" />
            GOVERNANCE CRITICAL ({summary.criticalRoutes})
          </button>
          <button
            onClick={() => setActiveTab('GOVERNANCE_AT_RISK')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${activeTab === 'GOVERNANCE_AT_RISK' ? 'bg-amber-900/60 text-amber-300 border border-amber-700/50' : 'text-amber-400/70 hover:text-amber-300'}`}
          >
            <AlertTriangle className="w-3 h-3" />
            GOVERNANCE AT RISK ({summary.atRiskRoutes})
          </button>
          <button
            onClick={() => setActiveTab('GOVERNANCE_MONITOR')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${activeTab === 'GOVERNANCE_MONITOR' ? 'bg-blue-900/60 text-blue-300 border border-blue-700/50' : 'text-blue-400/70 hover:text-blue-300'}`}
          >
            <Info className="w-3 h-3" />
            GOVERNANCE MONITOR ({summary.monitorRoutes})
          </button>
          <button
            onClick={() => setActiveTab('GOVERNANCE_COMPLIANT')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${activeTab === 'GOVERNANCE_COMPLIANT' ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/50' : 'text-emerald-400/70 hover:text-emerald-300'}`}
          >
            <CheckCircle2 className="w-3 h-3" />
            GOVERNANCE COMPLIANT ({summary.compliantRoutes})
          </button>
        </div>
      )}

      {/* ── VIEW MODE 1: CORRIDOR TABLE ── */}
      {viewMode === 'CORRIDORS' && (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4 font-bold">Corridor</th>
                <th className="py-3 px-3 font-bold">Governance Status</th>
                <th className="py-3 px-3 font-bold">Severity</th>
                <th className="py-3 px-3 font-bold">Exceptions</th>
                <th className="py-3 px-3 font-bold">Audit Coverage</th>
                <th className="py-3 px-3 font-bold">Audit Integrity</th>
                <th className="py-3 px-3 font-bold">Recommendations</th>
                <th className="py-3 px-3 font-bold">Incidents</th>
                <th className="py-3 px-3 font-bold">Alerts</th>
                <th className="py-3 px-3 font-bold">Review Gaps</th>
                <th className="py-3 px-3 font-bold">Evidence</th>
                <th className="py-3 px-4 font-bold text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredCorridors.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-slate-500">
                    No corridors match current filter.
                  </td>
                </tr>
              ) : (
                filteredCorridors.map((c) => (
                  <tr
                    key={c.routeId}
                    className="hover:bg-slate-800/30 transition cursor-pointer"
                    onClick={() => setSelectedCorridor(c)}
                  >
                    <td className="py-3.5 px-4 font-medium text-white">
                      <div className="font-bold text-slate-100">{c.routeCode}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[140px]">{c.routeName}</div>
                    </td>
                    <td className="py-3.5 px-3">{getStatusBadge(c.governanceStatus)}</td>
                    <td className="py-3.5 px-3">{getSeverityBadge(c.governanceSeverity)}</td>
                    <td className="py-3.5 px-3">
                      <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full font-bold ${c.exceptionCount > 0 ? 'bg-purple-900/40 text-purple-300 border border-purple-700/50' : 'bg-slate-800 text-slate-400'}`}>
                        {c.exceptionCount}
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className={`text-[11px] font-semibold ${c.auditCoverage.gapCount > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
                        {c.auditCoverage.status} ({c.auditCoverage.gapCount} gaps)
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className={`text-[11px] font-semibold ${c.auditIntegrity.failedCount > 0 ? 'text-rose-400 font-bold' : 'text-emerald-400'}`}>
                        {c.auditIntegrity.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="text-[11px] text-slate-300">
                        {c.recommendationGovernance.pending} pend / {c.recommendationGovernance.approved} app
                      </div>
                      {c.recommendationGovernance.stalePending > 0 && (
                        <div className="text-[10px] text-amber-400">{c.recommendationGovernance.stalePending} stale</div>
                      )}
                    </td>
                    <td className="py-3.5 px-3">
                      <span className={`text-[11px] ${c.incidentGovernance.openCritical > 0 ? 'text-rose-400 font-bold' : 'text-slate-300'}`}>
                        {c.incidentGovernance.openCritical > 0 ? `${c.incidentGovernance.openCritical} Crit Open` : `${c.incidentGovernance.totalOpen} Open`}
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className={`text-[11px] ${c.alertGovernance.reviewGaps > 0 ? 'text-amber-400 font-bold' : 'text-slate-300'}`}>
                        {c.alertGovernance.activeCritical > 0 ? `${c.alertGovernance.activeCritical} Crit Act` : `${c.alertGovernance.reviewGaps} Gaps`}
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="text-[11px] text-slate-300">
                        {c.riskReviewGovernance.reviewGap && <span className="text-amber-400">Risk Gap</span>}
                        {c.riskReviewGovernance.reviewGap && c.demandReviewGovernance.reviewGap && <span> | </span>}
                        {c.demandReviewGovernance.reviewGap && <span className="text-blue-400">Demand Gap</span>}
                        {!c.riskReviewGovernance.reviewGap && !c.demandReviewGovernance.reviewGap && (
                          <span className="text-emerald-400">None</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className={`text-[11px] font-medium ${c.evidenceGovernance.completenessGaps > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {c.evidenceGovernance.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCorridor(c);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-300 text-xs font-semibold inline-flex items-center gap-1 transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── VIEW MODE 2: TIMELINE VIEW ── */}
      {viewMode === 'TIMELINE' && (
        <div className="p-6">
          <div className="space-y-4">
            {timelineExceptions.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                <ShieldCheck className="w-10 h-10 mx-auto mb-2 text-emerald-500/50" />
                <p className="text-sm font-medium">No governance exceptions recorded on the timeline.</p>
                <p className="text-xs text-slate-500 mt-1">All corridor operations are fully compliant.</p>
              </div>
            ) : (
              timelineExceptions.map((exc, idx) => (
                <div
                  key={exc.exceptionId || idx}
                  className="flex items-start gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition"
                >
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex-shrink-0 mt-0.5">
                    <Clock className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-white">{exc.rule}</span>
                      {getSeverityBadge(exc.severity)}
                      <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                        {exc.routeId}
                      </span>
                      <span className="text-[11px] text-slate-500 ml-auto">
                        {new Date(exc.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">{exc.description}</p>
                    {exc.resourceId && (
                      <div className="mt-2 text-[11px] font-mono text-slate-400 flex items-center gap-2">
                        <span className="text-slate-500">Resource:</span>
                        <span>{exc.resourceType} #{exc.resourceId}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── VIEW MODE 3: ALL EXCEPTIONS INSPECTOR ── */}
      {viewMode === 'EXCEPTIONS' && (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4 font-bold">Rule</th>
                <th className="py-3 px-3 font-bold">Severity</th>
                <th className="py-3 px-3 font-bold">Corridor</th>
                <th className="py-3 px-3 font-bold">Resource Type</th>
                <th className="py-3 px-3 font-bold">Resource ID</th>
                <th className="py-3 px-4 font-bold">Description</th>
                <th className="py-3 px-3 font-bold">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {allExceptions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Zero governance exceptions across the entire fleet.
                  </td>
                </tr>
              ) : (
                allExceptions.map((exc) => (
                  <tr key={exc.exceptionId} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4 font-mono font-bold text-purple-300">{exc.rule}</td>
                    <td className="py-3 px-3">{getSeverityBadge(exc.severity)}</td>
                    <td className="py-3 px-3 font-mono text-slate-300">{exc.routeId}</td>
                    <td className="py-3 px-3 text-slate-400">{exc.resourceType}</td>
                    <td className="py-3 px-3 font-mono text-slate-400 text-[11px]">{exc.resourceId || '—'}</td>
                    <td className="py-3 px-4 text-slate-300 max-w-md">{exc.description}</td>
                    <td className="py-3 px-3 text-slate-500 whitespace-nowrap text-[11px]">
                      {new Date(exc.createdAt).toLocaleTimeString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── DETAIL DRAWER (SLIDE-OUT INSPECTOR) ── */}
      {selectedCorridor && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/80 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
            {/* Drawer Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-white">{selectedCorridor.routeCode}</h3>
                  {getStatusBadge(selectedCorridor.governanceStatus)}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{selectedCorridor.routeName}</p>
              </div>

              <button
                onClick={() => setSelectedCorridor(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Score & Severity Card */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Governance Health Score
                  </span>
                  <div className="text-3xl font-black text-white mt-1">
                    {selectedCorridor.governanceScore}
                    <span className="text-sm font-normal text-slate-500"> / 100</span>
                  </div>
                  <div className="mt-1">{getSeverityBadge(selectedCorridor.governanceSeverity)}</div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Exceptions</span>
                  <div className="text-2xl font-black text-purple-400 mt-1">
                    {selectedCorridor.exceptionCount}
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {selectedCorridor.criticalExceptionCount} Crit · {selectedCorridor.highExceptionCount} High
                  </span>
                </div>
              </div>

              {/* Briefing Box */}
              <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-900/40 text-xs text-purple-200">
                <div className="font-bold text-purple-300 uppercase tracking-wider text-[10px] mb-1 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" />
                  GOVERNANCE BRIEFING
                </div>
                <p className="leading-relaxed">{selectedCorridor.briefing}</p>
              </div>

              {/* Subsystem Audit Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Audit Coverage</div>
                  <div className="text-sm font-bold text-white mt-1">
                    {selectedCorridor.auditCoverage.status}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {selectedCorridor.auditCoverage.gapCount} coverage gaps detected
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Audit Integrity</div>
                  <div className="text-sm font-bold text-emerald-400 mt-1">
                    {selectedCorridor.auditIntegrity.status}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {selectedCorridor.auditIntegrity.verifiedCount} verified / {selectedCorridor.auditIntegrity.failedCount} failed
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Recommendations</div>
                  <div className="text-sm font-bold text-white mt-1">
                    {selectedCorridor.recommendationGovernance.status}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {selectedCorridor.recommendationGovernance.pending} pending · {selectedCorridor.recommendationGovernance.stalePending} stale
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Incidents & Alerts</div>
                  <div className="text-sm font-bold text-white mt-1">
                    {selectedCorridor.incidentGovernance.status}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {selectedCorridor.incidentGovernance.openCritical} open crit · {selectedCorridor.alertGovernance.reviewGaps} alert gaps
                  </div>
                </div>
              </div>

              {/* Corridor Exceptions List */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
                  <span>Detected Exceptions ({selectedCorridor.exceptions.length})</span>
                  <span className="text-[10px] text-slate-500 lowercase">read-only</span>
                </h4>

                {selectedCorridor.exceptions.length === 0 ? (
                  <div className="p-6 rounded-xl bg-emerald-950/20 border border-emerald-900/40 text-center text-xs text-emerald-300">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-1.5" />
                    Corridor has zero governance exceptions.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedCorridor.exceptions.map((exc) => (
                      <div
                        key={exc.exceptionId}
                        className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-purple-300">{exc.rule}</span>
                          {getSeverityBadge(exc.severity)}
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">{exc.description}</p>
                        <div className="pt-2 border-t border-slate-900 text-[10px] font-mono text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
                          <span>Resource: {exc.resourceType} {exc.resourceId ? `#${exc.resourceId}` : ''}</span>
                          <span>Detected: {new Date(exc.createdAt).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Explanations List */}
              {selectedCorridor.explanation.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                    Causal Governance Explanations
                  </h4>
                  <div className="space-y-2">
                    {selectedCorridor.explanation.map((item, i) => (
                      <div key={i} className="p-3 rounded-lg bg-slate-950/40 border border-slate-800/60 text-xs">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-slate-200">{item.rule}</span>
                          {getSeverityBadge(item.severity)}
                        </div>
                        <p className="text-slate-400">{item.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Deterministic governance evaluation · Administrator authority
              </span>
              <button
                onClick={() => setSelectedCorridor(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition"
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
