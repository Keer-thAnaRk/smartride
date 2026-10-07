'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Activity,
  AlertTriangle,
  RotateCcw,
  Info,
  Clock,
  Bus,
  Users,
  CheckCircle2,
  FileText,
  TrendingUp,
  TrendingDown,
  Minus,
  Layers,
  Crosshair,
  Compass,
  X,
  ChevronRight,
  Filter,
  CheckCircle,
  AlertOctagon,
  LifeBuoy,
  Lock,
  Search,
  ExternalLink,
  Sliders,
  Database,
  Eye,
} from 'lucide-react';
import {
  MANDATORY_MASTER_CONTROL_NOTICE,
  MasterOperationalControlResponse,
  CorridorMasterIntelligence,
  OperationalStatus,
  IntelligenceHealthState,
} from '@/lib/operations/master-control-engine';

export default function MasterOperationalControlCenter() {
  const [data, setData] = useState<MasterOperationalControlResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCorridor, setSelectedCorridor] = useState<CorridorMasterIntelligence | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('RISK');

  // Load consolidated intelligence
  const fetchIntelligence = async (routeId?: string, isAudit: boolean = false) => {
    setLoading(true);
    setError(null);
    try {
      let url = '/api/operations/master-control';
      const params = new URLSearchParams();
      if (routeId) params.append('routeId', routeId);
      if (isAudit) params.append('audit', 'true');
      const queryString = params.toString();
      if (queryString) url += `?${queryString}`;

      const res = await fetch(url);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP error ${res.status}`);
      }
      const json: MasterOperationalControlResponse = await res.json();
      setData(json);

      if (json.corridors && json.corridors.length > 0) {
        if (selectedCorridor) {
          const matched = json.corridors.find((c) => c.route.id === selectedCorridor.route.id);
          setSelectedCorridor(matched || json.corridors[0]);
        } else {
          setSelectedCorridor(json.corridors[0]);
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load master operational intelligence');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntelligence();
  }, []);

  // Filter corridors
  const filteredCorridors = (data?.corridors || []).filter((c) => {
    if (statusFilter !== 'ALL' && c.operationalStatus !== statusFilter) return false;
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      const codeMatch = c.route.code.toLowerCase().includes(q);
      const nameMatch = c.route.name.toLowerCase().includes(q);
      if (!codeMatch && !nameMatch) return false;
    }
    return true;
  });

  const getStatusBadge = (status: OperationalStatus) => {
    switch (status) {
      case 'URGENT_REVIEW':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-extrabold bg-rose-600 text-white shadow-sm">
            <AlertOctagon className="w-3 h-3 mr-1" /> URGENT REVIEW
          </span>
        );
      case 'ATTENTION_REQUIRED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-extrabold bg-amber-500 text-slate-950 shadow-sm">
            <AlertTriangle className="w-3 h-3 mr-1" /> ATTENTION REQ
          </span>
        );
      case 'MONITOR':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
            <Activity className="w-3 h-3 mr-1" /> MONITOR
          </span>
        );
      case 'NORMAL':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <CheckCircle className="w-3 h-3 mr-1" /> NORMAL
          </span>
        );
      default:
        return null;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'RISING':
        return <TrendingUp className="w-3.5 h-3.5 text-rose-400 inline mr-1" />;
      case 'FALLING':
        return <TrendingDown className="w-3.5 h-3.5 text-emerald-400 inline mr-1" />;
      case 'STABLE':
        return <Minus className="w-3.5 h-3.5 text-slate-400 inline mr-1" />;
      default:
        return <span className="text-[10px] text-slate-500 mr-1">—</span>;
    }
  };

  const getHealthBadge = (health: IntelligenceHealthState) => {
    switch (health) {
      case 'AVAILABLE':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            AVAILABLE
          </span>
        );
      case 'DEGRADED':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            DEGRADED
          </span>
        );
      case 'UNAVAILABLE':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
            UNAVAILABLE
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
      {/* 1. Master Control Header & Mandatory Advisory Notice */}
      <div className="p-6 bg-slate-950 border-b border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400 shadow-inner">
              <Crosshair className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold tracking-tight text-white">
                  Master Operational Control Center
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2.5 py-0.5 rounded-full">
                  Phase 3 Step 16 Consolidation
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                  Authoritative
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Single authoritative administrative orchestration workspace consolidating verified operational intelligence from Steps 1–15.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="text-right hidden sm:block">
              <span className="text-[11px] text-slate-400 block">Server Refresh Timestamp:</span>
              <span className="text-xs font-mono text-slate-300">
                {data ? new Date(data.generatedAt).toLocaleTimeString() : '—'}
              </span>
            </div>
            <button
              onClick={() => fetchIntelligence()}
              disabled={loading}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow transition disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Operational Intelligence</span>
            </button>
          </div>
        </div>

        {/* Mandatory Advisory Notice Banner */}
        <div className="mt-4 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start space-x-3">
          <ShieldAlert className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-200">
            <strong className="font-semibold text-amber-300 uppercase tracking-wide mr-1.5">
              Mandatory Governance Notice:
            </strong>
            {MANDATORY_MASTER_CONTROL_NOTICE}
          </div>
        </div>
      </div>

      {/* 2. Master KPI Area (12 Executive KPI Cards) */}
      {data?.executiveSummary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-px bg-slate-800 border-b border-slate-800">
          <div className="bg-slate-900/95 p-3.5">
            <span className="text-[11px] font-medium text-slate-400 block">Total Corridors</span>
            <div className="mt-1 flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-white">{data.executiveSummary.totalCorridors}</span>
              <span className="text-[10px] text-slate-500">Monitored</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">Active Network</span>
          </div>

          <div className="bg-slate-900/95 p-3.5">
            <span className="text-[11px] font-medium text-rose-400 block">Urgent Review</span>
            <div className="mt-1 flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-rose-400">{data.executiveSummary.urgentReviewCorridors}</span>
              <span className="text-[10px] text-rose-400">Routes</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">Immediate Intervention</span>
          </div>

          <div className="bg-slate-900/95 p-3.5">
            <span className="text-[11px] font-medium text-amber-400 block">Attention Required</span>
            <div className="mt-1 flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-amber-400">
                {data.executiveSummary.attentionRequiredCorridors}
              </span>
              <span className="text-[10px] text-amber-400">Routes</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">Action Recommended</span>
          </div>

          <div className="bg-slate-900/95 p-3.5">
            <span className="text-[11px] font-medium text-blue-400 block">Monitor State</span>
            <div className="mt-1 flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-blue-400">{data.executiveSummary.monitorCorridors}</span>
              <span className="text-[10px] text-blue-400">Routes</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">Telemetry Surveillance</span>
          </div>

          <div className="bg-slate-900/95 p-3.5">
            <span className="text-[11px] font-medium text-emerald-400 block">Normal State</span>
            <div className="mt-1 flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-emerald-400">{data.executiveSummary.normalCorridors}</span>
              <span className="text-[10px] text-emerald-400">Routes</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">Optimal Performance</span>
          </div>

          <div className="bg-slate-900/95 p-3.5">
            <span className="text-[11px] font-medium text-rose-400 block">Critical Risk</span>
            <div className="mt-1 flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-rose-300">{data.executiveSummary.criticalRiskCorridors}</span>
              <span className="text-[10px] text-rose-400">Routes</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              +{data.executiveSummary.highRiskCorridors} High Risk
            </span>
          </div>

          <div className="bg-slate-900/95 p-3.5">
            <span className="text-[11px] font-medium text-cyan-400 block">Critical Alerts</span>
            <div className="mt-1 flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-cyan-300">{data.executiveSummary.activeCriticalAlerts}</span>
              <span className="text-[10px] text-cyan-400">Active</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              {data.executiveSummary.activeTotalAlerts} Total Alerts
            </span>
          </div>

          <div className="bg-slate-900/95 p-3.5">
            <span className="text-[11px] font-medium text-yellow-400 block">Open Incidents</span>
            <div className="mt-1 flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-yellow-300">{data.executiveSummary.unresolvedIncidents}</span>
              <span className="text-[10px] text-yellow-400">Cases</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              {data.executiveSummary.criticalIncidents} Critical Severity
            </span>
          </div>

          <div className="bg-slate-900/95 p-3.5">
            <span className="text-[11px] font-medium text-purple-400 block">Capacity Pressure</span>
            <div className="mt-1 flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-purple-300">
                {data.executiveSummary.criticalDemandCorridors + data.executiveSummary.highDemandCorridors}
              </span>
              <span className="text-[10px] text-purple-400">Routes</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              {data.executiveSummary.criticalDemandCorridors} Critical Demand
            </span>
          </div>

          <div className="bg-slate-900/95 p-3.5">
            <span className="text-[11px] font-medium text-indigo-400 block">Pending Recs</span>
            <div className="mt-1 flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-indigo-300">
                {data.executiveSummary.pendingRecommendations}
              </span>
              <span className="text-[10px] text-indigo-400">Pending</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              {data.executiveSummary.approvedRecommendations} Approved
            </span>
          </div>

          <div className="bg-slate-900/95 p-3.5">
            <span className="text-[11px] font-medium text-amber-400 block">Gov Exceptions</span>
            <div className="mt-1 flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-amber-300">
                {data.executiveSummary.unresolvedGovernanceFindings}
              </span>
              <span className="text-[10px] text-amber-400">Findings</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">Compliance Review</span>
          </div>

          <div className="bg-slate-900/95 p-3.5">
            <span className="text-[11px] font-medium text-emerald-400 block">Audit Integrity</span>
            <div className="mt-1 flex items-baseline space-x-2">
              <span
                className={`text-sm font-extrabold ${
                  data.executiveSummary.auditIntegrityStatus === 'VERIFIED'
                    ? 'text-emerald-300'
                    : 'text-rose-400'
                }`}
              >
                {data.executiveSummary.auditIntegrityStatus}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              {data.executiveSummary.totalVerifiedAuditEvents} Hashes Verified
            </span>
          </div>
        </div>
      )}

      {/* 3. Operational Intelligence Health Panel */}
      {data?.intelligenceHealth && (
        <div className="p-4 bg-slate-950/80 border-b border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <Database className="w-4 h-4 text-indigo-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Operational Intelligence Source Health
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">
              {data.executiveSummary.dataQualitySummary}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex flex-col justify-between">
              <div className="text-[10px] text-slate-400">Route Risk (S1)</div>
              <div className="flex items-center justify-between mt-1">
                {getHealthBadge(data.intelligenceHealth.riskIntelligence.state)}
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex flex-col justify-between">
              <div className="text-[10px] text-slate-400">Risk Trend (S2)</div>
              <div className="flex items-center justify-between mt-1">
                {getHealthBadge(data.intelligenceHealth.trendIntelligence.state)}
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex flex-col justify-between">
              <div className="text-[10px] text-slate-400">Safety Alerts (S3)</div>
              <div className="flex items-center justify-between mt-1">
                {getHealthBadge(data.intelligenceHealth.safetyAlerts.state)}
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex flex-col justify-between">
              <div className="text-[10px] text-slate-400">Incidents (S4)</div>
              <div className="flex items-center justify-between mt-1">
                {getHealthBadge(data.intelligenceHealth.incidentIntelligence.state)}
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex flex-col justify-between">
              <div className="text-[10px] text-slate-400">AI Demand (S5)</div>
              <div className="flex items-center justify-between mt-1">
                {getHealthBadge(data.intelligenceHealth.demandIntelligence.state)}
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex flex-col justify-between">
              <div className="text-[10px] text-slate-400">Recommendations (S7)</div>
              <div className="flex items-center justify-between mt-1">
                {getHealthBadge(data.intelligenceHealth.recommendationIntelligence.state)}
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex flex-col justify-between">
              <div className="text-[10px] text-slate-400">Governance (S9)</div>
              <div className="flex items-center justify-between mt-1">
                {getHealthBadge(data.intelligenceHealth.governanceIntelligence.state)}
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex flex-col justify-between">
              <div className="text-[10px] text-slate-400">Audit Ledger (S8)</div>
              <div className="flex items-center justify-between mt-1">
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    data.intelligenceHealth.auditIntegrity.status === 'VERIFIED'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {data.intelligenceHealth.auditIntegrity.status}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Filter & Search Controls */}
      <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search corridor code or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <span>Operational Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="URGENT_REVIEW">Urgent Review</option>
              <option value="ATTENTION_REQUIRED">Attention Required</option>
              <option value="MONITOR">Monitor</option>
              <option value="NORMAL">Normal</option>
            </select>
          </div>
        </div>

        <div className="text-xs text-slate-400">
          Showing <span className="font-semibold text-white">{filteredCorridors.length}</span> of{' '}
          <span className="font-semibold text-white">{data?.corridors.length || 0}</span> evaluated corridors
        </div>
      </div>

      {/* 5. Master Corridor Command Table (Section 6) */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-semibold">
              <th className="p-3 pl-6">Corridor</th>
              <th className="p-3">Status</th>
              <th className="p-3">Risk Score</th>
              <th className="p-3">Risk Level</th>
              <th className="p-3">Trend & Delta</th>
              <th className="p-3">Alerts (Crit/Tot)</th>
              <th className="p-3">Open Incidents</th>
              <th className="p-3">Demand (Occupancy)</th>
              <th className="p-3">Data Quality</th>
              <th className="p-3">Pending Recs</th>
              <th className="p-3">Governance</th>
              <th className="p-3 pr-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredCorridors.length === 0 ? (
              <tr>
                <td colSpan={12} className="p-8 text-center text-slate-500">
                  {loading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <RotateCcw className="w-4 h-4 animate-spin text-indigo-400" />
                      <span>Consolidating verified intelligence...</span>
                    </div>
                  ) : error ? (
                    <div className="text-rose-400">{error}</div>
                  ) : (
                    <div>No corridors match the current filter criteria.</div>
                  )}
                </td>
              </tr>
            ) : (
              filteredCorridors.map((c) => {
                const isSelected = selectedCorridor?.route.id === c.route.id;
                return (
                  <tr
                    key={c.route.id}
                    onClick={() => setSelectedCorridor(c)}
                    className={`cursor-pointer transition hover:bg-slate-800/40 ${
                      isSelected ? 'bg-indigo-500/10' : ''
                    }`}
                  >
                    <td className="p-3 pl-6">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-200 px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                          {c.route.code}
                        </span>
                        <div className="truncate max-w-[140px] text-slate-300 font-medium" title={c.route.name}>
                          {c.route.name}
                        </div>
                      </div>
                    </td>
                    <td className="p-3">{getStatusBadge(c.operationalStatus)}</td>
                    <td className="p-3 font-bold">
                      <span
                        className={
                          c.risk.score >= 70
                            ? 'text-rose-400'
                            : c.risk.score >= 40
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                        }
                      >
                        {c.risk.score}/100
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="text-[11px] font-semibold text-slate-300">{c.risk.level}</span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center">
                        {getTrendIcon(c.risk.trend)}
                        <span className="text-[11px] text-slate-300">{c.risk.trend}</span>
                        {c.risk.scoreDelta !== null && (
                          <span className="text-[10px] text-slate-500 ml-1">
                            ({c.risk.scoreDelta > 0 ? `+${c.risk.scoreDelta}` : c.risk.scoreDelta})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={c.safety.criticalAlerts > 0 ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                        {c.safety.criticalAlerts}
                      </span>
                      <span className="text-slate-500"> / {c.safety.totalActiveAlerts}</span>
                    </td>
                    <td className="p-3">
                      <span className={c.incidents.unresolvedCount > 0 ? 'text-amber-400 font-bold' : 'text-slate-300'}>
                        {c.incidents.unresolvedCount}
                      </span>
                    </td>
                    <td className="p-3">
                      {c.demand.predictedOccupancy !== null ? (
                        <div className="flex items-center space-x-1.5">
                          <span
                            className={`font-bold ${
                              c.demand.predictedOccupancy >= 90
                                ? 'text-rose-400'
                                : c.demand.predictedOccupancy >= 75
                                ? 'text-amber-400'
                                : 'text-slate-300'
                            }`}
                          >
                            {c.demand.predictedOccupancy}%
                          </span>
                          <span className="text-[10px] text-slate-500">
                            ({c.demand.predictedDemand} riders)
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500 italic text-[11px]">No forecast</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          c.demand.dataQuality === 'HIGH_DATA_QUALITY' || c.demand.dataQuality === 'VERIFIED'
                            ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                        }`}
                      >
                        {c.demand.dataQuality}
                      </span>
                    </td>
                    <td className="p-3 font-semibold text-slate-300">
                      {c.recommendations.pendingCount}
                    </td>
                    <td className="p-3">
                      <span
                        className={`text-[10px] font-bold ${
                          c.governance.status === 'GOVERNANCE_COMPLIANT'
                            ? 'text-emerald-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {c.governance.status.replace('GOVERNANCE_', '')}
                      </span>
                    </td>
                    <td className="p-3 pr-6 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCorridor(c);
                          setIsDrawerOpen(true);
                        }}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition"
                      >
                        <span>Workspace</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 6. Selected Corridor Quick Briefing Panel */}
      {selectedCorridor && (
        <div className="p-5 bg-slate-950/90 border-t border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-bold text-xs">
                {selectedCorridor.route.code}
              </span>
              <span className="font-bold text-white text-sm">{selectedCorridor.route.name}</span>
              {getStatusBadge(selectedCorridor.operationalStatus)}
            </div>
            <p className="text-xs text-slate-300 leading-relaxed max-w-4xl">
              {selectedCorridor.decisionSupport.briefing}
            </p>
          </div>

          <div className="flex items-center space-x-2 flex-shrink-0">
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-lg"
            >
              <Eye className="w-4 h-4" />
              <span>Open Detailed Intelligence Workspace</span>
            </button>
          </div>
        </div>
      )}

      {/* 7. Comprehensive Corridor Detail Workspace Drawer (Sections A through J) */}
      {isDrawerOpen && selectedCorridor && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/80 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-3xl bg-slate-900 border-l border-slate-800 h-full overflow-y-auto p-6 space-y-6 shadow-2xl">
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-500/20 text-indigo-300 rounded-lg font-bold">
                  {selectedCorridor.route.code}
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">{selectedCorridor.route.name}</h2>
                  <div className="flex items-center space-x-2 mt-1">
                    {getStatusBadge(selectedCorridor.operationalStatus)}
                    <span className="text-xs text-slate-400">ID: {selectedCorridor.route.id}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Tabs for Sections A-J */}
            <div className="flex flex-wrap gap-1.5 pb-2 border-b border-slate-800 text-xs">
              {[
                { id: 'RISK', label: 'Current Risk (A)' },
                { id: 'TREND', label: 'Trend (B)' },
                { id: 'SAFETY', label: 'Safety Alerts (C)' },
                { id: 'INCIDENTS', label: 'Incidents (D)' },
                { id: 'DEMAND', label: 'Demand (E)' },
                { id: 'DECISION', label: 'Decision Support (F)' },
                { id: 'RECOMMENDATIONS', label: 'Recommendations (G)' },
                { id: 'GOVERNANCE', label: 'Governance (H)' },
                { id: 'AUDIT', label: 'Audit (I)' },
                { id: 'SCENARIOS', label: 'Scenarios (J)' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition ${
                    activeTab === tab.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* SECTION A: CURRENT RISK */}
            {activeTab === 'RISK' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                    Section A — Current Risk Profile
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400">
                    Source: {selectedCorridor.risk.source}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400">Risk Score</span>
                    <div className="text-2xl font-bold text-white mt-1">
                      {selectedCorridor.risk.score}/100
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400">Risk Level</span>
                    <div className="text-sm font-bold text-amber-300 mt-2">
                      {selectedCorridor.risk.level}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400">Active Emergencies</span>
                    <div className="text-2xl font-bold text-rose-400 mt-1">
                      {selectedCorridor.risk.activeEmergencies}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400">Speed Anomalies</span>
                    <div className="text-2xl font-bold text-cyan-400 mt-1">
                      {selectedCorridor.risk.activeSpeedAnomalies}
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
                  <div className="font-semibold text-slate-200 mb-1">Telemetry Factors:</div>
                  <ul className="list-disc list-inside space-y-1 text-slate-400">
                    <li>Active Roadway Deviations: {selectedCorridor.risk.activeDeviations}</li>
                    <li>Evaluated At: {new Date(selectedCorridor.risk.evaluatedAt).toLocaleString()}</li>
                    <li>Previous Risk Score: {selectedCorridor.risk.previousScore ?? 'N/A'}</li>
                  </ul>
                </div>
              </div>
            )}

            {/* SECTION B: TREND */}
            {activeTab === 'TREND' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                    Section B — Route Risk Trend & History
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400">
                    Source: {selectedCorridor.trend.source}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                  <div className="flex items-center space-x-2">
                    {getTrendIcon(selectedCorridor.trend.direction)}
                    <span className="font-bold text-slate-200">{selectedCorridor.trend.direction}</span>
                    {selectedCorridor.trend.delta !== null && (
                      <span className="text-slate-400">
                        (Delta: {selectedCorridor.trend.delta > 0 ? `+${selectedCorridor.trend.delta}` : selectedCorridor.trend.delta} pts)
                      </span>
                    )}
                  </div>
                  <p className="text-slate-300 mt-2">{selectedCorridor.trend.explanation}</p>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-300">Recent Snapshots</span>
                  {selectedCorridor.trend.recentSnapshots.length === 0 ? (
                    <div className="p-3 text-slate-500 text-xs">No historical snapshots recorded yet.</div>
                  ) : (
                    <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden text-xs">
                      {selectedCorridor.trend.recentSnapshots.map((s, idx) => (
                        <div key={idx} className="p-2.5 bg-slate-950 flex items-center justify-between">
                          <span className="text-slate-400">{new Date(s.timestamp).toLocaleString()}</span>
                          <span className="font-bold text-slate-200">{s.riskScore}/100</span>
                          <span className="text-[10px] text-amber-300">{s.riskLevel}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SECTION C: SAFETY */}
            {activeTab === 'SAFETY' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                    Section C — Active Safety Alerts
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400">
                    Source: {selectedCorridor.safety.source}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2 rounded bg-slate-950 border border-slate-800">
                    <span className="text-rose-400 text-[10px]">Critical</span>
                    <div className="font-bold text-rose-300 mt-1">{selectedCorridor.safety.criticalAlerts}</div>
                  </div>
                  <div className="p-2 rounded bg-slate-950 border border-slate-800">
                    <span className="text-amber-400 text-[10px]">High</span>
                    <div className="font-bold text-amber-300 mt-1">{selectedCorridor.safety.highAlerts}</div>
                  </div>
                  <div className="p-2 rounded bg-slate-950 border border-slate-800">
                    <span className="text-yellow-400 text-[10px]">Medium</span>
                    <div className="font-bold text-yellow-300 mt-1">{selectedCorridor.safety.mediumAlerts}</div>
                  </div>
                  <div className="p-2 rounded bg-slate-950 border border-slate-800">
                    <span className="text-slate-400 text-[10px]">Low</span>
                    <div className="font-bold text-slate-300 mt-1">{selectedCorridor.safety.lowAlerts}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  {selectedCorridor.safety.recentAlerts.length === 0 ? (
                    <div className="p-4 text-center text-slate-500 text-xs bg-slate-950 rounded-xl">
                      No active alerts for this corridor.
                    </div>
                  ) : (
                    selectedCorridor.safety.recentAlerts.map((a) => (
                      <div key={a.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-200">{a.title}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-extrabold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            {a.severity}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">{new Date(a.createdAt).toLocaleString()}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* SECTION D: INCIDENTS */}
            {activeTab === 'INCIDENTS' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                    Section D — Safety Incident Cases
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400">
                    Source: {selectedCorridor.incidents.source}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center text-xs">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400">Total Open</span>
                    <div className="text-xl font-bold text-white mt-1">{selectedCorridor.incidents.totalOpenCases}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-rose-400">Critical Cases</span>
                    <div className="text-xl font-bold text-rose-300 mt-1">{selectedCorridor.incidents.criticalCases}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-amber-400">Unresolved</span>
                    <div className="text-xl font-bold text-amber-300 mt-1">{selectedCorridor.incidents.unresolvedCount}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  {selectedCorridor.incidents.recentCases.length === 0 ? (
                    <div className="p-4 text-center text-slate-500 text-xs bg-slate-950 rounded-xl">
                      No open incident cases for this corridor.
                    </div>
                  ) : (
                    selectedCorridor.incidents.recentCases.map((i) => (
                      <div key={i.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-200">{i.title}</span>
                          <span className="text-[10px] font-bold text-amber-400">{i.status}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Severity: {i.severity} • Assignee: {i.assignedTo || 'Unassigned'} • Opened: {new Date(i.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* SECTION E: DEMAND */}
            {activeTab === 'DEMAND' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                    Section E — AI Demand Prediction & Occupancy
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400">
                    Source: {selectedCorridor.demand.source}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400">Predicted Demand</span>
                    <div className="text-xl font-bold text-white mt-1">
                      {selectedCorridor.demand.predictedDemand !== null ? `${selectedCorridor.demand.predictedDemand} riders` : '—'}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400">Vehicle Capacity</span>
                    <div className="text-xl font-bold text-white mt-1">{selectedCorridor.demand.vehicleCapacity} seats</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400">Predicted Occupancy</span>
                    <div className="text-xl font-bold text-cyan-300 mt-1">
                      {selectedCorridor.demand.predictedOccupancy !== null ? `${selectedCorridor.demand.predictedOccupancy}%` : '—'}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400">Data Quality</span>
                    <div className="text-xs font-bold text-emerald-400 mt-2">{selectedCorridor.demand.dataQuality}</div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                  <div className="font-semibold text-slate-200">Capacity Guidance:</div>
                  <div className="text-slate-300">{selectedCorridor.demand.capacityRecommendation}</div>
                  {selectedCorridor.demand.unavailableReason && (
                    <div className="text-amber-400 text-[11px] mt-1">{selectedCorridor.demand.unavailableReason}</div>
                  )}
                </div>
              </div>
            )}

            {/* SECTION F: DECISION SUPPORT */}
            {activeTab === 'DECISION' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                    Section F — Decision Support Briefing
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400">
                    Source: {selectedCorridor.decisionSupport.source}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center space-x-2">
                    {getStatusBadge(selectedCorridor.operationalStatus)}
                    <span className="text-xs text-slate-400">Authoritative Evaluation</span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    {selectedCorridor.decisionSupport.briefing}
                  </p>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-300">Contributing Factors</span>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs text-slate-400">
                    {selectedCorridor.decisionSupport.contributingFactors.map((f, idx) => (
                      <div key={idx} className="flex items-start space-x-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 mt-0.5 flex-shrink-0" />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* SECTION G: RECOMMENDATIONS */}
            {activeTab === 'RECOMMENDATIONS' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                    Section G — Operational Recommendations
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400">
                    Source: {selectedCorridor.recommendations.source}
                  </span>
                </div>

                <div className="space-y-2">
                  {selectedCorridor.recommendations.items.length === 0 ? (
                    <div className="p-4 text-center text-slate-500 text-xs bg-slate-950 rounded-xl">
                      No active recommendations for this corridor.
                    </div>
                  ) : (
                    selectedCorridor.recommendations.items.map((r) => (
                      <div key={r.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-200">{r.title}</span>
                          <span className="text-[10px] font-bold text-indigo-300 bg-indigo-500/20 px-1.5 py-0.5 rounded">
                            {r.priority}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-300">{r.recommendation}</div>
                        <div className="text-[10px] text-slate-500">
                          Type: {r.type} • Status: {r.status} • Created: {new Date(r.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* SECTION H: GOVERNANCE */}
            {activeTab === 'GOVERNANCE' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                    Section H — Operational Governance
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400">
                    Source: {selectedCorridor.governance.source}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center text-xs">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400">Status</span>
                    <div className="text-xs font-bold text-emerald-400 mt-2">{selectedCorridor.governance.status}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400">Compliance Score</span>
                    <div className="text-xl font-bold text-white mt-1">{selectedCorridor.governance.score}%</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400">Exceptions</span>
                    <div className="text-xl font-bold text-amber-300 mt-1">{selectedCorridor.governance.exceptionCount}</div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                  <div className="font-semibold text-slate-200 mb-1">Open Governance Findings:</div>
                  {selectedCorridor.governance.openFindings.length === 0 ? (
                    <div className="text-slate-500">Zero open governance exceptions for this corridor.</div>
                  ) : (
                    <ul className="list-disc list-inside space-y-1 text-slate-400">
                      {selectedCorridor.governance.openFindings.map((f, idx) => (
                        <li key={idx}>{f}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {/* SECTION I: AUDIT */}
            {activeTab === 'AUDIT' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                    Section I — Tamper-Evident Audit Trail
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400">
                    Source: {selectedCorridor.audit.source}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs flex items-center justify-between">
                  <span className="text-slate-300">Cryptographically Verified Events:</span>
                  <span className="font-bold text-emerald-400">
                    {selectedCorridor.audit.verifiedEventsCount} / {selectedCorridor.audit.recentEventsCount} passed SHA-256
                  </span>
                </div>

                <div className="space-y-2">
                  {selectedCorridor.audit.events.length === 0 ? (
                    <div className="p-4 text-center text-slate-500 text-xs bg-slate-950 rounded-xl">
                      No audit events on record for this corridor.
                    </div>
                  ) : (
                    selectedCorridor.audit.events.map((a) => (
                      <div key={a.id} className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-indigo-300 font-semibold">{a.eventType}</span>
                          <span className="text-[10px] text-emerald-400 flex items-center">
                            <Lock className="w-3 h-3 mr-1" /> Verified
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Actor: {a.actor.name} ({a.actor.role}) • {new Date(a.createdAt).toLocaleString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* SECTION J: SCENARIOS */}
            {activeTab === 'SCENARIOS' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                    Section J — Scenario Simulation & What-If Analysis
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400">
                    Source: {selectedCorridor.scenarios.source}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
                  <div className="font-semibold text-slate-200">Simulation Pipeline Active:</div>
                  <p className="text-slate-400 leading-relaxed">
                    Administrators can simulate hypothetical operational stress, surge demand, vehicle breakdowns, and safety incidents using verified baseline models without mutating live production resources.
                  </p>
                  <div className="mt-2">
                    <span className="text-[11px] font-medium text-slate-300 block mb-1">
                      Available Simulation Presets:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedCorridor.scenarios.availablePresets.map((p, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 text-[10px]">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Non-Mutative Rule */}
            <div className="pt-4 border-t border-slate-800 text-center">
              <p className="text-xs text-slate-500">
                Informational and advisory only. Human administrators execute standard operating procedures without automated dispatch mutation.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
