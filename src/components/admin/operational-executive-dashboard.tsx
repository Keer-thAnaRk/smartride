'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  RefreshCw,
  Search,
  Filter,
  Layers,
  Activity,
  FileText,
  ChevronRight,
  X,
  Info,
  Users,
  Bus,
  ExternalLink,
} from 'lucide-react';
import type { ExecutiveCorridorItem } from '@/lib/operations/executive-dashboard-types';
import type { OperationalAuditEventRecord } from '@/lib/operations/operational-audit-store';
import type { OperationalRecommendationRecord } from '@/lib/operations/recommendation-engine';

interface DashboardData {
  success: boolean;
  governanceNotice: string;
  summary: {
    totalRoutes: number;
    urgentReview: number;
    attentionRequired: number;
    monitor: number;
    normal: number;
    activeCriticalAlerts: number;
    unresolvedIncidents: number;
    criticalDemandRoutes: number;
    pendingRecommendations: number;
    recentAuditEvents: number;
  };
  corridors: ExecutiveCorridorItem[];
  topAttentionCorridors: ExecutiveCorridorItem[];
  safety: {
    activeCriticalAlerts: number;
    activeHighAlerts: number;
    activeMediumAlerts: number;
    activeLowAlerts: number;
    unresolvedCriticalIncidents: number;
    unresolvedHighIncidents: number;
    totalUnresolvedIncidents: number;
    recentSafetyEvents: {
      id: string;
      kind: 'ALERT' | 'INCIDENT';
      routeCode: string;
      severity: string;
      title: string;
      status: string;
      createdAt: string;
    }[];
  };
  demand: {
    criticalDemandRoutes: number;
    highDemandRoutes: number;
    averageOccupancy: number | null;
    capacityPressureCorridors: string[];
    insufficientDataCorridors: string[];
    insufficientDataNotice: string | null;
  };
  recommendations: {
    total: number;
    pending: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    approved: number;
    completed: number;
    dismissed: number;
    items: OperationalRecommendationRecord[];
  };
  recentActivity: OperationalAuditEventRecord[];
  auditIntegrity: {
    status: 'VERIFIED' | 'REVIEW_REQUIRED';
    totalVerified: number;
    integrityFailures: number;
    chainBreaks: number;
  };
  generatedAt: string;
}

