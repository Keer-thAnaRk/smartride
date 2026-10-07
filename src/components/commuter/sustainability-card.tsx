'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Leaf,
  Car,
  TrendingUp,
  Percent,
  Info,
  ChevronRight,
  ShieldCheck,
  TreeDeciduous,
  Wind,
  Sparkles,
  HelpCircle,
  X,
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
import { CommuterSustainabilitySummary } from '@/lib/sustainability/carbon-types';

interface SustainabilityCardProps {
  theme?: 'light' | 'dark';
}

export default function SustainabilityCard({ theme = 'light' }: SustainabilityCardProps) {
  const [data, setData] = useState<CommuterSustainabilitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFormulaModal, setShowFormulaModal] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const res = await axios.get('/api/commuter/sustainability');
        if (res.data?.success) {
          setData(res.data.summary);
        }
      } catch (err) {
        console.error('Error loading commuter sustainability stats:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Compute equivalent trees (approx 1.8 kg CO2 absorbed per mature tree per month)
  const equivalentTrees = data ? Math.max(1, Math.round(data.estimatedCo2AvoidedKg / 1.8)) : 0;

  return (
    <div className="bg-white rounded-3xl p-6 border border-emerald-100 shadow-sm relative overflow-hidden space-y-5">
      {/* Background subtle leaf glow */}
      <div className="absolute -top-12 -right-12 w-44 h-44 bg-emerald-50 rounded-full blur-2xl pointer-events-none -z-0" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 relative z-10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center font-bold">
            <Leaf className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-bold text-slate-900">Green Commute Impact</h2>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                Eco-Sync
              </span>
            </div>
            <p className="text-xs text-slate-500">Your personal contribution to corridor decarbonization</p>
          </div>
        </div>

        <button
          onClick={() => setShowFormulaModal(true)}
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100/70 px-3 py-1.5 rounded-xl transition"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>How this is estimated</span>
        </button>
      </div>

      {loading ? (
        <div className="py-8 flex items-center justify-center space-x-2 text-slate-400">
          <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-medium">Evaluating commute telemetry...</span>
        </div>
      ) : data ? (
        <div className="space-y-5 relative z-10">
          {/* 4 Core KPI Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Tile 1: CO2 Avoided */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50/50 border border-emerald-200/60 flex flex-col justify-between">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                <Wind className="w-3.5 h-3.5 text-emerald-600" />
                CO₂ Avoided
              </span>
              <div className="mt-2">
                <span className="text-2xl sm:text-3xl font-black text-emerald-950">
                  {data.estimatedCo2AvoidedKg}
                </span>
                <span className="text-xs font-bold text-emerald-700 ml-1">kg CO₂e</span>
              </div>
              <span className="text-[10px] text-emerald-700/80 mt-1">vs single-driver car</span>
            </div>

            {/* Tile 2: Cars Avoided */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 flex flex-col justify-between">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                <Car className="w-3.5 h-3.5 text-slate-500" />
                Cars Off Road
              </span>
              <div className="mt-2">
                <span className="text-2xl sm:text-3xl font-black text-slate-900">
                  {data.estimatedCarsAvoided}
                </span>
                <span className="text-xs font-bold text-slate-500 ml-1">trips</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1">road space saved</span>
            </div>

            {/* Tile 3: Shared Commute % */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 flex flex-col justify-between">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                <Percent className="w-3.5 h-3.5 text-slate-500" />
                Shared Mode %
              </span>
              <div className="mt-2">
                <span className="text-2xl sm:text-3xl font-black text-slate-900">
                  {data.sharedCommutePercentage}%
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2">
                <div
                  className="bg-emerald-500 h-1.5 rounded-full"
                  style={{ width: `${data.sharedCommutePercentage}%` }}
                />
              </div>
            </div>

            {/* Tile 4: Total Shared Trips */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 flex flex-col justify-between">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-slate-500" />
                Shared Rides
              </span>
              <div className="mt-2">
                <span className="text-2xl sm:text-3xl font-black text-slate-900">
                  {data.totalSharedTrips}
                </span>
                <span className="text-xs font-bold text-slate-500 ml-1">rides</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1">{data.totalDistanceKm} km traveled</span>
            </div>
          </div>

          {/* Equivalency Milestone Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-900 via-slate-900 to-emerald-950 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-400/20 border border-emerald-400/40 text-emerald-400 flex items-center justify-center font-black">
                <TreeDeciduous className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <span className="text-xs font-bold text-emerald-300 block">Corridor Equivalency</span>
                <p className="text-xs text-slate-200">
                  Your <strong className="text-emerald-400">{data.estimatedCo2AvoidedKg} kg</strong> avoided CO₂ is equal to the monthly absorption of approximately <strong className="text-white font-bold">{equivalentTrees} mature urban trees</strong>!
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 whitespace-nowrap">
              Active Commuter Score
            </span>
          </div>

          {/* Monthly Trend Chart */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">Monthly Avoided CO₂ Trend (kg CO₂e)</span>
              <span className="text-[11px] text-slate-400">6-Month History</span>
            </div>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthlyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(val: any) => [`${val} kg CO₂e`, 'Avoided CO₂']}
                    contentStyle={{ backgroundColor: '#0F172A', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                  />
                  <Bar dataKey="avoidedCo2Kg" fill="#10B981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Mandatory Transparent Scientific Caveat Banner */}
          <div className="p-3 rounded-xl bg-slate-100/80 border border-slate-200 text-slate-600 flex items-start space-x-2.5">
            <Info className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
            <p className="text-[11px] leading-relaxed">
              <strong>Transparent Methodology:</strong> {data.disclaimer}
            </p>
          </div>
        </div>
      ) : (
        <div className="text-xs text-slate-400 text-center py-4">No sustainability telemetry available.</div>
      )}

      {/* Modal: How This Is Calculated */}
      {showFormulaModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Leaf className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">Carbon Modeling Methodology</h3>
              </div>
              <button
                onClick={() => setShowFormulaModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-3">
              <p>
                SmartRide employs an exact, deterministic model comparing private car commute emissions against allocated shared shuttle travel:
              </p>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 font-mono text-[11px] text-slate-800 space-y-1">
                <div>1. Baseline Emissions = Distance (km) × 0.180 kg/km</div>
                <div>2. Shuttle Total = Distance (km) × 0.260 kg/km</div>
                <div>3. Your Share = Shuttle Total ÷ Passengers (N)</div>
                <div className="font-bold text-emerald-700">4. Net CO₂ Avoided = Baseline - Your Share</div>
              </div>
              <p>
                <strong>Zero Greenwashing Guarantee:</strong> These calculations reflect mathematical estimations based on verified corridor distances and standard vehicular emission constants, not tailpipe sensor telemetry.
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowFormulaModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
