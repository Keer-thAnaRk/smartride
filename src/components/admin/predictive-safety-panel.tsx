'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  Info,
  RefreshCw,
  AlertTriangle,
  Shield,
  Layers,
  Activity,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';

interface FactorTrends {
  emergency: 'RISING' | 'FALLING' | 'STABLE';
  deviation: 'RISING' | 'FALLING' | 'STABLE';
  speed: 'RISING' | 'FALLING' | 'STABLE';
  stopGps: 'RISING' | 'FALLING' | 'STABLE';
  compliance: 'RISING' | 'FALLING' | 'STABLE';
  complexity: 'RISING' | 'FALLING' | 'STABLE';
}

interface FactorDetail {
  key: keyof FactorTrends;
  label: string;
  slope: number;
  currentPoints: number;
  averagePoints: number;
  trend: 'RISING' | 'FALLING' | 'STABLE';
}

interface HistoricalScorePoint {
  evaluatedAt: string;
  riskScore: number;
}

interface PredictiveSafetyProjection {
  routeId: string;
  routeCode: string;
  routeName: string;
  predictionStatus: 'INSUFFICIENT_HISTORY' | 'RISING' | 'FALLING' | 'STABLE';
  currentScore: number;
  currentRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  historicalSnapshotCount: number;
  trendDirection: 'RISING' | 'FALLING' | 'STABLE';
  slope: number;
  intercept: number;
  rSquared: number;
  projectionConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
  projectedScore: number;
  projectedRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  dominantRiskDriver: string;
  factorTrends: FactorTrends;
  factorDetails?: FactorDetail[];
  historicalScores: HistoricalScorePoint[];
  evaluatedAt: string;
  explanation: string;
  disclaimer: string;
  message?: string;
}

interface CorridorRoute {
  id: string;
  code: string;
  name: string;
}

