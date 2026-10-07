'use client';

import React, { useState, useEffect } from 'react';
import {
  History,
  RotateCcw,
  Play,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  Bus,
  Activity,
  Info,
  CheckCircle2,
  HelpCircle,
  Clock,
  Database,
  ArrowRight,
  FileText,
  Sliders,
  Sparkles,
} from 'lucide-react';
import {
  MANDATORY_DECISION_REPLAY_NOTICE_1,
  MANDATORY_DECISION_REPLAY_NOTICE_2,
  HistoricalObservationSummary,
  ReplayScenarioInput,
  DecisionReplayResult,
} from '@/lib/operations/decision-replay-engine';
import {
  HypotheticalAlertSeverity,
  HypotheticalIncidentSeverity,
} from '@/lib/operations/scenario-simulation-engine';

export default function OperationalDecisionReplay() {
  const [selectedRoute, setSelectedRoute] = useState<string>('SR-101');
  const [availableRoutes, setAvailableRoutes] = useState<
    { id: string; code: string; name: string }[]
  >([
    { id: 'route_sr101', code: 'SR-101', name: 'Downtown Express' },
    { id: 'route_sr102', code: 'SR-102', name: 'Tech Park Shuttle' },
    { id: 'route_sr103', code: 'SR-103', name: 'Suburban Line' },
  ]);

  const [observations, setObservations] = useState<HistoricalObservationSummary[]>([]);
  const [selectedObservationId, setSelectedObservationId] = useState<string>('');
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Scenario Modifiers
  const defaultScenario: ReplayScenarioInput = {
    riskModifier: 0,
    demandModifierPercent: 0,
    capacityModifierPercent: 0,
    hypotheticalAlert: 'NONE',
    hypotheticalIncident: 'NONE',
    riskTrendScenario: 'UNCHANGED',
  };

  const [scenario, setScenario] = useState<ReplayScenarioInput>(defaultScenario);
  const [isReplaying, setIsReplaying] = useState<boolean>(false);
  const [replayError, setReplayError] = useState<string | null>(null);
  const [replayResult, setReplayResult] = useState<DecisionReplayResult | null>(null);

  // 1. Fetch available routes on mount
  useEffect(() => {
    async function loadRoutes() {
      try {
        const res = await fetch('/api/operations/decision-support');
        if (res.ok) {
          const json = await res.json();
          if (json?.data?.routes && Array.isArray(json.data.routes)) {
            setAvailableRoutes(
              json.data.routes.map((r: any) => ({
                id: r.routeId,
                code: r.routeCode,
                name: r.routeName,
              }))
            );
          }
        }
      } catch {
        // Fallback to static routes
      }
    }
    loadRoutes();
  }, []);

  // 2. Load historical observations when route changes
  useEffect(() => {
    async function loadObservations() {
      if (!selectedRoute) return;
      setIsLoadingHistory(true);
      setHistoryError(null);
      setReplayResult(null);

      try {
        const res = await fetch(
          `/api/operations/decision-replay/history?routeId=${encodeURIComponent(selectedRoute)}`
        );
        const data = await res.json();

        if (res.ok && data.success) {
          const obsList: HistoricalObservationSummary[] = data.observations || [];
          setObservations(obsList);
          if (obsList.length > 0) {
            setSelectedObservationId(obsList[0].observationId);
          } else {
            setSelectedObservationId('');
          }
        } else {
          setHistoryError(data.error || 'Failed to load historical observations');
          setObservations([]);
          setSelectedObservationId('');
        }
      } catch (err: any) {
        setHistoryError(err?.message || 'Error connecting to history service');
        setObservations([]);
        setSelectedObservationId('');
      } finally {
        setIsLoadingHistory(false);
      }
    }

    loadObservations();
  }, [selectedRoute]);

  // Execute Decision Replay
  const handleExecuteReplay = async () => {
    if (!selectedRoute || !selectedObservationId) {
      setReplayError('Please select both a corridor and a historical observation.');
      return;
    }

    setIsReplaying(true);
    setReplayError(null);

    try {
      const res = await fetch('/api/operations/decision-replay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routeId: selectedRoute,
          observationId: selectedObservationId,
          scenario,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setReplayResult(data);
      } else {
        setReplayError(data.error || 'Decision replay execution failed');
      }
    } catch (err: any) {
      setReplayError(err?.message || 'Network error executing decision replay');
    } finally {
      setIsReplaying(false);
    }
  };

  const handleResetModifiers = () => {
    setScenario(defaultScenario);
  };

  // Helper formatting badges
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'URGENT_REVIEW':
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1 w-fit">
            <AlertTriangle className="w-3.5 h-3.5" /> URGENT REVIEW
          </span>
        );
      case 'ATTENTION_REQUIRED':
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 w-fit">
            <ShieldAlert className="w-3.5 h-3.5" /> ATTENTION REQUIRED
          </span>
        );
      case 'MONITOR':
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1 w-fit">
            <Activity className="w-3.5 h-3.5" /> MONITOR
          </span>
        );
      case 'NORMAL':
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 w-fit">
            <ShieldCheck className="w-3.5 h-3.5" /> NORMAL
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-slate-800 text-slate-300 border border-slate-700">
            {status}
          </span>
        );
    }
  };

  const getRiskLevelBadge = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return (
          <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
            CRITICAL
          </span>
        );
      case 'HIGH':
        return (
          <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-orange-500/20 text-orange-300 border border-orange-500/40">
            HIGH
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
            MEDIUM
          </span>
        );
      case 'LOW':
        return (
          <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            LOW
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-slate-700 text-slate-300">
            {level}
          </span>
        );
    }
  };

  const getStatusChangeBadge = (change: string) => {
    switch (change) {
      case 'ESCALATED':
        return (
          <span className="px-2 py-0.5 text-xs font-bold rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> ESCALATED
          </span>
        );
      case 'DE_ESCALATED':
        return (
          <span className="px-2 py-0.5 text-xs font-bold rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
            <TrendingDown className="w-3 h-3" /> DE-ESCALATED
          </span>
        );
      case 'UNCHANGED':
        return (
          <span className="px-2 py-0.5 text-xs font-bold rounded bg-slate-700 text-slate-300 border border-slate-600 flex items-center gap-1">
            <Minus className="w-3 h-3" /> UNCHANGED
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 text-xs font-bold rounded bg-slate-800 text-slate-400">
            {change}
          </span>
        );
    }
  };

  const selectedObservation = observations.find((o) => o.observationId === selectedObservationId);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden text-slate-100 mb-8">
      {/* 1. Header & Mandatory Advisory Notices */}
      <div className="p-6 border-b border-slate-800 bg-slate-950/60">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <History className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black tracking-tight text-white">
                  Operational Decision Replay & Historical What-If Center
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                  Step 14 Replay Engine
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Reconstruct historical corridor states from immutable server snapshots and validate retrospective what-if hypotheses.
              </p>
            </div>
          </div>
        </div>

        {/* Advisory Warning Notices */}
        <div className="mt-4 p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-xl space-y-1.5 text-xs text-amber-200/90">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-300">Mandatory System Advisory Notice:</p>
              <p>{MANDATORY_DECISION_REPLAY_NOTICE_1}</p>
              <p className="mt-1 text-amber-300/80 italic">{MANDATORY_DECISION_REPLAY_NOTICE_2}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* 2. Corridor Selector & Historical Observation Picker */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-950/40 rounded-xl border border-slate-800/80">
          {/* Corridor Selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Select Operational Corridor
            </label>
            <div className="grid grid-cols-3 gap-2">
              {availableRoutes.map((r) => (
                <button
                  key={r.code}
                  type="button"
                  onClick={() => setSelectedRoute(r.code)}
                  className={`px-3 py-2 text-xs font-bold rounded-lg border transition text-left ${
                    selectedRoute === r.code
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                      : 'bg-slate-800/70 hover:bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  <div className="font-bold">{r.code}</div>
                  <div className="text-[10px] font-normal truncate opacity-80">{r.name}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Historical Observation Picker */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Persisted Historical Observation
              </label>
              {isLoadingHistory && (
                <span className="text-[11px] text-indigo-400 flex items-center gap-1">
                  <Clock className="w-3 h-3 animate-spin" /> Loading snapshots...
                </span>
              )}
            </div>

            {historyError ? (
              <div className="p-2.5 text-xs rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300">
                {historyError}
              </div>
            ) : observations.length === 0 ? (
              <div className="p-3 text-xs rounded-lg bg-slate-800/50 border border-slate-700/60 text-slate-400">
                No persisted historical snapshots found for corridor {selectedRoute}. Trigger a safety evaluation or route snapshot to create historical observations.
              </div>
            ) : (
              <select
                value={selectedObservationId}
                onChange={(e) => setSelectedObservationId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs font-medium text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                {observations.map((obs) => (
                  <option key={obs.observationId} value={obs.observationId}>
                    {new Date(obs.observedAt).toLocaleString()} — Risk: {obs.riskScore}/100 ({obs.riskLevel}) [{obs.dataQuality}]
                  </option>
                ))}
              </select>
            )}

            {selectedObservation && (
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                <span>
                  Source: <span className="text-slate-300 font-mono">{selectedObservation.sourceType}</span>
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-indigo-300 font-semibold">
                  {selectedObservation.dataQuality}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 3. Retrospective What-If Modifiers */}
        <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-800/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-slate-200">
                Retrospective What-If Modifiers (Applied to Historical State)
              </h3>
            </div>
            {/* Preset shortcuts */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-slate-500 font-medium mr-1">Presets:</span>
              <button
                type="button"
                onClick={handleResetModifiers}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold border border-slate-700"
              >
                Baseline (No Modifiers)
              </button>
              <button
                type="button"
                onClick={() =>
                  setScenario({
                    riskModifier: 20,
                    demandModifierPercent: 35,
                    capacityModifierPercent: -20,
                    hypotheticalAlert: 'HIGH',
                    hypotheticalIncident: 'NONE',
                    riskTrendScenario: 'RISING',
                  })
                }
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold border border-slate-700"
              >
                Peak Stress Surge
              </button>
              <button
                type="button"
                onClick={() =>
                  setScenario({
                    riskModifier: -15,
                    demandModifierPercent: -10,
                    capacityModifierPercent: 0,
                    hypotheticalAlert: 'NONE',
                    hypotheticalIncident: 'NONE',
                    riskTrendScenario: 'FALLING',
                  })
                }
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold border border-slate-700"
              >
                Calm Corridor
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Risk Modifier */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Risk Score Modifier</span>
                <span className="font-bold text-indigo-400">
                  {scenario.riskModifier > 0 ? `+${scenario.riskModifier}` : scenario.riskModifier} pts
                </span>
              </div>
              <input
                type="range"
                min="-50"
                max="50"
                step="5"
                value={scenario.riskModifier}
                onChange={(e) =>
                  setScenario({ ...scenario, riskModifier: parseInt(e.target.value, 10) })
                }
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>-50 pts</span>
                <span>0</span>
                <span>+50 pts</span>
              </div>
            </div>

            {/* Demand Modifier */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Demand Modifier (%)</span>
                <span className="font-bold text-indigo-400">
                  {scenario.demandModifierPercent > 0
                    ? `+${scenario.demandModifierPercent}%`
                    : `${scenario.demandModifierPercent}%`}
                </span>
              </div>
              <input
                type="range"
                min="-50"
                max="100"
                step="5"
                value={scenario.demandModifierPercent}
                onChange={(e) =>
                  setScenario({
                    ...scenario,
                    demandModifierPercent: parseInt(e.target.value, 10),
                  })
                }
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>-50%</span>
                <span>0%</span>
                <span>+100%</span>
              </div>
            </div>

            {/* Capacity Modifier */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Capacity Modifier (%)</span>
                <span className="font-bold text-indigo-400">
                  {scenario.capacityModifierPercent > 0
                    ? `+${scenario.capacityModifierPercent}%`
                    : `${scenario.capacityModifierPercent}%`}
                </span>
              </div>
              <input
                type="range"
                min="-50"
                max="100"
                step="5"
                value={scenario.capacityModifierPercent}
                onChange={(e) =>
                  setScenario({
                    ...scenario,
                    capacityModifierPercent: parseInt(e.target.value, 10),
                  })
                }
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>-50%</span>
                <span>0%</span>
                <span>+100%</span>
              </div>
            </div>

            {/* Hypothetical Alert */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Injected Alert Severity</label>
              <select
                value={scenario.hypotheticalAlert}
                onChange={(e) =>
                  setScenario({
                    ...scenario,
                    hypotheticalAlert: e.target.value as HypotheticalAlertSeverity,
                  })
                }
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="NONE">NONE (No Alert Injected)</option>
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>

            {/* Hypothetical Incident */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Injected Incident Severity</label>
              <select
                value={scenario.hypotheticalIncident}
                onChange={(e) =>
                  setScenario({
                    ...scenario,
                    hypotheticalIncident: e.target.value as HypotheticalIncidentSeverity,
                  })
                }
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="NONE">NONE (No Incident Injected)</option>
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>

            {/* Risk Trend Scenario */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Risk Trend Direction</label>
              <select
                value={scenario.riskTrendScenario}
                onChange={(e) =>
                  setScenario({
                    ...scenario,
                    riskTrendScenario: e.target.value as 'UNCHANGED' | 'RISING' | 'FALLING' | 'STABLE',
                  })
                }
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="UNCHANGED">UNCHANGED (Match Snapshot)</option>
                <option value="RISING">RISING</option>
                <option value="FALLING">FALLING</option>
                <option value="STABLE">STABLE</option>
              </select>
            </div>
          </div>

          {/* Action Trigger Buttons */}
          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={handleResetModifiers}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Modifiers
            </button>

            <button
              type="button"
              disabled={isReplaying || !selectedObservationId}
              onClick={handleExecuteReplay}
              className="px-5 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isReplaying ? (
                <>
                  <Clock className="w-3.5 h-3.5 animate-spin" /> Executing Replay...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" /> Run Decision Replay
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error message */}
        {replayError && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{replayError}</span>
          </div>
        )}

        {/* 4. Three-Column Comparative State Display */}
        {replayResult && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Column 1: Historical State */}
              <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 shadow-md space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Baseline Reconstruction
                    </span>
                    <h4 className="text-base font-bold text-white flex items-center gap-2">
                      <Clock className="w-4 h-4 text-indigo-400" /> Historical State
                    </h4>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 font-semibold">
                    {replayResult.historical.dataQuality}
                  </span>
                </div>

                <div className="text-[11px] text-slate-400 font-mono">
                  Observed: {new Date(replayResult.historical.observedAt).toLocaleString()}
                </div>

                {/* Risk & Status */}
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Risk Score:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black text-white">
                        {replayResult.historical.risk.score}/100
                      </span>
                      {getRiskLevelBadge(replayResult.historical.risk.level)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                    <span className="text-xs text-slate-400">Operational Status:</span>
                    {getStatusBadge(replayResult.historical.operationalStatus)}
                  </div>
                </div>

                {/* Telemetry Metrics */}
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-500" /> Predicted Demand:
                    </span>
                    <span className="font-semibold text-slate-200">
                      {replayResult.historical.demand.predictedDemand !== null
                        ? `${replayResult.historical.demand.predictedDemand} riders`
                        : <span className="text-slate-500 italic">Unavailable (Not Fabricated)</span>}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Bus className="w-3.5 h-3.5 text-slate-500" /> Vehicle Capacity:
                    </span>
                    <span className="font-semibold text-slate-200">
                      {replayResult.historical.demand.capacity !== null
                        ? `${replayResult.historical.demand.capacity} seats`
                        : <span className="text-slate-500 italic">Unavailable</span>}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-slate-500" /> Projected Occupancy:
                    </span>
                    <span className="font-semibold text-slate-200">
                      {replayResult.historical.demand.occupancy !== null
                        ? `${replayResult.historical.demand.occupancy}%`
                        : <span className="text-slate-500 italic">Unavailable</span>}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-500" /> Active Alerts:
                    </span>
                    <span className="font-semibold text-slate-200">
                      {replayResult.historical.alerts.totalActive} ({replayResult.historical.alerts.critical} critical)
                    </span>
                  </div>

                  <div className="flex justify-between py-1">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> Unresolved Incidents:
                    </span>
                    <span className="font-semibold text-slate-200">
                      {replayResult.historical.incidents.unresolved} ({replayResult.historical.incidents.critical} critical)
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-800">
                  Driver Verified: {replayResult.historical.risk.driverVerified ? 'Yes' : 'No'} | Vehicle Approved: {replayResult.historical.risk.vehicleApproved ? 'Yes' : 'No'}
                </div>
              </div>

              {/* Column 2: Current Verified State */}
              <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 shadow-md space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Live Telemetry Baseline
                    </span>
                    <h4 className="text-base font-bold text-white flex items-center gap-2">
                      <Activity className="w-4 h-4 text-emerald-400" /> Current Verified State
                    </h4>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-semibold">
                    LIVE VERIFIED
                  </span>
                </div>

                <div className="text-[11px] text-slate-400 font-mono">
                  Evaluated: {new Date(replayResult.current.evaluatedAt).toLocaleString()}
                </div>

                {/* Risk & Status */}
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Risk Score:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black text-white">
                        {replayResult.current.riskScore}/100
                      </span>
                      {getRiskLevelBadge(replayResult.current.riskLevel)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                    <span className="text-xs text-slate-400">Operational Status:</span>
                    {getStatusBadge(replayResult.current.operationalStatus)}
                  </div>
                </div>

                {/* Telemetry Metrics */}
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-500" /> Predicted Demand:
                    </span>
                    <span className="font-semibold text-slate-200">
                      {replayResult.current.predictedDemand !== null
                        ? `${replayResult.current.predictedDemand} riders`
                        : <span className="text-slate-500 italic">N/A</span>}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Bus className="w-3.5 h-3.5 text-slate-500" /> Vehicle Capacity:
                    </span>
                    <span className="font-semibold text-slate-200">
                      {replayResult.current.vehicleCapacity} seats
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-slate-500" /> Projected Occupancy:
                    </span>
                    <span className="font-semibold text-slate-200">
                      {replayResult.current.projectedOccupancy !== null
                        ? `${replayResult.current.projectedOccupancy}%`
                        : <span className="text-slate-500 italic">N/A</span>}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-500" /> Active Alerts:
                    </span>
                    <span className="font-semibold text-slate-200">
                      {replayResult.current.activeAlerts} ({replayResult.current.criticalAlerts} critical)
                    </span>
                  </div>

                  <div className="flex justify-between py-1">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> Unresolved Incidents:
                    </span>
                    <span className="font-semibold text-slate-200">
                      {replayResult.current.unresolvedIncidents} ({replayResult.current.criticalIncidents} critical)
                    </span>
                  </div>
                </div>

                {/* Variance vs Historical */}
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] space-y-1">
                  <div className="font-bold text-slate-300">Variance vs Historical:</div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Risk Variance:</span>
                    <span className={`font-semibold ${
                      replayResult.variances.historicalVsCurrent.riskDelta > 0
                        ? 'text-rose-400'
                        : replayResult.variances.historicalVsCurrent.riskDelta < 0
                        ? 'text-emerald-400'
                        : 'text-slate-300'
                    }`}>
                      {replayResult.variances.historicalVsCurrent.riskDelta > 0 ? `+${replayResult.variances.historicalVsCurrent.riskDelta}` : replayResult.variances.historicalVsCurrent.riskDelta} pts
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Status Change:</span>
                    {getStatusChangeBadge(replayResult.variances.historicalVsCurrent.statusChange)}
                  </div>
                </div>
              </div>

              {/* Column 3: Historical + What-If State */}
              <div className="p-5 rounded-2xl bg-indigo-950/20 border border-indigo-500/30 shadow-md space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-indigo-500/20">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                      Retrospective Simulation
                    </span>
                    <h4 className="text-base font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-400" /> Historical + What-If
                    </h4>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-semibold">
                    SIMULATED HYPOTHESIS
                  </span>
                </div>

                <div className="text-[11px] text-slate-400 font-mono">
                  Modifiers: Risk {scenario.riskModifier > 0 ? `+${scenario.riskModifier}` : scenario.riskModifier} | Demand {scenario.demandModifierPercent}% | Cap {scenario.capacityModifierPercent}%
                </div>

                {/* Risk & Status */}
                <div className="p-3 bg-slate-900/90 rounded-xl border border-indigo-500/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Simulated Risk:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black text-white">
                        {replayResult.historicalWhatIf.riskScore}/100
                      </span>
                      {getRiskLevelBadge(replayResult.historicalWhatIf.riskLevel)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                    <span className="text-xs text-slate-400">Simulated Status:</span>
                    {getStatusBadge(replayResult.historicalWhatIf.operationalStatus)}
                  </div>
                </div>

                {/* Telemetry Metrics */}
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-500" /> Projected Demand:
                    </span>
                    <span className="font-semibold text-slate-200">
                      {replayResult.historicalWhatIf.predictedDemand !== null
                        ? `${replayResult.historicalWhatIf.predictedDemand} riders`
                        : <span className="text-slate-500 italic">Unavailable</span>}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Bus className="w-3.5 h-3.5 text-slate-500" /> Modified Capacity:
                    </span>
                    <span className="font-semibold text-slate-200">
                      {replayResult.historicalWhatIf.vehicleCapacity !== null
                        ? `${replayResult.historicalWhatIf.vehicleCapacity} seats`
                        : <span className="text-slate-500 italic">Unavailable</span>}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-slate-500" /> Projected Occupancy:
                    </span>
                    <span className="font-semibold text-slate-200">
                      {replayResult.historicalWhatIf.projectedOccupancy !== null
                        ? `${replayResult.historicalWhatIf.projectedOccupancy}%`
                        : <span className="text-slate-500 italic">Unavailable</span>}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-500" /> Total Active Alerts:
                    </span>
                    <span className="font-semibold text-slate-200">
                      {replayResult.historicalWhatIf.activeAlerts} ({replayResult.historicalWhatIf.criticalAlerts} critical)
                    </span>
                  </div>

                  <div className="flex justify-between py-1">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> Unresolved Incidents:
                    </span>
                    <span className="font-semibold text-slate-200">
                      {replayResult.historicalWhatIf.unresolvedIncidents} ({replayResult.historicalWhatIf.criticalIncidents} critical)
                    </span>
                  </div>
                </div>

                {/* Variance vs Historical Baseline */}
                <div className="p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-500/20 text-[11px] space-y-1">
                  <div className="font-bold text-indigo-300">Hypothesis Impact vs Baseline:</div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Risk Delta:</span>
                    <span className={`font-semibold ${
                      replayResult.variances.historicalVsWhatIf.riskDelta > 0
                        ? 'text-rose-400'
                        : replayResult.variances.historicalVsWhatIf.riskDelta < 0
                        ? 'text-emerald-400'
                        : 'text-slate-300'
                    }`}>
                      {replayResult.variances.historicalVsWhatIf.riskDelta > 0 ? `+${replayResult.variances.historicalVsWhatIf.riskDelta}` : replayResult.variances.historicalVsWhatIf.riskDelta} pts
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Status Impact:</span>
                    {getStatusChangeBadge(replayResult.variances.historicalVsWhatIf.statusChange)}
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Deterministic Explanations */}
            <div className="p-5 bg-slate-950/50 rounded-2xl border border-slate-800 space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                Deterministic Explainability & Variance Drivers
              </h4>
              <ul className="space-y-2">
                {replayResult.explanations.map((exp, idx) => (
                  <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                    <span>{exp}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 6. Recommendation Impact Drawer / Card */}
            {replayResult.historicalWhatIf.recommendationImpact && (
              <div className="p-5 bg-slate-950/50 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-amber-400" />
                    Simulated Recommendation Impact (Step 7 Rule Triggering)
                  </h4>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-semibold">
                    {replayResult.historicalWhatIf.recommendationImpact.recommendationCount} Simulated Draft(s)
                  </span>
                </div>

                {replayResult.historicalWhatIf.recommendationImpact.simulatedDrafts.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">
                    No operational recommendations were triggered under this simulated condition. Corridor remains within acceptable bounds.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {replayResult.historicalWhatIf.recommendationImpact.simulatedDrafts.map((draft, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                            {draft.type}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            draft.priority === 'CRITICAL'
                              ? 'bg-rose-500/20 text-rose-300'
                              : draft.priority === 'HIGH'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-slate-700 text-slate-300'
                          }`}>
                            {draft.priority}
                          </span>
                        </div>
                        <h5 className="text-xs font-bold text-white">{draft.title}</h5>
                        <p className="text-[11px] text-slate-300">{draft.recommendation}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 7. Metric Evidence Trace & Persisted Data Quality */}
            <div className="p-5 bg-slate-950/50 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-400" />
                  Metric Evidence Trace & Source Data Quality
                </h4>
                <span className="text-[11px] text-slate-500 font-mono">
                  {replayResult.evidenceTrace.length} Verified Evidence Points
                </span>
              </div>
              <p className="text-xs text-slate-400">
                To prevent hallucination, each metric is explicitly mapped to its server source record. Missing historical data is marked unavailable rather than fabricated.
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="py-2 px-3">Metric</th>
                      <th className="py-2 px-3">Reconstructed Value</th>
                      <th className="py-2 px-3">Source Store</th>
                      <th className="py-2 px-3">Availability</th>
                      <th className="py-2 px-3">Data Quality / Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {replayResult.evidenceTrace.map((ev, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/40">
                        <td className="py-2 px-3 font-semibold text-slate-200">
                          {ev.metric}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-300">
                          {ev.value !== null ? String(ev.value) : <span className="text-slate-500 italic">null</span>}
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-400">
                          {ev.sourceType || 'N/A'}
                        </td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            ev.availability === 'VERIFIED'
                              ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                              : ev.availability === 'PARTIAL'
                              ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                              : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                          }`}>
                            {ev.availability}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-[11px] text-slate-400">
                          {ev.reason || (ev.verified ? 'Verified persisted intelligence' : 'Derived baseline')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
