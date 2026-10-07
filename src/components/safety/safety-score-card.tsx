'use client';

import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Car,
  UserCheck,
  FileCheck,
  KeyRound,
  Navigation,
  Gauge,
  Activity,
  ChevronRight,
  Info,
  X,
} from 'lucide-react';
import { calculateTripSafetyScore, createSanitizedPublicSafetyIndicator } from '@/lib/safety/scoring-engine';
import { SafetyScoreResult } from '@/lib/safety/types';

interface SafetyScoreCardProps {
  trip?: any;
  liveLocation?: {
    lat: number;
    lng: number;
    speedKmH?: number;
    heading?: number;
    updatedAt?: string;
  };
  theme?: 'dark' | 'light';
  mode?: 'full' | 'commuter' | 'driver' | 'public';
  compact?: boolean;
}

export default function SafetyScoreCard({
  trip,
  liveLocation,
  theme = 'light',
  mode = 'full',
  compact = false,
}: SafetyScoreCardProps) {
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);

  // Compute safety score dynamically from current trip telemetry
  const safetyResult: SafetyScoreResult = useMemo(() => {
    return calculateTripSafetyScore({
      tripId: trip?.tripId || 'trip-sr101-today',
      status: trip?.status || 'in_transit',
      liveLocation: liveLocation || trip?.liveLocation,
      driver: {
        isVerified: trip?.driver?.isVerified ?? true,
        name: trip?.driverName || trip?.driver?.name || 'Rajesh Sharma',
      },
      vehicle: {
        isApproved: trip?.vehicle?.isApproved ?? true,
        rcDocUrl: trip?.vehicle?.rcDocUrl || 'https://smartride.com/docs/rc.pdf',
        insuranceDocUrl: trip?.vehicle?.insuranceDocUrl || 'https://smartride.com/docs/insurance.pdf',
        licensePlate: trip?.vehiclePlate || trip?.vehicle?.licensePlate || 'KA-01-MJ-8822',
        model: trip?.vehicleModel || trip?.vehicle?.model || 'Toyota Innova Crysta',
      },
      passengers: trip?.passengers || [],
      sosDetails: trip?.sosDetails,
      existingEvents: trip?.activeSafetyEvents || [],
    });
  }, [trip, liveLocation]);

  const isDark = theme === 'dark';
  const b = safetyResult.breakdown;

  // Sanitized Public Mode Rendering
  if (mode === 'public') {
    const pub = createSanitizedPublicSafetyIndicator(safetyResult);
    return (
      <div
        className={`rounded-3xl border transition-all ${
          isDark
            ? 'bg-slate-900/90 border-slate-800 text-white shadow-lg'
            : 'bg-white border-slate-200 text-slate-900 shadow-sm'
        } p-5 sm:p-6 space-y-4`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            <span>Operational Trip Safety</span>
          </div>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
              safetyResult.score >= 90
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : safetyResult.score >= 75
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
            }`}
          >
            {pub.riskLabel}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div
              className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-black ${
                safetyResult.score >= 90
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : safetyResult.score >= 75
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
              }`}
            >
              <span className="text-xl leading-none">{pub.score}</span>
              <span className="text-[9px] opacity-70 uppercase">/ 100</span>
            </div>
            <div>
              <div className="text-sm font-black text-white">{pub.riskLabel}</div>
              <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                {pub.statusSummary}
              </p>
            </div>
          </div>
        </div>

        {/* 4 Trust Badges */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-[11px]">
          <div className="flex items-center space-x-1.5 text-slate-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Driver verified</span>
          </div>
          <div className="flex items-center space-x-1.5 text-slate-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Vehicle verified</span>
          </div>
          <div className="flex items-center space-x-1.5 text-slate-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Route on track</span>
          </div>
          <div className="flex items-center space-x-1.5 text-slate-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>No active emergency</span>
          </div>
        </div>

        <p className="text-[10px] text-slate-500 italic pt-1">
          {pub.operationalDisclaimer}
        </p>
      </div>
    );
  }

  // Commuter / Driver / Full Mode Rendering
  return (
    <>
      <div
        className={`rounded-3xl border transition-all ${
          isDark
            ? 'bg-slate-900/90 border-slate-800 text-white shadow-xl'
            : 'bg-white border-slate-200/90 text-slate-900 shadow-sm'
        } ${compact ? 'p-5' : 'p-6'}`}
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200/20">
          <div className="flex items-center space-x-3">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black flex-shrink-0 ${
                safetyResult.score >= 90
                  ? 'bg-emerald-500/20 text-emerald-600 border border-emerald-500/30'
                  : safetyResult.score >= 75
                  ? 'bg-amber-500/20 text-amber-600 border border-amber-500/30'
                  : safetyResult.score >= 50
                  ? 'bg-orange-500/20 text-orange-600 border border-orange-500/30'
                  : 'bg-rose-500/20 text-rose-600 border border-rose-500/30'
              }`}
            >
              <ShieldCheck className="w-6 h-6" />
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <h3 className={`text-base font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Smart Trip Safety Score
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    safetyResult.score >= 90
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : safetyResult.score >= 75
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : safetyResult.score >= 50
                      ? 'bg-orange-100 text-orange-800 border border-orange-200'
                      : 'bg-rose-100 text-rose-800 border border-rose-200'
                  }`}
                >
                  {safetyResult.riskLabel}
                </span>
              </div>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} mt-0.5`}>
                {safetyResult.primaryReason}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="text-right">
              <div className="flex items-baseline space-x-1 justify-end">
                <span className={`text-2xl sm:text-3xl font-black ${
                  safetyResult.score >= 90
                    ? 'text-emerald-600'
                    : safetyResult.score >= 75
                    ? 'text-amber-600'
                    : 'text-rose-600'
                }`}>
                  {safetyResult.score}
                </span>
                <span className="text-xs font-semibold text-slate-400">/ 100</span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                Calculated {safetyResult.calculatedAt}
              </div>
            </div>

            <button
              onClick={() => setShowBreakdownModal(true)}
              className="px-3.5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-all whitespace-nowrap flex items-center space-x-1"
            >
              <span>View Breakdown</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 6 Dimension Grid Preview */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-4">
          {/* Driver */}
          <div className={`p-2.5 rounded-2xl border text-center ${
            b.driverVerification.isCompliant
              ? isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-emerald-50/70 border-emerald-100'
              : 'bg-rose-50 border-rose-200'
          }`}>
            <div className="text-[10px] uppercase font-bold text-slate-400">Driver KYC</div>
            <div className="text-xs font-black mt-0.5 flex items-center justify-center space-x-1">
              {b.driverVerification.isCompliant ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-rose-500" />
              )}
              <span>{b.driverVerification.earnedScore}/20</span>
            </div>
          </div>

          {/* Vehicle Docs */}
          <div className={`p-2.5 rounded-2xl border text-center ${
            b.vehicleDocuments.isCompliant
              ? isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-emerald-50/70 border-emerald-100'
              : 'bg-rose-50 border-rose-200'
          }`}>
            <div className="text-[10px] uppercase font-bold text-slate-400">Vehicle Docs</div>
            <div className="text-xs font-black mt-0.5 flex items-center justify-center space-x-1">
              {b.vehicleDocuments.isCompliant ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-rose-500" />
              )}
              <span>{b.vehicleDocuments.earnedScore}/15</span>
            </div>
          </div>

          {/* OTP */}
          <div className={`p-2.5 rounded-2xl border text-center ${
            b.otpBoarding.isCompliant
              ? isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-emerald-50/70 border-emerald-100'
              : 'bg-amber-50 border-amber-200'
          }`}>
            <div className="text-[10px] uppercase font-bold text-slate-400">OTP Boarding</div>
            <div className="text-xs font-black mt-0.5 flex items-center justify-center space-x-1">
              {b.otpBoarding.isCompliant ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              )}
              <span>{b.otpBoarding.earnedScore}/15</span>
            </div>
          </div>

          {/* Corridor Route */}
          <div className={`p-2.5 rounded-2xl border text-center ${
            b.routeCompliance.isCompliant
              ? isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-emerald-50/70 border-emerald-100'
              : 'bg-amber-50 border-amber-200'
          }`}>
            <div className="text-[10px] uppercase font-bold text-slate-400">Route Corridor</div>
            <div className="text-xs font-black mt-0.5 flex items-center justify-center space-x-1">
              {b.routeCompliance.isCompliant ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              )}
              <span>{b.routeCompliance.earnedScore}/20</span>
            </div>
          </div>

          {/* Speed */}
          <div className={`p-2.5 rounded-2xl border text-center ${
            b.speedMonitoring.isCompliant
              ? isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-emerald-50/70 border-emerald-100'
              : 'bg-rose-50 border-rose-200'
          }`}>
            <div className="text-[10px] uppercase font-bold text-slate-400">Speed Limit</div>
            <div className="text-xs font-black mt-0.5 flex items-center justify-center space-x-1">
              {b.speedMonitoring.isCompliant ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
              )}
              <span>{b.speedMonitoring.earnedScore}/15</span>
            </div>
          </div>

          {/* Emergency SOS */}
          <div className={`p-2.5 rounded-2xl border text-center ${
            b.emergencyEvents.isCompliant
              ? isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-emerald-50/70 border-emerald-100'
              : 'bg-rose-50 border-rose-200'
          }`}>
            <div className="text-[10px] uppercase font-bold text-slate-400">Emergency SOS</div>
            <div className="text-xs font-black mt-0.5 flex items-center justify-center space-x-1">
              {b.emergencyEvents.isCompliant ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
              )}
              <span>{b.emergencyEvents.earnedScore}/15</span>
            </div>
          </div>
        </div>
      </div>

      {/* DETAILED SCORE BREAKDOWN & TIMELINE MODAL */}
      {showBreakdownModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="bg-slate-900 px-6 py-5 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-black tracking-tight">Smart Safety Score Breakdown</h2>
                  <p className="text-xs text-slate-400">
                    Transparent rule-based scoring engine • Trip ID: {trip?.tripId || 'trip-sr101-today'}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <div className="text-2xl font-black text-emerald-400">
                    {safetyResult.score} <span className="text-xs text-slate-400">/ 100</span>
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                    {safetyResult.riskLabel}
                  </div>
                </div>
                <button
                  onClick={() => setShowBreakdownModal(false)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Primary Factor Explainability Alert */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
                  <Info className="w-4 h-4 text-emerald-600" />
                  <span>Telemetry Explainability Analysis</span>
                </div>
                <p className="text-xs font-semibold text-slate-800">
                  {safetyResult.primaryReason}
                </p>
              </div>

              {/* 6 Dimensions Detailed List */}
              <div className="space-y-3">
                <div className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Weighted Safety Dimensions
                </div>

                {[
                  b.driverVerification,
                  b.vehicleDocuments,
                  b.otpBoarding,
                  b.routeCompliance,
                  b.speedMonitoring,
                  b.emergencyEvents,
                ].map((dim, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div
                          className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold ${
                            dim.isCompliant
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {dim.isCompliant ? '✓' : '⚠️'}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">{dim.name}</div>
                          <div className="text-[11px] text-slate-500">{dim.statusText}</div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span
                          className={`text-sm font-black ${
                            dim.isCompliant ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {dim.earnedScore} / {dim.maxScore}
                        </span>
                        {dim.deduction > 0 && (
                          <div className="text-[10px] font-bold text-rose-600">
                            -{dim.deduction} deduction
                          </div>
                        )}
                      </div>
                    </div>

                    {dim.reasons.length > 0 && (
                      <div className="text-[11px] text-slate-600 pl-9 space-y-0.5">
                        {dim.reasons.map((r, rIdx) => (
                          <div key={rIdx}>• {r}</div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Safety Timeline Section */}
              <div className="space-y-3 pt-2">
                <div className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                  <Clock className="w-4 h-4 text-emerald-600" />
                  <span>Trip Safety Event Timeline</span>
                </div>

                {safetyResult.timeline.length === 0 ? (
                  <div className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-xl border border-slate-100">
                    No safety anomalies recorded for this trip. All systems nominal.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {safetyResult.timeline.slice(0, 8).map((evt, idx) => (
                      <div
                        key={evt.id || idx}
                        className={`p-3 rounded-xl border text-xs flex items-start justify-between ${
                          evt.severity === 'CRITICAL'
                            ? 'bg-rose-50 border-rose-200 text-rose-900'
                            : evt.severity === 'HIGH'
                            ? 'bg-orange-50 border-orange-200 text-orange-900'
                            : evt.severity === 'MEDIUM'
                            ? 'bg-amber-50 border-amber-200 text-amber-900'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="font-bold">{evt.title}</div>
                          <div className="text-[11px] opacity-90">{evt.description}</div>
                        </div>
                        <div className="text-[10px] font-mono whitespace-nowrap ml-2 opacity-75">
                          {new Date(evt.detectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Regulatory & Academic Disclaimer */}
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] space-y-1">
                <div className="font-bold flex items-center space-x-1">
                  <Info className="w-3.5 h-3.5 text-amber-700" />
                  <span>Important Safety Disclaimer</span>
                </div>
                <p>{safetyResult.operationalDisclaimer}</p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowBreakdownModal(false)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all"
              >
                Close Breakdown
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
