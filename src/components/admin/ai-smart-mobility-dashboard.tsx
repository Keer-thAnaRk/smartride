'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Sparkles,
  TrendingUp,
  Users,
  Car,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Clock,
  MapPin,
  Compass,
  Layers,
  ArrowRight,
  Info,
  Sliders,
  Check,
  X,
  BrainCircuit,
  Activity,
  GitMerge,
  BarChart3,
  HelpCircle,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

interface SummaryKPIs {
  forecastDate: string;
  totalPredictedDemand: number;
  expectedOccupancy: number;
  highDemandRoutes: number;
  criticalDemandRoutes: number;
  additionalShuttlesRecommended: number;
  routesAnalyzed: number;
}

interface WeeklyForecastItem {
  day: string;
  historicalDemand: number;
  predictedDemand: number;
}

interface RoutePrediction {
  routeId: string;
  routeCode: string;
  routeName: string;
  shift: 'MORNING_PICKUP' | 'EVENING_DROP';
  predictionDate: string;
  predictedDemand: number;
  vehicleCapacity: number;
  routeCapacity: number;
  predictedOccupancy: number;
  status: 'LOW' | 'NORMAL' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  demandLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  historicalAverageDemand: number;
  demandDelta: number;
  dataQualityStatus: 'HIGH_DATA_QUALITY' | 'MEDIUM_DATA_QUALITY' | 'LOW_DATA_QUALITY' | 'INSUFFICIENT_DATA';
  recommendation: string;
  additionalShuttles: number;
  requiredVehicles: number;
  reliability: 'HIGH' | 'MEDIUM' | 'LOW';
  reliabilityReason: string;
  explainability: {
    title: string;
    factors: string[];
    topDriver: string;
  };
  stopDemands: {
    stopName: string;
    predictedPassengers: number;
    capacityPressure: 'Normal' | 'Moderate' | 'High' | 'Critical';
    utilizationPercent: number;
    classification: 'HIGH_DEMAND_STOP' | 'LOW_DEMAND_STOP' | 'NORMAL_DEMAND_STOP';
    recommendation: string;
  }[] | { status: 'STOP_ANALYSIS_UNAVAILABLE'; message: string };
}

interface StopDemand {
  stopName: string;
  predictedPassengers: number;
  capacityPressure: 'Normal' | 'Moderate' | 'High' | 'Critical';
  utilizationPercent: number;
  classification: 'HIGH_DEMAND_STOP' | 'LOW_DEMAND_STOP' | 'NORMAL_DEMAND_STOP';
  recommendation: string;
}

interface ConsolidationRec {
  candidateType: 'POTENTIAL CONSOLIDATION CANDIDATE';
  routeA: { code: string; name: string; occupancy: number; predictedDemand: number };
  routeB: { code: string; name: string; occupancy: number; predictedDemand: number };
  sharedCorridor: string;
  combinedDemand: number;
  recommendedVehicleCapacity: number;
  rationale: string;
  adminActionNote: string;
}

interface ModelMetrics {
  mae: number;
  rmse: number;
  r2: number;
  trainSamplesCount: number;
  testSamplesCount: number;
  evaluationStatus?: 'EVALUATED' | 'EVALUATION_UNAVAILABLE';
  featureImportances: { feature: string; importance: number; percentage: number }[];
  trainedAt: string;
}

