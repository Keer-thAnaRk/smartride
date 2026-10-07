'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Bell,
  AlertTriangle,
  AlertOctagon,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Filter,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  Zap,
  Info,
  Sliders,
  XCircle,
} from 'lucide-react';

interface SafetyAlertItem {
  id: string;
  routeId: string;
  routeCode: string;
  routeName: string;
  type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  message: string;
  currentScore: number;
  previousScore: number | null;
  scoreDelta: number | null;
  evidence: Record<string, any>;
  status: 'ACTIVE' | 'RESOLVED';
  dedupKey: string;
  triggeredAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

interface SafetySummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  active: number;
  resolved: number;
}

interface CorridorRoute {
  id: string;
  code: string;
  name: string;
}

export default function SafetyAlertCenter() {
  const [alerts, setAlerts] = useState<SafetyAlertItem[]>([]);
  const [summary, setSummary] = useState<SafetySummary>({
    total: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    active: 0,
    resolved: 0,
  });
  const [routes, setRoutes] = useState<CorridorRoute[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('all');
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState<boolean>(true);
  const [evaluating, setEvaluating] = useState<boolean>(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Fetch routes on mount
  useEffect(() => {
    async function loadRoutes() {
      try {
        const res = await axios.get('/api/routes');
        if (res.data?.routes && Array.isArray(res.data.routes)) {
          setRoutes(res.data.routes);
        }
      } catch (err) {
        console.warn('Failed to fetch routes for safety alert selector:', err);
      }
    }
    loadRoutes();
  }, []);

  // Fetch alerts whenever route or filter changes
  useEffect(() => {
    fetchAlerts();
  }, [selectedRouteId, selectedFilter]);

  async function fetchAlerts() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (selectedRouteId && selectedRouteId !== 'all') {
        params.routeId = selectedRouteId;
      }
      if (selectedFilter === 'CRITICAL' || selectedFilter === 'HIGH' || selectedFilter === 'MEDIUM' || selectedFilter === 'LOW') {
        params.severity = selectedFilter;
      } else if (selectedFilter === 'ACTIVE' || selectedFilter === 'RESOLVED') {
        params.status = selectedFilter;
      }

      const res = await axios.get('/api/safety/alerts', { params });
      if (res.data?.success) {
        setAlerts(res.data.alerts || []);
        if (res.data.summary) {
          setSummary(res.data.summary);
        }
      }
    } catch (err) {
      console.error('Failed to load safety alerts:', err);
    } finally {
      setLoading(false);
    }
  }

  // Trigger server-side evaluation
  async function handleEvaluateAlerts() {
    const routeToEvaluate = selectedRouteId !== 'all' ? selectedRouteId : (routes[0]?.id || 'route-sr-101');
    setEvaluating(true);
    setNotification(null);
    try {
      const res = await axios.post('/api/safety/alerts/evaluate', {
        routeId: routeToEvaluate,
      });

      if (res.data?.success) {
        const genCount = res.data.generatedCount || 0;
        setNotification({
          type: 'success',
          message: `Evaluation completed for ${res.data.route?.code || routeToEvaluate}: ${genCount} new alert(s) generated.`,
        });
        await fetchAlerts();
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.response?.data?.error || 'Failed to evaluate safety alerts',
      });
    } finally {
      setEvaluating(false);
    }
  }

  // Resolve an alert
  async function handleResolve(id: string) {
    setResolvingId(id);
    try {
      const res = await axios.post(`/api/safety/alerts/${id}/resolve`);
      if (res.data?.success) {
        setNotification({
          type: 'success',
          message: 'Safety alert resolved successfully.',
        });
        await fetchAlerts();
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.response?.data?.error || 'Failed to resolve safety alert',
      });
    } finally {
      setResolvingId(null);
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedAlertId(expandedAlertId === id ? null : id);
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-500/20 text-rose-300 border border-rose-500/30">
            <AlertOctagon className="w-3.5 h-3.5" />
            <span>CRITICAL</span>
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-orange-500/20 text-orange-300 border border-orange-500/30">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>HIGH</span>
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>MEDIUM</span>
          </span>
        );
      case 'LOW':
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>LOW</span>
          </span>
        );
    }
  };

  const renderEvidenceDetails = (evidence: Record<string, any>) => {
    if (!evidence || Object.keys(evidence).length === 0) {
      return <p className="text-xs text-slate-400 italic">No additional evidence logged.</p>;
    }

    const items: React.ReactNode[] = [];

    if (evidence.currentScore !== undefined) {
      items.push(
        <div key="score" className="flex items-center space-x-2 text-xs text-slate-300">
          <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span>
            Current Risk Score: <strong>{evidence.currentScore}/100</strong> ({evidence.riskLevel || 'EVALUATED'})
          </span>
        </div>
      );
    }

    if (evidence.delta !== undefined) {
      items.push(
        <div key="delta" className="flex items-center space-x-2 text-xs text-slate-300">
          <Check className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span>
            Risk surge: <strong>+{evidence.delta} pts</strong> (from {evidence.previousScore} to {evidence.currentScore})
          </span>
        </div>
      );
    }

    if (evidence.previousLevel && evidence.currentLevel) {
      items.push(
        <div key="escalation" className="flex items-center space-x-2 text-xs text-slate-300">
          <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>
            Safety Tier Escalated: <strong>{evidence.previousLevel} → {evidence.currentLevel}</strong>
          </span>
        </div>
      );
    }

    if (evidence.activeEmergencies !== undefined && evidence.activeEmergencies > 0) {
      items.push(
        <div key="emergencies" className="flex items-center space-x-2 text-xs text-rose-300 font-semibold">
          <AlertOctagon className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span>
            {evidence.activeEmergencies} active passenger SOS / emergency alert(s) logged
          </span>
        </div>
      );
    }

    if (evidence.activeDeviations !== undefined && evidence.activeDeviations > 0) {
      items.push(
        <div key="deviations" className="flex items-center space-x-2 text-xs text-slate-300">
          <Compass className="w-3.5 h-3.5 text-orange-400 shrink-0" />
          <span>
            {evidence.activeDeviations} active off-corridor route deviation(s)
          </span>
        </div>
      );
    }

    if (evidence.activeSpeedAnomalies !== undefined && evidence.activeSpeedAnomalies > 0) {
      items.push(
        <div key="speed" className="flex items-center space-x-2 text-xs text-slate-300">
          <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>
            {evidence.activeSpeedAnomalies} active corridor speed surge violation(s)
          </span>
        </div>
      );
    }

    if (evidence.driverVerified === false || evidence.vehicleApproved === false) {
      items.push(
        <div key="compliance" className="flex items-center space-x-2 text-xs text-orange-300">
          <XCircle className="w-3.5 h-3.5 text-orange-400 shrink-0" />
          <span>
            Compliance issue: {evidence.failedCondition || (evidence.failedConditions ? evidence.failedConditions.join(', ') : 'Driver/Vehicle unverified')}
          </span>
        </div>
      );
    }

    if (Array.isArray(evidence.factorChanges) && evidence.factorChanges.length > 0) {
      items.push(
        <div key="factors" className="space-y-1 pt-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Contributing Factor Shifts ({evidence.increasedCount || evidence.factorChanges.length}):
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
            {evidence.factorChanges.map((fc: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between px-2.5 py-1 rounded bg-slate-900 border border-slate-700/60 text-[11px]">
                <span className="text-slate-300">{fc.name}</span>
                <span className="font-bold text-rose-400">+{fc.delta} pts</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return <div className="space-y-1.5">{items}</div>;
  };

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl text-white">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-white flex items-center space-x-2">
                <span>Operational Safety Alert Center</span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-full">
                  Step 3 Engine
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Deterministic real-time alerts derived from route risk scores, threshold escalations, and corridor telemetry.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Route Selector */}
          <div className="relative">
            <select
              value={selectedRouteId}
              onChange={(e) => setSelectedRouteId(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-200 focus:outline-none focus:border-indigo-500 transition pr-8 cursor-pointer"
            >
              <option value="all">All Corridors ({routes.length})</option>
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} — {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Evaluate Safety Alerts Action Button */}
          <button
            onClick={handleEvaluateAlerts}
            disabled={evaluating}
            className="flex items-center space-x-1.5 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition shadow-lg shadow-rose-900/20 active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${evaluating ? 'animate-spin' : ''}`} />
            <span>{evaluating ? 'Evaluating Rules...' : 'Evaluate Safety Alerts'}</span>
          </button>
        </div>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div
          className={`mt-4 p-3 rounded-xl border text-xs flex items-center justify-between ${
            notification.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
              : 'bg-rose-950/40 border-rose-800/60 text-rose-300'
          }`}
        >
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-white">
            <CheckCircle2 className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-6">
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
            <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
            <span>Active Alerts</span>
          </div>
          <div className="text-2xl font-black text-rose-400 pt-2">{summary.active}</div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            <span>Critical</span>
          </div>
          <div className="text-2xl font-black text-rose-500 pt-2">{summary.critical}</div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-orange-400" />
            <span>High</span>
          </div>
          <div className="text-2xl font-black text-orange-400 pt-2">{summary.high}</div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
            <Sliders className="w-3.5 h-3.5 text-amber-400" />
            <span>Medium</span>
          </div>
          <div className="text-2xl font-black text-amber-400 pt-2">{summary.medium}</div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Resolved</span>
          </div>
          <div className="text-2xl font-black text-emerald-400 pt-2">{summary.resolved}</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center space-x-1 pt-6 pb-2 overflow-x-auto border-b border-slate-800/80">
        <span className="text-xs font-bold text-slate-400 mr-2 flex items-center space-x-1">
          <Filter className="w-3.5 h-3.5" />
          <span>Filter:</span>
        </span>
        {['ALL', 'ACTIVE', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'RESOLVED'].map((tab) => (
          <button
            key={tab}
            onClick={() => setSelectedFilter(tab)}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap ${
              selectedFilter === tab
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Alerts List */}
      <div className="pt-4 space-y-3">
        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
            <span>Loading operational safety alerts...</span>
          </div>
        ) : alerts.length === 0 ? (
          <div className="py-10 text-center rounded-xl bg-slate-950/40 border border-slate-800/60 p-6">
            <ShieldCheck className="w-10 h-10 text-emerald-400/80 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-slate-200">Zero Active Safety Alerts</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto pt-1">
              No matching alerts for the selected filter. Trigger &quot;Evaluate Safety Alerts&quot; above to audit corridor telemetry and risk thresholds.
            </p>
          </div>
        ) : (
          alerts.map((alert) => {
            const isExpanded = expandedAlertId === alert.id;
            const isResolving = resolvingId === alert.id;
            const isResolved = alert.status === 'RESOLVED';

            return (
              <div
                key={alert.id}
                className={`rounded-xl border transition ${
                  isResolved
                    ? 'bg-slate-950/30 border-slate-800/60 opacity-75'
                    : alert.severity === 'CRITICAL'
                    ? 'bg-slate-950/90 border-rose-500/40 shadow-lg shadow-rose-950/20'
                    : alert.severity === 'HIGH'
                    ? 'bg-slate-950/80 border-orange-500/30'
                    : 'bg-slate-950/60 border-slate-800'
                }`}
              >
                {/* Alert Item Header */}
                <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-start space-x-3 flex-1">
                    <div className="pt-0.5">{getSeverityBadge(alert.severity)}</div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                          {alert.routeCode}
                        </span>
                        <h4 className="text-sm font-bold text-white">{alert.title}</h4>
                        {alert.scoreDelta !== null && alert.scoreDelta !== undefined && (
                          <span
                            className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                              alert.scoreDelta > 0
                                ? 'bg-rose-500/20 text-rose-300'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            Δ {alert.scoreDelta > 0 ? `+${alert.scoreDelta}` : alert.scoreDelta} pts
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 pt-1">{alert.message}</p>
                      <div className="flex items-center space-x-4 text-[11px] text-slate-400 pt-2">
                        <span className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(alert.triggeredAt).toLocaleString()}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isResolved ? 'bg-emerald-400' : 'bg-rose-400 animate-pulse'
                            }`}
                          />
                          <span className={isResolved ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                            {alert.status}
                          </span>
                        </span>
                        {isResolved && alert.resolvedAt && (
                          <span className="text-slate-400">
                            Resolved: {new Date(alert.resolvedAt).toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      onClick={() => toggleExpand(alert.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center space-x-1 border border-slate-700/60 transition"
                    >
                      <Info className="w-3.5 h-3.5" />
                      <span>{isExpanded ? 'Hide Evidence' : 'View Evidence'}</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    {!isResolved && (
                      <button
                        onClick={() => handleResolve(alert.id)}
                        disabled={isResolving}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-bold flex items-center space-x-1 shadow transition active:scale-95"
                      >
                        <CheckCircle2 className={`w-3.5 h-3.5 ${isResolving ? 'animate-spin' : ''}`} />
                        <span>{isResolving ? 'Resolving...' : 'Resolve Alert'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Evidence Drawer */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t border-slate-800/80 bg-slate-950/60 rounded-b-xl">
                    <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 flex items-center space-x-1">
                          <Info className="w-3 h-3" />
                          <span>Deterministic Audit Evidence</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ID: {alert.id}
                        </span>
                      </div>
                      {renderEvidenceDetails(alert.evidence)}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
