'use client';

import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Shield,
  Clock,
  Calendar,
  FileText,
  Printer,
  X,
  Eye,
  RefreshCw,
  Search,
  Filter,
  Layers,
  Activity,
  CheckCircle2,
  Users,
  Car,
  ChevronRight,
  Info,
  SlidersHorizontal,
  Flame,
  Zap,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  OperationalAnalyticsResponse,
  AnalyticsTimeWindow,
  ExecutiveInsight,
  RecurringPattern,
  CorridorHealthProfile,
  RiskAnalyticsMetric,
  ExecutiveReportData,
} from '@/lib/operations/operational-analytics-engine';

export default function OperationalAnalyticsCenter() {
  const [data, setData] = useState<OperationalAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Time Window & Filtering States
  const [selectedWindow, setSelectedWindow] = useState<AnalyticsTimeWindow>('LAST_7_DAYS');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [selectedRouteId, setSelectedRouteId] = useState<string>('ALL');

  // UI Selection States
  const [selectedCorridor, setSelectedCorridor] = useState<CorridorHealthProfile | null>(null);
  const [reportModalData, setReportModalData] = useState<ExecutiveReportData | null>(null);
  const [selectedInsight, setSelectedInsight] = useState<ExecutiveInsight | null>(null);
  const [sortField, setSortField] = useState<'risk' | 'alerts' | 'incidents' | 'exceptions'>('risk');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [auditSuccessNotice, setAuditSuccessNotice] = useState<string | null>(null);

  // Fetch Analytics Data
  const fetchAnalytics = async (report: boolean = false, audit: boolean = false) => {
    try {
      setRefreshing(true);
      setError(null);

      let url = `/api/operations/analytics?window=${selectedWindow}`;
      if (selectedWindow === 'CUSTOM' && customFrom && customTo) {
        url += `&from=${customFrom}&to=${customTo}`;
      }
      if (selectedRouteId !== 'ALL') {
        url += `&routeId=${selectedRouteId}`;
      }
      if (report) {
        url += `&report=true`;
      }
      if (audit) {
        url += `&audit=true`;
      }

      const res = await axios.get(url);
      if (res.data.success) {
        setData(res.data);
        if (report && res.data.report) {
          setReportModalData(res.data.report);
        }
        if (audit) {
          setAuditSuccessNotice(
            report
              ? 'Authoritative EXECUTIVE_REPORT_GENERATED audit event recorded.'
              : 'Authoritative OPERATIONAL_ANALYTICS_VIEWED audit event recorded.'
          );
          setTimeout(() => setAuditSuccessNotice(null), 4000);
        }
      }
    } catch (err: any) {
      console.error('[OperationalAnalyticsCenter] Error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to load operational analytics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(false, false);
  }, [selectedWindow, selectedRouteId]);

  // Handle custom date submission
  const handleCustomDateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customFrom || !customTo) {
      setError('Please provide both Start and End dates for custom range.');
      return;
    }
    fetchAnalytics(false, false);
  };

  // Sort corridors for comparison table
  const sortedCorridors = useMemo(() => {
    if (!data?.corridorProfiles) return [];
    return [...data.corridorProfiles].sort((a, b) => {
      let valA = 0;
      let valB = 0;
      if (sortField === 'risk') {
        valA = a.riskProfile.averageScore;
        valB = b.riskProfile.averageScore;
      } else if (sortField === 'alerts') {
        valA = a.safetyProfile.totalAlerts;
        valB = b.safetyProfile.totalAlerts;
      } else if (sortField === 'incidents') {
        valA = a.incidentProfile.totalIncidents;
        valB = b.incidentProfile.totalIncidents;
      } else if (sortField === 'exceptions') {
        valA = a.governanceProfile.exceptionCount;
        valB = b.governanceProfile.exceptionCount;
      }
      return sortOrder === 'desc' ? valB - valA : valA - valB;
    });
  }, [data?.corridorProfiles, sortField, sortOrder]);

  const handleSort = (field: 'risk' | 'alerts' | 'incidents' | 'exceptions') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'RISING':
        return <TrendingUp className="w-3.5 h-3.5 text-rose-400" />;
      case 'FALLING':
        return <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />;
      case 'STABLE':
        return <Minus className="w-3.5 h-3.5 text-blue-400" />;
      default:
        return <Minus className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-900/50 text-rose-300 border border-rose-700/60">CRITICAL</span>;
      case 'HIGH':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-900/50 text-amber-300 border border-amber-700/60">HIGH</span>;
      case 'MEDIUM':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-900/40 text-yellow-300 border border-yellow-700/50">MEDIUM</span>;
      case 'LOW':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-900/40 text-blue-300 border border-blue-700/50">LOW</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">INFO</span>;
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden text-slate-100 mb-8">
      {/* ── HEADER ── */}
      <div className="p-6 border-b border-slate-800 bg-slate-950/70 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
              SMART COMMUTE OPERATIONAL INTELLIGENCE ANALYTICS
              <span className="text-[10px] font-mono px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-md">
                PHASE 3 STEP 10
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Historical intelligence aggregation, trend analysis, recurring patterns & executive reporting.
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => fetchAnalytics(false, false)}
            disabled={refreshing}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 transition disabled:opacity-50"
            title="Refresh analytics without logging audit event"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => fetchAnalytics(true, true)}
            disabled={refreshing}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 transition shadow-lg shadow-indigo-900/30 disabled:opacity-50"
            title="Generate verified executive report with authoritative audit logging"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Generate Executive Report</span>
          </button>
        </div>
      </div>

      {/* ── MANDATORY SYSTEM SAFETY NOTICE BANNER ── */}
      <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2.5 flex items-center gap-2.5 text-xs text-amber-300">
        <Info className="w-4 h-4 flex-shrink-0 text-amber-400" />
        <span className="font-medium">
          Analytics are derived from verified historical operational data and are advisory. No operational resources are automatically modified.
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
          <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── TIME WINDOW & FILTERING CONTROLS (Part 18) ── */}
      <div className="p-6 pb-4 border-b border-slate-800 bg-slate-950/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Time Window Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
          <span className="text-[10px] font-bold text-slate-500 uppercase px-2">Window:</span>
          {(['LAST_24_HOURS', 'LAST_7_DAYS', 'LAST_30_DAYS', 'LAST_90_DAYS', 'CUSTOM'] as AnalyticsTimeWindow[]).map(
            (w) => (
              <button
                key={w}
                onClick={() => setSelectedWindow(w)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                  selectedWindow === w
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {w === 'LAST_24_HOURS'
                  ? 'Last 24 Hours'
                  : w === 'LAST_7_DAYS'
                  ? 'Last 7 Days'
                  : w === 'LAST_30_DAYS'
                  ? 'Last 30 Days'
                  : w === 'LAST_90_DAYS'
                  ? 'Last 90 Days'
                  : 'Custom Range'}
              </button>
            )
          )}
        </div>

        {/* Corridor Filter & Custom Date Inputs */}
        <div className="flex flex-wrap items-center gap-3">
          {selectedWindow === 'CUSTOM' && (
            <form onSubmit={handleCustomDateSubmit} className="flex items-center gap-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
              />
              <span className="text-xs text-slate-500">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition"
              >
                Apply
              </button>
            </form>
          )}

          <select
            value={selectedRouteId}
            onChange={(e) => setSelectedRouteId(e.target.value)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Corridors (Fleet View)</option>
            {data?.corridorProfiles?.map((c) => (
              <option key={c.routeId} value={c.routeId}>
                {c.routeCode} — {c.routeName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── 8 EXECUTIVE KPI CARDS (Part 19) ── */}
      <div className="p-6 border-b border-slate-800/80 bg-slate-950/20">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {/* 1. Routes Analyzed */}
          <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Routes Analyzed</span>
            <div className="text-2xl font-black text-white mt-1">
              {data?.executiveSummary.routesAnalyzed ?? 0}
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5">Corridors in scope</span>
          </div>

          {/* 2. Average Fleet Risk */}
          <div className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-900/40 flex flex-col">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Avg Fleet Risk</span>
            <div className="text-2xl font-black text-indigo-400 mt-1">
              {data?.executiveSummary.averageFleetRisk ?? 0}
              <span className="text-xs font-normal text-indigo-500"> / 100</span>
            </div>
            <span className="text-[10px] text-indigo-400/70 mt-0.5">Weighted avg</span>
          </div>

          {/* 3. Critical Risk Occurrences */}
          <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-900/40 flex flex-col">
            <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Critical Risk</span>
            <div className="text-2xl font-black text-rose-400 mt-1">
              {data?.executiveSummary.criticalRiskOccurrences ?? 0}
            </div>
            <span className="text-[10px] text-rose-400/70 mt-0.5">Historical spikes</span>
          </div>

          {/* 4. Safety Alerts */}
          <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-900/40 flex flex-col">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Safety Alerts</span>
            <div className="text-2xl font-black text-amber-400 mt-1">
              {data?.executiveSummary.safetyAlerts ?? 0}
            </div>
            <span className="text-[10px] text-amber-400/70 mt-0.5">
              {data?.alerts.activeAlerts ?? 0} active
            </span>
          </div>

          {/* 5. Open Incidents */}
          <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Open Incidents</span>
            <div className="text-2xl font-black text-slate-200 mt-1">
              {data?.executiveSummary.openIncidents ?? 0}
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5">
              {data?.incidents.criticalIncidents ?? 0} critical
            </span>
          </div>

          {/* 6. High Demand Occurrences */}
          <div className="p-3.5 rounded-xl bg-blue-950/20 border border-blue-900/40 flex flex-col">
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">High Demand</span>
            <div className="text-2xl font-black text-blue-400 mt-1">
              {data?.executiveSummary.highDemandOccurrences ?? 0}
            </div>
            <span className="text-[10px] text-blue-400/70 mt-0.5">&gt;75% occupancy</span>
          </div>

          {/* 7. Pending Recommendations */}
          <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-900/40 flex flex-col">
            <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Pending Recs</span>
            <div className="text-2xl font-black text-purple-400 mt-1">
              {data?.executiveSummary.pendingRecommendations ?? 0}
            </div>
            <span className="text-[10px] text-purple-400/70 mt-0.5">
              {data?.recommendations.stalePendingRecommendations ?? 0} stale
            </span>
          </div>

          {/* 8. Governance Exceptions */}
          <div className={`p-3.5 rounded-xl border flex flex-col ${
            (data?.executiveSummary.governanceExceptions ?? 0) > 0
              ? 'bg-rose-950/30 border-rose-700/60'
              : 'bg-emerald-950/20 border-emerald-900/40'
          }`}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Governance</span>
            <div className={`text-2xl font-black mt-1 ${
              (data?.executiveSummary.governanceExceptions ?? 0) > 0 ? 'text-rose-400' : 'text-emerald-400'
            }`}>
              {data?.executiveSummary.governanceExceptions ?? 0}
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5">Exceptions active</span>
          </div>
        </div>
      </div>

      {/* ── SECTION 1: TREND VISUALIZATIONS & CHARTS (Part 20) ── */}
      <div className="p-6 border-b border-slate-800 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Trend Chart */}
        <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-400" />
                Corridor Risk Score Comparison
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Current score vs historical average across corridors
              </p>
            </div>
            <span className="text-[10px] font-mono text-slate-500">{data?.timeWindow.window}</span>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.risk.metrics || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis dataKey="routeCode" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" domain={[0, 100]} fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 8, fontSize: 12 }}
                  formatter={(val: any) => [`${val}/100`, 'Risk Score']}
                />
                <Bar dataKey="currentRiskScore" name="Current Score" fill="#818cf8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="averageRiskScore" name="Average Score" fill="#6366f1" radius={[4, 4, 0, 0]} opacity={0.6} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Operational Distribution (Alerts vs Incidents vs Recommendations) */}
        <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-purple-400" />
                Operational Activity by Dimension
              </h3>
              <span className="text-[10px] font-mono text-slate-500">Totals in Window</span>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Alerts Total</span>
                <div className="text-xl font-bold text-amber-400 mt-1">{data?.alerts.totalAlerts ?? 0}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{data?.alerts.resolutionRatePercent}% resolved</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Incidents Total</span>
                <div className="text-xl font-bold text-rose-400 mt-1">{data?.incidents.totalIncidents ?? 0}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{data?.incidents.openIncidents} open</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Recommendations</span>
                <div className="text-xl font-bold text-purple-400 mt-1">{data?.recommendations.totalRecommendations ?? 0}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{data?.recommendations.approvalRatePercent}% approved</div>
              </div>
            </div>
          </div>

          {/* Subsystem Health Progress Bars */}
          <div className="space-y-3 pt-2 border-t border-slate-900">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Safety Alert Resolution Rate</span>
                <span className="text-amber-400 font-bold">{data?.alerts.resolutionRatePercent ?? 100}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-500"
                  style={{ width: `${data?.alerts.resolutionRatePercent ?? 100}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Recommendation Approval Rate</span>
                <span className="text-purple-400 font-bold">{data?.recommendations.approvalRatePercent ?? 0}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all duration-500"
                  style={{ width: `${data?.recommendations.approvalRatePercent ?? 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Governance Compliance Proportion</span>
                <span className="text-emerald-400 font-bold">
                  {data?.governance.compliantRoutes && data?.executiveSummary.routesAnalyzed
                    ? Math.round((data.governance.compliantRoutes / data.executiveSummary.routesAnalyzed) * 100)
                    : 100}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      data?.governance.compliantRoutes && data?.executiveSummary.routesAnalyzed
                        ? Math.round((data.governance.compliantRoutes / data.executiveSummary.routesAnalyzed) * 100)
                        : 100
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: EXECUTIVE INSIGHTS & RECURRING PATTERNS (Part 12 & 13) ── */}
      <div className="p-6 border-b border-slate-800 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Executive Insights Panel */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              Evidence-Backed Executive Insights
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">Deterministic Logic</span>
          </div>

          <div className="space-y-3">
            {data?.insights.length === 0 ? (
              <div className="p-6 rounded-xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-500">
                No critical insights detected for the selected period.
              </div>
            ) : (
              data?.insights.map((ins) => (
                <div
                  key={ins.insightId}
                  onClick={() => setSelectedInsight(ins)}
                  className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-indigo-500/50 transition cursor-pointer flex items-start gap-3"
                >
                  <div className="mt-0.5">{getSeverityBadge(ins.severity)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white truncate">{ins.title}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                    </div>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">{ins.description}</p>
                    {ins.comparison && <div className="text-[11px] text-indigo-400 mt-1">{ins.comparison}</div>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recurring Patterns Panel */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Flame className="w-4 h-4 text-rose-400" />
              Identified Recurring Patterns
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">Deterministic Thresholds</span>
          </div>

          <div className="space-y-3">
            {data?.recurringPatterns.length === 0 ? (
              <div className="p-6 rounded-xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-500">
                <CheckCircle2 className="w-6 h-6 text-emerald-500/40 mx-auto mb-1.5" />
                No recurring risk, alert, or incident patterns detected.
              </div>
            ) : (
              data?.recurringPatterns.map((pat) => (
                <div
                  key={pat.patternId}
                  className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3"
                >
                  <div className="p-2 rounded-lg bg-rose-950/30 text-rose-400 border border-rose-900/40 flex-shrink-0 mt-0.5">
                    <Flame className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-purple-300">{pat.patternType}</span>
                      <span className="text-[10px] font-bold text-rose-400 bg-rose-950/40 px-2 py-0.5 rounded border border-rose-800/40">
                        {pat.occurrences}x Observed
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">{pat.description}</p>
                    <div className="text-[10px] font-mono text-slate-500 mt-1">Corridor: {pat.routeCode}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── SECTION 3: CORRIDOR COMPARISON TABLE (Part 21) ── */}
      <div className="p-6 border-b border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              Corridor Historical Health Comparison
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Click columns to sort by verified metrics. Click any row to inspect historical detail profile.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Sorted by:</span>
            <span className="font-bold text-white uppercase">{sortField} ({sortOrder})</span>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4 font-bold">Corridor</th>
                <th
                  onClick={() => handleSort('risk')}
                  className="py-3 px-3 font-bold cursor-pointer hover:text-white transition"
                >
                  Avg Risk {sortField === 'risk' && (sortOrder === 'desc' ? '▼' : '▲')}
                </th>
                <th className="py-3 px-3 font-bold">Peak Risk</th>
                <th className="py-3 px-3 font-bold">Risk Trend</th>
                <th
                  onClick={() => handleSort('alerts')}
                  className="py-3 px-3 font-bold cursor-pointer hover:text-white transition"
                >
                  Alerts {sortField === 'alerts' && (sortOrder === 'desc' ? '▼' : '▲')}
                </th>
                <th
                  onClick={() => handleSort('incidents')}
                  className="py-3 px-3 font-bold cursor-pointer hover:text-white transition"
                >
                  Incidents {sortField === 'incidents' && (sortOrder === 'desc' ? '▼' : '▲')}
                </th>
                <th className="py-3 px-3 font-bold">Demand Pressure</th>
                <th className="py-3 px-3 font-bold">Recs (P/A/C)</th>
                <th
                  onClick={() => handleSort('exceptions')}
                  className="py-3 px-3 font-bold cursor-pointer hover:text-white transition"
                >
                  Governance {sortField === 'exceptions' && (sortOrder === 'desc' ? '▼' : '▲')}
                </th>
                <th className="py-3 px-4 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
              {sortedCorridors.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-500">
                    No corridor health profiles available for selected window.
                  </td>
                </tr>
              ) : (
                sortedCorridors.map((c) => (
                  <tr
                    key={c.routeId}
                    onClick={() => setSelectedCorridor(c)}
                    className="hover:bg-slate-800/40 transition cursor-pointer"
                  >
                    <td className="py-3 px-4">
                      <div className="font-bold text-white">{c.routeCode}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[150px]">{c.routeName}</div>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-indigo-300">
                      {c.riskProfile.averageScore}/100
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-300">
                      {c.riskProfile.maxScore}/100
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                        {getTrendIcon(c.riskProfile.trend)}
                        <span>{c.riskProfile.trend}</span>
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`font-bold ${c.safetyProfile.totalAlerts > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                        {c.safetyProfile.totalAlerts} ({c.safetyProfile.activeAlerts} act)
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`font-bold ${c.incidentProfile.openIncidents > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                        {c.incidentProfile.totalIncidents} ({c.incidentProfile.openIncidents} open)
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-300">
                      {c.demandProfile.predictedOccupancy}%
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-400 text-[11px]">
                      {c.recommendationProfile.pending}p / {c.recommendationProfile.approved}a / {c.recommendationProfile.completed}c
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        c.governanceProfile.exceptionCount > 0
                          ? 'bg-rose-950/40 text-rose-300 border border-rose-800/40'
                          : 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/40'
                      }`}>
                        {c.governanceProfile.governanceStatus.replace('GOVERNANCE_', '')} ({c.governanceProfile.exceptionCount})
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCorridor(c);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-semibold inline-flex items-center gap-1 transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Profile</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL 1: CORRIDOR DETAIL DRAWER (Part 23) ── */}
      {selectedCorridor && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/80 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
            {/* Drawer Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-white">{selectedCorridor.routeCode}</h3>
                  <span className="text-xs font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                    Historical Health Profile
                  </span>
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

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Historical Summary Box */}
              <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-900/40 text-xs text-indigo-200">
                <div className="font-bold text-indigo-300 uppercase tracking-wider text-[10px] mb-1 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" />
                  HISTORICAL HEALTH SUMMARY
                </div>
                <p className="leading-relaxed">{selectedCorridor.historicalSummary}</p>
              </div>

              {/* Subsystem Metric Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Risk History</span>
                  <div className="text-sm font-bold text-white mt-1">
                    Current: {selectedCorridor.riskProfile.currentScore}/100 ({selectedCorridor.riskProfile.currentLevel})
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Avg: {selectedCorridor.riskProfile.averageScore} · Peak: {selectedCorridor.riskProfile.maxScore} · Trend: {selectedCorridor.riskProfile.trend}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Safety Alerts</span>
                  <div className="text-sm font-bold text-amber-400 mt-1">
                    {selectedCorridor.safetyProfile.totalAlerts} Total Alerts
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {selectedCorridor.safetyProfile.activeAlerts} active · {selectedCorridor.safetyProfile.resolvedAlerts} resolved
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Incidents</span>
                  <div className="text-sm font-bold text-rose-400 mt-1">
                    {selectedCorridor.incidentProfile.totalIncidents} Total Incidents
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {selectedCorridor.incidentProfile.openIncidents} open · {selectedCorridor.incidentProfile.resolvedIncidents} resolved
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Governance</span>
                  <div className="text-sm font-bold text-purple-400 mt-1">
                    {selectedCorridor.governanceProfile.governanceStatus}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Score: {selectedCorridor.governanceProfile.governanceScore}/100 ({selectedCorridor.governanceProfile.exceptionCount} exceptions)
                  </div>
                </div>
              </div>

              {/* Recommendation Lifecycle Breakdown */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Recommendation Lifecycle
                </span>
                <div className="grid grid-cols-4 gap-2 text-center pt-1">
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="text-xs text-slate-400">Total</div>
                    <div className="text-sm font-bold text-white mt-0.5">{selectedCorridor.recommendationProfile.total}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="text-xs text-amber-400">Pending</div>
                    <div className="text-sm font-bold text-amber-400 mt-0.5">{selectedCorridor.recommendationProfile.pending}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="text-xs text-indigo-400">Approved</div>
                    <div className="text-sm font-bold text-indigo-400 mt-0.5">{selectedCorridor.recommendationProfile.approved}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="text-xs text-emerald-400">Completed</div>
                    <div className="text-sm font-bold text-emerald-400 mt-0.5">{selectedCorridor.recommendationProfile.completed}</div>
                  </div>
                </div>
              </div>

              {/* Verified Evidence Details */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Corridor Telemetry & Audit Evidence
                </h4>
                <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto">
                  {JSON.stringify(selectedCorridor.evidence, null, 2)}
                </pre>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">Read-only profile · No mutation operations</span>
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

      {/* ── MODAL 2: EXECUTIVE REPORT MODAL (Part 24 & 25) ── */}
      {reportModalData && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Report Header */}
            <div className="p-6 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">{reportModalData.title}</h3>
                  <div className="text-xs text-slate-400 flex items-center gap-3 mt-0.5">
                    <span>Generated: {new Date(reportModalData.generatedAt).toLocaleString()}</span>
                    <span>•</span>
                    <span>Window: {reportModalData.timeWindow.window}</span>
                    <span>•</span>
                    <span>Scope: {reportModalData.routeFilter}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white flex items-center gap-1.5 transition"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
                <button
                  onClick={() => setReportModalData(null)}
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Report Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-200">
              {/* Executive Summary */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <h4 className="font-bold text-white uppercase text-[11px] tracking-wider">
                  Executive Briefing & Key Indicators
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-center">
                  <div className="p-2.5 rounded-lg bg-slate-900">
                    <span className="text-[10px] text-slate-400 uppercase">Routes</span>
                    <div className="text-lg font-bold text-white mt-0.5">{reportModalData.executiveSummary.totalRoutes}</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900">
                    <span className="text-[10px] text-slate-400 uppercase">Avg Risk</span>
                    <div className="text-lg font-bold text-indigo-400 mt-0.5">{reportModalData.executiveSummary.averageFleetRisk}/100</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900">
                    <span className="text-[10px] text-slate-400 uppercase">Total Alerts</span>
                    <div className="text-lg font-bold text-amber-400 mt-0.5">{reportModalData.executiveSummary.totalAlerts}</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900">
                    <span className="text-[10px] text-slate-400 uppercase">Governance</span>
                    <div className="text-lg font-bold text-emerald-400 mt-0.5">{reportModalData.executiveSummary.overallGovernanceStatus.replace('GOVERNANCE_', '')}</div>
                  </div>
                </div>
              </div>

              {/* Insights Section */}
              <div className="space-y-3">
                <h4 className="font-bold text-white uppercase text-[11px] tracking-wider">
                  Verified Executive Insights
                </h4>
                <div className="space-y-2">
                  {reportModalData.insights.map((ins) => (
                    <div key={ins.insightId} className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-white">{ins.title}</span>
                        {getSeverityBadge(ins.severity)}
                      </div>
                      <p className="text-slate-300">{ins.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recurring Patterns Section */}
              <div className="space-y-3">
                <h4 className="font-bold text-white uppercase text-[11px] tracking-wider">
                  Recurring Operational Patterns
                </h4>
                {reportModalData.recurringPatterns.length === 0 ? (
                  <p className="text-slate-500 italic">No recurring risk or incident patterns observed.</p>
                ) : (
                  <div className="space-y-2">
                    {reportModalData.recurringPatterns.map((pat) => (
                      <div key={pat.patternId} className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-purple-300 font-bold">{pat.patternType}</span>
                          <span className="text-[10px] font-bold text-rose-400">{pat.occurrences}x</span>
                        </div>
                        <p className="text-slate-300">{pat.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Mandatory Notices */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-[11px] text-slate-400">
                <div className="font-bold text-slate-300 uppercase tracking-wider text-[10px]">
                  Operational Safety & Human-in-the-Loop Safeguards
                </div>
                <p>{reportModalData.humanInTheLoopNotice}</p>
                <p>{reportModalData.limitationsNotice}</p>
              </div>
            </div>

            {/* Report Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-mono">
                Report ID: {reportModalData.reportId}
              </span>
              <button
                onClick={() => setReportModalData(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