export default function OperationalExecutiveDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCorridor, setSelectedCorridor] = useState<ExecutiveCorridorItem | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [riskFilter, setRiskFilter] = useState<string>('ALL');
  const [demandFilter, setDemandFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/operations/executive-dashboard');
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Authentication session expired. Please sign in as Administrator.');
        }
        if (res.status === 403) {
          throw new Error('Access denied. Administrator privileges required.');
        }
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Server responded with HTTP ${res.status}`);
      }
      const json: DashboardData = await res.json();
      setData(json);
      // If a corridor is selected, keep it updated with fresh data
      if (selectedCorridor) {
        const updated = json.corridors.find((c) => c.routeId === selectedCorridor.routeId);
        if (updated) setSelectedCorridor(updated);
      }
    } catch (err: any) {
      console.error('[OperationalExecutiveDashboard] Fetch error:', err);
      setError(err.message || 'Unable to load operational intelligence.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Filtered corridors list
  const filteredCorridors = useMemo(() => {
    if (!data?.corridors) return [];
    return data.corridors.filter((c) => {
      // Status filter
      if (statusFilter !== 'ALL' && c.operationalStatus !== statusFilter) {
        return false;
      }
      // Risk filter
      if (riskFilter !== 'ALL' && c.riskLevel !== riskFilter) {
        return false;
      }
      // Demand filter
      if (demandFilter !== 'ALL') {
        if (demandFilter === 'INSUFFICIENT_DATA' && c.dataQuality !== 'INSUFFICIENT_DATA') {
          return false;
        }
        if (demandFilter === 'CRITICAL' && c.demandLevel !== 'CRITICAL' && (c.predictedOccupancy ?? 0) < 90) {
          return false;
        }
        if (demandFilter === 'HIGH' && c.demandLevel !== 'HIGH' && (c.predictedOccupancy ?? 0) < 80) {
          return false;
        }
        if (demandFilter === 'NORMAL' && (c.demandLevel === 'HIGH' || c.demandLevel === 'CRITICAL' || (c.predictedOccupancy ?? 0) >= 80)) {
          return false;
        }
      }
      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchesCode = c.routeCode.toLowerCase().includes(query);
        const matchesName = c.routeName.toLowerCase().includes(query);
        if (!matchesCode && !matchesName) return false;
      }
      return true;
    });
  }, [data?.corridors, statusFilter, riskFilter, demandFilter, searchQuery]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'URGENT_REVIEW':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <AlertCircle className="w-3 h-3 mr-1" /> URGENT REVIEW
          </span>
        );
      case 'ATTENTION_REQUIRED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <AlertTriangle className="w-3 h-3 mr-1" /> ATTENTION REQUIRED
          </span>
        );
      case 'MONITOR':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
            <Activity className="w-3 h-3 mr-1" /> MONITOR
          </span>
        );
      case 'NORMAL':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3 h-3 mr-1" /> NORMAL
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300">
            {status}
          </span>
        );
    }
  };

  const getRiskBadge = (score: number, level: string) => {
    let color = 'bg-emerald-100 text-emerald-800 border-emerald-300';
    if (level === 'CRITICAL') color = 'bg-rose-100 text-rose-800 border-rose-300';
    else if (level === 'HIGH') color = 'bg-orange-100 text-orange-800 border-orange-300';
    else if (level === 'MEDIUM') color = 'bg-amber-100 text-amber-800 border-amber-300';

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${color}`}>
        {score}/100 ({level})
      </span>
    );
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'RISING':
        return <span className="inline-flex items-center text-xs font-semibold text-rose-600"><ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> Rising</span>;
      case 'FALLING':
        return <span className="inline-flex items-center text-xs font-semibold text-emerald-600"><ArrowDownRight className="w-3.5 h-3.5 mr-0.5" /> Falling</span>;
      case 'STABLE':
        return <span className="inline-flex items-center text-xs font-semibold text-slate-600"><Minus className="w-3.5 h-3.5 mr-0.5" /> Stable</span>;
      default:
        return <span className="text-xs text-slate-400">No History</span>;
    }
  };

  const getDataQualityBadge = (quality: string) => {
    if (quality === 'INSUFFICIENT_DATA') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-300" title="Demand intelligence unavailable due to insufficient historical data">
          <Info className="w-3 h-3 mr-1 text-slate-500" /> Insufficient Data
        </span>
      );
    }
    if (quality === 'HIGH_DATA_QUALITY') {
      return <span className="text-[11px] font-medium text-emerald-700">High Confidence</span>;
    }
    if (quality === 'MEDIUM_DATA_QUALITY') {
      return <span className="text-[11px] font-medium text-blue-700">Moderate Confidence</span>;
    }
    return <span className="text-[11px] font-medium text-amber-700">Low Confidence</span>;
  };

  return (
    <div className="space-y-6">
      {/* 1. Mandatory Human-In-The-Loop Governance Safeguard Notice */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-amber-900 flex items-start space-x-3 shadow-sm">
        <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-bold text-amber-950 uppercase tracking-wide">
            Mandatory System Safety & Governance Notice
          </p>
          <p className="text-amber-900 leading-relaxed">
            {data?.governanceNotice ||
              'This dashboard is advisory and read-only. It presents verified operational intelligence for administrative review. No route, schedule, vehicle, driver, subscription, booking, seat allocation, dispatch, alert, incident, or recommendation is automatically modified.'}
          </p>
        </div>
      </div>

      {/* 2. Top Executive Header Strip */}
      <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Phase 3 • Step 11
            </span>
            <span className="text-xs text-slate-400">
              Generated: {data?.generatedAt ? new Date(data.generatedAt).toLocaleTimeString() : '...'}
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center space-x-2">
            <span>Operational Intelligence Executive Dashboard</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Unified, server-authoritative command view synthesizing corridor risk trends, safety alerts, incident cases, capacity pressure, and audit integrity across the transit network.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Audit Cryptographic Integrity Badge */}
          <div className="flex items-center space-x-2 bg-slate-950/80 border border-slate-800 px-3 py-2 rounded-xl">
            <Shield className={`w-4 h-4 ${data?.auditIntegrity?.status === 'VERIFIED' ? 'text-emerald-400' : 'text-amber-400'}`} />
            <div className="text-left text-[11px]">
              <div className="text-slate-400 font-semibold uppercase tracking-wider text-[9px]">Audit Integrity</div>
              <div className="font-bold text-white">
                {data?.auditIntegrity?.status === 'VERIFIED' ? 'VERIFIED' : 'REVIEW REQUIRED'}
                <span className="text-[10px] text-slate-400 font-normal ml-1">
                  ({data?.auditIntegrity?.totalVerified ?? 0} events)
                </span>
              </div>
            </div>
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchDashboardData}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/30 disabled:opacity-50"
            title="Refresh Operational Intelligence"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Refreshing...' : 'Refresh Intelligence'}</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <span className="text-xs font-semibold">{error}</span>
          </div>
          <button
            onClick={fetchDashboardData}
            className="px-3 py-1 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* 3. Executive KPI Strip (8 Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {/* KPI 1: Total Corridors */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Corridors</span>
            <Bus className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-xl font-black text-slate-900">{data?.summary?.totalRoutes ?? 0}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Active network corridors</div>
        </div>

        {/* KPI 2: Urgent Review */}
        <div className={`border rounded-2xl p-3.5 shadow-sm ${(data?.summary?.urgentReview ?? 0) > 0 ? 'bg-rose-50 border-rose-300' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${(data?.summary?.urgentReview ?? 0) > 0 ? 'text-rose-900' : 'text-slate-500'}`}>Urgent Review</span>
            <AlertCircle className={`w-4 h-4 ${(data?.summary?.urgentReview ?? 0) > 0 ? 'text-rose-600 animate-pulse' : 'text-slate-400'}`} />
          </div>
          <div className={`text-xl font-black ${(data?.summary?.urgentReview ?? 0) > 0 ? 'text-rose-700' : 'text-slate-900'}`}>
            {data?.summary?.urgentReview ?? 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Critical risk or alert corridors</div>
        </div>

        {/* KPI 3: Attention Required */}
        <div className={`border rounded-2xl p-3.5 shadow-sm ${(data?.summary?.attentionRequired ?? 0) > 0 ? 'bg-amber-50 border-amber-300' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${(data?.summary?.attentionRequired ?? 0) > 0 ? 'text-amber-900' : 'text-slate-500'}`}>Attention Req.</span>
            <AlertTriangle className={`w-4 h-4 ${(data?.summary?.attentionRequired ?? 0) > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
          </div>
          <div className={`text-xl font-black ${(data?.summary?.attentionRequired ?? 0) > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
            {data?.summary?.attentionRequired ?? 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Elevated risk or demand</div>
        </div>

        {/* KPI 4: Active Critical Alerts */}
        <div className={`border rounded-2xl p-3.5 shadow-sm ${(data?.summary?.activeCriticalAlerts ?? 0) > 0 ? 'bg-rose-50 border-rose-300' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${(data?.summary?.activeCriticalAlerts ?? 0) > 0 ? 'text-rose-900' : 'text-slate-500'}`}>Critical Alerts</span>
            <Shield className={`w-4 h-4 ${(data?.summary?.activeCriticalAlerts ?? 0) > 0 ? 'text-rose-600' : 'text-slate-400'}`} />
          </div>
          <div className={`text-xl font-black ${(data?.summary?.activeCriticalAlerts ?? 0) > 0 ? 'text-rose-700' : 'text-slate-900'}`}>
            {data?.summary?.activeCriticalAlerts ?? 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Unresolved emergency alerts</div>
        </div>

        {/* KPI 5: Unresolved Incidents */}
        <div className={`border rounded-2xl p-3.5 shadow-sm ${(data?.summary?.unresolvedIncidents ?? 0) > 0 ? 'bg-orange-50 border-orange-300' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${(data?.summary?.unresolvedIncidents ?? 0) > 0 ? 'text-orange-900' : 'text-slate-500'}`}>Open Cases</span>
            <Layers className={`w-4 h-4 ${(data?.summary?.unresolvedIncidents ?? 0) > 0 ? 'text-orange-600' : 'text-slate-400'}`} />
          </div>
          <div className={`text-xl font-black ${(data?.summary?.unresolvedIncidents ?? 0) > 0 ? 'text-orange-700' : 'text-slate-900'}`}>
            {data?.summary?.unresolvedIncidents ?? 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Formal incident cases</div>
        </div>

        {/* KPI 6: Critical Demand */}
        <div className={`border rounded-2xl p-3.5 shadow-sm ${(data?.summary?.criticalDemandRoutes ?? 0) > 0 ? 'bg-purple-50 border-purple-300' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${(data?.summary?.criticalDemandRoutes ?? 0) > 0 ? 'text-purple-900' : 'text-slate-500'}`}>Peak Demand</span>
            <Users className={`w-4 h-4 ${(data?.summary?.criticalDemandRoutes ?? 0) > 0 ? 'text-purple-600' : 'text-slate-400'}`} />
          </div>
          <div className={`text-xl font-black ${(data?.summary?.criticalDemandRoutes ?? 0) > 0 ? 'text-purple-700' : 'text-slate-900'}`}>
            {data?.summary?.criticalDemandRoutes ?? 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Occupancy ≥ 90%</div>
        </div>

        {/* KPI 7: Pending Recommendations */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Pending Recs</span>
            <FileText className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-xl font-black text-slate-900">{data?.summary?.pendingRecommendations ?? 0}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Actions awaiting approval</div>
        </div>

        {/* KPI 8: Recent Audit Events */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Audit Events</span>
            <Activity className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-black text-slate-900">{data?.summary?.recentAuditEvents ?? 0}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Verified governance trail</div>
        </div>
      </div>

      {/* 4. Operational Health Overview: Corridors Distribution */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Network Operational Health Overview</h2>
            <p className="text-xs text-slate-500">
              Deterministic categorization of all {data?.summary?.totalRoutes ?? 0} corridors by current operational urgency.
            </p>
          </div>
          <div className="flex items-center space-x-2 text-xs font-semibold">
            <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
              Urgent: {data?.summary?.urgentReview ?? 0}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
              Attention: {data?.summary?.attentionRequired ?? 0}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
              Monitor: {data?.summary?.monitor ?? 0}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
              Normal: {data?.summary?.normal ?? 0}
            </span>
          </div>
        </div>

        {/* Multi-segment status bar */}
        {data?.summary?.totalRoutes ? (
          <div className="space-y-1.5">
            <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
              <div
                style={{ width: `${((data.summary.urgentReview) / data.summary.totalRoutes) * 100}%` }}
                className="bg-rose-500 transition-all duration-500"
                title={`Urgent Review: ${data.summary.urgentReview}`}
              />
              <div
                style={{ width: `${((data.summary.attentionRequired) / data.summary.totalRoutes) * 100}%` }}
                className="bg-amber-500 transition-all duration-500"
                title={`Attention Required: ${data.summary.attentionRequired}`}
              />
              <div
                style={{ width: `${((data.summary.monitor) / data.summary.totalRoutes) * 100}%` }}
                className="bg-blue-500 transition-all duration-500"
                title={`Monitor: ${data.summary.monitor}`}
              />
              <div
                style={{ width: `${((data.summary.normal) / data.summary.totalRoutes) * 100}%` }}
                className="bg-emerald-500 transition-all duration-500"
                title={`Normal: ${data.summary.normal}`}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500 font-medium">
              <span>{Math.round(((data.summary.urgentReview + data.summary.attentionRequired) / data.summary.totalRoutes) * 100)}% Corridors Elevated</span>
              <span>{Math.round(((data.summary.normal) / data.summary.totalRoutes) * 100)}% Corridors Nominal</span>
            </div>
          </div>
        ) : null}
      </div>

      {/* 5. Top Attention Corridors (Visible when any corridor requires urgent/attention) */}
      {(data?.topAttentionCorridors?.length ?? 0) > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Corridors Requiring Administrative Attention</span>
            </h2>
            <span className="text-xs text-slate-500">
              {data?.topAttentionCorridors.length} corridor(s) currently flagged for review
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data?.topAttentionCorridors.map((corridor) => (
              <div
                key={corridor.routeId}
                onClick={() => setSelectedCorridor(corridor)}
                className={`p-4 rounded-2xl border cursor-pointer transition hover:shadow-md ${
                  corridor.operationalStatus === 'URGENT_REVIEW'
                    ? 'bg-rose-50/40 border-rose-200 hover:border-rose-300'
                    : 'bg-amber-50/40 border-amber-200 hover:border-amber-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-extrabold text-sm text-slate-900">{corridor.routeCode}</span>
                      {getStatusBadge(corridor.operationalStatus)}
                    </div>
                    <div className="text-xs font-medium text-slate-600 mt-1 line-clamp-1">
                      {corridor.routeName}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 mt-1" />
                </div>

                <div className="mt-3 pt-3 border-t border-slate-200/60 grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Risk</div>
                    <div className="font-bold text-slate-900 mt-0.5">{corridor.riskScore}/100</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Alerts</div>
                    <div className="font-bold text-rose-600 mt-0.5">{corridor.activeAlertsCount}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Occupancy</div>
                    <div className="font-bold text-slate-900 mt-0.5">
                      {corridor.predictedOccupancy !== null ? `${corridor.predictedOccupancy}%` : 'N/A'}
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-600 mt-3 line-clamp-2 italic bg-white/70 p-2 rounded-lg border border-slate-200/50">
                  &ldquo;{corridor.briefing}&rdquo;
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Filter & Search Strip */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
          <div className="flex items-center space-x-1.5 text-xs text-slate-500 mr-1">
            <Filter className="w-3.5 h-3.5" />
            <span className="font-bold">Filters:</span>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">Status: All</option>
            <option value="URGENT_REVIEW">Urgent Review</option>
            <option value="ATTENTION_REQUIRED">Attention Required</option>
            <option value="MONITOR">Monitor</option>
            <option value="NORMAL">Normal</option>
          </select>

          {/* Risk Filter */}
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">Risk: All</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          {/* Demand Filter */}
          <select
            value={demandFilter}
            onChange={(e) => setDemandFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">Demand: All</option>
            <option value="CRITICAL">Critical (≥90%)</option>
            <option value="HIGH">High (≥80%)</option>
            <option value="NORMAL">Normal (&lt;80%)</option>
            <option value="INSUFFICIENT_DATA">Insufficient Data</option>
          </select>

          {(statusFilter !== 'ALL' || riskFilter !== 'ALL' || demandFilter !== 'ALL' || searchQuery) && (
            <button
              onClick={() => {
                setStatusFilter('ALL');
                setRiskFilter('ALL');
                setDemandFilter('ALL');
                setSearchQuery('');
              }}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-bold underline px-2"
            >
              Reset
            </button>
          )}
        </div>

        {/* Text Search */}
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search corridor or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* 7. Primary Corridor Intelligence Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Corridor Operational Intelligence Matrix</h2>
            <p className="text-xs text-slate-500">
              Deterministic priority order: Urgent Review &gt; Attention Required &gt; Monitor &gt; Normal, then risk score descending.
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            Showing {filteredCorridors.length} of {data?.corridors?.length ?? 0} corridors
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 border-collapse">
            <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Corridor</th>
                <th className="py-3 px-4">Operational Status</th>
                <th className="py-3 px-4">Risk & Trend</th>
                <th className="py-3 px-4 text-center">Active Alerts</th>
                <th className="py-3 px-4 text-center">Unresolved Cases</th>
                <th className="py-3 px-4">Predicted Occupancy</th>
                <th className="py-3 px-4 text-center">Pending Recs</th>
                <th className="py-3 px-4">Data Quality</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCorridors.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 text-xs">
                    No corridors match the selected filter criteria.
                  </td>
                </tr>
              ) : (
                filteredCorridors.map((corridor) => (
                  <tr
                    key={corridor.routeId}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    {/* Corridor */}
                    <td className="py-3.5 px-4">
                      <div className="font-extrabold text-slate-900">{corridor.routeCode}</div>
                      <div className="text-[11px] text-slate-500 line-clamp-1">{corridor.routeName}</div>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">{getStatusBadge(corridor.operationalStatus)}</td>

                    {/* Risk & Trend */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-2">
                        {getRiskBadge(corridor.riskScore, corridor.riskLevel)}
                        {getTrendIcon(corridor.riskTrend)}
                      </div>
                    </td>

                    {/* Active Alerts */}
                    <td className="py-3.5 px-4 text-center">
                      {corridor.activeAlertsCount > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700">
                          {corridor.activeAlertsCount}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>

                    {/* Unresolved Incidents */}
                    <td className="py-3.5 px-4 text-center">
                      {corridor.unresolvedIncidentsCount > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700">
                          {corridor.unresolvedIncidentsCount}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>

                    {/* Predicted Occupancy */}
                    <td className="py-3.5 px-4">
                      {corridor.predictedOccupancy !== null ? (
                        <div>
                          <div className="font-bold text-slate-800">{corridor.predictedOccupancy}%</div>
                          <div className="text-[10px] text-slate-400">{corridor.demandLevel || 'NORMAL'}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">Insufficient Data</span>
                      )}
                    </td>

                    {/* Pending Recs */}
                    <td className="py-3.5 px-4 text-center">
                      {corridor.pendingRecommendationsCount > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                          {corridor.pendingRecommendationsCount}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>

                    {/* Data Quality */}
                    <td className="py-3.5 px-4">{getDataQualityBadge(corridor.dataQuality)}</td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setSelectedCorridor(corridor)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-lg text-xs font-bold transition flex items-center space-x-1 ml-auto"
                      >
                        <span>Inspect</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 8. Three Focused Intelligence Overview Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel A: Safety Situation */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <Shield className="w-4 h-4 text-rose-600" />
              <span>Safety Situation</span>
            </h2>
            <span className="text-[10px] uppercase font-bold text-slate-400">Read-Only</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 bg-slate-50 rounded-xl">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Active Critical Alerts</div>
              <div className="text-lg font-black text-rose-600">{data?.safety?.activeCriticalAlerts ?? 0}</div>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Active High Alerts</div>
              <div className="text-lg font-black text-orange-600">{data?.safety?.activeHighAlerts ?? 0}</div>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Open Incidents</div>
              <div className="text-lg font-black text-slate-800">{data?.safety?.totalUnresolvedIncidents ?? 0}</div>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Critical Incidents</div>
              <div className="text-lg font-black text-rose-600">{data?.safety?.unresolvedCriticalIncidents ?? 0}</div>
            </div>
          </div>

          <div>
            <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">Recent Safety Events</div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {(data?.safety?.recentSafetyEvents?.length ?? 0) === 0 ? (
                <div className="text-xs text-slate-400 italic py-2">No active safety alerts or open incidents.</div>
              ) : (
                data?.safety?.recentSafetyEvents.map((evt) => (
                  <div key={evt.id} className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-extrabold text-slate-800 mr-1.5">{evt.routeCode}</span>
                      <span className="text-slate-600 text-[11px]">{evt.title}</span>
                    </div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      evt.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {evt.severity}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Panel B: Demand & Capacity Situation */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <Users className="w-4 h-4 text-purple-600" />
              <span>Demand & Capacity Situation</span>
            </h2>
            <span className="text-[10px] uppercase font-bold text-slate-400">Ridership</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 bg-slate-50 rounded-xl">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Critical Demand (&ge;90%)</div>
              <div className="text-lg font-black text-purple-700">{data?.demand?.criticalDemandRoutes ?? 0}</div>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">High Demand (&ge;80%)</div>
              <div className="text-lg font-black text-indigo-700">{data?.demand?.highDemandRoutes ?? 0}</div>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl col-span-2">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Fleet Average Predicted Occupancy</div>
              <div className="text-xl font-black text-slate-900">
                {data?.demand?.averageOccupancy !== null ? `${data?.demand?.averageOccupancy}%` : 'Unavailable'}
              </div>
            </div>
          </div>

          {/* Insufficient Data Explanation */}
          {data?.demand?.insufficientDataNotice && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-start space-x-2">
              <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-800">Notice on Telemetry: </span>
                {data.demand.insufficientDataNotice}
              </div>
            </div>
          )}

          {/* Capacity Pressure Corridors */}
          <div>
            <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">High Occupancy Corridors</div>
            {(data?.demand?.capacityPressureCorridors?.length ?? 0) === 0 ? (
              <div className="text-xs text-slate-400 italic">No corridors currently under capacity pressure.</div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {data?.demand?.capacityPressureCorridors.map((code) => (
                  <span key={code} className="px-2.5 py-1 bg-purple-50 text-purple-800 border border-purple-200 rounded-lg text-xs font-extrabold">
                    {code}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Panel C: Recommendation Situation */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <FileText className="w-4 h-4 text-blue-600" />
              <span>Operational Recommendations</span>
            </h2>
            <span className="text-[10px] uppercase font-bold text-slate-400">Advisory</span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs text-center">
            <div className="p-2.5 bg-blue-50/60 rounded-xl border border-blue-100">
              <div className="text-[10px] text-blue-800 uppercase font-semibold">Pending</div>
              <div className="text-lg font-black text-blue-900">{data?.recommendations?.pending ?? 0}</div>
            </div>
            <div className="p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-100">
              <div className="text-[10px] text-emerald-800 uppercase font-semibold">Approved</div>
              <div className="text-lg font-black text-emerald-900">{data?.recommendations?.approved ?? 0}</div>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
              <div className="text-[10px] text-slate-600 uppercase font-semibold">Completed</div>
              <div className="text-lg font-black text-slate-900">{data?.recommendations?.completed ?? 0}</div>
            </div>
          </div>

          <div>
            <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">Pending Action Queue</div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {(data?.recommendations?.items?.filter((r) => r.status === 'PENDING').length ?? 0) === 0 ? (
                <div className="text-xs text-slate-400 italic py-2">No pending recommendations in the queue.</div>
              ) : (
                data?.recommendations?.items
                  ?.filter((r) => r.status === 'PENDING')
                  .slice(0, 5)
                  .map((rec) => (
                    <div key={rec.id} className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-extrabold text-slate-800 mr-1.5">{rec.routeCode}</span>
                        <span className="text-slate-600 text-[11px] line-clamp-1">{rec.title}</span>
                      </div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        rec.priority === 'CRITICAL' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {rec.priority}
                      </span>
                    </div>
                  ))
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 italic">
            Actions are executed in the Operational Recommendation Center below.
          </div>
        </div>
      </div>

      {/* 9. Recent Operational Activity Timeline (Step 8 Audit Integration) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <Activity className="w-4 h-4 text-emerald-600" />
              <span>Recent Operational Activity Timeline</span>
            </h2>
            <p className="text-xs text-slate-500">
              Immutable, server-authoritative audit log of human administrative decisions and intelligence reviews.
            </p>
          </div>
          <div className="flex items-center space-x-2 text-xs">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
              <CheckCircle2 className="w-3 h-3 mr-1" /> SHA-256 Verified
            </span>
          </div>
        </div>

        <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
          {(data?.recentActivity?.length ?? 0) === 0 ? (
            <div className="text-xs text-slate-400 italic py-4 text-center">No recent audit activity recorded.</div>
          ) : (
            data?.recentActivity.map((evt) => (
              <div key={evt.id} className="py-2.5 flex items-start justify-between text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <span className="font-extrabold text-slate-800">{evt.eventType}</span>
                    {evt.routeCode && (
                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold">
                        {evt.routeCode}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400">({evt.sourceModule})</span>
                  </div>
                  <div className="text-slate-600 text-[11px]">{evt.description}</div>
                </div>

                <div className="text-right text-[11px] text-slate-400 flex-shrink-0 ml-4">
                  <div className="font-medium text-slate-700">{evt.actorName || evt.actorRole}</div>
                  <div>{new Date(evt.createdAt).toLocaleTimeString()}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 10. "Why This Needs Attention" Detail Drawer */}
      {selectedCorridor && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex justify-end transition-opacity">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl overflow-y-auto flex flex-col">
            {/* Drawer Header */}
            <div className="p-6 bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-10 flex items-start justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-lg font-black tracking-tight">{selectedCorridor.routeCode}</span>
                  {getStatusBadge(selectedCorridor.operationalStatus)}
                </div>
                <h2 className="text-sm font-semibold text-slate-300 mt-1">{selectedCorridor.routeName}</h2>
              </div>
              <button
                onClick={() => setSelectedCorridor(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                title="Close intelligence drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="p-6 space-y-6 flex-1 text-slate-700 text-xs">
              {/* Executive Briefing Callout */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 text-indigo-950 space-y-1 shadow-sm">
                <div className="font-bold text-indigo-900 text-[11px] uppercase tracking-wider flex items-center space-x-1.5">
                  <Info className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Executive Operational Briefing</span>
                </div>
                <p className="text-xs leading-relaxed font-medium">
                  {selectedCorridor.briefing}
                </p>
              </div>

              {/* Contributing Conditions Explanation */}
              {(selectedCorridor.explanation?.length ?? 0) > 0 && (
                <div className="space-y-2">
                  <div className="font-bold text-slate-900 uppercase text-[11px] tracking-wider">
                    Contributing Operational Factors
                  </div>
                  <ul className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    {selectedCorridor.explanation.map((item, idx) => (
                      <li key={idx} className="flex items-start space-x-2 text-slate-700">
                        <span className="text-indigo-600 font-bold">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Grid: Risk & Demand */}
              <div className="grid grid-cols-2 gap-4">
                {/* Risk Box */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                  <div className="font-bold text-slate-900 uppercase text-[10px] tracking-wider">Risk Profile</div>
                  <div className="text-2xl font-black text-slate-900">{selectedCorridor.riskScore}/100</div>
                  <div className="space-y-1 text-slate-600 text-[11px]">
                    <div>Level: <span className="font-bold text-slate-800">{selectedCorridor.riskLevel}</span></div>
                    <div>Trend: <span className="font-bold text-slate-800">{selectedCorridor.riskTrend}</span></div>
                    {selectedCorridor.scoreDelta !== null && (
                      <div>Delta: <span className="font-bold text-slate-800">{selectedCorridor.scoreDelta > 0 ? `+${selectedCorridor.scoreDelta}` : selectedCorridor.scoreDelta}</span></div>
                    )}
                  </div>
                </div>

                {/* Demand Box */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                  <div className="font-bold text-slate-900 uppercase text-[10px] tracking-wider">Capacity & Demand</div>
                  <div className="text-2xl font-black text-slate-900">
                    {selectedCorridor.predictedOccupancy !== null ? `${selectedCorridor.predictedOccupancy}%` : 'N/A'}
                  </div>
                  <div className="space-y-1 text-slate-600 text-[11px]">
                    <div>Shuttle Capacity: <span className="font-bold text-slate-800">{selectedCorridor.vehicleCapacity} seats</span></div>
                    <div>Predicted Demand: <span className="font-bold text-slate-800">{selectedCorridor.predictedDemand ?? 'N/A'} riders</span></div>
                    <div>Data Quality: {getDataQualityBadge(selectedCorridor.dataQuality)}</div>
                  </div>
                </div>
              </div>

              {/* Active Safety Alerts for this route */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-900 uppercase text-[11px] tracking-wider">
                    Active Safety Alerts ({selectedCorridor.activeAlertsCount})
                  </div>
                </div>
                {(selectedCorridor.evidence?.alertEvidence?.length ?? 0) === 0 ? (
                  <div className="p-3 bg-slate-50 rounded-xl text-slate-400 italic">No active safety alerts for this corridor.</div>
                ) : (
                  <div className="space-y-2">
                    {selectedCorridor.evidence.alertEvidence.map((alert: any) => (
                      <div key={alert.id} className="p-3 bg-rose-50/50 border border-rose-200 rounded-xl">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-rose-900">{alert.title}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-200 text-rose-800">{alert.severity}</span>
                        </div>
                        <p className="text-slate-600 text-[11px] mt-1">{alert.description || alert.reason}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pending Recommendations for this route */}
              <div className="space-y-2">
                <div className="font-bold text-slate-900 uppercase text-[11px] tracking-wider">
                  Pending Recommendations ({selectedCorridor.pendingRecommendationsCount})
                </div>
                {(selectedCorridor.pendingRecommendations?.length ?? 0) === 0 ? (
                  <div className="p-3 bg-slate-50 rounded-xl text-slate-400 italic">No pending recommendations for this corridor.</div>
                ) : (
                  <div className="space-y-2">
                    {selectedCorridor.pendingRecommendations.map((rec) => (
                      <div key={rec.id} className="p-3 bg-blue-50/50 border border-blue-200 rounded-xl space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-blue-900">{rec.title}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-200 text-blue-800">{rec.priority}</span>
                        </div>
                        <p className="text-slate-600 text-[11px]">{rec.recommendation}</p>
                        <div className="text-[10px] text-slate-400 italic">Created {new Date(rec.createdAt).toLocaleDateString()}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Corridor Audit Trail */}
              <div className="space-y-2">
                <div className="font-bold text-slate-900 uppercase text-[11px] tracking-wider">
                  Corridor Audit Trail ({selectedCorridor.recentAuditEvents?.length ?? 0})
                </div>
                {(selectedCorridor.recentAuditEvents?.length ?? 0) === 0 ? (
                  <div className="p-3 bg-slate-50 rounded-xl text-slate-400 italic">No recent audit activity for this corridor.</div>
                ) : (
                  <div className="space-y-1.5">
                    {selectedCorridor.recentAuditEvents.map((evt) => (
                      <div key={evt.id} className="p-2 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-800">{evt.eventType}</div>
                          <div className="text-[10px] text-slate-500">{evt.description}</div>
                        </div>
                        <div className="text-right text-[10px] text-slate-400">
                          <div>{evt.actorName || evt.actorRole}</div>
                          <div>{new Date(evt.createdAt).toLocaleTimeString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-500 flex items-center justify-between">
              <span>Read-only operational briefing</span>
              <button
                onClick={() => setSelectedCorridor(null)}
                className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-700 transition"
              >
                Close Panel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
