'use client';

import React, { useState, useEffect } from 'react';
import {
  Layers,
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
  Plus,
  Trash2,
  ChevronRight,
  X,
  Scale,
  GitCompare,
} from 'lucide-react';
import {
  MANDATORY_SCENARIO_COMPARISON_NOTICE_1,
  MANDATORY_SCENARIO_COMPARISON_NOTICE_2,
  ScenarioComparisonResult,
  ScenarioComparisonItem,
  ScenarioDefinitionInput,
} from '@/lib/operations/scenario-comparison-engine';
import {
  SCENARIO_PRESETS,
  HypotheticalAlertSeverity,
  HypotheticalIncidentSeverity,
  RiskTrendScenario,
} from '@/lib/operations/scenario-simulation-engine';

export default function OperationalScenarioComparison() {
  const [selectedRoute, setSelectedRoute] = useState<string>('SR-101');
  const [availableRoutes, setAvailableRoutes] = useState<
    { id: string; code: string; name: string }[]
  >([
    { id: 'route_sr101', code: 'SR-101', name: 'Downtown Express' },
    { id: 'route_sr102', code: 'SR-102', name: 'Tech Park Shuttle' },
    { id: 'route_sr103', code: 'SR-103', name: 'Suburban Line' },
  ]);

  // Default initial 3 scenarios
  const defaultScenarios: ScenarioDefinitionInput[] = [
    {
      id: 'sc_baseline',
      name: 'Baseline Condition',
      description: 'Zero modifiers applied; reflects live operational corridor telemetry.',
      riskModifier: 0,
      demandModifierPercent: 0,
      capacityModifierPercent: 0,
      hypotheticalAlert: 'NONE',
      hypotheticalIncident: 'NONE',
      riskTrendScenario: 'NO_CHANGE',
    },
    {
      id: 'sc_surge',
      name: 'Scenario A: Demand Surge',
      description: '+40% ridership surge during peak hours without vehicle change.',
      riskModifier: 0,
      demandModifierPercent: 40,
      capacityModifierPercent: 0,
      hypotheticalAlert: 'NONE',
      hypotheticalIncident: 'NONE',
      riskTrendScenario: 'NO_CHANGE',
    },
    {
      id: 'sc_stress',
      name: 'Scenario B: Combined Stress',
      description: 'Vehicle capacity reduced (-25%), +30 risk surge, and High alert.',
      riskModifier: 30,
      demandModifierPercent: 20,
      capacityModifierPercent: -25,
      hypotheticalAlert: 'HIGH',
      hypotheticalIncident: 'NONE',
      riskTrendScenario: 'RISING',
    },
  ];

  const [scenarios, setScenarios] = useState<ScenarioDefinitionInput[]>(defaultScenarios);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [comparisonResult, setComparisonResult] =
    useState<ScenarioComparisonResult | null>(null);

  // Drawer state for inspecting a specific scenario
  const [activeDrawerScenario, setActiveDrawerScenario] =
    useState<ScenarioComparisonItem | null>(null);

  // Fetch routes from decision-support
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

  // Execute comparison
  const executeComparison = async (scenariosToCompare = scenarios) => {
    setIsLoading(true);
    setError(null);

    const payload = {
      routeId: selectedRoute,
      scenarios: scenariosToCompare,
    };

    try {
      const res = await fetch('/api/operations/scenario-comparison', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      setComparisonResult(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to execute scenario comparison');
    } finally {
      setIsLoading(false);
    }
  };

  // Run initial comparison on corridor change
  useEffect(() => {
    executeComparison(scenarios);
  }, [selectedRoute]);

  // Add a scenario from preset or blank
  const handleAddPresetScenario = (presetId: string) => {
    if (scenarios.length >= 5) return;
    const preset = SCENARIO_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    const newSc: ScenarioDefinitionInput = {
      id: `sc_${Date.now()}`,
      name: `Scenario ${String.fromCharCode(65 + scenarios.length)}: ${preset.name}`,
      description: preset.description,
      riskModifier: preset.modifiers.riskModifier,
      demandModifierPercent: preset.modifiers.demandModifierPercent,
      capacityModifierPercent: preset.modifiers.capacityModifierPercent,
      hypotheticalAlert: preset.modifiers.hypotheticalAlert,
      hypotheticalIncident: preset.modifiers.hypotheticalIncident,
      riskTrendScenario: preset.modifiers.riskTrendScenario,
    };

    const updated = [...scenarios, newSc];
    setScenarios(updated);
    executeComparison(updated);
  };

  // Remove a scenario
  const handleRemoveScenario = (index: number) => {
    if (scenarios.length <= 2) return;
    const updated = scenarios.filter((_, i) => i !== index);
    setScenarios(updated);
    executeComparison(updated);
  };

  // Reset comparison to default 3 scenarios
  const handleReset = () => {
    setScenarios(defaultScenarios);
    executeComparison(defaultScenarios);
  };

  // Status badge styling helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'URGENT_REVIEW':
        return (
          <span className="px-2 py-0.5 text-xs font-bold rounded bg-red-950/80 text-red-300 border border-red-700/60 inline-flex items-center gap-1">
            <ShieldAlert className="w-3 h-3 text-red-400" />
            URGENT REVIEW
          </span>
        );
      case 'ATTENTION_REQUIRED':
        return (
          <span className="px-2 py-0.5 text-xs font-bold rounded bg-amber-950/80 text-amber-300 border border-amber-700/60 inline-flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            ATTENTION REQUIRED
          </span>
        );
      case 'MONITOR':
        return (
          <span className="px-2 py-0.5 text-xs font-bold rounded bg-blue-950/80 text-blue-300 border border-blue-700/60 inline-flex items-center gap-1">
            <Activity className="w-3 h-3 text-blue-400" />
            MONITOR
          </span>
        );
      case 'NORMAL':
      default:
        return (
          <span className="px-2 py-0.5 text-xs font-bold rounded bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 inline-flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            NORMAL
          </span>
        );
    }
  };

  const getRiskBadge = (level: string, score: number) => {
    switch (level) {
      case 'CRITICAL':
        return (
          <span className="px-2 py-0.5 text-[11px] font-extrabold rounded bg-red-900/60 text-red-200 border border-red-700">
            {score}/100 CRIT
          </span>
        );
      case 'HIGH':
        return (
          <span className="px-2 py-0.5 text-[11px] font-extrabold rounded bg-amber-900/60 text-amber-200 border border-amber-700">
            {score}/100 HIGH
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="px-2 py-0.5 text-[11px] font-extrabold rounded bg-blue-900/60 text-blue-200 border border-blue-700">
            {score}/100 MED
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 text-[11px] font-extrabold rounded bg-emerald-900/60 text-emerald-200 border border-emerald-700">
            {score}/100 LOW
          </span>
        );
    }
  };

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6 text-slate-100">
      {/* 1. Header & Mandatory Advisory Disclaimers */}
      <div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl">
                <GitCompare className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-white">
                Operational Scenario Comparison & Decision Planning Center
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Phase 3 Step 13 — Side-by-side multi-scenario evaluation, metric variance analysis, and deterministic trade-off modeling.
            </p>
          </div>

          {/* Route Selector */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-slate-400">Target Corridor:</label>
            <select
              value={selectedRoute}
              onChange={(e) => setSelectedRoute(e.target.value)}
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

        {/* Mandatory Safety Notice Banners */}
        <div className="mt-4 space-y-2">
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">MANDATORY ADVISORY NOTICE: </span>
              {MANDATORY_SCENARIO_COMPARISON_NOTICE_1}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 text-[11px] flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>{MANDATORY_SCENARIO_COMPARISON_NOTICE_2}</span>
          </div>
        </div>
      </div>

      {/* 2. Scenario Builder & Quick Preset Loader */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4.5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-indigo-400" />
              Configured Comparison Scenarios ({scenarios.length}/5)
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Compare 2 to 5 hypothetical operational paths side-by-side.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 transition"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
            <button
              onClick={() => executeComparison()}
              disabled={isLoading}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition shadow"
            >
              <Play className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Comparing...' : 'Run Comparison'}
            </button>
          </div>
        </div>

        {/* Quick Presets Bar */}
        {scenarios.length < 5 && (
          <div className="pt-2 border-t border-slate-800/80">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Add Preset Scenario:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {SCENARIO_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleAddPresetScenario(p.id)}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-[11px] text-slate-300 flex items-center gap-1.5 transition"
                >
                  <Plus className="w-3 h-3 text-indigo-400" />
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Configured Scenario Chips */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-1">
          {scenarios.map((sc, idx) => (
            <div
              key={sc.id || idx}
              className="p-3 rounded-xl bg-slate-900 border border-slate-800 relative group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-xs font-bold text-white truncate">
                    {sc.name}
                  </span>
                  {scenarios.length > 2 && (
                    <button
                      onClick={() => handleRemoveScenario(idx)}
                      className="text-slate-500 hover:text-red-400 p-0.5 rounded transition"
                      title="Remove scenario"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 line-clamp-2 mb-2">
                  {sc.description || 'Custom defined scenario'}
                </p>
              </div>

              <div className="space-y-1 text-[10px] font-mono text-slate-300 border-t border-slate-800/60 pt-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Risk:</span>
                  <span className={sc.riskModifier > 0 ? 'text-indigo-400' : 'text-slate-300'}>
                    {sc.riskModifier > 0 ? `+${sc.riskModifier}` : sc.riskModifier} pts
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Demand:</span>
                  <span className={sc.demandModifierPercent > 0 ? 'text-cyan-400' : 'text-slate-300'}>
                    {sc.demandModifierPercent > 0 ? `+${sc.demandModifierPercent}%` : `${sc.demandModifierPercent}%`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Capacity:</span>
                  <span className={sc.capacityModifierPercent < 0 ? 'text-amber-400' : 'text-slate-300'}>
                    {sc.capacityModifierPercent > 0 ? `+${sc.capacityModifierPercent}%` : `${sc.capacityModifierPercent}%`}
                  </span>
                </div>
                {sc.hypotheticalAlert !== 'NONE' && (
                  <div className="flex justify-between text-red-400">
                    <span>Alert:</span>
                    <span>{sc.hypotheticalAlert}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-3 bg-red-950/60 border border-red-800 rounded-xl text-red-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <span>Comparison Error: {error}</span>
        </div>
      )}

      {/* 3. Executive Comparison Summary KPIs */}
      {comparisonResult && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2.5">
              Executive Multi-Scenario Comparison Summary
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Scenarios</div>
                <div className="text-lg font-bold text-white mt-0.5">
                  {comparisonResult.summary.scenariosCompared}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Escalated</div>
                <div className="text-lg font-bold text-red-400 mt-0.5">
                  {comparisonResult.summary.escalatedScenarios}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Unchanged</div>
                <div className="text-lg font-bold text-slate-300 mt-0.5">
                  {comparisonResult.summary.unchangedScenarios}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                <div className="text-[10px] text-slate-400 font-semibold uppercase">De-escalated</div>
                <div className="text-lg font-bold text-emerald-400 mt-0.5">
                  {comparisonResult.summary.deescalatedScenarios}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Critical Status</div>
                <div className="text-lg font-bold text-red-400 mt-0.5">
                  {comparisonResult.summary.criticalScenarios}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                <div className="text-[10px] text-slate-400 font-semibold uppercase">High Demand</div>
                <div className="text-lg font-bold text-amber-400 mt-0.5">
                  {comparisonResult.summary.highDemandScenarios}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Max Risk Obs.</div>
                <div className="text-lg font-bold text-indigo-400 mt-0.5">
                  {comparisonResult.summary.highestRiskScoreObserved}/100
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Max Occupancy</div>
                <div className="text-lg font-bold text-cyan-400 mt-0.5">
                  {comparisonResult.summary.highestOccupancyObserved !== null
                    ? `${comparisonResult.summary.highestOccupancyObserved}%`
                    : 'N/A'}
                </div>
              </div>
            </div>
          </div>

          {/* 4. Multi-Scenario Comparison Matrix Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Corridor {comparisonResult.route.code} — Side-by-Side Comparison Matrix
              </span>
              <span className="text-[11px] text-slate-500 italic">
                Click any scenario row for full drill-down analysis
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Scenario</th>
                    <th className="py-2.5 px-3">Risk Score</th>
                    <th className="py-2.5 px-3">Risk Δ</th>
                    <th className="py-2.5 px-3">Demand</th>
                    <th className="py-2.5 px-3">Capacity</th>
                    <th className="py-2.5 px-3">Occupancy</th>
                    <th className="py-2.5 px-3">Alerts</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Shift</th>
                    <th className="py-2.5 px-3">Rec. Impact</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {/* Baseline Row */}
                  <tr
                    onClick={() => setActiveDrawerScenario(comparisonResult.baseline)}
                    className="hover:bg-slate-900/60 cursor-pointer bg-slate-900/20"
                  >
                    <td className="py-3 px-3">
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                        <span>{comparisonResult.baseline.name}</span>
                      </div>
                      <div className="text-[10px] text-slate-500">Live Telemetry</div>
                    </td>
                    <td className="py-3 px-3">
                      {getRiskBadge(
                        comparisonResult.baseline.riskLevel,
                        comparisonResult.baseline.riskScore
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-500">—</td>
                    <td className="py-3 px-3 font-mono text-slate-300">
                      {comparisonResult.baseline.predictedDemand !== null
                        ? `${comparisonResult.baseline.predictedDemand} pax`
                        : 'Pending'}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-300">
                      {comparisonResult.baseline.vehicleCapacity} seats
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-300 font-bold">
                      {comparisonResult.baseline.projectedOccupancy !== null
                        ? `${comparisonResult.baseline.projectedOccupancy}%`
                        : 'N/A'}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-300">
                      {comparisonResult.baseline.activeAlerts}
                    </td>
                    <td className="py-3 px-3">
                      {getStatusBadge(comparisonResult.baseline.operationalStatus)}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded bg-slate-800 text-slate-400 border border-slate-700">
                        Baseline
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-[10px] font-mono text-slate-400">
                        {comparisonResult.baseline.recommendationImpact.impactLevel.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <ChevronRight className="w-4 h-4 text-slate-500 inline" />
                    </td>
                  </tr>

                  {/* Simulated Scenarios Rows */}
                  {comparisonResult.scenarios.map((sc, idx) => (
                    <tr
                      key={sc.id || idx}
                      onClick={() => setActiveDrawerScenario(sc)}
                      className="hover:bg-slate-900/60 cursor-pointer"
                    >
                      <td className="py-3 px-3">
                        <div className="font-bold text-white">{sc.name}</div>
                        <div className="text-[10px] text-slate-400 truncate max-w-xs">
                          {sc.description}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        {getRiskBadge(sc.riskLevel, sc.riskScore)}
                      </td>
                      <td className="py-3 px-3 font-mono">
                        {sc.deltas.riskScoreDelta > 0 ? (
                          <span className="text-red-400 font-bold">
                            +{sc.deltas.riskScoreDelta}
                          </span>
                        ) : sc.deltas.riskScoreDelta < 0 ? (
                          <span className="text-emerald-400 font-bold">
                            {sc.deltas.riskScoreDelta}
                          </span>
                        ) : (
                          <span className="text-slate-500">0</span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-cyan-300">
                        {sc.predictedDemand !== null ? `${sc.predictedDemand} pax` : 'Pending'}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-300">
                        {sc.vehicleCapacity} seats
                      </td>
                      <td className="py-3 px-3 font-mono text-amber-300 font-bold">
                        {sc.projectedOccupancy !== null ? `${sc.projectedOccupancy}%` : 'N/A'}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-300">
                        {sc.activeAlerts}
                      </td>
                      <td className="py-3 px-3">
                        {getStatusBadge(sc.operationalStatus)}
                      </td>
                      <td className="py-3 px-3">
                        {sc.statusChange === 'ESCALATED' && (
                          <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded bg-red-500/20 text-red-400 border border-red-500/30">
                            ▲ Escalated
                          </span>
                        )}
                        {sc.statusChange === 'DE_ESCALATED' && (
                          <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            ▼ De-escalated
                          </span>
                        )}
                        {sc.statusChange === 'UNCHANGED' && (
                          <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded bg-slate-800 text-slate-400 border border-slate-700">
                            ● Unchanged
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded border uppercase ${
                            sc.recommendationImpact.impactLevel === 'CRITICAL_RECOMMENDATION'
                              ? 'bg-red-950 text-red-300 border-red-800'
                              : sc.recommendationImpact.impactLevel === 'HIGH_PRIORITY_RECOMMENDATION'
                              ? 'bg-amber-950 text-amber-300 border-amber-800'
                              : sc.recommendationImpact.impactLevel === 'MONITORING_RECOMMENDATION'
                              ? 'bg-blue-950 text-blue-300 border-blue-800'
                              : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                          }`}
                        >
                          {sc.recommendationImpact.impactLevel.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <ChevronRight className="w-4 h-4 text-slate-500 inline" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 5. Trade-Off Analysis & Pairwise Difference Matrix Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Deterministic Trade-Off Observations */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4.5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                <Scale className="w-4 h-4 text-indigo-400" />
                Factual Scenario Trade-Off Analysis
              </div>
              <p className="text-[11px] text-slate-400">
                Deterministic cross-scenario variances. Note: The system does not classify scenarios as "better" or "worse".
              </p>

              {comparisonResult.tradeOffs.length > 0 ? (
                <ul className="space-y-2 text-xs text-slate-300 max-h-56 overflow-y-auto pr-1">
                  {comparisonResult.tradeOffs.map((obs, idx) => (
                    <li key={idx} className="flex items-start gap-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
                      <span className="text-indigo-400 font-bold">•</span>
                      <span>{obs}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-4 text-center rounded-lg bg-slate-900/60 text-slate-400 text-xs">
                  All compared scenarios share identical parameters with zero measurable trade-offs.
                </div>
              )}
            </div>

            {/* Pairwise Differences Matrix */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4.5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                <GitCompare className="w-4 h-4 text-cyan-400" />
                Scenario Difference Matrix (Pairwise)
              </div>
              <p className="text-[11px] text-slate-400">
                Mathematical variance between each scenario pairing.
              </p>

              <div className="overflow-x-auto max-h-56 overflow-y-auto rounded-lg border border-slate-800">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase border-b border-slate-800">
                    <tr>
                      <th className="py-2 px-2.5">Pair</th>
                      <th className="py-2 px-2.5">Risk Δ</th>
                      <th className="py-2 px-2.5">Occ. Δ</th>
                      <th className="py-2 px-2.5">Cap. Δ</th>
                      <th className="py-2 px-2.5">Alert Δ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {comparisonResult.pairwiseDifferences.map((pair, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/40">
                        <td className="py-2 px-2.5 font-sans font-medium text-slate-200 truncate max-w-[130px]">
                          {pair.pair}
                        </td>
                        <td className="py-2 px-2.5">
                          {pair.riskDifference !== 0 ? (
                            <span className={pair.riskDifference > 0 ? 'text-red-400' : 'text-emerald-400'}>
                              {pair.riskDifference > 0 ? `+${pair.riskDifference}` : pair.riskDifference}
                            </span>
                          ) : (
                            <span className="text-slate-500">0</span>
                          )}
                        </td>
                        <td className="py-2 px-2.5">
                          {pair.occupancyDifference !== null ? (
                            <span className={pair.occupancyDifference > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                              {pair.occupancyDifference > 0 ? `+${pair.occupancyDifference}%` : `${pair.occupancyDifference}%`}
                            </span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="py-2 px-2.5">
                          {pair.capacityDifference !== 0 ? (
                            <span className="text-cyan-400">
                              {pair.capacityDifference > 0 ? `+${pair.capacityDifference}` : pair.capacityDifference} seats
                            </span>
                          ) : (
                            <span className="text-slate-500">0</span>
                          )}
                        </td>
                        <td className="py-2 px-2.5 text-slate-300">
                          {pair.alertDifference !== 0 ? (
                            <span className="text-red-400">
                              {pair.alertDifference > 0 ? `+${pair.alertDifference}` : pair.alertDifference}
                            </span>
                          ) : (
                            <span className="text-slate-500">0</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Detailed Scenario Drawer (Slide-Over Modal) */}
      {activeDrawerScenario && (
        <div className="fixed inset-0 z-50 bg-black/70 flex justify-end">
          <div className="bg-slate-900 border-l border-slate-800 w-full max-w-xl h-full p-6 overflow-y-auto space-y-5 animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white">
                    {activeDrawerScenario.name}
                  </h3>
                  {activeDrawerScenario.isBaseline && (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                      LIVE BASELINE
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {activeDrawerScenario.description || 'Hypothetical scenario projection'}
                </p>
              </div>
              <button
                onClick={() => setActiveDrawerScenario(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Status Shift Badge & Summary */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-semibold uppercase">Operational Status:</span>
                {getStatusBadge(activeDrawerScenario.operationalStatus)}
              </div>
              <p className="text-xs text-slate-300 pt-1">
                {activeDrawerScenario.briefing}
              </p>
            </div>

            {/* Why Status Changed */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
                Why Did This Scenario's Status Change?
              </span>
              <ul className="space-y-1.5 text-xs text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800">
                {activeDrawerScenario.whyStatusChanged.map((exp, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-indigo-400 font-bold">•</span>
                    <span>{exp}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Metric Comparison vs Baseline */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Variance vs Live Corridor Baseline
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[10px] text-slate-500 uppercase">Risk Score</div>
                  <div className="text-sm font-bold text-white mt-0.5">
                    {activeDrawerScenario.riskScore}/100 ({activeDrawerScenario.riskLevel})
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    Delta: {activeDrawerScenario.deltas.riskScoreDelta >= 0 ? `+${activeDrawerScenario.deltas.riskScoreDelta}` : activeDrawerScenario.deltas.riskScoreDelta} pts
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[10px] text-slate-500 uppercase">Vehicle Occupancy</div>
                  <div className="text-sm font-bold text-amber-300 mt-0.5">
                    {activeDrawerScenario.projectedOccupancy !== null ? `${activeDrawerScenario.projectedOccupancy}%` : 'N/A'}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    Delta: {activeDrawerScenario.deltas.occupancyDelta !== null ? `${activeDrawerScenario.deltas.occupancyDelta >= 0 ? `+${activeDrawerScenario.deltas.occupancyDelta}` : activeDrawerScenario.deltas.occupancyDelta}%` : '—'}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[10px] text-slate-500 uppercase">Seating Capacity</div>
                  <div className="text-sm font-bold text-white mt-0.5">
                    {activeDrawerScenario.vehicleCapacity} seats
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    Delta: {activeDrawerScenario.deltas.capacityDelta >= 0 ? `+${activeDrawerScenario.deltas.capacityDelta}` : activeDrawerScenario.deltas.capacityDelta} seats
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[10px] text-slate-500 uppercase">Active Alerts</div>
                  <div className="text-sm font-bold text-white mt-0.5">
                    {activeDrawerScenario.activeAlerts} alerts
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    Delta: +{activeDrawerScenario.deltas.alertDelta}
                  </div>
                </div>
              </div>
            </div>

            {/* Advisory Recommendations Under This Scenario */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>Advisory Action Recommendations</span>
                <span className="text-[10px] text-slate-400 lowercase font-normal">
                  ({activeDrawerScenario.recommendationImpact.recommendationCount} generated)
                </span>
              </span>

              {activeDrawerScenario.recommendationImpact.simulatedDrafts.length > 0 ? (
                <div className="space-y-2">
                  {activeDrawerScenario.recommendationImpact.simulatedDrafts.map((d, i) => (
                    <div key={i} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-200">{d.title}</span>
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                          d.priority === 'CRITICAL'
                            ? 'bg-red-950 text-red-300 border border-red-800'
                            : d.priority === 'HIGH'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-blue-950 text-blue-300 border border-blue-800'
                        }`}>
                          {d.priority}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">{d.recommendation}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 bg-slate-950 rounded-xl text-slate-400 text-xs border border-slate-800 text-center">
                  No action recommendations triggered under this scenario.
                </div>
              )}
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[10px] text-slate-500 italic">
              Notice: The administrator remains the final authority. Scenario comparison is informational and does not execute dispatch or rerouting actions.
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