export default function PredictiveSafetyPanel() {
  const [routes, setRoutes] = useState<CorridorRoute[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('route-sr-101');
  const [loading, setLoading] = useState<boolean>(true);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [projection, setProjection] = useState<PredictiveSafetyProjection | null>(null);
  const [isInsufficient, setIsInsufficient] = useState<boolean>(false);
  const [insufficientMessage, setInsufficientMessage] = useState<string>('');

  useEffect(() => {
    async function loadRoutes() {
      try {
        const res = await axios.get('/api/routes');
        if (res.data?.routes && Array.isArray(res.data.routes)) {
          setRoutes(res.data.routes);
          if (res.data.routes.length > 0) {
            setSelectedRouteId(res.data.routes[0].id);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch routes for predictive panel:', err);
      }
    }
    loadRoutes();
  }, []);

  useEffect(() => {
    if (selectedRouteId) {
      fetchPrediction(selectedRouteId);
    }
  }, [selectedRouteId]);

  async function fetchPrediction(routeId: string) {
    setLoading(true);
    try {
      const res = await axios.get('/api/safety/prediction', {
        params: { routeId },
      });

      if (res.data?.prediction) {
        const p = res.data.prediction;
        if (p.predictionStatus === 'INSUFFICIENT_HISTORY') {
          setIsInsufficient(true);
          setInsufficientMessage(
            p.message || 'At least 3 historical route-risk snapshots are required to estimate a risk trajectory.'
          );
          setProjection(null);
        } else {
          setIsInsufficient(false);
          setInsufficientMessage('');
          setProjection(p as PredictiveSafetyProjection);
        }
      }
    } catch (err) {
      console.error('Failed to load safety prediction:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAnalyze() {
    setAnalyzing(true);
    await fetchPrediction(selectedRouteId);
    setAnalyzing(false);
  }

  // Format Recharts data combining observed historical points and the forecasted point
  const chartData = React.useMemo(() => {
    if (!projection || !projection.historicalScores || projection.historicalScores.length === 0) {
      return [];
    }

    const n = projection.historicalScores.length;
    const slope = projection.slope;
    const intercept = projection.intercept;

    interface ChartItem {
      label: string;
      observedScore: number | null;
      trendLine: number;
      projectedScore: number | null;
      type: 'OBSERVED' | 'PROJECTED';
    }

    const items: ChartItem[] = projection.historicalScores.map((h, idx) => ({
      label: `#${idx + 1}`,
      observedScore: h.riskScore,
      trendLine: Math.round((slope * idx + intercept) * 10) / 10,
      projectedScore: null,
      type: 'OBSERVED',
    }));

    // Add projected next point with visual distinction
    items.push({
      label: `Proj (Next)`,
      observedScore: null,
      trendLine: Math.round((slope * n + intercept) * 10) / 10,
      projectedScore: projection.projectedScore,
      type: 'PROJECTED',
    });

    return items;
  }, [projection]);

  function getBadgeColor(level?: string) {
    switch (level) {
      case 'CRITICAL':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'HIGH':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
      case 'MEDIUM':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      default:
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    }
  }

  function getTrendBadge(trend?: string) {
    switch (trend) {
      case 'RISING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <TrendingUp className="w-3.5 h-3.5" />
            RISING (Risk Increasing)
          </span>
        );
      case 'FALLING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <TrendingDown className="w-3.5 h-3.5" />
            FALLING (Safety Improving)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
            <Minus className="w-3.5 h-3.5" />
            STABLE (Trajectory Flat)
          </span>
        );
    }
  }

  function getConfidenceBadge(confidence?: string) {
    switch (confidence) {
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            <CheckCircle2 className="w-3 h-3" />
            HIGH CONFIDENCE
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
            <Activity className="w-3 h-3" />
            MEDIUM CONFIDENCE
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-500/20 text-slate-300 border border-slate-500/40">
            <AlertCircle className="w-3 h-3" />
            LOW CONFIDENCE
          </span>
        );
    }
  }

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-800/80 bg-slate-950/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-400">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white tracking-tight">
                Predictive Safety Intelligence
              </h2>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Phase 3 · Step 4
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Explainable, deterministic statistical trajectory estimation based on observed route-risk snapshots.
            </p>
          </div>
        </div>

        {/* Route Selector & Action */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={selectedRouteId}
              onChange={(e) => setSelectedRouteId(e.target.value)}
              className="bg-slate-800 text-slate-200 text-xs font-medium border border-slate-700 rounded-xl px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} — {r.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleAnalyze}
            disabled={analyzing || loading}
            className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/20 transition active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${analyzing ? 'animate-spin' : ''}`} />
            <span>Analyze Risk Trajectory</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-6 space-y-6">
        {loading ? (
          <div className="py-16 text-center">
            <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-400">
              Evaluating historical safety snapshots & regression trajectories...
            </p>
          </div>
        ) : isInsufficient ? (
          <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 flex-shrink-0 mt-0.5 text-amber-400" />
            <div>
              <h4 className="text-sm font-bold text-amber-200">Insufficient Historical Data</h4>
              <p className="text-xs text-amber-300/90 mt-1 leading-relaxed">
                {insufficientMessage}
              </p>
              <p className="text-[11px] text-amber-400/80 mt-2 font-mono">
                Requirement: Minimum 3 chronological snapshots recorded to establish an explainable linear trajectory.
              </p>
            </div>
          </div>
        ) : projection ? (
          <>
            {/* KPI Cards Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Current Risk */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Current Observed Risk
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-3xl font-extrabold text-white">
                    {projection.currentScore}
                    <span className="text-xs text-slate-500 font-normal">/100</span>
                  </span>
                  <span
                    className={`px-2 py-0.5 text-[11px] font-bold rounded-md border ${getBadgeColor(
                      projection.currentRiskLevel
                    )}`}
                  >
                    {projection.currentRiskLevel}
                  </span>
                </div>
                <div className="mt-2 text-[11px] text-slate-400">
                  Observed at snapshot #{projection.historicalSnapshotCount}
                </div>
              </div>

              {/* Card 2: Observed Trajectory Trend */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Trajectory Direction
                </div>
                <div className="mt-2.5">
                  {getTrendBadge(projection.trendDirection)}
                </div>
                <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Regression Slope:</span>
                  <span className="font-mono font-semibold text-slate-300">
                    {projection.slope >= 0 ? `+${projection.slope}` : projection.slope} pts/eval
                  </span>
                </div>
              </div>

              {/* Card 3: Projected Next Observation */}
              <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-800/50">
                <div className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider">
                  Projected Risk Score (Next)
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-3xl font-extrabold text-indigo-300">
                    {projection.projectedScore}
                    <span className="text-xs text-indigo-400/60 font-normal">/100</span>
                  </span>
                  <span
                    className={`px-2 py-0.5 text-[11px] font-bold rounded-md border ${getBadgeColor(
                      projection.projectedRiskLevel
                    )}`}
                  >
                    {projection.projectedRiskLevel}
                  </span>
                </div>
                <div className="mt-2 text-[11px] text-indigo-400/80">
                  Statistical estimate for observation #{projection.historicalSnapshotCount + 1}
                </div>
              </div>

              {/* Card 4: Statistical Confidence */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Projection Confidence
                </div>
                <div className="mt-2.5">
                  {getConfidenceBadge(projection.projectionConfidence)}
                </div>
                <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Goodness of Fit (R²):</span>
                  <span className="font-mono font-semibold text-slate-300">
                    {projection.rSquared}
                  </span>
                </div>
              </div>
            </div>

            {/* Regression Chart Section (Distinguishing Observed vs Projected) */}
            <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800/80 gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-400" />
                    Observed Safety Trajectory & Next-Evaluation Projection
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Solid line indicates verified historical observations. Dashed point indicates mathematical statistical projection.
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <span className="w-3 h-3 rounded-full bg-cyan-400 inline-block" />
                    Observed Risk
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <span className="w-3 h-0.5 bg-slate-500 inline-block" />
                    Trend Line (OLS)
                  </span>
                  <span className="flex items-center gap-1.5 text-indigo-400 font-semibold">
                    <span className="w-3 h-3 rounded-full border-2 border-indigo-400 bg-indigo-950 inline-block" />
                    Projected Next
                  </span>
                </div>
              </div>

              <div className="h-64 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                    <XAxis dataKey="label" stroke="#64748b" fontSize={11} />
                    <YAxis domain={[0, 100]} stroke="#64748b" fontSize={11} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload || !payload.length) return null;
                        const dataPoint = payload[0]?.payload;
                        return (
                          <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl text-xs space-y-1">
                            <div className="font-bold text-white border-b border-slate-700 pb-1">
                              {label} ({dataPoint?.type === 'PROJECTED' ? 'Projected' : 'Historical Snapshot'})
                            </div>
                            {dataPoint?.observedScore !== null && (
                              <div className="text-cyan-300 font-medium">
                                Observed Score: {dataPoint.observedScore}
                              </div>
                            )}
                            {dataPoint?.projectedScore !== null && (
                              <div className="text-indigo-300 font-semibold">
                                Projected Score: {dataPoint.projectedScore}
                              </div>
                            )}
                            <div className="text-slate-400 text-[10px]">
                              Regression Line: {dataPoint?.trendLine}
                            </div>
                          </div>
                        );
                      }}
                    />
                    <ReferenceLine y={25} stroke="#10b981" strokeDasharray="2 2" opacity={0.4} />
                    <ReferenceLine y={50} stroke="#f59e0b" strokeDasharray="2 2" opacity={0.4} />
                    <ReferenceLine y={75} stroke="#f43f5e" strokeDasharray="2 2" opacity={0.4} />

                    {/* Trend Line (Linear Fit) */}
                    <Line
                      type="monotone"
                      dataKey="trendLine"
                      stroke="#64748b"
                      strokeDasharray="4 4"
                      dot={false}
                      strokeWidth={1.5}
                      name="Trend (OLS)"
                    />

                    {/* Historical Observed Points */}
                    <Line
                      type="monotone"
                      dataKey="observedScore"
                      stroke="#22d3ee"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#22d3ee', stroke: '#0891b2', strokeWidth: 1.5 }}
                      connectNulls={false}
                      name="Observed Risk"
                    />

                    {/* Projected Next Point */}
                    <Line
                      type="monotone"
                      dataKey="projectedScore"
                      stroke="#818cf8"
                      strokeWidth={2.5}
                      dot={{ r: 6, fill: '#4f46e5', stroke: '#c7d2fe', strokeWidth: 2 }}
                      connectNulls={false}
                      name="Projected Next"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Evidence Narrative & Dominant Driver */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/50 flex flex-col justify-between">
                <div>
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Dominant Trajectory Driver
                  </div>
                  <div className="mt-2 text-lg font-bold text-white flex items-center gap-2">
                    <Shield className="w-5 h-5 text-indigo-400" />
                    <span>{projection.dominantRiskDriver}</span>
                  </div>
                </div>
                <div className="mt-3 text-[11px] text-slate-400">
                  Identified mathematically by the highest positive slope among changing safety dimensions.
                </div>
              </div>

              <div className="lg:col-span-2 p-4 rounded-xl bg-slate-800/30 border border-slate-700/50">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Explainable Statistical Narrative
                </div>
                <p className="mt-2 text-xs text-slate-200 leading-relaxed font-medium">
                  {projection.explanation}
                </p>
                <div className="mt-3 flex items-center gap-4 text-[11px] text-slate-400 border-t border-slate-700/50 pt-2 font-mono">
                  <span>Snapshots: {projection.historicalSnapshotCount}</span>
                  <span>Slope: {projection.slope}</span>
                  <span>Intercept: {projection.intercept}</span>
                  <span>R²: {projection.rSquared}</span>
                </div>
              </div>
            </div>

            {/* Factor Trends Breakdown (6 Dimensions) */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  Factor-Level Trend Trajectories (6 Dimensions)
                </h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {projection.factorDetails && projection.factorDetails.length > 0 ? (
                  projection.factorDetails.map((f) => (
                    <div
                      key={f.key}
                      className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 flex flex-col justify-between"
                    >
                      <div className="text-[11px] font-medium text-slate-400 truncate" title={f.label}>
                        {f.label}
                      </div>
                      <div className="mt-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            f.trend === 'RISING'
                              ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                              : f.trend === 'FALLING'
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : 'bg-slate-700/40 text-slate-300 border border-slate-600/30'
                          }`}
                        >
                          {f.trend === 'RISING' && <TrendingUp className="w-2.5 h-2.5" />}
                          {f.trend === 'FALLING' && <TrendingDown className="w-2.5 h-2.5" />}
                          {f.trend === 'STABLE' && <Minus className="w-2.5 h-2.5" />}
                          {f.trend}
                        </span>
                      </div>
                      <div className="mt-2 text-[10px] text-slate-400 flex items-center justify-between font-mono">
                        <span>Curr: {f.currentPoints} pt</span>
                        <span>Avg: {f.averagePoints}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  Object.entries(projection.factorTrends).map(([k, v]) => (
                    <div
                      key={k}
                      className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 flex flex-col justify-between"
                    >
                      <div className="text-[11px] font-medium text-slate-400 uppercase truncate">
                        {k}
                      </div>
                      <div className="mt-2">
                        <span className="text-[10px] font-bold text-slate-300">{v}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        ) : null}

        {/* Mandatory Prediction Disclaimer (Section 25) */}
        <div className="pt-3 border-t border-slate-800/80 flex items-center gap-2 text-[11px] text-slate-400/90 italic">
          <Info className="w-4 h-4 flex-shrink-0 text-slate-500" />
          <span>
            {projection?.disclaimer ||
              'This projection is based on observed historical route-risk scores. It is a statistical trajectory estimate, not a prediction of a specific safety incident.'}
          </span>
        </div>
      </div>
    </section>
  );
}
