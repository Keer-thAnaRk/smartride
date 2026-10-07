'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Users,
  Car,
  Compass,
  Clock,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  UserCheck,
  Search,
  ArrowRight,
  ShieldAlert,
  Play,
  RotateCcw,
  Sparkles,
  Info,
} from 'lucide-react';
import {
  DriverCheckInInfo,
  FleetCoverageSummary,
  CandidateEvaluationResult,
} from '@/lib/operations/driver-coverage-types';
import StandbyRecommendationModal from './standby-recommendation-modal';

export default function DriverCoverageCenter() {
  const [summary, setSummary] = useState<FleetCoverageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [evaluatingTripId, setEvaluatingTripId] = useState<string | null>(null);
  const [activeEvaluation, setActiveEvaluation] =
    useState<CandidateEvaluationResult | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [simMessage, setSimMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadCoverageSummary = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await axios.get('/api/admin/driver-coverage');
      if (res.data?.success) {
        setSummary(res.data.summary);
      }
    } catch (err: any) {
      console.error('Error loading driver coverage summary:', err);
      setErrorMessage('Failed to load driver coverage summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCoverageSummary();
    const interval = setInterval(loadCoverageSummary, 12000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenStandbySearch = async (tripId: string, routeId?: string) => {
    try {
      setEvaluatingTripId(tripId);
      setErrorMessage(null);

      const res = await axios.post(
        `/api/admin/driver-coverage/${tripId}/recommend`,
        { routeId }
      );

      if (res.data?.success && res.data.evaluation) {
        setActiveEvaluation(res.data.evaluation);
      }
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.error || 'Failed to search standby driver recommendations'
      );
    } finally {
      setEvaluatingTripId(null);
    }
  };

  const handleSimulate = async (action: string) => {
    try {
      setSimulating(true);
      setSimMessage(null);

      const res = await axios.post('/api/admin/driver-coverage/simulate', {
        action,
        tripId: 'trip-sr101-today',
        routeCode: 'SR-101',
      });

      if (res.data?.success) {
        setSimMessage(res.data.message);
        await loadCoverageSummary();
      }
    } catch (err: any) {
      setSimMessage('Simulation error: ' + (err.response?.data?.error || err.message));
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xl">🔄</span>
            <h3 className="text-lg font-bold text-slate-900">Driver Coverage & No-Show Contingency</h3>
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
              Grace Period Monitor
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time check-in tracking, automated no-show detection, and standby driver ranking.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={loadCoverageSummary}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center space-x-1.5 text-xs font-bold transition-all disabled:opacity-50"
            title="Refresh Coverage Monitor"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Trips Today
          </div>
          <div className="text-2xl font-black text-slate-900">
            {summary?.tripsToday ?? '—'}
          </div>
          <div className="text-[11px] text-slate-400 font-medium">Scheduled corridors</div>
        </div>

        <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 space-y-1">
          <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
            Checked In
          </div>
          <div className="text-2xl font-black text-emerald-700">
            {summary?.checkedInCount ?? '—'}
          </div>
          <div className="text-[11px] text-emerald-600 font-medium">Captains confirmed</div>
        </div>

        <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200 space-y-1">
          <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
            Late (Grace)
          </div>
          <div className="text-2xl font-black text-amber-700">
            {summary?.lateCount ?? '—'}
          </div>
          <div className="text-[11px] text-amber-600 font-medium">Within 5 min grace</div>
        </div>

        <div className="bg-rose-50/70 p-4 rounded-2xl border border-rose-200 space-y-1">
          <div className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">
            No-Show Risk
          </div>
          <div className="text-2xl font-black text-rose-700">
            {summary?.noShowRiskCount ?? '—'}
          </div>
          <div className="text-[11px] text-rose-600 font-medium">Standby search active</div>
        </div>

        <div className="bg-indigo-50/70 p-4 rounded-2xl border border-indigo-200 space-y-1 col-span-2 md:col-span-1">
          <div className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider">
            Replacements
          </div>
          <div className="text-2xl font-black text-indigo-700">
            {summary?.replacementsCount ?? '—'}
          </div>
          <div className="text-[11px] text-indigo-600 font-medium">Standby assigned</div>
        </div>
      </div>

      {/* Active Coverage Alerts */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Active Coverage Advisories ({summary?.activeAlerts.length || 0})
          </div>
          <span className="text-[11px] text-slate-500">
            Deadline policy: <strong>15m prior + 5m grace</strong>
          </span>
        </div>

        {summary && summary.activeAlerts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {summary.activeAlerts.map((alert) => {
              const isNoShow =
                alert.status === 'NO_SHOW_RISK' || alert.status === 'NO_SHOW_CONFIRMED';
              const isLate = alert.status === 'LATE';
              const isReplaced = alert.status === 'REPLACED';
              const isReturned = alert.status === 'PRIMARY_RETURNED';

              const badgeColor = isNoShow
                ? 'bg-rose-100 text-rose-800 border-rose-200'
                : isLate
                ? 'bg-amber-100 text-amber-800 border-amber-200'
                : isReturned
                ? 'bg-purple-100 text-purple-800 border-purple-200'
                : 'bg-indigo-100 text-indigo-800 border-indigo-200';

              return (
                <div
                  key={alert.tripId}
                  className="p-5 rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-slate-300 transition-all space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-black bg-slate-900 text-white px-2 py-0.5 rounded">
                        {alert.routeCode}
                      </span>
                      <span
                        className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${badgeColor}`}
                      >
                        {alert.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{alert.routeName}</h4>
                      <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                        <div>
                          Primary Captain: <strong>{alert.driverName}</strong>
                        </div>
                        <div>
                          Departure: <strong>{alert.scheduledDispatch}</strong> • Check-in Deadline:{' '}
                          <strong>{alert.checkInDeadline}</strong>
                        </div>
                      </div>
                    </div>

                    {isNoShow && (
                      <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center space-x-1.5">
                        <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                        <span>Not checked in past grace threshold. Replacement search ready.</span>
                      </div>
                    )}

                    {isReturned && (
                      <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-800 text-xs font-semibold flex items-center space-x-1.5">
                        <Info className="w-4 h-4 text-purple-600 flex-shrink-0" />
                        <span>Primary driver checked in late after replacement was assigned.</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-500">
                      {isReplaced
                        ? 'Standby driver dispatched'
                        : isLate
                        ? 'Awaiting driver check-in'
                        : 'Action required'}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleOpenStandbySearch(alert.tripId, alert.routeId)}
                      disabled={evaluatingTripId === alert.tripId}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                        isNoShow
                          ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs'
                          : 'bg-slate-900 hover:bg-slate-800 text-white'
                      }`}
                    >
                      {evaluatingTripId === alert.tripId ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>Searching...</span>
                        </>
                      ) : (
                        <>
                          <Search className="w-3 h-3" />
                          <span>{isReplaced ? 'View Coverage' : 'Find Replacement'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500">
            {loading
              ? 'Monitoring driver check-in telemetry...'
              : '✓ All assigned route captains checked in or within expected schedule.'}
          </div>
        )}
      </div>

      {/* Demo / Simulation Sandbox (MCA Viva Voce Testing) */}
      <div className="pt-4 border-t border-slate-100 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded bg-slate-200 text-[10px] font-mono font-bold text-slate-700 uppercase">
              DEMO / VIVA SIMULATOR
            </span>
            <span className="text-xs text-slate-500 font-medium">
              Simulate check-in events on Route SR-101
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => handleSimulate('SIMULATE_DRIVER_CHECK_IN')}
              disabled={simulating}
              className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition-all disabled:opacity-50"
            >
              Simulate Check-In
            </button>
            <button
              onClick={() => handleSimulate('SIMULATE_DRIVER_LATE')}
              disabled={simulating}
              className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold transition-all disabled:opacity-50"
            >
              Simulate Late
            </button>
            <button
              onClick={() => handleSimulate('SIMULATE_DRIVER_NO_SHOW')}
              disabled={simulating}
              className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold transition-all disabled:opacity-50"
            >
              Simulate No-Show
            </button>
            <button
              onClick={() => handleSimulate('RESET')}
              disabled={simulating}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center space-x-1 disabled:opacity-50"
              title="Reset check-in records"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {simMessage && (
          <div className="p-3 rounded-xl bg-slate-100 text-slate-800 text-xs font-medium flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>{simMessage}</span>
          </div>
        )}
      </div>

      {/* Standby Recommendation Modal */}
      {activeEvaluation && (
        <StandbyRecommendationModal
          evaluation={activeEvaluation}
          onClose={() => setActiveEvaluation(null)}
          onAssigned={() => {
            loadCoverageSummary();
          }}
        />
      )}
    </div>
  );
}
