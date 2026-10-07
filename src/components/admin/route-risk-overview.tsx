'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Compass,
  ChevronRight,
  Info,
  Sliders,
  CheckCircle2,
  Clock,
} from 'lucide-react';

interface RouteRiskItem {
  routeId: string;
  routeCode: string;
  routeName: string;
  origin: string;
  destination: string;
  distanceKm: number;
  score: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  badgeColor: 'emerald' | 'amber' | 'orange' | 'rose';
  summary: string;
  factors: Array<{
    name: string;
    description: string;
    value: number | string;
    contribution: number;
    severity: string;
  }>;
  metrics: {
    totalIncidents: number;
    activeIncidents: number;
    routeDeviations: number;
    speedAnomalies: number;
    stationaryLongStops: number;
    sosAlerts: number;
  };
  assignedDriver?: {
    name: string;
    isVerified: boolean;
  } | null;
  assignedVehicle?: {
    model: string;
    licensePlate: string;
    isApproved: boolean;
  } | null;
}

export default function RouteRiskOverview() {
  const [routes, setRoutes] = useState<RouteRiskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoute, setSelectedRoute] = useState<RouteRiskItem | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [filterLevel, setFilterLevel] = useState<string>('ALL');

  const fetchRiskData = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/safety/route-risk');
      if (res.data?.success && Array.isArray(res.data.routes)) {
        setRoutes(res.data.routes);
        setLastUpdated(res.data.calculatedAt || new Date().toISOString());
      }
    } catch (err) {
      console.warn('Could not load corridor route risk data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRiskData();
  }, []);

  const filteredRoutes = routes.filter((r) => {
    if (filterLevel === 'ALL') return true;
    return r.level === filterLevel;
  });

  const getBadgeClass = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'HIGH':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
      case 'MEDIUM':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'LOW':
      default:
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    }
  };

  const getProgressColor = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return 'bg-rose-500';
      case 'HIGH':
        return 'bg-orange-500';
      case 'MEDIUM':
        return 'bg-amber-500';
      case 'LOW':
      default:
        return 'bg-emerald-500';
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white tracking-wide">
              Corridor Route Risk Scores
            </h2>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Phase 3 Intelligence
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Deterministic corridor safety index derived from active route deviations, speed violations, stops, and compliance audits.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Level Filter */}
          <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
            {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((lvl) => (
              <button
                key={lvl}
                onClick={() => setFilterLevel(lvl)}
                className={`px-2.5 py-1 rounded-lg transition text-[11px] font-bold ${
                  filterLevel === lvl
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>

          <button
            onClick={fetchRiskData}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition disabled:opacity-50"
            title="Refresh Route Risks"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Corridor Cards Grid */}
      {loading && routes.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center space-y-2">
          <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
          <span className="text-xs text-slate-400">Evaluating corridor safety telemetry...</span>
        </div>
      ) : filteredRoutes.length === 0 ? (
        <div className="py-10 text-center text-xs text-slate-400">
          No corridors matching filter <span className="font-bold text-slate-300">"{filterLevel}"</span>.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRoutes.map((r) => {
            // Find active non-zero factors
            const notableFactors = r.factors.filter((f) => f.contribution > 0);

            return (
              <div
                key={r.routeId}
                onClick={() => setSelectedRoute(r)}
                className="bg-slate-950/70 hover:bg-slate-800/60 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 transition cursor-pointer flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2.5">
                  {/* Top Bar: Code + Level Badge */}
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-black text-white bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                      {r.routeCode}
                    </span>
                    <span
                      className={`text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${getBadgeClass(
                        r.level
                      )}`}
                    >
                      {r.level}
                    </span>
                  </div>

                  {/* Route Name & Corridor */}
                  <div>
                    <h3 className="font-bold text-sm text-white line-clamp-1">{r.routeName}</h3>
                    <p className="text-xs text-slate-400 flex items-center space-x-1 mt-0.5">
                      <Compass className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">
                        {r.origin} → {r.destination}
                      </span>
                    </p>
                  </div>

                  {/* Risk Score & Progress Bar */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Risk Score
                      </span>
                      <span className="font-mono text-lg font-black text-white">
                        {r.score}{' '}
                        <span className="text-xs font-normal text-slate-500">/ 100</span>
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${getProgressColor(
                          r.level
                        )}`}
                        style={{ width: `${Math.max(4, r.score)}%` }}
                      />
                    </div>
                  </div>

                  {/* Contributing Factors Bullet List */}
                  <div className="pt-2 border-t border-slate-800/60 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Contributing Factors
                    </span>
                    {notableFactors.length > 0 ? (
                      <ul className="text-xs space-y-0.5 text-slate-300">
                        {notableFactors.slice(0, 3).map((f, idx) => (
                          <li key={idx} className="flex items-center space-x-1.5">
                            <span className="text-indigo-400 font-bold">•</span>
                            <span className="truncate">{f.name} (+{f.contribution} pts)</span>
                          </li>
                        ))}
                        {notableFactors.length > 3 && (
                          <li className="text-[10px] text-slate-400 italic">
                            +{notableFactors.length - 3} more factor(s)
                          </li>
                        )}
                      </ul>
                    ) : (
                      <p className="text-xs text-emerald-400 flex items-center space-x-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Zero active safety anomalies</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Footer details */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  <span>{r.distanceKm} km corridor</span>
                  <div className="flex items-center space-x-1 text-indigo-400 font-semibold group-hover:text-indigo-300">
                    <span>Details</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer Timestamp */}
      {lastUpdated && (
        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/60">
          <span className="flex items-center space-x-1">
            <Clock className="w-3.5 h-3.5" />
            <span>Last calculated: {new Date(lastUpdated).toLocaleTimeString()}</span>
          </span>
          <span className="text-[10px] text-slate-400">
            Scale: 0 (Safe) to 100 (Critical)
          </span>
        </div>
      )}

      {/* Modal: Detailed Factor Breakdown for Selected Corridor */}
      {selectedRoute && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 text-white space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-xs font-black bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                    {selectedRoute.routeCode}
                  </span>
                  <span
                    className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${getBadgeClass(
                      selectedRoute.level
                    )}`}
                  >
                    {selectedRoute.level}
                  </span>
                </div>
                <h3 className="font-bold text-base text-white mt-1">
                  {selectedRoute.routeName}
                </h3>
                <p className="text-xs text-slate-400">
                  {selectedRoute.origin} → {selectedRoute.destination}
                </p>
              </div>

              <button
                onClick={() => setSelectedRoute(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              >
                ✕
              </button>
            </div>

            {/* Score Summary Banner */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Deterministic Route Risk
                </span>
                <span className="font-mono text-2xl font-black text-white">
                  {selectedRoute.score} <span className="text-xs text-slate-500 font-normal">/ 100</span>
                </span>
              </div>
              <p className="text-xs text-slate-300 max-w-[240px] text-right">
                {selectedRoute.summary}
              </p>
            </div>

            {/* Dimensional Breakdown */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Factor Contribution Breakdown
              </span>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {selectedRoute.factors.map((f, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs"
                  >
                    <div className="space-y-0.5 max-w-[320px]">
                      <span className="font-bold text-white block">{f.name}</span>
                      <span className="text-[11px] text-slate-400 block">{f.description}</span>
                    </div>
                    <span
                      className={`font-mono font-bold px-2 py-0.5 rounded ${
                        f.contribution > 0
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      +{f.contribution} pts
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Operational Assignment Info */}
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Assigned Driver</span>
                <span className="font-semibold text-slate-200">
                  {selectedRoute.assignedDriver?.name || 'Unassigned'}
                </span>
                <span className="text-[10px] text-slate-400 block">
                  {selectedRoute.assignedDriver?.isVerified ? '✓ Verified Driver' : '⚠️ Pending Verification'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Assigned Vehicle</span>
                <span className="font-semibold text-slate-200">
                  {selectedRoute.assignedVehicle?.model || 'Unassigned'}
                </span>
                <span className="text-[10px] text-slate-400 block">
                  {selectedRoute.assignedVehicle?.licensePlate || 'N/A'} (
                  {selectedRoute.assignedVehicle?.isApproved ? 'Approved' : 'Pending'})
                </span>
              </div>
            </div>

            <button
              onClick={() => setSelectedRoute(null)}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-xs text-white transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
