'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  ShieldAlert,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  X,
  ChevronRight,
  Info,
  CheckCircle2,
  Activity,
  Bus,
  Users,
  Layers,
  Clock,
  Shield,
  FileText,
  AlertCircle,
} from 'lucide-react';

interface RouteRiskData {
  score: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  trend: 'RISING' | 'FALLING' | 'STABLE' | 'NO_HISTORY';
  scoreDelta: number | null;
  previousScore: number | null;
  activeEmergencies: number;
  activeDeviations: number;
  activeSpeedAnomalies: number;
}

interface RouteAlertsData {
  activeCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
}

interface RouteIncidentsData {
  activeCount: number;
  criticalCount: number;
  unresolvedCount: number;
}

interface RouteDemandData {
  predictedDemand: number | null;
  predictedOccupancy: number | null;
  demandLevel: string | null;
  dataQuality: string;
}

interface RouteCapacityData {
  recommendation: string;
  vehicleCapacity: number;
}

interface RouteDecisionSupport {
  routeId: string;
  routeCode: string;
  routeName: string;
  operationalStatus: 'NORMAL' | 'MONITOR' | 'ATTENTION_REQUIRED' | 'URGENT_REVIEW';
  risk: RouteRiskData;
  alerts: RouteAlertsData;
  incidents: RouteIncidentsData;
  demand: RouteDemandData;
  capacity: RouteCapacityData;
  explanation: string[];
  briefing: string;
  evidence: {
    riskEvidence: any;
    alertEvidence: any[];
    incidentEvidence: any[];
    demandEvidence: any;
  };
  generatedAt: string;
}

interface FleetSummary {
  totalRoutes: number;
  normal: number;
  monitor: number;
  attentionRequired: number;
  urgentReview: number;
  criticalRiskRoutes: number;
  highRiskRoutes: number;
  activeCriticalAlerts: number;
  activeHighAlerts: number;
  unresolvedIncidents: number;
  highDemandRoutes: number;
  criticalDemandRoutes: number;
}

