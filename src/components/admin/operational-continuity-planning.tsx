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
} from 'lucide-react';
import {
  MANDATORY_CONTINUITY_PLANNING_NOTICE,
  MANDATORY_CONTINUITY_SAFETY_STATEMENT,
  ContinuityPlanningResponse,
  CorridorContinuityPlan,
  ContinuityStatus,
  RecoveryPriority,
  OperationalCapability,
} from '@/lib/operations/continuity-planning-engine';

export default function OperationalContinuityPlanning() {
  const [data, setData] = useState<ContinuityPlanningResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCorridor, setSelectedCorridor] = useState<CorridorContinuityPlan | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // Load continuity data
  const fetchData = async (routeId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = routeId
        ? `/api/operations/continuity-planning?routeId=${encodeURIComponent(routeId)}`
        : '/api/operations/continuity-planning';
      const res = await fetch(url);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP error ${res.status}`);
      }
      const json: ContinuityPlanningResponse = await res.json();
      setData(json);
      // Auto-select first corridor or keep currently selected if still available
      if (json.corridors && json.corridors.length > 0) {
        if (selectedCorridor) {
          const matched = json.corridors.find((c) => c.route.id === selectedCorridor.route.id);
          setSelectedCorridor(matched || json.corridors[0]);
        } else {
          setSelectedCorridor(json.corridors[0]);
        }
      } else {
        setSelectedCorridor(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load continuity planning data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter corridors
  const filteredCorridors = (data?.corridors || []).filter((c) => {
    if (statusFilter !== 'ALL' && c.continuityStatus !== statusFilter) return false;
    if (priorityFilter !== 'ALL' && c.recoveryPriority !== priorityFilter) return false;
    return true;
  });

  const getContinuityBadge = (status: ContinuityStatus) => {
    switch (status) {
      case 'CONTINUITY_CRITICAL':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
            <AlertOctagon className="w-3 h-3 mr-1" /> Critical Disruption
          </span>
        );
      case 'CONTINUITY_DEGRADED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3 mr-1" /> Degraded
          </span>
        );
      case 'CONTINUITY_AT_RISK':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
            <AlertTriangle className="w-3 h-3 mr-1" /> At Risk
          </span>
        );
      case 'CONTINUITY_MONITOR':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
            <Activity className="w-3 h-3 mr-1" /> Monitoring
          </span>
        );
      case 'CONTINUITY_READY':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <CheckCircle className="w-3 h-3 mr-1" /> Ready & Resilient
          </span>
        );
      default:
        return null;
    }
  };

  const getPriorityBadge = (priority: RecoveryPriority) => {
    switch (priority) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-extrabold bg-rose-600 text-white shadow-sm">
            CRITICAL P1
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-extrabold bg-amber-500 text-slate-950 shadow-sm">
            HIGH P2
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
            MEDIUM P3
          </span>
        );
      case 'LOW':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
            LOW P4
          </span>
        );
    }
  };

  const getReadinessBadge = (level: string) => {
    switch (level) {
      case 'HIGH_READINESS':
        return (
          <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
            HIGH READINESS
          </span>
        );
      case 'MODERATE_READINESS':
        return (
          <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
            MODERATE READINESS
          </span>
        );
      case 'LOW_READINESS':
        return (
          <span className="text-xs font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/30">
            LOW READINESS
          </span>
        );
      default:
        return (
          <span className="text-xs font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
            LIMITED DATA
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden text-slate-100">
      {/* 1. Header Section & Mandatory Safety Banner */}
      <div className="p-6 bg-slate-950 border-b border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
              <LifeBuoy className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold tracking-tight text-white">
                  Operational Continuity & Recovery Planning Center
                </h2>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                  Phase 3 Step 16
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  Human In The Loop
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Deterministic capability disruption analysis, dependency health tracking, recovery sequencing, and advisory continuity governance.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => fetchData()}
              disabled={loading}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Fleet Intelligence</span>
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
            {MANDATORY_CONTINUITY_PLANNING_NOTICE}
          </div>
        </div>
      </div>

      {/* 2. Executive Fleet KPI Overview */}
      {data?.fleetSummary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-px bg-slate-800 border-b border-slate-800">
          <div className="bg-slate-900/90 p-4">
            <span className="text-[11px] font-medium text-slate-400 block">Monitored Routes</span>
            <div className="mt-1 flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-white">{data.fleetSummary.totalRoutes}</span>
              <span className="text-[10px] text-slate-500">Corridors</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              {data.fleetSummary.affectedRoutes} Affected
            </span>
          </div>

          <div className="bg-slate-900/90 p-4">
            <span className="text-[11px] font-medium text-rose-400 block">Critical Disruption</span>
            <div className="mt-1 flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-rose-300">{data.fleetSummary.continuityCritical}</span>
              <span className="text-[10px] text-rose-400">Routes</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">Immediate Review</span>
          </div>

          <div className="bg-slate-900/90 p-4">
            <span className="text-[11px] font-medium text-amber-400 block">Degraded / At-Risk</span>
            <div className="mt-1 flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-amber-300">
                {data.fleetSummary.continuityDegraded + data.fleetSummary.continuityAtRisk}
              </span>
              <span className="text-[10px] text-amber-400">Routes</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              {data.fleetSummary.continuityDegraded} Degraded / {data.fleetSummary.continuityAtRisk} At-Risk
            </span>
          </div>

          <div className="bg-slate-900/90 p-4">
            <span className="text-[11px] font-medium text-emerald-400 block">Continuity Ready</span>
            <div className="mt-1 flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-emerald-300">{data.fleetSummary.continuityReady}</span>
              <span className="text-[10px] text-emerald-400">Stable</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              {data.fleetSummary.continuityMonitor} Under Monitor
            </span>
          </div>

          <div className="bg-slate-900/90 p-4">
            <span className="text-[11px] font-medium text-rose-400 block">Critical Recovery</span>
            <div className="mt-1 flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-rose-300">{data.fleetSummary.criticalRecoveryRoutes}</span>
              <span className="text-[10px] text-rose-400">P1</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              +{data.fleetSummary.highRecoveryRoutes} High (P2)
            </span>
          </div>

          <div className="bg-slate-900/90 p-4">
            <span className="text-[11px] font-medium text-indigo-400 block">Critical Deps</span>
            <div className="mt-1 flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-indigo-300">{data.fleetSummary.criticalDependencies}</span>
              <span className="text-[10px] text-indigo-400">Impacted</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">Across Capabilities</span>
          </div>

          <div className="bg-slate-900/90 p-4">
            <span className="text-[11px] font-medium text-cyan-400 block">Critical Alerts</span>
            <div className="mt-1 flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-cyan-300">{data.fleetSummary.activeCriticalAlerts}</span>
              <span className="text-[10px] text-cyan-400">Alerts</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">Safety Engine S3</span>
          </div>

          <div className="bg-slate-900/90 p-4">
            <span className="text-[11px] font-medium text-yellow-400 block">Unresolved Cases</span>
            <div className="mt-1 flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-yellow-300">{data.fleetSummary.unresolvedIncidents}</span>
              <span className="text-[10px] text-yellow-400">Cases</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">Incident S4</span>
          </div>
        </div>
      )}

      {/* 3. Controls & Filter Bar */}
      <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <span>Continuity Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="CONTINUITY_CRITICAL">Critical Disruption</option>
              <option value="CONTINUITY_DEGRADED">Degraded</option>
              <option value="CONTINUITY_AT_RISK">At Risk</option>
              <option value="CONTINUITY_MONITOR">Monitor</option>
              <option value="CONTINUITY_READY">Ready & Resilient</option>
            </select>
          </div>

          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <span>Recovery Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">All Priorities</option>
              <option value="CRITICAL">Critical (P1)</option>
              <option value="HIGH">High (P2)</option>
              <option value="MEDIUM">Medium (P3)</option>
              <option value="LOW">Low (P4)</option>
            </select>
          </div>
        </div>

        <div className="text-xs text-slate-400">
          Showing <span className="font-semibold text-white">{filteredCorridors.length}</span> of{' '}
          <span className="font-semibold text-white">{data?.corridors.length || 0}</span> evaluated corridors
        </div>
      </div>

      {/* 4. Comparative Corridor Grid / Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-semibold">
              <th className="p-3.5 pl-6">Corridor</th>
              <th className="p-3.5">Continuity Status</th>
              <th className="p-3.5">Recovery Priority</th>
              <th className="p-3.5">Risk & Safety</th>
              <th className="p-3.5">Demand & Capacity</th>
              <th className="p-3.5">Readiness</th>
              <th className="p-3.5">Dependencies</th>
              <th className="p-3.5 pr-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredCorridors.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500">
                  {loading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <RotateCcw className="w-4 h-4 animate-spin text-indigo-400" />
                      <span>Evaluating deterministic continuity models...</span>
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
                    <td className="p-3.5 pl-6">
                      <div className="flex items-center space-x-2.5">
                        <div className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 font-bold text-xs">
                          {c.route.code}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-200">{c.route.name}</div>
                          <div className="text-[11px] text-slate-400">ID: {c.route.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5">{getContinuityBadge(c.continuityStatus)}</td>
                    <td className="p-3.5">{getPriorityBadge(c.recoveryPriority)}</td>
                    <td className="p-3.5">
                      <div className="flex items-center space-x-1.5">
                        <span
                          className={`font-bold ${
                            c.risk.score >= 70
                              ? 'text-rose-400'
                              : c.risk.score >= 40
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {c.risk.score}/100
                        </span>
                        <span className="text-[10px] text-slate-500">({c.risk.level})</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {c.safety.criticalAlerts} crit alerts • {c.safety.unresolvedIncidents} incidents
                      </div>
                    </td>
                    <td className="p-3.5">
                      <div className="text-slate-200">
                        {c.demand.occupancy !== null ? (
                          <span
                            className={`font-semibold ${
                              c.demand.occupancy >= 90
                                ? 'text-rose-400'
                                : c.demand.occupancy >= 75
                                ? 'text-amber-400'
                                : 'text-slate-300'
                            }`}
                          >
                            {c.demand.occupancy}% Occupancy
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">No forecast</span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {c.demand.predictedDemand !== null ? `${c.demand.predictedDemand} riders` : '—'} /{' '}
                        {c.demand.capacity} cap
                      </div>
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center space-x-2">
                        <div className="w-12 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full ${
                              c.readiness.readinessScore >= 70
                                ? 'bg-emerald-500'
                                : c.readiness.readinessScore >= 40
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                            style={{ width: `${c.readiness.readinessScore}%` }}
                          />
                        </div>
                        <span className="font-bold text-slate-300">{c.readiness.readinessScore}%</span>
                      </div>
                      <div className="mt-1">{getReadinessBadge(c.readiness.readinessLevel)}</div>
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center space-x-1.5">
                        {c.readiness.criticalDependencies > 0 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            {c.readiness.criticalDependencies} Crit
                          </span>
                        )}
                        {c.readiness.degradedDependencies > 0 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            {c.readiness.degradedDependencies} Deg
                          </span>
                        )}
                        {c.readiness.criticalDependencies === 0 && c.readiness.degradedDependencies === 0 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Optimal
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {c.dependencies.length} monitored deps
                      </div>
                    </td>
                    <td className="p-3.5 pr-6 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCorridor(c);
                          setIsDrawerOpen(true);
                        }}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition"
                      >
                        <span>Inspect Plan</span>
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

      {/* 5. Selected Corridor Detail Section (Inline & Drawer) */}
      {selectedCorridor && (
        <div className="p-6 bg-slate-950/90 border-t border-slate-800 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center space-x-3">
                <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 border border-indigo-500/30 font-extrabold text-indigo-300 text-sm">
                  {selectedCorridor.route.code}
                </span>
                <h3 className="text-lg font-bold text-white">{selectedCorridor.route.name}</h3>
                {getContinuityBadge(selectedCorridor.continuityStatus)}
                {getPriorityBadge(selectedCorridor.recoveryPriority)}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Authoritative Evaluation Timestamp: {new Date(selectedCorridor.evaluatedAt).toLocaleString()}
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsDrawerOpen(true)}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition"
              >
                <Layers className="w-4 h-4 text-indigo-400" />
                <span>Open Full Intelligence Drawer</span>
              </button>
            </div>
          </div>

          {/* Executive Continuity Briefing */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
            <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-1 flex items-center space-x-1.5">
              <FileText className="w-3.5 h-3.5" />
              <span>Executive Continuity Briefing</span>
            </h4>
            <p className="text-xs text-slate-200 leading-relaxed">
              {selectedCorridor.explanations.continuityBriefing}
            </p>
          </div>

          {/* Grid: 10 Operational Capabilities Health & Readiness */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Capability Dependency Breakdown */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center justify-between">
                <span className="flex items-center space-x-1.5">
                  <Activity className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Capability Dependency Health</span>
                </span>
                <span className="text-[11px] font-medium text-slate-400">
                  {selectedCorridor.dependencies.length} Monitored Capabilities
                </span>
              </h4>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {selectedCorridor.dependencies.map((dep, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-lg border text-xs flex flex-col space-y-1 ${
                      dep.status === 'CRITICAL'
                        ? 'bg-rose-500/10 border-rose-500/30'
                        : dep.status === 'DEGRADED'
                        ? 'bg-amber-500/10 border-amber-500/30'
                        : 'bg-slate-800/60 border-slate-700/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200">{dep.capability.replace(/_/g, ' ')}</span>
                      <span
                        className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                          dep.status === 'CRITICAL'
                            ? 'bg-rose-600 text-white'
                            : dep.status === 'DEGRADED'
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-emerald-600 text-white'
                        }`}
                      >
                        {dep.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">{dep.evidence}</div>
                    <div className="text-[9px] text-slate-500">Source: {dep.sourceModule}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: 7-Step Recovery Sequence */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center justify-between">
                <span className="flex items-center space-x-1.5">
                  <Compass className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Recommended Recovery Sequence</span>
                </span>
                <span className="text-[11px] font-medium text-cyan-400">
                  {selectedCorridor.recoverySequence.length} Deterministic Steps
                </span>
              </h4>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {selectedCorridor.recoverySequence.map((step) => (
                  <div
                    key={step.stepNumber}
                    className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/80 text-xs flex items-start space-x-2.5"
                  >
                    <div className="w-5 h-5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">
                      {step.stepNumber}
                    </div>
                    <div className="flex-1 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-200">{step.action}</span>
                        <span className="text-[9px] font-bold text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">
                          {step.phase}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-300">{step.guidance}</div>
                      <div className="text-[10px] text-slate-500 italic">Evidence: {step.evidence}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Applicable Contingency Plans Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <Crosshair className="w-3.5 h-3.5 text-indigo-400" />
                <span>Applicable Verified Contingency Plans</span>
              </span>
              <span className="text-[11px] font-medium text-indigo-400">
                {selectedCorridor.applicableContingencyPlans.length} Pre-Screened Plans
              </span>
            </h4>

            {selectedCorridor.applicableContingencyPlans.length === 0 ? (
              <div className="p-4 text-center text-slate-500 text-xs bg-slate-950/40 rounded-lg">
                No active contingencies triggered. Route operating within nominal resilience parameters.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {selectedCorridor.applicableContingencyPlans.map((plan) => (
                  <div
                    key={plan.planId}
                    className="p-3 rounded-lg bg-slate-800 border border-slate-700 text-xs flex flex-col justify-between space-y-2"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">{plan.planName}</span>
                        {getPriorityBadge(plan.priority)}
                      </div>
                      <div className="text-[11px] text-slate-300 mt-1 font-medium">
                        Condition: {plan.applicableCondition}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">
                        Impacted: <span className="text-slate-300">{plan.affectedCapability}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1 italic">
                        {plan.evidence}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between text-[10px]">
                      <span className="text-slate-400">Readiness:</span>
                      {getReadinessBadge(plan.readiness)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. Comprehensive Detail Drawer */}
      {isDrawerOpen && selectedCorridor && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/80 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-full overflow-y-auto p-6 space-y-6 shadow-2xl">
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-500/20 text-indigo-300 rounded-lg font-bold">
                  {selectedCorridor.route.code}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{selectedCorridor.route.name}</h3>
                  <div className="flex items-center space-x-2 mt-1">
                    {getContinuityBadge(selectedCorridor.continuityStatus)}
                    {getPriorityBadge(selectedCorridor.recoveryPriority)}
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

            {/* Safety Invariant Notice */}
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-xs text-indigo-300">
              <strong className="block font-semibold mb-1">Human Decision Authority Rule:</strong>
              {MANDATORY_CONTINUITY_SAFETY_STATEMENT}
            </div>

            {/* Recovery Readiness Scorecard */}
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase">Recovery Readiness Index</span>
                <span className="text-lg font-extrabold text-white">{selectedCorridor.readiness.readinessScore}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full ${
                    selectedCorridor.readiness.readinessScore >= 70
                      ? 'bg-emerald-500'
                      : selectedCorridor.readiness.readinessScore >= 40
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                  style={{ width: `${selectedCorridor.readiness.readinessScore}%` }}
                />
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2 text-center text-xs">
                <div className="p-2 rounded bg-slate-900 border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Known Deps</div>
                  <div className="font-bold text-white mt-0.5">{selectedCorridor.readiness.knownDependencies}</div>
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800">
                  <div className="text-amber-400 text-[10px]">Degraded</div>
                  <div className="font-bold text-amber-300 mt-0.5">{selectedCorridor.readiness.degradedDependencies}</div>
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800">
                  <div className="text-rose-400 text-[10px]">Critical</div>
                  <div className="font-bold text-rose-300 mt-0.5">{selectedCorridor.readiness.criticalDependencies}</div>
                </div>
              </div>
              <div className="space-y-1 pt-1 text-xs text-slate-400">
                {selectedCorridor.readiness.explanation.map((exp, idx) => (
                  <div key={idx} className="flex items-start space-x-1.5">
                    <span className="text-indigo-400">•</span>
                    <span>{exp}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Detailed Explanations & Evidence */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Authoritative Evaluation Explanations
              </h4>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs text-slate-300">
                {selectedCorridor.explanations.explanation.map((e, idx) => (
                  <div key={idx} className="flex items-start space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 mt-0.5 flex-shrink-0" />
                    <span>{e}</span>
                  </div>
                ))}
              </div>

              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Recovery Priority Determination
              </h4>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs text-slate-300">
                {selectedCorridor.explanations.recoveryPriorityReason.map((r, idx) => (
                  <div key={idx} className="flex items-start space-x-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                    <span>{r}</span>
                  </div>
                ))}
              </div>

              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Evaluated Evidence Trail
              </h4>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5 text-xs text-slate-400 font-mono">
                {selectedCorridor.explanations.evidence.map((ev, idx) => (
                  <div key={idx} className="text-[11px]">
                    &gt; {ev}
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Non-Mutative Confirmation */}
            <div className="pt-4 border-t border-slate-800 text-center">
              <p className="text-xs text-slate-500">
                Advisory View Only. Human administrators execute standard operating procedures without automated dispatch mutation.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
