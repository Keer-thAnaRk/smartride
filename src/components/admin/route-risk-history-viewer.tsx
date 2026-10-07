'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  History,
  Camera,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  ChevronRight,
  Info,
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

interface SnapshotItem {
  id: string;
  routeId: string;
  routeCode: string;
  routeName: string;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  emergencyPoints: number;
  deviationPoints: number;
  speedPoints: number;
  stopGpsPoints: number;
  compliancePoints: number;
  complexityPoints: number;
  totalEvents: number;
  evaluatedAt: string;
}

interface FactorDeltas {
  emergencyPoints: number;
  deviationPoints: number;
  speedPoints: number;
  stopGpsPoints: number;
  compliancePoints: number;
  complexityPoints: number;
}

interface TrendAnalysis {
  trend: 'RISING' | 'FALLING' | 'STABLE' | 'NO_HISTORY';
  currentScore: number | null;
  previousScore: number | null;
  scoreDelta: number | null;
  currentLevel: string | null;
  previousLevel: string | null;
  factorDeltas: FactorDeltas | null;
  summary: string;
}

export default function RouteRiskHistoryViewer() {
  const [routes, setRoutes] = useState<Array<{ id: string; code: string; name: string }>>([
    { id: 'route-sr-101', code: 'SR-101', name: 'Whitefield Tech Corridor Express' },
    { id: 'route-sr-102', code: 'SR-102', name: 'CyberCity & Manyata Tech Shuttle' },
    { id: 'route-sr-103', code: 'SR-103', name: 'Outer Ring Road Tech Express' },
  ]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('route-sr-101');
  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);
  const [trendAnalysis, setTrendAnalysis] = useState<TrendAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchHistory = async (routeId: string) => {
    try {
      setLoading(true);
      const res = await axios.get(`/api/safety/route-risk/history?routeId=${routeId}`);
      if (res.data?.success) {
        setSnapshots(res.data.snapshots || []);
        setTrendAnalysis(res.data.trendAnalysis || null);
      }
    } catch (err: any) {
      console.warn('Failed to load route risk history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory(selectedRouteId);
  }, [selectedRouteId]);

  const handleCaptureSnapshot = async () => {
    try {
      setCapturing(true);
      setStatusMessage(null);
      const res = await axios.post('/api/safety/route-risk/history', {
        routeId: selectedRouteId,
      });

      if (res.data?.success) {
        setStatusMessage(`Captured snapshot for ${selectedRouteId} (Score: ${res.data.snapshot?.riskScore})`);
        await fetchHistory(selectedRouteId);
        setTimeout(() => setStatusMessage(null), 4000);
      }
    } catch (err: any) {
      setStatusMessage(err.response?.data?.error || 'Failed to capture risk snapshot');
    } finally {
      setCapturing(false);
    }
  };

  const getTrendBadge = (trend?: string) => {
    switch (trend) {
      case 'RISING':
        return (
          <span className="flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>RISING RISK</span>
          </span>
        );
      case 'FALLING':
        return (
          <span className="flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            <TrendingDown className="w-3.5 h-3.5" />
            <span>IMPROVING / FALLING</span>
          </span>
        );
      case 'STABLE':
        return (
          <span className="flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
            <Minus className="w-3.5 h-3.5" />
            <span>STABLE RISK</span>
          </span>
        );
      case 'NO_HISTORY':
      default:
        return (
          <span className="flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
            <History className="w-3.5 h-3.5" />
            <span>INSUFFICIENT HISTORY</span>
          </span>
        );
    }
  };

  // Prepare chart data chronologically
  const chartData = snapshots.map((s, idx) => ({
    index: idx + 1,
    time: new Date(s.evaluatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    date: new Date(s.evaluatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' }),
    score: s.riskScore,
    level: s.riskLevel,
  }));

  const factorDeltas = trendAnalysis?.factorDeltas;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 text-white shadow-xl space-y-6">
      {/* Top Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-400 flex items-center justify-center font-black">
            <History className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-black text-white tracking-tight">
                Route Risk History & Trends
              </h2>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
                Phase 3 Step 2
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Deterministic point-in-time risk snapshots and historical trend analysis
            </p>
          </div>
        </div>

        {/* Route Selector & Action */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedRouteId}
            onChange={(e) => setSelectedRouteId(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white text-xs font-bold rounded-xl px-3 py-2 outline-none focus:border-indigo-500"
          >
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.code} — {r.name}
              </option>
            ))}
          </select>

          <button
            onClick={handleCaptureSnapshot}
            disabled={capturing}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/20 disabled:opacity-50"
          >
            <Camera className="w-4 h-4" />
            <span>{capturing ? 'Recording...' : 'Capture Snapshot'}</span>
          </button>

          <button
            onClick={() => fetchHistory(selectedRouteId)}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
            title="Refresh history"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-bold flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* KPI Cards: Current Score, Previous Score, Delta, Trend */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Current Score */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Current Risk Score
          </span>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-black text-white">
              {trendAnalysis?.currentScore !== null ? trendAnalysis?.currentScore : '—'}
            </span>
            <span className="text-xs text-slate-400 font-bold">/ 100</span>
          </div>
          <span className="text-[10px] font-bold text-slate-400 block">
            Level: {trendAnalysis?.currentLevel || 'Pending'}
          </span>
        </div>

        {/* Previous Score */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Previous Risk Score
          </span>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-black text-slate-300">
              {trendAnalysis?.previousScore !== null ? trendAnalysis?.previousScore : '—'}
            </span>
            <span className="text-xs text-slate-400 font-bold">/ 100</span>
          </div>
          <span className="text-[10px] font-bold text-slate-400 block">
            Level: {trendAnalysis?.previousLevel || 'N/A'}
          </span>
        </div>

        {/* Score Delta */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Score Delta (Change)
          </span>
          <div className="flex items-baseline space-x-1.5">
            <span
              className={`text-2xl font-black ${
                trendAnalysis?.scoreDelta && trendAnalysis.scoreDelta > 0
                  ? 'text-rose-400'
                  : trendAnalysis?.scoreDelta && trendAnalysis.scoreDelta < 0
                  ? 'text-emerald-400'
                  : 'text-slate-300'
              }`}
            >
              {trendAnalysis?.scoreDelta !== null && trendAnalysis?.scoreDelta !== undefined
                ? `${trendAnalysis.scoreDelta > 0 ? '+' : ''}${trendAnalysis.scoreDelta}`
                : '0'}
            </span>
            <span className="text-xs text-slate-400 font-bold">pts</span>
          </div>
          <span className="text-[10px] font-bold text-slate-400 block">
            {snapshots.length} total snapshot(s)
          </span>
        </div>

        {/* Trend Pill */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 space-y-2 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Safety Trajectory
          </span>
          <div>{getTrendBadge(trendAnalysis?.trend)}</div>
        </div>
      </div>

      {/* Summary Narrative */}
      {trendAnalysis && (
        <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/90 text-xs text-slate-300 flex items-start space-x-2.5">
          <Info className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-white">Analysis Summary: </strong>
            {trendAnalysis.summary}
          </p>
        </div>
      )}

      {/* Historical Trend Chart (Recharts) */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-white flex items-center space-x-2">
            <span>Historical Risk Curve (0–100)</span>
            <span className="text-[10px] font-bold bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md">
              Descriptive Timeline
            </span>
          </h3>

          <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold text-slate-400">
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>LOW (0–24)</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span>MED (25–49)</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
              <span>HIGH (50–74)</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span>CRITICAL (75–100)</span>
            </span>
          </div>
        </div>

        {snapshots.length >= 2 ? (
          <div className="w-full h-64 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis domain={[0, 100]} stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-xl shadow-xl text-xs space-y-1">
                          <p className="font-bold text-white">{data.date} at {data.time}</p>
                          <p className="text-indigo-300 font-mono font-bold">Risk Score: {data.score} / 100</p>
                          <p className="text-[10px] text-slate-400">Risk Level: {data.level}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {/* Threshold Reference Lines */}
                <ReferenceLine y={25} stroke="#10b981" strokeDasharray="3 3" />
                <ReferenceLine y={50} stroke="#f59e0b" strokeDasharray="3 3" />
                <ReferenceLine y={75} stroke="#f43f5e" strokeDasharray="3 3" />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#6366f1"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#818cf8' }}
                  activeDot={{ r: 6, fill: '#ffffff' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="py-12 text-center space-y-2 border border-dashed border-slate-800 rounded-xl">
            <Clock className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-xs font-bold text-slate-400">Insufficient history to render risk trend line</p>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
              At least 2 historical snapshots are required to display risk trajectories. Click &quot;Capture Snapshot&quot; above to log current corridor risk states.
            </p>
          </div>
        )}
      </div>

      {/* Factor Delta Breakdown (Explaining WHY the score changed) */}
      {factorDeltas && (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-indigo-400" />
            <span>Factor Point Deltas (Recent vs Previous)</span>
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Emergency / SOS', delta: factorDeltas.emergencyPoints },
              { label: 'Route Deviations', delta: factorDeltas.deviationPoints },
              { label: 'Speed Anomalies', delta: factorDeltas.speedPoints },
              { label: 'Stops & GPS Drops', delta: factorDeltas.stopGpsPoints },
              { label: 'Compliance (Driver/Veh)', delta: factorDeltas.compliancePoints },
              { label: 'Corridor Complexity', delta: factorDeltas.complexityPoints },
            ].map((f, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-slate-900 border border-slate-800/80 space-y-1 text-center">
                <span className="text-[10px] text-slate-400 block truncate" title={f.label}>
                  {f.label}
                </span>
                <span
                  className={`text-base font-black ${
                    f.delta > 0
                      ? 'text-rose-400'
                      : f.delta < 0
                      ? 'text-emerald-400'
                      : 'text-slate-400'
                  }`}
                >
                  {f.delta > 0 ? `+${f.delta}` : f.delta} pts
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Snapshot Log Table */}
      {snapshots.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-white">Chronological Snapshot Log</h3>
          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Corridor</th>
                  <th className="px-4 py-3">Risk Score</th>
                  <th className="px-4 py-3">Severity Level</th>
                  <th className="px-4 py-3">Deviations</th>
                  <th className="px-4 py-3">Speed Violations</th>
                  <th className="px-4 py-3">Total Incidents</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/60 font-mono">
                {snapshots.slice().reverse().map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/50 transition">
                    <td className="px-4 py-3 text-slate-300">
                      {new Date(s.evaluatedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-bold text-white">{s.routeCode}</td>
                    <td className="px-4 py-3 font-bold text-indigo-400">{s.riskScore} / 100</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                          s.riskLevel === 'CRITICAL'
                            ? 'bg-rose-500/20 text-rose-300'
                            : s.riskLevel === 'HIGH'
                            ? 'bg-orange-500/20 text-orange-300'
                            : s.riskLevel === 'MEDIUM'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-emerald-500/20 text-emerald-300'
                        }`}
                      >
                        {s.riskLevel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{s.deviationPoints} pts</td>
                    <td className="px-4 py-3 text-slate-400">{s.speedPoints} pts</td>
                    <td className="px-4 py-3 text-slate-400">{s.totalEvents}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
