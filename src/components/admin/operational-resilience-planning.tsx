'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Activity,
  AlertTriangle,
  RotateCcw,
  Play,
  Info,
  Clock,
  Bus,
  Users,
  CheckCircle2,
  HelpCircle,
  FileText,
  Sliders,
  Sparkles,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Database,
  Layers,
  Crosshair,
  Compass,
  X,
} from 'lucide-react';
import {
  MANDATORY_RESILIENCE_PLANNING_NOTICE,
  DisruptionType,
  DisruptionSeverity,
  RecoveryMode,
  ResiliencePlanningResult,
  ContingencyPlanOption,
} from '@/lib/operations/resilience-planning-engine';

export default function OperationalResiliencePlanning() {
  const [selectedRoute, setSelectedRoute] = useState<string>('SR-101');
  const [availableRoutes, setAvailableRoutes] = useState<
    { id: string; code: string; name: string }[]
  >([
    { id: 'route-sr-101', code: 'SR-101', name: 'Whitefield Tech Corridor Express' },
    { id: 'route-sr-102', code: 'SR-102', name: 'CyberCity & Manyata Tech Shuttle' },
    { id: 'route-sr-103', code: 'SR-103', name: 'Outer Ring Road Tech Express' },
  ]);

  // Scenario configuration state
  const [scenarioName, setScenarioName] = useState<string>('Peak Vehicle Disruption & Surge');
  const [disruptionType, setDisruptionType] = useState<DisruptionType>('CAPACITY_REDUCTION');
  const [severity, setSeverity] = useState<DisruptionSeverity>('HIGH');
  const [recoveryMode, setRecoveryMode] = useState<RecoveryMode>('CONTINGENCY_PREPARATION');
  const [riskModifier, setRiskModifier] = useState<number>(15);
  const [demandModifierPercent, setDemandModifierPercent] = useState<number>(20);
  const [capacityModifierPercent, setCapacityModifierPercent] = useState<number>(-25);
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [alertInjection, setAlertInjection] = useState<'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('NONE');
  const [incidentInjection, setIncidentInjection] = useState<'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('NONE');

  // Execution state
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResiliencePlanningResult | null>(null);

  // Evidence drawer state
  const [isEvidenceDrawerOpen, setIsEvidenceDrawerOpen] = useState<boolean>(false);

  // Fetch routes from decision support API
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
        // Fallback static routes retained
      }
    }
    loadRoutes();
  }, []);

  // Quick Preset Handlers
  const handleApplyPreset = (type: DisruptionType) => {
    setDisruptionType(type);
    switch (type) {
      case 'VEHICLE_UNAVAILABLE':
        setScenarioName('Vehicle Mechanical Unavailability');
        setSeverity('HIGH');
        setRecoveryMode('CONTINGENCY_PREPARATION');
        setRiskModifier(10);
        setDemandModifierPercent(0);
        setCapacityModifierPercent(-50);
        setAlertInjection('MEDIUM');
        setIncidentInjection('NONE');
        break;
      case 'DRIVER_UNAVAILABLE':
        setScenarioName('Driver Relief Roster Unavailability');
        setSeverity('MEDIUM');
        setRecoveryMode('MANUAL_REVIEW');
        setRiskModifier(15);
        setDemandModifierPercent(0);
        setCapacityModifierPercent(-25);
        setAlertInjection('LOW');
        setIncidentInjection('NONE');
        break;
      case 'ROUTE_DISRUPTION':
        setScenarioName('Corridor Roadway Obstruction');
        setSeverity('CRITICAL');
        setRecoveryMode('SUPERVISOR_ESCALATION');
        setRiskModifier(35);
        setDemandModifierPercent(-10);
        setCapacityModifierPercent(-20);
        setAlertInjection('HIGH');
        setIncidentInjection('NONE');
        break;
      case 'DEMAND_SURGE':
        setScenarioName('Sudden Commuter Demand Surge');
        setSeverity('MEDIUM');
        setRecoveryMode('CONTINGENCY_PREPARATION');
        setRiskModifier(5);
        setDemandModifierPercent(45);
        setCapacityModifierPercent(0);
        setAlertInjection('NONE');
        setIncidentInjection('NONE');
        break;
      case 'CAPACITY_REDUCTION':
        setScenarioName('Peak Capacity Constraint');
        setSeverity('HIGH');
        setRecoveryMode('CONTINGENCY_PREPARATION');
        setRiskModifier(15);
        setDemandModifierPercent(20);
        setCapacityModifierPercent(-30);
        setAlertInjection('NONE');
        setIncidentInjection('NONE');
        break;
      case 'SAFETY_ESCALATION':
        setScenarioName('Hazard Alert & Protocol Escalation');
        setSeverity('CRITICAL');
        setRecoveryMode('SUPERVISOR_ESCALATION');
        setRiskModifier(40);
        setDemandModifierPercent(0);
        setCapacityModifierPercent(0);
        setAlertInjection('CRITICAL');
        setIncidentInjection('HIGH');
        break;
      case 'COMBINED_DISRUPTION':
        setScenarioName('Combined Weather & Fleet Disruption');
        setSeverity('CRITICAL');
        setRecoveryMode('SUPERVISOR_ESCALATION');
        setRiskModifier(35);
        setDemandModifierPercent(30);
        setCapacityModifierPercent(-35);
        setAlertInjection('HIGH');
        setIncidentInjection('HIGH');
        break;
      default:
        setScenarioName('Normal Baseline Condition');
        setSeverity('LOW');
        setRecoveryMode('MONITOR_ONLY');
        setRiskModifier(0);
        setDemandModifierPercent(0);
        setCapacityModifierPercent(0);
        setAlertInjection('NONE');
        setIncidentInjection('NONE');
        break;
    }
  };

  const handleResetModifiers = () => {
    handleApplyPreset('NONE');
  };

  const handleRunResilienceAnalysis = async () => {
    if (!selectedRoute) {
      setError('Please select an operational corridor.');
      return;
    }

    setIsSimulating(true);
    setError(null);

    try {
      const res = await fetch('/api/operations/resilience-planning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routeId: selectedRoute,
          scenario: {
            scenarioName,
            disruptionType,
            severity,
            recoveryMode,
            riskModifier,
            demandModifierPercent,
            capacityModifierPercent,
            alertInjection,
            incidentInjection,
            durationMinutes,
          },
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setResult(data);
      } else {
        setError(data.error || 'Resilience analysis failed.');
      }
    } catch (err: any) {
      setError(err?.message || 'Network error executing resilience analysis.');
    } finally {
      setIsSimulating(false);
    }
  };

  // Helper formatting badges
  const getResilienceStatusBadge = (status: string) => {
    switch (status) {
      case 'CRITICAL':
        return (
          <span className="px-3 py-1 text-xs font-bold rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1.5 w-fit">
            <AlertTriangle className="w-3.5 h-3.5" /> CRITICAL
          </span>
        );
      case 'DEGRADED':
        return (
          <span className="px-3 py-1 text-xs font-bold rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 w-fit">
            <ShieldAlert className="w-3.5 h-3.5" /> DEGRADED
          </span>
        );
      case 'WATCH':
        return (
          <span className="px-3 py-1 text-xs font-bold rounded-lg bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1.5 w-fit">
            <Activity className="w-3.5 h-3.5" /> WATCH
          </span>
        );
      case 'STABLE':
        return (
          <span className="px-3 py-1 text-xs font-bold rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 w-fit">
            <ShieldCheck className="w-3.5 h-3.5" /> STABLE
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 text-xs font-bold rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
            {status}
          </span>
        );
    }
  };

  const getReadinessBadge = (readiness: string) => {
    switch (readiness) {
      case 'READY':
        return (
          <span className="px-2.5 py-0.5 text-xs font-bold rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            READY
          </span>
        );
      case 'PARTIALLY_READY':
        return (
          <span className="px-2.5 py-0.5 text-xs font-bold rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
            PARTIALLY READY
          </span>
        );
      case 'LIMITED':
        return (
          <span className="px-2.5 py-0.5 text-xs font-bold rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
            LIMITED
          </span>
        );
      case 'INSUFFICIENT_DATA':
        return (
          <span className="px-2.5 py-0.5 text-xs font-bold rounded bg-slate-800 text-slate-400 border border-slate-700">
            INSUFFICIENT DATA
          </span>
        );
      default:
        return <span className="text-slate-300">{readiness}</span>;
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'IMMEDIATE':
        return (
          <span className="px-2.5 py-0.5 text-xs font-bold rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
            IMMEDIATE
          </span>
        );
      case 'HIGH':
        return (
          <span className="px-2.5 py-0.5 text-xs font-bold rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
            HIGH
          </span>
        );
      case 'ELEVATED':
        return (
          <span className="px-2.5 py-0.5 text-xs font-bold rounded bg-sky-500/20 text-sky-300 border border-sky-500/40">
            ELEVATED
          </span>
        );
      case 'ROUTINE':
        return (
          <span className="px-2.5 py-0.5 text-xs font-bold rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            ROUTINE
          </span>
        );
      default:
        return <span className="text-slate-300">{urgency}</span>;
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden text-slate-100 mb-8">
      {/* 1. Header & Mandatory Safety Notices */}
      <div className="p-6 border-b border-slate-800 bg-slate-950/60">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Compass className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black tracking-tight text-white">
                  Operational Resilience & Contingency Planning Center
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                  Step 15 Resilience Engine
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Deterministic disruption modeling, projected capacity shortfall calculation, and advisory contingency recovery options.
              </p>
            </div>
          </div>
        </div>

        {/* Advisory Warning Notices */}
        <div className="mt-4 p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-xl space-y-1 text-xs text-amber-200/90">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-300">Mandatory System Advisory Notice:</p>
              <p>{MANDATORY_RESILIENCE_PLANNING_NOTICE}</p>
              <p className="mt-1 text-amber-300/80 italic">
                Administrative review is required before any operational action. No operational resources were modified.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* 2. Corridor Selector & Preset Shortcuts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 bg-slate-950/40 rounded-xl border border-slate-800/80">
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

          {/* Preset Disruption Shortcuts */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Quick Disruption Presets
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleApplyPreset('CAPACITY_REDUCTION')}
                className="px-2.5 py-1 text-[11px] font-semibold rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
              >
                Capacity Reduction (-30%)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('DEMAND_SURGE')}
                className="px-2.5 py-1 text-[11px] font-semibold rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
              >
                Demand Surge (+45%)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('VEHICLE_UNAVAILABLE')}
                className="px-2.5 py-1 text-[11px] font-semibold rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
              >
                Vehicle Unavailable
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('DRIVER_UNAVAILABLE')}
                className="px-2.5 py-1 text-[11px] font-semibold rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
              >
                Driver Unavailable
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('ROUTE_DISRUPTION')}
                className="px-2.5 py-1 text-[11px] font-semibold rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
              >
                Roadway Disruption
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('SAFETY_ESCALATION')}
                className="px-2.5 py-1 text-[11px] font-semibold rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
              >
                Safety Escalation
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('COMBINED_DISRUPTION')}
                className="px-2.5 py-1 text-[11px] font-semibold rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
              >
                Combined Shock
              </button>
              <button
                type="button"
                onClick={handleResetModifiers}
                className="px-2.5 py-1 text-[11px] font-semibold rounded bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* 3. Disruption Scenario Parameters & Modifiers */}
        <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-800/80 space-y-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-200">
              Contingency Disruption Parameters
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Scenario Name */}
            <div className="lg:col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Scenario Name</label>
              <input
                type="text"
                value={scenarioName}
                onChange={(e) => setScenarioName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Disruption Type */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Disruption Type</label>
              <select
                value={disruptionType}
                onChange={(e) => setDisruptionType(e.target.value as DisruptionType)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="NONE">NONE</option>
                <option value="CAPACITY_REDUCTION">CAPACITY REDUCTION</option>
                <option value="DEMAND_SURGE">DEMAND SURGE</option>
                <option value="VEHICLE_UNAVAILABLE">VEHICLE UNAVAILABLE</option>
                <option value="DRIVER_UNAVAILABLE">DRIVER UNAVAILABLE</option>
                <option value="ROUTE_DISRUPTION">ROUTE DISRUPTION</option>
                <option value="SAFETY_ESCALATION">SAFETY ESCALATION</option>
                <option value="COMBINED_DISRUPTION">COMBINED DISRUPTION</option>
              </select>
            </div>

            {/* Severity */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Disruption Severity</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as DisruptionSeverity)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>

            {/* Recovery Mode */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Recovery Mode</label>
              <select
                value={recoveryMode}
                onChange={(e) => setRecoveryMode(e.target.value as RecoveryMode)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="MONITOR_ONLY">MONITOR ONLY</option>
                <option value="MANUAL_REVIEW">MANUAL REVIEW</option>
                <option value="CONTINGENCY_PREPARATION">CONTINGENCY PREPARATION</option>
                <option value="SUPERVISOR_ESCALATION">SUPERVISOR ESCALATION</option>
              </select>
            </div>

            {/* Duration Minutes */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Duration (Minutes)</label>
              <input
                type="number"
                min="1"
                max="1440"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Math.max(1, parseInt(e.target.value, 10) || 60))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Injected Alert */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Injected Alert Severity</label>
              <select
                value={alertInjection}
                onChange={(e) => setAlertInjection(e.target.value as any)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="NONE">NONE</option>
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>

            {/* Injected Incident */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Injected Incident Severity</label>
              <select
                value={incidentInjection}
                onChange={(e) => setIncidentInjection(e.target.value as any)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="NONE">NONE</option>
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>
          </div>

          {/* Sliders: Risk, Demand, Capacity */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            {/* Risk Modifier */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Risk Score Modifier</span>
                <span className="font-bold text-indigo-400">
                  {riskModifier > 0 ? `+${riskModifier}` : riskModifier} pts
                </span>
              </div>
              <input
                type="range"
                min="-50"
                max="50"
                step="5"
                value={riskModifier}
                onChange={(e) => setRiskModifier(parseInt(e.target.value, 10))}
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
                  {demandModifierPercent > 0 ? `+${demandModifierPercent}%` : `${demandModifierPercent}%`}
                </span>
              </div>
              <input
                type="range"
                min="-50"
                max="100"
                step="5"
                value={demandModifierPercent}
                onChange={(e) => setDemandModifierPercent(parseInt(e.target.value, 10))}
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
                  {capacityModifierPercent > 0 ? `+${capacityModifierPercent}%` : `${capacityModifierPercent}%`}
                </span>
              </div>
              <input
                type="range"
                min="-50"
                max="100"
                step="5"
                value={capacityModifierPercent}
                onChange={(e) => setCapacityModifierPercent(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>-50%</span>
                <span>0%</span>
                <span>+100%</span>
              </div>
            </div>
          </div>

          {/* Trigger Button */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={handleResetModifiers}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Modifiers
            </button>

            <button
              type="button"
              disabled={isSimulating}
              onClick={handleRunResilienceAnalysis}
              className="px-5 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition disabled:opacity-50"
            >
              {isSimulating ? (
                <>
                  <Clock className="w-3.5 h-3.5 animate-spin" /> Evaluating Resilience...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" /> Run Resilience Analysis
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 4. Analysis Results Board */}
        {result && (
          <div className="space-y-6">
            {/* Top Summary Cards: Resilience Status, Readiness, Urgency, Shortfall */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Resilience Status */}
              <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Resilience Posture
                </span>
                <div className="flex items-center justify-between">
                  {getResilienceStatusBadge(result.resilience.simulatedStatus)}
                  <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                    result.resilience.statusChange === 'ESCALATED'
                      ? 'bg-rose-500/20 text-rose-300'
                      : result.resilience.statusChange === 'DE_ESCALATED'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {result.resilience.statusChange}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Baseline: <span className="font-semibold text-slate-300">{result.resilience.baselineStatus}</span>
                </div>
              </div>

              {/* Card 2: Recovery Readiness */}
              <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Recovery Readiness
                </span>
                <div>{getReadinessBadge(result.resilience.recoveryReadiness)}</div>
                <p className="text-[10px] text-slate-400 truncate" title={result.resilience.readinessStatement}>
                  {result.resilience.readinessStatement}
                </p>
              </div>

              {/* Card 3: Recovery Urgency */}
              <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Recovery Urgency
                </span>
                <div>{getUrgencyBadge(result.resilience.recoveryUrgency)}</div>
                <div className="text-[11px] text-slate-400">
                  Mode: <span className="font-semibold text-slate-300">{result.scenario.recoveryMode}</span>
                </div>
              </div>

              {/* Card 4: Projected Capacity Shortfall */}
              <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Projected Shortfall
                </span>
                <div className="text-xl font-black text-white flex items-center gap-1.5">
                  <Bus className="w-5 h-5 text-indigo-400" />
                  <span className={result.metrics.capacity.shortfall > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                    {result.metrics.capacity.shortfall > 0 ? `${result.metrics.capacity.shortfall} seats` : '0 seats'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">
                  {result.metrics.capacity.shortfall > 0
                    ? 'Demand exceeds available capacity'
                    : 'Shuttle capacity meets demand'}
                </div>
              </div>
            </div>

            {/* Baseline vs Simulated Comparison Board */}
            <div className="p-5 bg-slate-950/50 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-400" />
                  Baseline vs Contingency Telemetry Matrix
                </h4>
                <button
                  type="button"
                  onClick={() => setIsEvidenceDrawerOpen(true)}
                  className="px-2.5 py-1 text-xs font-semibold rounded bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30"
                >
                  Inspect Evidence Drawer
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                {/* Metric 1: Risk */}
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1.5">
                  <span className="text-slate-400 font-semibold">Route Risk Score</span>
                  <div className="flex justify-between items-baseline">
                    <span className="text-slate-400">Baseline: {result.metrics.risk.baseline}/100</span>
                    <span className="text-sm font-bold text-white">Sim: {result.metrics.risk.simulated}/100</span>
                  </div>
                  <div className={`text-[11px] font-semibold ${
                    result.metrics.risk.delta > 0 ? 'text-rose-400' : result.metrics.risk.delta < 0 ? 'text-emerald-400' : 'text-slate-400'
                  }`}>
                    Delta: {result.metrics.risk.delta > 0 ? `+${result.metrics.risk.delta}` : result.metrics.risk.delta} pts ({result.metrics.risk.level})
                  </div>
                </div>

                {/* Metric 2: Capacity */}
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1.5">
                  <span className="text-slate-400 font-semibold">Vehicle Capacity</span>
                  <div className="flex justify-between items-baseline">
                    <span className="text-slate-400">Baseline: {result.metrics.capacity.baseline} seats</span>
                    <span className="text-sm font-bold text-white">Sim: {result.metrics.capacity.simulated} seats</span>
                  </div>
                  <div className={`text-[11px] font-semibold ${
                    result.metrics.capacity.delta < 0 ? 'text-amber-400' : 'text-slate-400'
                  }`}>
                    Delta: {result.metrics.capacity.delta > 0 ? `+${result.metrics.capacity.delta}` : result.metrics.capacity.delta} seats
                  </div>
                </div>

                {/* Metric 3: Passenger Demand */}
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1.5">
                  <span className="text-slate-400 font-semibold">Passenger Demand</span>
                  <div className="flex justify-between items-baseline">
                    <span className="text-slate-400">
                      Base: {result.metrics.demand.baseline !== null ? `${result.metrics.demand.baseline} riders` : 'N/A'}
                    </span>
                    <span className="text-sm font-bold text-white">
                      Sim: {result.metrics.demand.simulated !== null ? `${result.metrics.demand.simulated} riders` : 'N/A'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Quality: {result.metrics.demand.dataQuality}
                  </div>
                </div>

                {/* Metric 4: Projected Occupancy */}
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1.5">
                  <span className="text-slate-400 font-semibold">Projected Occupancy</span>
                  <div className="flex justify-between items-baseline">
                    <span className="text-slate-400">
                      Base: {result.metrics.occupancy.baseline !== null ? `${result.metrics.occupancy.baseline}%` : 'N/A'}
                    </span>
                    <span className="text-sm font-bold text-white">
                      Sim: {result.metrics.occupancy.simulated !== null ? `${result.metrics.occupancy.simulated}%` : 'N/A'}
                    </span>
                  </div>
                  <div className={`text-[11px] font-semibold ${
                    result.metrics.occupancy.simulated !== null && result.metrics.occupancy.simulated >= 90
                      ? 'text-rose-400'
                      : 'text-emerald-400'
                  }`}>
                    Occupancy Pressure: {result.metrics.occupancy.simulated !== null && result.metrics.occupancy.simulated >= 90 ? 'HIGH' : 'NORMAL'}
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Deterministic Explanations Section */}
            <div className="p-5 bg-slate-950/50 rounded-2xl border border-slate-800 space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                Deterministic Explainability & Factual Drivers
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-300">Why Resilience Changed:</span>
                  <ul className="space-y-1 text-xs text-slate-400">
                    {result.explanations.whyResilienceChanged.map((text, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                        <span>{text}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-300">Recovery Readiness Assessment:</span>
                  <ul className="space-y-1 text-xs text-slate-400">
                    {result.explanations.whyRecoveryReadiness.map((text, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                        <span>{text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* 6. Advisory Contingency Planning Options */}
            <div className="p-5 bg-slate-950/50 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Compass className="w-4 h-4 text-amber-400" />
                  Advisory Contingency Planning Options (Human-in-the-Loop Review)
                </h4>
                <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400">
                  {result.contingencyPlanningOptions.length} Options Generated
                </span>
              </div>
              <p className="text-xs text-slate-400">
                These planning options are hypothetical recovery candidates for administrative review. No autonomous operational action is executed.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {result.contingencyPlanningOptions.map((opt, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                        {opt.type}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        opt.priority === 'CRITICAL'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : opt.priority === 'HIGH'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}>
                        {opt.priority}
                      </span>
                    </div>

                    <h5 className="text-xs font-bold text-white">{opt.title}</h5>
                    <p className="text-[11px] text-slate-300">{opt.explanation}</p>

                    <div className="pt-2 border-t border-slate-800/80 text-[10px] text-slate-400 space-y-0.5">
                      <div><strong className="text-slate-300">Evidence:</strong> {opt.evidence}</div>
                      <div><strong className="text-slate-300">Rationale:</strong> {opt.rationale}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 7. Evidence Drawer Modal */}
      {isEvidenceDrawerOpen && result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-400" />
                Resilience Planning Evidence Trace
              </h3>
              <button
                type="button"
                onClick={() => setIsEvidenceDrawerOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl space-y-1">
                <div className="font-bold text-slate-200">Corridor Identity:</div>
                <div className="text-slate-400">{result.evidence.route.name} ({result.evidence.route.code} / {result.evidence.route.id})</div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 bg-slate-950 rounded-lg">
                  <span className="text-slate-400">Baseline Risk:</span>{' '}
                  <span className="font-bold text-white">{result.evidence.baselineRiskScore}/100</span>
                </div>
                <div className="p-2.5 bg-slate-950 rounded-lg">
                  <span className="text-slate-400">Simulated Risk:</span>{' '}
                  <span className="font-bold text-white">{result.evidence.simulatedRiskScore}/100</span>
                </div>
                <div className="p-2.5 bg-slate-950 rounded-lg">
                  <span className="text-slate-400">Baseline Capacity:</span>{' '}
                  <span className="font-bold text-white">{result.evidence.baselineCapacity} seats</span>
                </div>
                <div className="p-2.5 bg-slate-950 rounded-lg">
                  <span className="text-slate-400">Simulated Capacity:</span>{' '}
                  <span className="font-bold text-white">{result.evidence.simulatedCapacity} seats</span>
                </div>
                <div className="p-2.5 bg-slate-950 rounded-lg">
                  <span className="text-slate-400">Projected Shortfall:</span>{' '}
                  <span className="font-bold text-white">{result.evidence.capacityShortfall} seats</span>
                </div>
                <div className="p-2.5 bg-slate-950 rounded-lg">
                  <span className="text-slate-400">Demand Data Quality:</span>{' '}
                  <span className="font-bold text-white">{result.evidence.dataQuality}</span>
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl space-y-1 text-slate-400">
                <div className="font-bold text-slate-200">System Safety Invariant:</div>
                <p>
                  No operational resources were modified during this simulation. All contingency options are hypothetical candidates for supervisor evaluation.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsEvidenceDrawerOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