export default function AiSmartMobilityDashboard() {
  const [loading, setLoading] = useState(true);
  const [retraining, setRetraining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SummaryKPIs | null>(null);
  const [weeklyForecast, setWeeklyForecast] = useState<WeeklyForecastItem[]>([]);
  const [routePredictions, setRoutePredictions] = useState<RoutePrediction[]>([]);
  const [topStops, setTopStops] = useState<StopDemand[]>([]);
  const [consolidationRecs, setConsolidationRecs] = useState<ConsolidationRec[]>([]);
  const [metrics, setMetrics] = useState<ModelMetrics | null>(null);
  const [selectedShift, setSelectedShift] = useState<'ALL' | 'MORNING_PICKUP' | 'EVENING_DROP'>('ALL');
  const [selectedRouteDetail, setSelectedRouteDetail] = useState<RoutePrediction | null>(null);
  const [insufficientData, setInsufficientData] = useState<{ message: string; required: number; available: number } | null>(null);

  const fetchDemandIntelligence = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get('/api/ai/demand-prediction');
      if (res.data.status === 'INSUFFICIENT_DATA') {
        setInsufficientData({
          message: res.data.message,
          required: res.data.requiredRecords || 20,
          available: res.data.availableRecords || 0,
        });
        setLoading(false);
        return;
      }

      setInsufficientData(null);
      setSummary(res.data.summary);
      setWeeklyForecast(res.data.weeklyForecast || []);
      setRoutePredictions(res.data.routePredictions || []);
      setTopStops(res.data.topStopDemands || []);
      setConsolidationRecs(res.data.consolidationRecommendations || []);
      setMetrics(res.data.modelMetrics);

      if (res.data.routePredictions && res.data.routePredictions.length > 0 && !selectedRouteDetail) {
        setSelectedRouteDetail(res.data.routePredictions[0]);
      }
    } catch (err: any) {
      console.error('Failed to load AI demand intelligence:', err);
      setError(err.response?.data?.error || err.message || 'Failed to fetch demand intelligence');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDemandIntelligence();
  }, []);

  const handleRetrain = async () => {
    setRetraining(true);
    try {
      await axios.post('/api/ai/demand-prediction', { action: 'retrain' });
      await fetchDemandIntelligence();
    } catch (err: any) {
      alert('Model retraining failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setRetraining(false);
    }
  };

  const getDemandBadge = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-red-100 text-red-800 border border-red-200">CRITICAL</span>;
      case 'HIGH':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-100 text-amber-800 border border-amber-200">HIGH</span>;
      case 'MEDIUM':
      case 'NORMAL':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-blue-100 text-blue-800 border border-blue-200">MEDIUM</span>;
      case 'LOW':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-slate-100 text-slate-700 border border-slate-200">LOW</span>;
      default:
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-slate-100 text-slate-700">{level}</span>;
    }
  };

  const filteredPredictions = routePredictions.filter((p) => {
    if (selectedShift === 'ALL') return true;
    return p.shift === selectedShift;
  });

  return (
    <div id="ai-smart-mobility-dashboard" className="space-y-6">
      {/* Mandatory Operational Disclaimer Notice */}
      <div className="bg-slate-900 text-slate-200 p-4 rounded-xl border border-slate-800 flex items-start gap-3 text-sm">
        <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-white">AI-Based Route & Demand Intelligence (Phase 3 Step 5):</span>{' '}
          This module provides data-driven forecasts and operational recommendations. It does not automatically modify
          routes, vehicles, schedules, subscriptions, or passenger bookings. All operational actions remain with the Admin.
        </div>
      </div>

      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-xl text-white shadow-md shadow-indigo-100">
            <BrainCircuit className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              Smart Route & Demand Intelligence
              <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded-full font-semibold">
                Random Forest Regressor
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Forecast Date: {summary?.forecastDate || 'Tomorrow'} • Target: Corporate Corridor Mobility
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <button
            onClick={fetchDemandIntelligence}
            disabled={loading || retraining}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            onClick={handleRetrain}
            disabled={loading || retraining}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition"
          >
            <Sparkles className={`w-3.5 h-3.5 ${retraining ? 'animate-spin' : ''}`} />
            {retraining ? 'Retraining...' : 'Retrain Model'}
          </button>
        </div>
      </div>

      {/* Insufficient Data State */}
      {insufficientData && (
        <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
          <h3 className="text-base font-bold text-amber-900">Insufficient Historical Mobility Records</h3>
          <p className="text-sm text-amber-800 max-w-lg mx-auto">
            {insufficientData.message}
          </p>
          <div className="flex justify-center gap-6 text-xs text-amber-900 font-medium pt-2">
            <span>Available Records: <strong>{insufficientData.available}</strong></span>
            <span>Required Threshold: <strong>{insufficientData.required}</strong></span>
          </div>
        </div>
      )}

      {/* 8 Top KPI Metric Cards */}
      {summary && metrics && !insufficientData && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-medium text-slate-500 block truncate">Routes Analyzed</span>
            <span className="text-lg font-bold text-slate-900 mt-1 block">{summary.routesAnalyzed || 3}</span>
            <span className="text-[10px] text-slate-400">active corridors</span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-medium text-slate-500 block truncate">High Demand</span>
            <span className="text-lg font-bold text-amber-600 mt-1 block">{summary.highDemandRoutes}</span>
            <span className="text-[10px] text-amber-500">70% - 89% occ</span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-medium text-slate-500 block truncate">Critical Demand</span>
            <span className="text-lg font-bold text-red-600 mt-1 block">{summary.criticalDemandRoutes || 0}</span>
            <span className="text-[10px] text-red-500">≥ 90% occ</span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-medium text-slate-500 block truncate">Avg Occupancy</span>
            <span className="text-lg font-bold text-indigo-600 mt-1 block">{summary.expectedOccupancy}%</span>
            <span className="text-[10px] text-slate-400">fleet average</span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-medium text-slate-500 block truncate">Model MAE</span>
            <span className="text-lg font-bold text-emerald-600 mt-1 block">{metrics.mae}</span>
            <span className="text-[10px] text-slate-400">avg pax error</span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-medium text-slate-500 block truncate">Model RMSE</span>
            <span className="text-lg font-bold text-emerald-600 mt-1 block">{metrics.rmse}</span>
            <span className="text-[10px] text-slate-400">root sq error</span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-medium text-slate-500 block truncate">Model R²</span>
            <span className="text-lg font-bold text-indigo-600 mt-1 block">{metrics.r2}</span>
            <span className="text-[10px] text-emerald-600 font-medium">good fit</span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-medium text-slate-500 block truncate">Training Records</span>
            <span className="text-lg font-bold text-slate-900 mt-1 block">{metrics.trainSamplesCount + metrics.testSamplesCount}</span>
            <span className="text-[10px] text-slate-400">80/20 train/test</span>
          </div>
        </div>
      )}

      {/* Visualizations Section */}
      {weeklyForecast.length > 0 && !insufficientData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Weekly Forecast Chart */}
          <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Historical vs Predicted Weekly Corridor Demand</h3>
                <p className="text-xs text-slate-500">Compares baseline weekday traffic with Random Forest ML predictions</p>
              </div>
              <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded font-medium">
                Passengers / Day
              </span>
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={weeklyForecast} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="historicalDemand" name="Historical Baseline" fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={28} />
                  <Line type="monotone" dataKey="predictedDemand" name="Predicted Demand (ML)" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#6366f1' }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Feature Importances Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-1">Model Feature Importances</h3>
            <p className="text-xs text-slate-500 mb-4">Variance reduction contribution per feature</p>

            <div className="space-y-3">
              {(metrics?.featureImportances || []).slice(0, 5).map((f, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium text-slate-700">
                    <span className="truncate">{f.feature}</span>
                    <span className="text-slate-500">{f.percentage}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-indigo-600 h-1.5 rounded-full"
                      style={{ width: `${Math.min(100, f.percentage * 2)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Route Demand Analysis Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Route Demand Forecast & Capacity Recommendations</h3>
            <p className="text-xs text-slate-500">Corridor-by-corridor breakdown of predicted demand and occupancy</p>
          </div>

          {/* Shift filter tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs">
            <button
              onClick={() => setSelectedShift('ALL')}
              className={`px-3 py-1.5 rounded-md font-medium transition ${
                selectedShift === 'ALL' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Shifts
            </button>
            <button
              onClick={() => setSelectedShift('MORNING_PICKUP')}
              className={`px-3 py-1.5 rounded-md font-medium transition ${
                selectedShift === 'MORNING_PICKUP' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Morning Pickup
            </button>
            <button
              onClick={() => setSelectedShift('EVENING_DROP')}
              className={`px-3 py-1.5 rounded-md font-medium transition ${
                selectedShift === 'EVENING_DROP' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Evening Drop
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="py-3 px-4">Route</th>
                <th className="py-3 px-3">Shift</th>
                <th className="py-3 px-3">Predicted Demand</th>
                <th className="py-3 px-3">Capacity</th>
                <th className="py-3 px-3">Occupancy</th>
                <th className="py-3 px-3">Demand Level</th>
                <th className="py-3 px-3">Hist Avg</th>
                <th className="py-3 px-3">Delta</th>
                <th className="py-3 px-4">Operational Recommendation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredPredictions.map((pred, idx) => (
                <tr
                  key={idx}
                  onClick={() => setSelectedRouteDetail(pred)}
                  className={`hover:bg-slate-50 cursor-pointer transition ${
                    selectedRouteDetail?.routeCode === pred.routeCode && selectedRouteDetail?.shift === pred.shift
                      ? 'bg-indigo-50/50'
                      : ''
                  }`}
                >
                  <td className="py-3.5 px-4 font-medium text-slate-900">
                    <span className="font-bold text-indigo-600">{pred.routeCode}</span>
                    <span className="block text-[11px] text-slate-500 truncate max-w-xs">{pred.routeName}</span>
                  </td>
                  <td className="py-3.5 px-3 text-slate-600">
                    {pred.shift === 'MORNING_PICKUP' ? 'Morning AM' : 'Evening PM'}
                  </td>
                  <td className="py-3.5 px-3 font-semibold text-slate-900">
                    {pred.predictedDemand} pax
                  </td>
                  <td className="py-3.5 px-3 text-slate-500">
                    {pred.vehicleCapacity} seats
                  </td>
                  <td className="py-3.5 px-3 font-semibold">
                    <span
                      className={`${
                        pred.predictedOccupancy >= 90
                          ? 'text-red-600'
                          : pred.predictedOccupancy >= 70
                          ? 'text-amber-600'
                          : 'text-slate-700'
                      }`}
                    >
                      {pred.predictedOccupancy}%
                    </span>
                  </td>
                  <td className="py-3.5 px-3">
                    {getDemandBadge(pred.demandLevel || pred.status)}
                  </td>
                  <td className="py-3.5 px-3 text-slate-500">
                    {pred.historicalAverageDemand}
                  </td>
                  <td className="py-3.5 px-3">
                    <span
                      className={`font-semibold ${
                        pred.demandDelta > 0
                          ? 'text-emerald-600'
                          : pred.demandDelta < 0
                          ? 'text-slate-500'
                          : 'text-slate-400'
                      }`}
                    >
                      {pred.demandDelta > 0 ? `+${pred.demandDelta}` : pred.demandDelta}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 max-w-sm truncate">
                    {pred.recommendation}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Route Explainability & Stop Pressure Drawer */}
      {selectedRouteDetail && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-600" />
                Model Explainability: {selectedRouteDetail.routeCode} ({selectedRouteDetail.shift === 'MORNING_PICKUP' ? 'AM' : 'PM'})
              </h4>
              <span className="text-xs text-slate-400">Data Quality: {selectedRouteDetail.dataQualityStatus}</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl mb-4 border border-slate-100">
              <span className="text-[11px] font-semibold text-slate-500 block uppercase">Primary Driver</span>
              <span className="text-sm font-bold text-slate-800">{selectedRouteDetail.explainability.topDriver}</span>
            </div>

            <ul className="space-y-2 text-xs text-slate-600">
              {selectedRouteDetail.explainability.factors.map((f, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 mt-1.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-indigo-600" />
              Stop-Level Passenger Pressure Breakdown
            </h4>

            {Array.isArray(selectedRouteDetail.stopDemands) && selectedRouteDetail.stopDemands.length > 0 ? (
              <div className="space-y-2">
                {selectedRouteDetail.stopDemands.map((s, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg text-xs border border-slate-100">
                    <div>
                      <span className="font-semibold text-slate-800">{s.stopName}</span>
                      <span className="block text-[10px] text-slate-500">{s.recommendation}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-slate-900">{s.predictedPassengers} pax</span>
                      <span
                        className={`block text-[10px] font-semibold ${
                          s.classification === 'HIGH_DEMAND_STOP'
                            ? 'text-red-600'
                            : s.classification === 'LOW_DEMAND_STOP'
                            ? 'text-slate-400'
                            : 'text-emerald-600'
                        }`}
                      >
                        {s.classification === 'HIGH_DEMAND_STOP' ? 'High Demand Stop' : s.classification === 'LOW_DEMAND_STOP' ? 'Low Demand Stop' : 'Normal'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-500">
                Stop-level passenger telemetry is unavailable for this corridor.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Potential Route Consolidation Candidates (Descriptive Advisory) */}
      {consolidationRecs.length > 0 && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <GitMerge className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">Potential Route Consolidation Candidates</h3>
              <p className="text-xs text-slate-500">Advisory recommendations only — Admin review required before altering schedules</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {consolidationRecs.map((rec, idx) => (
              <div key={idx} className="p-4 bg-indigo-50/40 rounded-xl border border-indigo-100 space-y-2 text-xs">
                <div className="flex items-center justify-between font-semibold text-indigo-900">
                  <span>{rec.routeA.code} ({rec.routeA.occupancy}%) + {rec.routeB.code} ({rec.routeB.occupancy}%)</span>
                  <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">
                    {rec.candidateType}
                  </span>
                </div>
                <p className="text-slate-600">{rec.rationale}</p>
                <div className="text-[11px] text-slate-500 font-medium pt-1">
                  Combined Demand: <strong>{rec.combinedDemand} pax</strong> • Recommended Shuttle Capacity: <strong>{rec.recommendedVehicleCapacity} seats</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
