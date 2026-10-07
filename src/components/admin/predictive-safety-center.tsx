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
  Compass,
  Zap,
  Sliders,
  Calendar,
  Layers,
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

interface FactorTrendItem {
  dimension: string;
  label: string;
  currentPoints: number;
  averagePoints: number;
  slope: number;
  trendDirection: 'RISING' | 'FALLING' | 'STABLE';
  delta: number;
}

interface HistoricalSeriesPoint {
  id: string;
  evaluatedAt: string;
  riskScore: number;
  riskLevel: string;
}

interface PredictiveForecast {
  routeId: string;
  routeCode: string;
  routeName: string;
  currentRiskScore: number;
  currentRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  forecastScore: number;
  forecastRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  forecastHorizon: 'NEXT_EVALUATION';
  confidence: number | null;
  trendDirection: 'RISING' | 'FALLING' | 'STABLE';
  historicalSnapshots: number;
  scoreSlope: number;
  volatility: number;
  contributingFactors: FactorTrendItem[];
  historicalSeries: HistoricalSeriesPoint[];
  explanation: string;
  generatedAt: string;
  disclaimer: string;
}

interface CorridorRoute {
  id: string;
  code: string;
  name: string;
}

export default function PredictiveSafetyCenter() {
  const [routes, setRoutes] = useState<CorridorRoute[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('route-sr-101');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [status, setStatus] = useState<'SUFFICIENT_DATA' | 'INSUFFICIENT_HISTORY'>('SUFFICIENT_DATA');
  const [forecast, setForecast] = useState<PredictiveForecast | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');

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
        console.warn('Failed to fetch routes for predictive center:', err);
      }
    }
    loadRoutes();
  }, []);

  useEffect(() => {
    if (selectedRouteId) {
      fetchPredictiveAnalytics();
    }
  }, [selectedRouteId]);

  async function fetchPredictiveAnalytics() {
    setLoading(true);
    try {
      const res = await axios.get('/api/safety/predictive', {
        params: { routeId: selectedRouteId },
      });

      if (res.data) {
        setStatus(res.data.status || 'SUFFICIENT_DATA');
        setForecast(res.data.forecast || null);
        setStatusMessage(res.data.message || '');
      }
    } catch (err) {
      console.error('Failed to load predictive safety analytics:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await fetchPredictiveAnalytics();
    setRefreshing(false);
  }

  // Format Recharts data combining observed historical points and the forecasted point
  const chartData = React.useMemo(() => {
    if (!forecast || !forecast.historicalSeries || forecast.historicalSeries.length === 0) {
      return [];
    }

    interface ChartDataPoint {
      index: number;
      label: string;
      timestamp: string;
      observedScore: number | null;
      forecastScore: number | null;
      type: string;
    }

    const points: ChartDataPoint[] = forecast.historicalSeries.map((s, idx) => ({
      index: idx + 1,
      label: `Observed #${idx + 1}`,
      timestamp: new Date(s.evaluatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      observedScore: s.riskScore,
      forecastScore: null,
      type: 'OBSERVED',
    }));

    // Append connecting bridge and forecast point
    const lastObserved = points[points.length - 1];

    // Bridge point: last observed also anchors the forecast line for continuous visualization
    const bridgePoint: ChartDataPoint = {
      index: points.length,
      label: `Observed #${points.length}`,
      timestamp: lastObserved.timestamp,
      observedScore: lastObserved.observedScore,
      forecastScore: lastObserved.observedScore,
      type: 'BRIDGE',
    };
    points[points.length - 1] = bridgePoint;

    // Forecasted point for Next Evaluation
    points.push({
      index: points.length + 1,
      label: 'Next Evaluation (Forecast)',
      timestamp: 'Forecast Target',
      observedScore: null,
      forecastScore: forecast.forecastScore,
      type: 'FORECAST',
    });

    return points;
  }, [forecast]);

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-500/20 text-rose-300 border border-rose-500/30">
            CRITICAL
          </span>
        );
      case 'HIGH':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-orange-500/20 text-orange-300 border border-orange-500/30">
            HIGH
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            MEDIUM
          </span>
        );
      case 'LOW':
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            LOW
          </span>
        );
    }
  };

  const getTrendBadge = (trend: string) => {
    switch (trend) {
      case 'RISING':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>RISING</span>
          </span>
        );
      case 'FALLING':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <TrendingDown className="w-3.5 h-3.5" />
            <span>FALLING</span>
          </span>
        );
      case 'STABLE':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
            <Minus className="w-3.5 h-3.5" />
            <span>STABLE</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
            <span>INSUFFICIENT HISTORY</span>
          </span>
        );
    }
  };

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl text-white">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-white flex items-center space-x-2">
                <span>Predictive Safety Analytics</span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                  Step 4 Forecast
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Statistical risk trajectory projection derived from historical RouteRiskSnapshot evaluations.
              </p>
            </div>
          </div>
        </div>

        {/* Corridor Selector & Refresh */}
        <div className="flex items-center space-x-2.5">
          <select
            value={selectedRouteId}
            onChange={(e) => setSelectedRouteId(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-200 focus:outline-none focus:border-indigo-500 transition cursor-pointer"
          >
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.code} — {r.name}
              </option>
            ))}
          </select>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition active:scale-95"
            title="Refresh Predictive Model"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center space-y-2">
          <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
          <span>Computing statistical safety projection...</span>
        </div>
      ) : status === 'INSUFFICIENT_HISTORY' || !forecast ? (
        <div className="py-12 px-6 my-6 rounded-xl bg-slate-950/60 border border-amber-500/30 text-center space-y-3">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
          <h3 className="text-sm font-bold text-slate-200">Insufficient Historical Data for Predictive Analysis</h3>
          <p className="text-xs text-slate-400 max-w-lg mx-auto">
            {statusMessage ||
              'At least 3 chronological snapshot evaluations are required to calculate statistically defensible slope and volatility estimates.'}
          </p>
          <div className="pt-2 text-[11px] text-slate-500">
            Tip: Record additional snapshots using the <strong>Route Risk History Viewer</strong> above to unlock trend projection.
          </div>
        </div>
      ) : (
        <div className="space-y-6 pt-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {/* Current Score */}
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Score</span>
              <div className="pt-1 flex items-baseline justify-between">
                <span className="text-2xl font-black text-white">{forecast.currentRiskScore}</span>
                {getRiskBadge(forecast.currentRiskLevel)}
              </div>
            </div>

            {/* Forecast Score */}
            <div className="bg-slate-950/70 border border-indigo-500/40 rounded-xl p-3 flex flex-col justify-between shadow-lg shadow-indigo-950/20">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 flex items-center space-x-1">
                <Sparkles className="w-3 h-3" />
                <span>Forecast</span>
              </span>
              <div className="pt-1 flex items-baseline justify-between">
                <span className="text-2xl font-black text-indigo-300">{forecast.forecastScore}</span>
                {getRiskBadge(forecast.forecastRiskLevel)}
              </div>
            </div>

            {/* Trajectory */}
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Trajectory</span>
              <div className="pt-2">{getTrendBadge(forecast.trendDirection)}</div>
            </div>

            {/* Score Slope */}
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Slope (m)</span>
              <div className="pt-1">
                <span className={`text-lg font-black ${forecast.scoreSlope > 0 ? 'text-rose-400' : forecast.scoreSlope < 0 ? 'text-emerald-400' : 'text-slate-300'}`}>
                  {forecast.scoreSlope > 0 ? `+${forecast.scoreSlope}` : forecast.scoreSlope}
                </span>
                <span className="text-[10px] text-slate-500 block">pts / interval</span>
              </div>
            </div>

            {/* Volatility */}
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Volatility (σ)</span>
              <div className="pt-1">
                <span className="text-lg font-black text-slate-200">±{forecast.volatility}</span>
                <span className="text-[10px] text-slate-500 block">std dev pts</span>
              </div>
            </div>

            {/* Statistical Confidence */}
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Confidence</span>
              <div className="pt-1">
                <span className="text-lg font-black text-indigo-400">
                  {forecast.confidence !== null ? `${forecast.confidence}%` : 'N/A'}
                </span>
                <span className="text-[10px] text-slate-500 block">R² weighted</span>
              </div>
            </div>

            {/* Historical Series Size */}
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">History Size</span>
              <div className="pt-1">
                <span className="text-lg font-black text-slate-200">{forecast.historicalSnapshots}</span>
                <span className="text-[10px] text-slate-500 block">snapshots</span>
              </div>
            </div>

            {/* Forecast Horizon */}
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Horizon</span>
              <div className="pt-1">
                <span className="text-xs font-bold text-slate-200 block pt-1">Next Eval</span>
                <span className="text-[10px] text-slate-500 block">+1 interval</span>
              </div>
            </div>
          </div>

          {/* Interactive Recharts Visualization: Observed vs Forecast */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Historical Trend & Projection Horizon</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Solid cyan line represents verified historical observations. Dashed purple line represents the statistical model forecast.
                </p>
              </div>

              {/* Legend Badges */}
              <div className="flex items-center space-x-3 text-[11px]">
                <div className="flex items-center space-x-1.5">
                  <span className="w-3 h-0.5 bg-cyan-400 rounded" />
                  <span className="text-slate-300">Observed History</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="w-3 h-0.5 border-t-2 border-dashed border-indigo-400" />
                  <span className="text-indigo-300 font-semibold">Model Forecast</span>
                </div>
              </div>
            </div>

            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                  <XAxis
                    dataKey="label"
                    stroke="#94a3b8"
                    fontSize={10}
                    tickLine={false}
                    interval={0}
                  />
                  <YAxis
                    domain={[0, 100]}
                    stroke="#94a3b8"
                    fontSize={10}
                    tickLine={false}
                    ticks={[0, 25, 50, 75, 100]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#020617',
                      borderColor: '#334155',
                      borderRadius: '0.75rem',
                      fontSize: '11px',
                    }}
                    labelStyle={{ color: '#e2e8f0', fontWeight: 'bold' }}
                    formatter={(value: any, name?: any) => {
                      if (name === 'observedScore' && value !== null) {
                        return [`${value} pts`, 'Observed Risk Score'];
                      }
                      if (name === 'forecastScore' && value !== null) {
                        return [`${value} pts`, 'Model-Based Forecast'];
                      }
                      return [value, name || 'Score'];
                    }}
                  />
                  {/* Threshold Reference Lines */}
                  <ReferenceLine
                    y={25}
                    stroke="#f59e0b"
                    strokeDasharray="3 3"
                    strokeOpacity={0.6}
                    label={{ value: 'MEDIUM (25)', position: 'insideTopRight', fill: '#f59e0b', fontSize: 9 }}
                  />
                  <ReferenceLine
                    y={50}
                    stroke="#f97316"
                    strokeDasharray="3 3"
                    strokeOpacity={0.6}
                    label={{ value: 'HIGH (50)', position: 'insideTopRight', fill: '#f97316', fontSize: 9 }}
                  />
                  <ReferenceLine
                    y={75}
                    stroke="#f43f5e"
                    strokeDasharray="3 3"
                    strokeOpacity={0.6}
                    label={{ value: 'CRITICAL (75)', position: 'insideTopRight', fill: '#f43f5e', fontSize: 9 }}
                  />

                  {/* Observed Historical Line */}
                  <Line
                    type="monotone"
                    dataKey="observedScore"
                    stroke="#38bdf8"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#38bdf8', strokeWidth: 1, stroke: '#020617' }}
                    activeDot={{ r: 6 }}
                    isAnimationActive={false}
                  />

                  {/* Forecast Projection Line */}
                  <Line
                    type="linear"
                    dataKey="forecastScore"
                    stroke="#a855f7"
                    strokeWidth={2.5}
                    strokeDasharray="5 5"
                    dot={{ r: 5, fill: '#a855f7', strokeWidth: 2, stroke: '#ffffff' }}
                    activeDot={{ r: 7 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Statistical Narrative Banner */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
            <div className="flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider text-indigo-400">
              <Info className="w-3.5 h-3.5" />
              <span>Statistical Model Narrative & Evidence</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">{forecast.explanation}</p>
          </div>

          {/* Factor Trajectory Breakdown (6 dimensions) */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>Safety Factor Movement Analysis</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {forecast.contributingFactors.map((factor) => (
                <div
                  key={factor.dimension}
                  className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between"
                >
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">{factor.label}</span>
                    <span className="text-[11px] text-slate-400">
                      Current: <strong>{factor.currentPoints} pts</strong> | Avg: {factor.averagePoints} pts
                    </span>
                  </div>

                  <div className="text-right">
                    {getTrendBadge(factor.trendDirection)}
                    <span className="text-[10px] text-slate-500 block pt-0.5">
                      Δ {factor.delta > 0 ? `+${factor.delta}` : factor.delta} pts
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mandatory Safety Disclaimer Banner */}
          <div className="p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-500/30 text-indigo-200 text-xs flex items-start space-x-2.5">
            <HelpCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block text-indigo-300">Statistical Forecasting Notice</span>
              <p className="text-[11px] text-indigo-200/90 leading-normal">{forecast.disclaimer}</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