export default function OperationalDecisionSupport() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<FleetSummary | null>(null);
  const [routes, setRoutes] = useState<RouteDecisionSupport[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<RouteDecisionSupport | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setError(null);
      const res = await axios.get('/api/operations/decision-support');
      if (res.data?.success) {
        setSummary(res.data.summary);
        setRoutes(res.data.routes || []);
      }
    } catch (err: any) {
      console.error('Failed to load operational decision support:', err);
      setError(err.response?.data?.error || 'Failed to retrieve operational decision support.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'URGENT_REVIEW':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/40">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5 animate-pulse" />
            Urgent Review
          </span>
        );
      case 'ATTENTION_REQUIRED':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/40">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" />
            Attention Required
          </span>
        );
      case 'MONITOR':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/40">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 mr-1.5" />
            Monitor
          </span>
        );
      case 'NORMAL':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
            Normal
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400">
            {status}
          </span>
        );
    }
  };

  const getRiskBadge = (level: string, score: number) => {
    let color = 'bg-slate-800 text-slate-300 border-slate-700';
    if (level === 'CRITICAL') color = 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    else if (level === 'HIGH') color = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    else if (level === 'MEDIUM') color = 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    else if (level === 'LOW') color = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${color}`}>
        {score}/100 ({level})
      </span>
    );
  };

  const getTrendIcon = (trend: string, delta: number | null) => {
    if (trend === 'RISING') {
      return (
        <span className="inline-flex items-center text-xs font-bold text-rose-400">
          <TrendingUp className="w-3.5 h-3.5 mr-1" />
          +{delta ?? 0}
        </span>
      );
    }
    if (trend === 'FALLING') {
      return (
        <span className="inline-flex items-center text-xs font-bold text-emerald-400">
          <TrendingDown className="w-3.5 h-3.5 mr-1" />
          {delta ?? 0}
        </span>
      );
    }
    if (trend === 'STABLE') {
      return (
        <span className="inline-flex items-center text-xs font-medium text-slate-400">
          <Minus className="w-3.5 h-3.5 mr-1" />
          Stable
        </span>
      );
    }
    return <span className="text-xs text-slate-500">Baseline</span>;
  };

  const filteredRoutes = routes.filter((r) => {
    if (filterStatus === 'ALL') return true;
    return r.operationalStatus === filterStatus;
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl space-y-6">
      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold tracking-tight">
                  Smart Commute Operational Decision Support
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Phase 3 • Step 6
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Deterministic synthesis of verified corridor risk, safety alerts, operational incident cases, and AI demand intelligence.
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
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
            <span>Refresh Operational Intelligence</span>
          </button>
        </div>
      </div>

      {/* Mandatory System Advisory Notice */}
      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start space-x-3">
        <Info className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-slate-400 leading-relaxed">
          <strong className="text-slate-300 font-semibold">Advisory Decision-Support Notice:</strong> This Step 6 operational decision-support module is advisory and deterministic. It does not automatically modify routes, vehicles, schedules, subscriptions, bookings, or driver assignments. The operations administrator retains authoritative operational control.
        </p>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Top 6 Executive KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Routes Analyzed
          </div>
          <div className="text-2xl font-black text-white mt-1">
            {loading ? '—' : summary?.totalRoutes ?? 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Corridors in scope</div>
        </div>

        <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20">
          <div className="text-[11px] font-bold uppercase tracking-wider text-rose-400">
            Urgent Review
          </div>
          <div className="text-2xl font-black text-rose-400 mt-1">
            {loading ? '—' : summary?.urgentReview ?? 0}
          </div>
          <div className="text-[10px] text-rose-500/80 mt-0.5">Critical safety triggers</div>
        </div>

        <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
            Attention Required
          </div>
          <div className="text-2xl font-black text-amber-400 mt-1">
            {loading ? '—' : summary?.attentionRequired ?? 0}
          </div>
          <div className="text-[10px] text-amber-500/80 mt-0.5">High risk or alerts</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Active Critical Alerts
          </div>
          <div className="text-2xl font-black text-white mt-1">
            {loading ? '—' : summary?.activeCriticalAlerts ?? 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">High-severity alerts</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Unresolved Incidents
          </div>
          <div className="text-2xl font-black text-white mt-1">
            {loading ? '—' : summary?.unresolvedIncidents ?? 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Open response cases</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Critical Demand Routes
          </div>
          <div className="text-2xl font-black text-white mt-1">
            {loading ? '—' : summary?.criticalDemandRoutes ?? 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">≥90% vehicle capacity</div>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex items-center space-x-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs">
          {[
            { id: 'ALL', label: 'All Corridors' },
            { id: 'URGENT_REVIEW', label: 'Urgent Review' },
            { id: 'ATTENTION_REQUIRED', label: 'Attention Required' },
            { id: 'MONITOR', label: 'Monitor' },
            { id: 'NORMAL', label: 'Normal' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                filterStatus === tab.id
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="text-xs text-slate-400">
          Showing <span className="font-semibold text-slate-200">{filteredRoutes.length}</span> of{' '}
          <span className="font-semibold text-slate-200">{routes.length}</span> verified corridors
        </div>
      </div>

      {/* Main Corridor Decision Support Table */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/50">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800 text-[10px]">
              <tr>
                <th className="py-3 px-4">Corridor Route</th>
                <th className="py-3 px-3">Operational Status</th>
                <th className="py-3 px-3">Risk Score</th>
                <th className="py-3 px-3">Risk Trend</th>
                <th className="py-3 px-3">Active Alerts</th>
                <th className="py-3 px-3">Open Cases</th>
                <th className="py-3 px-3">Occupancy</th>
                <th className="py-3 px-3">Demand</th>
                <th className="py-3 px-3">Data Quality</th>
                <th className="py-3 px-4 text-right">Operational Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-500">
                    <div className="flex items-center justify-center space-x-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                      <span>Synthesizing operational intelligence...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredRoutes.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-500">
                    No corridor routes match the selected operational status filter.
                  </td>
                </tr>
              ) : (
                filteredRoutes.map((r) => (
                  <tr
                    key={r.routeId}
                    className="hover:bg-slate-900/60 transition cursor-pointer"
                    onClick={() => setSelectedRoute(r)}
                  >
                    <td className="py-3.5 px-4 font-bold text-white">
                      <div className="flex items-center space-x-2">
                        <Bus className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                        <div>
                          <div>{r.routeName}</div>
                          <div className="text-[10px] text-slate-500 font-mono font-normal">
                            {r.routeCode}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-3 whitespace-nowrap">
                      {getStatusBadge(r.operationalStatus)}
                    </td>

                    <td className="py-3.5 px-3 whitespace-nowrap">
                      {getRiskBadge(r.risk.level, r.risk.score)}
                    </td>

                    <td className="py-3.5 px-3 whitespace-nowrap">
                      {getTrendIcon(r.risk.trend, r.risk.scoreDelta)}
                    </td>

                    <td className="py-3.5 px-3 whitespace-nowrap">
                      {r.alerts.activeCount > 0 ? (
                        <span className="font-bold text-rose-400">
                          {r.alerts.activeCount} alert{r.alerts.activeCount > 1 ? 's' : ''}
                          {r.alerts.criticalCount > 0 && (
                            <span className="ml-1 text-[10px] px-1 py-0.2 rounded bg-rose-500/20 text-rose-300">
                              {r.alerts.criticalCount} crit
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-500">0</span>
                      )}
                    </td>

                    <td className="py-3.5 px-3 whitespace-nowrap">
                      {r.incidents.unresolvedCount > 0 ? (
                        <span className="font-bold text-amber-400">
                          {r.incidents.unresolvedCount} open
                          {r.incidents.criticalCount > 0 && (
                            <span className="ml-1 text-[10px] px-1 py-0.2 rounded bg-rose-500/20 text-rose-300">
                              {r.incidents.criticalCount} crit
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-500">0</span>
                      )}
                    </td>

                    <td className="py-3.5 px-3 whitespace-nowrap">
                      {r.demand.predictedOccupancy !== null ? (
                        <div className="space-y-1">
                          <div className="font-bold text-white">
                            {r.demand.predictedOccupancy}%
                          </div>
                          <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                r.demand.predictedOccupancy >= 90
                                  ? 'bg-rose-500'
                                  : r.demand.predictedOccupancy >= 75
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(100, r.demand.predictedOccupancy)}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>

                    <td className="py-3.5 px-3 whitespace-nowrap">
                      {r.demand.demandLevel ? (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                            r.demand.demandLevel === 'CRITICAL'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : r.demand.demandLevel === 'HIGH'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : r.demand.demandLevel === 'LOW'
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {r.demand.demandLevel}
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>

                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <span className="text-[10px] font-mono text-slate-400">
                        {r.demand.dataQuality === 'INSUFFICIENT_DATA' ? (
                          <span className="text-amber-400 font-bold">INSUFFICIENT</span>
                        ) : (
                          r.demand.dataQuality.replace('_DATA_QUALITY', '')
                        )}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRoute(r);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 font-semibold text-xs transition flex items-center space-x-1 ml-auto"
                      >
                        <span>Evidence</span>
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

      {/* Operational Evidence & Briefing Drawer */}
      {selectedRoute && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/80 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-full overflow-y-auto p-6 space-y-6 shadow-2xl">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-lg font-bold text-white">{selectedRoute.routeName}</h3>
                  <span className="px-2 py-0.5 rounded text-xs font-mono bg-slate-800 text-slate-400">
                    {selectedRoute.routeCode}
                  </span>
                </div>
                <div className="mt-1 flex items-center space-x-2">
                  <span className="text-xs text-slate-400">Operational Status:</span>
                  {getStatusBadge(selectedRoute.operationalStatus)}
                </div>
              </div>
              <button
                onClick={() => setSelectedRoute(null)}
                className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Deterministic Executive Briefing */}
            <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30 space-y-2">
              <div className="flex items-center space-x-2 text-indigo-300 font-bold text-xs uppercase tracking-wider">
                <FileText className="w-4 h-4" />
                <span>Deterministic Operational Briefing</span>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed font-medium">
                {selectedRoute.briefing}
              </p>
            </div>

            {/* Explanation Factors List */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Verified Contributing Factors
              </h4>
              <div className="space-y-1.5">
                {selectedRoute.explanation.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 flex items-start space-x-2.5"
                  >
                    <CheckCircle2 className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Multi-Section Evidence Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Risk Intelligence Card */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-300 flex items-center space-x-1.5">
                    <Shield className="w-4 h-4 text-indigo-400" />
                    <span>Route Risk (Step 1 & 2)</span>
                  </span>
                  {getRiskBadge(selectedRoute.risk.level, selectedRoute.risk.score)}
                </div>
                <div className="space-y-1.5 text-xs text-slate-400">
                  <div className="flex justify-between">
                    <span>Trend Direction:</span>
                    <span className="font-bold text-slate-200">{selectedRoute.risk.trend}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Score Delta:</span>
                    <span>{getTrendIcon(selectedRoute.risk.trend, selectedRoute.risk.scoreDelta)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Active Emergencies:</span>
                    <span className="font-bold text-slate-200">
                      {selectedRoute.risk.activeEmergencies}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Route Deviations:</span>
                    <span className="font-bold text-slate-200">
                      {selectedRoute.risk.activeDeviations}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Speed Anomalies:</span>
                    <span className="font-bold text-slate-200">
                      {selectedRoute.risk.activeSpeedAnomalies}
                    </span>
                  </div>
                </div>
              </div>

              {/* Demand Intelligence Card */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-300 flex items-center space-x-1.5">
                    <Users className="w-4 h-4 text-indigo-400" />
                    <span>Demand Forecast (Step 5)</span>
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-slate-800 text-slate-400">
                    {selectedRoute.demand.dataQuality.replace('_DATA_QUALITY', '')}
                  </span>
                </div>
                <div className="space-y-1.5 text-xs text-slate-400">
                  <div className="flex justify-between">
                    <span>Predicted Demand:</span>
                    <span className="font-bold text-slate-200">
                      {selectedRoute.demand.predictedDemand !== null
                        ? `${selectedRoute.demand.predictedDemand} pax`
                        : 'Unavailable'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Expected Occupancy:</span>
                    <span className="font-bold text-slate-200">
                      {selectedRoute.demand.predictedOccupancy !== null
                        ? `${selectedRoute.demand.predictedOccupancy}%`
                        : 'Unavailable'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Vehicle Capacity:</span>
                    <span className="font-bold text-slate-200">
                      {selectedRoute.capacity.vehicleCapacity} seats
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Demand Band:</span>
                    <span className="font-bold text-slate-200">
                      {selectedRoute.demand.demandLevel || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Active Safety Alerts Evidence */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <h4 className="font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  <span>Active Operational Alerts ({selectedRoute.alerts.activeCount})</span>
                </h4>
              </div>
              {selectedRoute.evidence.alertEvidence.length === 0 ? (
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-500">
                  No active safety alerts for this corridor.
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedRoute.evidence.alertEvidence.map((a: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">{a.title}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            a.severity === 'CRITICAL'
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {a.severity}
                        </span>
                      </div>
                      <p className="text-slate-400">{a.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Incident Response Cases Evidence */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <h4 className="font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                  <Activity className="w-4 h-4 text-amber-400" />
                  <span>Open Incident Response Cases ({selectedRoute.incidents.unresolvedCount})</span>
                </h4>
              </div>
              {selectedRoute.evidence.incidentEvidence.length === 0 ? (
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-500">
                  No unresolved incident response cases.
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedRoute.evidence.incidentEvidence.map((inc: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">{inc.title}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                          {inc.status}
                        </span>
                      </div>
                      <p className="text-slate-400">{inc.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Advisory Recommendation Footer */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
                <Info className="w-4 h-4 text-indigo-400" />
                <span>Operational Capacity & Scheduling Recommendation</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                {selectedRoute.capacity.recommendation}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
