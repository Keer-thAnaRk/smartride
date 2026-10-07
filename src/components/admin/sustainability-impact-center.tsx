'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Leaf,
  Wind,
  Car,
  TrendingUp,
  Percent,
  Award,
  Settings,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Info,
  Layers,
  Sparkles,
  ChevronRight,
  Sliders,
  Save,
  X,
  ShieldCheck,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  FleetSustainabilitySummary,
  RouteSustainabilityMetric,
} from '@/lib/sustainability/carbon-types';
import { SustainabilityConfig } from '@/lib/sustainability/carbon-config';

export default function SustainabilityImpactCenter() {
  const [summary, setSummary] = useState<FleetSustainabilitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSuccess, setConfigSuccess] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  // Configuration edit form state
  const [editForm, setEditForm] = useState({
    baselineCarEmissionKgPerKm: 0.18,
    baselineCarOccupancy: 1.15,
    shuttleSedanKgPerKm: 0.18,
    shuttleSuvKgPerKm: 0.22,
    shuttleVanKgPerKm: 0.26,
    shuttleMiniBusKgPerKm: 0.32,
    workingDaysPerMonth: 22,
    tripsPerWorkingDay: 2,
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/admin/sustainability');
      if (res.data?.success) {
        setSummary(res.data.summary);
        if (res.data.summary.activeConfig) {
          const cfg = res.data.summary.activeConfig;
          setEditForm({
            baselineCarEmissionKgPerKm: cfg.baselineCarEmissionKgPerKm,
            baselineCarOccupancy: cfg.baselineCarOccupancy,
            shuttleSedanKgPerKm: cfg.shuttleEmissionsKgPerKm.SEDAN,
            shuttleSuvKgPerKm: cfg.shuttleEmissionsKgPerKm.SUV,
            shuttleVanKgPerKm: cfg.shuttleEmissionsKgPerKm.VAN,
            shuttleMiniBusKgPerKm: cfg.shuttleEmissionsKgPerKm.MINI_BUS,
            workingDaysPerMonth: cfg.workingDaysPerMonth,
            tripsPerWorkingDay: cfg.tripsPerWorkingDay,
          });
        }
      }
    } catch (err) {
      console.error('Failed to load fleet sustainability summary:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingConfig(true);
      setConfigSuccess(null);
      setConfigError(null);
      const res = await axios.post('/api/admin/sustainability/config', editForm);
      if (res.data?.success) {
        setConfigSuccess(res.data.message || 'Configuration updated successfully');
        setTimeout(() => {
          setShowConfigModal(false);
          setConfigSuccess(null);
          loadData();
        }, 1200);
      }
    } catch (err: any) {
      setConfigError(err.response?.data?.error || 'Failed to update configuration');
    } finally {
      setSavingConfig(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center font-black text-xl">
            <Leaf className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-black text-slate-900">
                Sustainability & Carbon Impact Center
              </h2>
              <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
                {summary?.activeConfig?.modelVersion || 'Model v1.0'}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Fleet-wide corridor emission modeling, private car substitution & assumption auditing
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowConfigModal(true)}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Tune Assumptions</span>
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
            title="Refresh metrics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
          </button>
        </div>
      </div>

      {loading && !summary ? (
        <div className="py-12 flex items-center justify-center space-x-2 text-slate-400">
          <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold">Computing corridor carbon models...</span>
        </div>
      ) : summary ? (
        <div className="space-y-6">
          {/* 4 Fleet-Level KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1 */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-200/80 space-y-2">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                <Wind className="w-4 h-4 text-emerald-600" />
                Total Fleet CO₂ Avoided
              </span>
              <div className="flex items-baseline space-x-1.5">
                <span className="text-3xl font-black text-emerald-950">
                  {summary.fleetTotalCo2AvoidedKg.toLocaleString()}
                </span>
                <span className="text-xs font-bold text-emerald-700">kg CO₂e</span>
              </div>
              <span className="text-[11px] text-emerald-700 block">
                Across {summary.fleetTotalSharedTrips.toLocaleString()} completed corridor runs
              </span>
            </div>

            {/* KPI 2 */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <Car className="w-4 h-4 text-slate-500" />
                Cars Off Road
              </span>
              <div className="flex items-baseline space-x-1.5">
                <span className="text-3xl font-black text-slate-900">
                  {summary.fleetCarsAvoidedCount.toLocaleString()}
                </span>
                <span className="text-xs font-bold text-slate-500">trips substituted</span>
              </div>
              <span className="text-[11px] text-slate-500 block">
                Substituted private car trips
              </span>
            </div>

            {/* KPI 3 */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-slate-500" />
                Avg Savings / Commuter
              </span>
              <div className="flex items-baseline space-x-1.5">
                <span className="text-3xl font-black text-slate-900">
                  {summary.fleetAvgCo2SavingsPerCommuter}
                </span>
                <span className="text-xs font-bold text-slate-500">kg CO₂e</span>
              </div>
              <span className="text-[11px] text-slate-500 block">
                Across {summary.activeCommutersCount} registered subscribers
              </span>
            </div>

            {/* KPI 4 */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <Percent className="w-4 h-4 text-slate-500" />
                Shared Mode Adoption
              </span>
              <div className="flex items-baseline space-x-1.5">
                <span className="text-3xl font-black text-slate-900">
                  {summary.fleetSharedCommutePercent}%
                </span>
              </div>
              <span className="text-[11px] text-slate-500 block">
                Vs standard monthly solo driving
              </span>
            </div>
          </div>

          {/* 6-Month Fleet Carbon Abatement Chart */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Fleet Carbon Abatement Progression</h3>
                <p className="text-xs text-slate-500">Monthly estimated kg CO₂e avoided across tech park corridors</p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg">
                Steady Growth
              </span>
            </div>

            <div className="h-48 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.monthlyTrend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(val: any) => [`${Number(val).toLocaleString()} kg CO₂e`, 'Avoided Emissions']}
                    contentStyle={{ backgroundColor: '#0F172A', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                  />
                  <Bar dataKey="avoidedCo2Kg" fill="#059669" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Route Sustainability Leaderboard */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Award className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Corridor Sustainability Leaderboard</h3>
              </div>
              <span className="text-xs text-slate-500">Ranked by avoided carbon</span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Corridor Route</th>
                    <th className="py-3 px-4">Distance</th>
                    <th className="py-3 px-4">Runs</th>
                    <th className="py-3 px-4">Avg Riders</th>
                    <th className="py-3 px-4">Avoided CO₂</th>
                    <th className="py-3 px-4">Cars Displaced</th>
                    <th className="py-3 px-4">Efficiency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {summary.routeLeaderboard.map((r, idx) => (
                    <tr key={r.routeId} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        <div className="flex items-center space-x-2">
                          <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-[10px]">
                            {idx + 1}
                          </span>
                          <div>
                            <span className="font-bold text-slate-900 block">{r.routeCode}</span>
                            <span className="text-[11px] text-slate-500 truncate max-w-xs block">{r.routeName}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-medium">{r.distanceKm} km</td>
                      <td className="py-3 px-4 text-slate-600 font-medium">{r.totalTrips}</td>
                      <td className="py-3 px-4 text-slate-700 font-bold">{r.avgOccupancy}</td>
                      <td className="py-3 px-4 font-bold text-emerald-700">
                        {r.avoidedCo2Kg.toLocaleString()} kg
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">{r.carsAvoided}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            r.efficiencyRating === 'EXCELLENT'
                              ? 'bg-emerald-100 text-emerald-800'
                              : r.efficiencyRating === 'GOOD'
                              ? 'bg-teal-100 text-teal-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {r.efficiencyRating}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Rule-Based Sustainability Insights */}
          {summary.insights.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Intelligent Sustainability Insights</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {summary.insights.map((insight) => (
                  <div
                    key={insight.id}
                    className={`p-4 rounded-2xl border space-y-1.5 ${
                      insight.type === 'ACHIEVEMENT' || insight.type === 'CORRIDOR_LEADER'
                        ? 'bg-emerald-50/50 border-emerald-200/80'
                        : 'bg-amber-50/50 border-amber-200/80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">{insight.title}</span>
                      {insight.metric && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700">
                          {insight.metric}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{insight.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mandatory Methodology Disclaimer */}
          <div className="p-3.5 rounded-2xl bg-slate-100 border border-slate-200 flex items-start space-x-2.5 text-slate-600">
            <Info className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs leading-relaxed">
              <strong>Methodological Transparency:</strong> {summary.disclaimer} Calculations reference verified corridor lengths and configurable baseline emission factors.
            </p>
          </div>
        </div>
      ) : null}

      {/* Configuration & Assumptions Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-slate-200 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Sliders className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">Tune Sustainability Assumptions</h3>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {configSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-semibold flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{configSuccess}</span>
              </div>
            )}
            {configError && (
              <div className="p-3 rounded-xl bg-red-50 text-red-800 text-xs font-semibold flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span>{configError}</span>
              </div>
            )}

            <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Baseline Car Factor (kg CO₂e/km)</label>
                <input
                  type="number"
                  step="0.005"
                  value={editForm.baselineCarEmissionKgPerKm}
                  onChange={(e) =>
                    setEditForm({ ...editForm, baselineCarEmissionKgPerKm: parseFloat(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
                <span className="text-[10px] text-slate-400">Default: 0.180 kg/km (CPCB / ARAI standard)</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Van Factor (kg/km)</label>
                  <input
                    type="number"
                    step="0.005"
                    value={editForm.shuttleVanKgPerKm}
                    onChange={(e) =>
                      setEditForm({ ...editForm, shuttleVanKgPerKm: parseFloat(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">SUV Factor (kg/km)</label>
                  <input
                    type="number"
                    step="0.005"
                    value={editForm.shuttleSuvKgPerKm}
                    onChange={(e) =>
                      setEditForm({ ...editForm, shuttleSuvKgPerKm: parseFloat(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Working Days / Month</label>
                  <input
                    type="number"
                    value={editForm.workingDaysPerMonth}
                    onChange={(e) =>
                      setEditForm({ ...editForm, workingDaysPerMonth: parseInt(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Daily Commute Legs</label>
                  <input
                    type="number"
                    value={editForm.tripsPerWorkingDay}
                    onChange={(e) =>
                      setEditForm({ ...editForm, tripsPerWorkingDay: parseInt(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-[11px]">
                Saving these assumptions will automatically increment the model version (e.g. {summary?.activeConfig?.modelVersion || 'v1.0'} → v1.1) to preserve historical data auditability.
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingConfig}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md shadow-emerald-500/20 transition disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{savingConfig ? 'Saving...' : 'Save & Bump Model'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
