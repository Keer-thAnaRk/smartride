'use client';

import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Play,
  RotateCcw,
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
  Zap,
} from 'lucide-react';
import {
  SCENARIO_PRESETS,
  MANDATORY_SCENARIO_SIMULATION_NOTICE,
  ScenarioSimulationResult,
  HypotheticalAlertSeverity,
  HypotheticalIncidentSeverity,
  RiskTrendScenario,
} from '@/lib/operations/scenario-simulation-engine';

export default function OperationalScenarioSimulation() {
  const [selectedRoute, setSelectedRoute] = useState<string>('SR-101');
  const [availableRoutes, setAvailableRoutes] = useState<
    { id: string; code: string; name: string }[]
  >([
    { id: 'route_sr101', code: 'SR-101', name: 'Downtown Express' },
    { id: 'route_sr102', code: 'SR-102', name: 'Tech Park Shuttle' },
    { id: 'route_sr103', code: 'SR-103', name: 'Suburban Line' },
  ]);

  // Scenario Modifiers
  const [riskModifier, setRiskModifier] = useState<number>(0);
  const [demandModifierPercent, setDemandModifierPercent] = useState<number>(0);
  const [capacityModifierPercent, setCapacityModifierPercent] = useState<number>(0);
  const [hypotheticalAlert, setHypotheticalAlert] =
    useState<HypotheticalAlertSeverity>('NONE');
  const [hypotheticalIncident, setHypotheticalIncident] =
    useState<HypotheticalIncidentSeverity>('NONE');
  const [riskTrendScenario, setRiskTrendScenario] =
    useState<RiskTrendScenario>('NO_CHANGE');

  // Simulation State
  const [activePresetId, setActivePresetId] = useState<string>('NORMAL_BASELINE');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [simulationResult, setSimulationResult] =
    useState<ScenarioSimulationResult | null>(null);

  // Fetch corridors from decision-support or use defaults
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
        // Fallback to static corridor routes
      }
    }
    loadRoutes();
  }, []);

  // Run simulation against backend
  const runSimulation = async (overrideModifiers?: {
    riskModifier: number;
    demandModifierPercent: number;
    capacityModifierPercent: number;
    hypotheticalAlert: HypotheticalAlertSeverity;
    hypotheticalIncident: HypotheticalIncidentSeverity;
    riskTrendScenario: RiskTrendScenario;
  }) => {
    setIsLoading(true);
    setError(null);

    const payload = {
      routeId: selectedRoute,
      riskModifier: overrideModifiers ? overrideModifiers.riskModifier : riskModifier,
      demandModifierPercent: overrideModifiers
        ? overrideModifiers.demandModifierPercent
        : demandModifierPercent,
      capacityModifierPercent: overrideModifiers
        ? overrideModifiers.capacityModifierPercent
        : capacityModifierPercent,
      hypotheticalAlert: overrideModifiers
        ? overrideModifiers.hypotheticalAlert
        : hypotheticalAlert,
      hypotheticalIncident: overrideModifiers
        ? overrideModifiers.hypotheticalIncident
        : hypotheticalIncident,
      riskTrendScenario: overrideModifiers
        ? overrideModifiers.riskTrendScenario
        : riskTrendScenario,
    };

    try {
      const res = await fetch('/api/operations/scenario-simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      setSimulationResult(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to execute scenario simulation');
    } finally {
      setIsLoading(false);
    }
  };

  // Run initial simulation on corridor change
  useEffect(() => {
    runSimulation();
  }, [selectedRoute]);

  // Apply a preset
  const handleApplyPreset = (presetId: string) => {
    const preset = SCENARIO_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    setActivePresetId(presetId);
    setRiskModifier(preset.modifiers.riskModifier);
    setDemandModifierPercent(preset.modifiers.demandModifierPercent);
    setCapacityModifierPercent(preset.modifiers.capacityModifierPercent);
    setHypotheticalAlert(preset.modifiers.hypotheticalAlert);
    setHypotheticalIncident(preset.modifiers.hypotheticalIncident);
    setRiskTrendScenario(preset.modifiers.riskTrendScenario);

    runSimulation(preset.modifiers);
  };

  // Reset to Baseline
  const handleReset = () => {
    handleApplyPreset('NORMAL_BASELINE');
  };

  // Status badge styling helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'URGENT_REVIEW':
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-red-950/80 text-red-300 border border-red-700/60 inline-flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
            URGENT REVIEW
          </span>
        );
      case 'ATTENTION_REQUIRED':
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-950/80 text-amber-300 border border-amber-700/60 inline-flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            ATTENTION REQUIRED
          </span>
        );
      case 'MONITOR':
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-950/80 text-blue-300 border border-blue-700/60 inline-flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-blue-400" />
            MONITOR
          </span>
        );
      case 'NORMAL':
      default:
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 inline-flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            NORMAL
          </span>
        );
    }
  };

  const getRiskBadge = (level: string, score: number) => {
    switch (level) {
      case 'CRITICAL':
        return (
          <span className="px-2 py-0.5 text-xs font-extrabold rounded bg-red-900/60 text-red-200 border border-red-700">
            {score}/100 CRITICAL
          </span>
        );
      case 'HIGH':
        return (
          <span className="px-2 py-0.5 text-xs font-extrabold rounded bg-amber-900/60 text-amber-200 border border-amber-700">
            {score}/100 HIGH
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="px-2 py-0.5 text-xs font-extrabold rounded bg-blue-900/60 text-blue-200 border border-blue-700">
            {score}/100 MEDIUM
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 text-xs font-extrabold rounded bg-emerald-900/60 text-emerald-200 border border-emerald-700">
            {score}/100 LOW
          </span>
        );
    }
  };

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6 text-slate-100">
      {/* 1. Header & Mandatory Advisory Disclaimer */}
      <div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl">
                <Sliders className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-white">
                Operational Scenario Simulation & What-If Analysis Center
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Phase 3 Step 12 — Safe corridor stress-testing, hypothetical risk modulation, and deterministic impact modeling.
            </p>
          </div>

          {/* Route Selector */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-slate-400">Target Corridor:</label>
            <select
              value={selectedRoute}
              onChange={(e) => {
                setSelectedRoute(e.target.value);
                setActivePresetId('NORMAL_BASELINE');
              }}
              className="bg-slate-950 border border-slate-700 text-white text-xs font-semibold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              {availableRoutes.map((r) => (
                <option key={r.id} value={r.code}>
                  {r.code} — {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Mandatory Safety Notice Banner */}
        <div className="mt-4 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">MANDATORY OPERATIONAL SAFETY NOTICE: </span>
            {MANDATORY_SCENARIO_SIMULATION_NOTICE}
          </div>
        </div>
      </div>

      {/* 2. Scenario Presets */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            Quick Scenario Presets
          </span>
          <button
            onClick={handleReset}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 transition"
          >
            <RotateCcw className="w-3 h-3" />
            Reset Baseline
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
          {SCENARIO_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handleApplyPreset(preset.id)}
              className={`p-2.5 text-left rounded-xl border text-xs transition flex flex-col justify-between ${
                activePresetId === preset.id
                  ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-md'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800/80 hover:border-slate-700'
              }`}
            >
              <div className="font-bold text-[11px] leading-tight mb-1">
                {preset.name}
              </div>
              <div className="text-[10px] text-slate-400 line-clamp-2">
                {preset.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Interactive Modifiers & Controls */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4.5 space-y-4">
        <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
          Hypothetical Parameters & Stress Controls
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Risk Modifier Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-medium">Risk Score Modifier:</span>
              <span className="font-bold font-mono text-indigo-400">
                {riskModifier > 0 ? `+${riskModifier}` : riskModifier} pts
              </span>
            </div>
            <input
              type="range"
              min="-50"
              max="50"
              step="5"
              value={riskModifier}
              onChange={(e) => {
                setRiskModifier(parseInt(e.target.value, 10));
                setActivePresetId('CUSTOM');
              }}
              className="w-full accent-indigo-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>-50 pts</span>
              <span>0 (Baseline)</span>
              <span>+50 pts</span>
            </div>
          </div>

          {/* Demand Modifier Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-medium">Demand Surge / Drop:</span>
              <span className="font-bold font-mono text-cyan-400">
                {demandModifierPercent > 0
                  ? `+${demandModifierPercent}%`
                  : `${demandModifierPercent}%`}
              </span>
            </div>
            <input
              type="range"
              min="-50"
              max="100"
              step="5"
              value={demandModifierPercent}
              onChange={(e) => {
                setDemandModifierPercent(parseInt(e.target.value, 10));
                setActivePresetId('CUSTOM');
              }}
              className="w-full accent-cyan-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>-50%</span>
              <span>0%</span>
              <span>+100%</span>
            </div>
          </div>

          {/* Capacity Modifier Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-medium">Capacity Adjustment:</span>
              <span className="font-bold font-mono text-amber-400">
                {capacityModifierPercent > 0
                  ? `+${capacityModifierPercent}%`
                  : `${capacityModifierPercent}%`}
              </span>
            </div>
            <input
              type="range"
              min="-50"
              max="100"
              step="5"
              value={capacityModifierPercent}
              onChange={(e) => {
                setCapacityModifierPercent(parseInt(e.target.value, 10));
                setActivePresetId('CUSTOM');
              }}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>-50%</span>
              <span>0%</span>
              <span>+100%</span>
            </div>
          </div>
        </div>

        {/* Hypothetical Events & Trajectory Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-800/80">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Hypothetical Safety Alert:
            </label>
            <select
              value={hypotheticalAlert}
              onChange={(e) => {
                setHypotheticalAlert(e.target.value as HypotheticalAlertSeverity);
                setActivePresetId('CUSTOM');
              }}
              className="w-full bg-slate-900 border border-slate-700 text-white text-xs rounded-lg px-2.5 py-1.5"
            >
              <option value="NONE">None (Live Alerts Only)</option>
              <option value="LOW">Inject LOW Alert</option>
              <option value="MEDIUM">Inject MEDIUM Alert</option>
              <option value="HIGH">Inject HIGH Alert</option>
              <option value="CRITICAL">Inject CRITICAL Alert</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Hypothetical Incident Case:
            </label>
            <select
              value={hypotheticalIncident}
              onChange={(e) => {
                setHypotheticalIncident(e.target.value as HypotheticalIncidentSeverity);
                setActivePresetId('CUSTOM');
              }}
              className="w-full bg-slate-900 border border-slate-700 text-white text-xs rounded-lg px-2.5 py-1.5"
            >
              <option value="NONE">None (Live Incidents Only)</option>
              <option value="LOW">Inject LOW Incident</option>
              <option value="MEDIUM">Inject MEDIUM Incident</option>
              <option value="HIGH">Inject HIGH Incident</option>
              <option value="CRITICAL">Inject CRITICAL Incident</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Risk Trajectory Scenario:
            </label>
            <select
              value={riskTrendScenario}
              onChange={(e) => {
                setRiskTrendScenario(e.target.value as RiskTrendScenario);
                setActivePresetId('CUSTOM');
              }}
              className="w-full bg-slate-900 border border-slate-700 text-white text-xs rounded-lg px-2.5 py-1.5"
            >
              <option value="NO_CHANGE">Baseline Observed Trend</option>
              <option value="RISING">Simulate RISING Trend (+10 pts)</option>
              <option value="STABLE">Simulate STABLE Trend</option>
              <option value="FALLING">Simulate IMPROVING / FALLING</option>
            </select>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end pt-1">
          <button
            onClick={() => runSimulation()}
            disabled={isLoading}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-lg shadow-indigo-600/20"
          >
            <Play className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Simulating Scenario...' : 'Execute What-If Simulation'}
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-3 bg-red-950/60 border border-red-800 rounded-xl text-red-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <span>Simulation Error: {error}</span>
        </div>
      )}

      {/* 4. Comparative Matrix & Results */}
      {simulationResult && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Status Shift Executive Banner */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Corridor {simulationResult.route.code} Status Shift:
                </span>
                {getStatusBadge(simulationResult.baseline.operationalStatus)}
                <span className="text-slate-500 font-mono text-xs">➔</span>
                {getStatusBadge(simulationResult.simulated.operationalStatus)}

                {simulationResult.comparison.statusChange === 'ESCALATED' && (
                  <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded bg-red-500/20 text-red-400 border border-red-500/30">
                    ▲ Escalated
                  </span>
                )}
                {simulationResult.comparison.statusChange === 'DE_ESCALATED' && (
                  <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    ▼ De-escalated
                  </span>
                )}
                {simulationResult.comparison.statusChange === 'UNCHANGED' && (
                  <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded bg-slate-800 text-slate-400 border border-slate-700">
                    ● Unchanged
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 pt-1">
                {simulationResult.simulated.briefing}
              </p>
            </div>

            <div className="text-right shrink-0">
              <div className="text-[11px] text-slate-500">Simulated at:</div>
              <div className="text-xs font-mono text-slate-300">
                {new Date(simulationResult.simulatedAt).toLocaleTimeString()}
              </div>
            </div>
          </div>

          {/* Comparative Matrix Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-4">Operational Factor</th>
                  <th className="py-2.5 px-4">Live Baseline</th>
                  <th className="py-2.5 px-4">What-If Simulated</th>
                  <th className="py-2.5 px-4 text-right">Variance / Delta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {/* Risk Score */}
                <tr className="hover:bg-slate-900/40">
                  <td className="py-3 px-4 text-slate-300 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-400" />
                    <span>Risk Score & Level</span>
                  </td>
                  <td className="py-3 px-4">
                    {getRiskBadge(
                      simulationResult.baseline.riskLevel,
                      simulationResult.baseline.riskScore
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {getRiskBadge(
                      simulationResult.simulated.riskLevel,
                      simulationResult.simulated.riskScore
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-mono">
                    {simulationResult.comparison.riskDelta > 0 ? (
                      <span className="text-red-400 font-bold">
                        +{simulationResult.comparison.riskDelta} pts
                      </span>
                    ) : simulationResult.comparison.riskDelta < 0 ? (
                      <span className="text-emerald-400 font-bold">
                        {simulationResult.comparison.riskDelta} pts
                      </span>
                    ) : (
                      <span className="text-slate-500">0 pts</span>
                    )}
                  </td>
                </tr>

                {/* Risk Trend */}
                <tr className="hover:bg-slate-900/40">
                  <td className="py-3 px-4 text-slate-300">Risk Trajectory</td>
                  <td className="py-3 px-4 font-mono text-slate-400">
                    {simulationResult.baseline.riskTrend}
                  </td>
                  <td className="py-3 px-4 font-mono text-indigo-300">
                    {simulationResult.simulated.riskTrend}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-400">
                    {simulationResult.baseline.riskTrend ===
                    simulationResult.simulated.riskTrend
                      ? 'Identical'
                      : 'Shifted'}
                  </td>
                </tr>

                {/* Demand & Capacity */}
                <tr className="hover:bg-slate-900/40">
                  <td className="py-3 px-4 text-slate-300 flex items-center gap-2">
                    <Users className="w-4 h-4 text-cyan-400" />
                    <span>Demand & Capacity</span>
                  </td>
                  <td className="py-3 px-4 text-slate-300 font-mono">
                    {simulationResult.baseline.demand !== null
                      ? `${simulationResult.baseline.demand} pax / ${simulationResult.baseline.capacity} seats`
                      : 'Telemetry Pending'}
                  </td>
                  <td className="py-3 px-4 text-cyan-300 font-mono">
                    {simulationResult.simulated.demand !== null
                      ? `${simulationResult.simulated.demand} pax / ${simulationResult.simulated.capacity} seats`
                      : 'Telemetry Pending'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono">
                    {simulationResult.comparison.demandDelta !== null ? (
                      <span
                        className={
                          simulationResult.comparison.demandDelta > 0
                            ? 'text-cyan-400'
                            : 'text-slate-400'
                        }
                      >
                        {simulationResult.comparison.demandDelta > 0
                          ? `+${simulationResult.comparison.demandDelta}`
                          : simulationResult.comparison.demandDelta}{' '}
                        pax
                      </span>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                </tr>

                {/* Vehicle Occupancy */}
                <tr className="hover:bg-slate-900/40">
                  <td className="py-3 px-4 text-slate-300 flex items-center gap-2">
                    <Bus className="w-4 h-4 text-amber-400" />
                    <span>Projected Occupancy</span>
                  </td>
                  <td className="py-3 px-4 text-slate-300 font-mono">
                    {simulationResult.baseline.occupancy !== null
                      ? `${simulationResult.baseline.occupancy}%`
                      : 'N/A'}
                  </td>
                  <td className="py-3 px-4 text-amber-300 font-mono font-bold">
                    {simulationResult.simulated.occupancy !== null
                      ? `${simulationResult.simulated.occupancy}%`
                      : 'N/A'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono">
                    {simulationResult.comparison.occupancyDelta !== null ? (
                      <span
                        className={
                          simulationResult.comparison.occupancyDelta > 0
                            ? 'text-amber-400 font-bold'
                            : 'text-emerald-400 font-bold'
                        }
                      >
                        {simulationResult.comparison.occupancyDelta > 0
                          ? `+${simulationResult.comparison.occupancyDelta}%`
                          : `${simulationResult.comparison.occupancyDelta}%`}
                      </span>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                </tr>

                {/* Active Alerts */}
                <tr className="hover:bg-slate-900/40">
                  <td className="py-3 px-4 text-slate-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <span>Active Safety Alerts</span>
                  </td>
                  <td className="py-3 px-4 text-slate-400 font-mono">
                    {simulationResult.baseline.activeAlerts} alerts (
                    {simulationResult.baseline.criticalAlerts} CRIT)
                  </td>
                  <td className="py-3 px-4 text-red-300 font-mono font-bold">
                    {simulationResult.simulated.activeAlerts} alerts (
                    {simulationResult.simulated.criticalAlerts} CRIT)
                  </td>
                  <td className="py-3 px-4 text-right font-mono">
                    {simulationResult.comparison.alertsDelta > 0 ? (
                      <span className="text-red-400 font-bold">
                        +{simulationResult.comparison.alertsDelta}
                      </span>
                    ) : (
                      <span className="text-slate-500">0</span>
                    )}
                  </td>
                </tr>

                {/* Unresolved Incidents */}
                <tr className="hover:bg-slate-900/40">
                  <td className="py-3 px-4 text-slate-300 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-purple-400" />
                    <span>Incident Case Backlog</span>
                  </td>
                  <td className="py-3 px-4 text-slate-400 font-mono">
                    {simulationResult.baseline.unresolvedIncidents} open (
                    {simulationResult.baseline.criticalIncidents} CRIT)
                  </td>
                  <td className="py-3 px-4 text-purple-300 font-mono font-bold">
                    {simulationResult.simulated.unresolvedIncidents} open (
                    {simulationResult.simulated.criticalIncidents} CRIT)
                  </td>
                  <td className="py-3 px-4 text-right font-mono">
                    {simulationResult.comparison.incidentsDelta > 0 ? (
                      <span className="text-purple-400 font-bold">
                        +{simulationResult.comparison.incidentsDelta}
                      </span>
                    ) : (
                      <span className="text-slate-500">0</span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Explainability & Recommendation Impact Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Deterministic Explanations */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4.5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                <HelpCircle className="w-4 h-4 text-indigo-400" />
                Why Did The Operational Status Change?
              </div>
              <ul className="space-y-2 text-xs text-slate-300">
                {simulationResult.simulationExplanations.map((exp, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-indigo-400 font-bold">•</span>
                    <span>{exp}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Simulated Recommendation Impact */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4.5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                  <Info className="w-4 h-4 text-amber-400" />
                  Simulated Action Recommendations
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                    simulationResult.recommendationImpact.impactLevel ===
                    'CRITICAL_RECOMMENDATION'
                      ? 'bg-red-500/20 text-red-300 border-red-500/40'
                      : simulationResult.recommendationImpact.impactLevel ===
                        'HIGH_PRIORITY_RECOMMENDATION'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : simulationResult.recommendationImpact.impactLevel ===
                        'MONITORING_RECOMMENDATION'
                      ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}
                >
                  {simulationResult.recommendationImpact.impactLevel.replace(
                    /_/g,
                    ' '
                  )}
                </span>
              </div>

              {simulationResult.recommendationImpact.simulatedDrafts.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {simulationResult.recommendationImpact.simulatedDrafts.map(
                    (draft, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-200">
                            {draft.title}
                          </span>
                          <span
                            className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                              draft.priority === 'CRITICAL'
                                ? 'bg-red-950 text-red-300 border border-red-800'
                                : draft.priority === 'HIGH'
                                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                : 'bg-blue-950 text-blue-300 border border-blue-800'
                            }`}
                          >
                            {draft.priority}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {draft.recommendation}
                        </p>
                      </div>
                    )
                  )}
                </div>
              ) : (
                <div className="p-4 text-center rounded-lg bg-slate-900/60 text-slate-400 text-xs">
                  No action recommendations triggered under this scenario. Operational conditions remain nominal.
                </div>
              )}

              <p className="text-[10px] text-slate-500 italic pt-1">
                Notice: Hypothetical recommendations are simulated dynamically and have not been committed to the operational governance log.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
