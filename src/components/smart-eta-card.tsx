'use client';

import React, { useMemo } from 'react';
import {
  Clock,
  Car,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Navigation,
  Compass,
  MapPin,
  Activity,
  Radio,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { calculateSmartEta, SmartEtaPrediction } from '@/lib/ai/smart-eta';

interface SmartEtaCardProps {
  currentLocation?: {
    lat: number;
    lng: number;
    speedKmH?: number;
    heading?: number;
  };
  theme?: 'dark' | 'light';
  compact?: boolean;
}

export default function SmartEtaCard({
  currentLocation,
  theme = 'light',
  compact = false,
}: SmartEtaCardProps) {
  const etaPrediction: SmartEtaPrediction = useMemo(() => {
    return calculateSmartEta(
      currentLocation || { lat: 12.936, lng: 77.692, speedKmH: 38 }
    );
  }, [currentLocation?.lat, currentLocation?.lng, currentLocation?.speedKmH]);

  const isDark = theme === 'dark';

  return (
    <div
      className={`rounded-3xl border transition-all ${
        isDark
          ? 'bg-slate-900/90 border-slate-800 text-white shadow-xl'
          : 'bg-white border-slate-200/90 text-slate-900 shadow-sm'
      } ${compact ? 'p-5' : 'p-6 sm:p-7'}`}
    >
      {/* 1. Header & Live Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200/20">
        <div className="flex items-center space-x-3">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black flex-shrink-0 ${
              etaPrediction.currentDelayMinutes >= 6
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                : etaPrediction.currentDelayMinutes >= 3
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            }`}
          >
            <Clock className="w-5 h-5 animate-pulse" />
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <h3 className={`text-base font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {etaPrediction.statusIndicator}
              </h3>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider ${
                  etaPrediction.currentDelayMinutes > 0
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                }`}
              >
                {etaPrediction.currentDelayMinutes > 0
                  ? `Current Delay: +${etaPrediction.currentDelayMinutes} min`
                  : 'On Schedule (0 min)'}
              </span>
            </div>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} mt-0.5`}>
              Next Stop: <span className="font-bold text-emerald-400">{etaPrediction.nextStopName}</span> •{' '}
              {etaPrediction.distanceToNextStopKm} km away
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono self-start sm:self-auto">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>
            Predicted: <span className="font-bold text-emerald-400 text-sm">{etaPrediction.trafficAdjustedEta}</span>
          </span>
        </div>
      </div>

      {/* 2. Key ETA & Delay Prediction Matrix */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-4">
        {/* Metric 1: Predicted Arrival Time */}
        <div
          className={`p-3.5 rounded-2xl border ${
            isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Predicted Arrival
          </div>
          <div className="text-xl font-black text-emerald-400 font-mono mt-1">
            {etaPrediction.trafficAdjustedEta}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Traffic-adjusted
          </div>
        </div>

        {/* Metric 2: Normal Scheduled ETA */}
        <div
          className={`p-3.5 rounded-2xl border ${
            isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Normal Scheduled ETA
          </div>
          <div className={`text-xl font-black font-mono mt-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>
            {etaPrediction.normalScheduledEta}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Free-flow timetable
          </div>
        </div>

        {/* Metric 3: Current Delay */}
        <div
          className={`p-3.5 rounded-2xl border ${
            isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Current Delay
          </div>
          <div
            className={`text-xl font-black font-mono mt-1 ${
              etaPrediction.currentDelayMinutes > 0 ? 'text-amber-400' : 'text-emerald-400'
            }`}
          >
            +{etaPrediction.currentDelayMinutes} min
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Vs scheduled slot
          </div>
        </div>

        {/* Metric 4: Live Speed & Slowdown */}
        <div
          className={`p-3.5 rounded-2xl border ${
            isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Corridor Velocity
          </div>
          <div className={`text-xl font-black font-mono mt-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>
            {etaPrediction.currentSpeedKmH}{' '}
            <span className="text-xs font-normal text-slate-400">km/h</span>
          </div>
          <div className="text-[10px] text-amber-500 font-semibold mt-0.5">
            {etaPrediction.trafficSlowdownPercent}% corridor slowdown
          </div>
        </div>
      </div>

      {/* 3. Traffic Condition & Smart Prediction Rationale */}
      <div
        className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs font-medium ${
          isDark
            ? 'bg-slate-950/50 border-slate-800/80 text-slate-300'
            : 'bg-emerald-50/70 border-emerald-200/80 text-emerald-950'
        }`}
      >
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          <span>{etaPrediction.trafficCondition}</span>
        </div>

        <div className="hidden sm:flex items-center space-x-1.5 font-mono text-[11px] text-slate-400">
          <span>Target: {etaPrediction.destinationStopName}</span>
          <span>•</span>
          <span className="text-emerald-400 font-bold">{etaPrediction.destinationTrafficEta}</span>
        </div>
      </div>

      {/* 4. Stop-by-Stop Dual ETA Timeline (Rendered unless compact) */}
      {!compact && (
        <div className="mt-5 pt-4 border-t border-slate-200/20 space-y-3">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
            <span>Corridor Stops &amp; Traffic-Adjusted Schedule</span>
            <span>Normal vs Predicted</span>
          </div>

          <div className="space-y-2.5">
            {etaPrediction.allStops.map((stop, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
                  stop.status === 'arriving_next'
                    ? isDark
                      ? 'bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/30'
                      : 'bg-emerald-50 border-emerald-300'
                    : stop.status === 'completed'
                    ? isDark
                      ? 'bg-slate-950/40 border-slate-800 opacity-60'
                      : 'bg-slate-50 border-slate-200 opacity-60'
                    : isDark
                    ? 'bg-slate-950/60 border-slate-800'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                      stop.status === 'completed'
                        ? 'bg-emerald-500 text-slate-950'
                        : stop.status === 'arriving_next'
                        ? 'bg-emerald-400 text-slate-950 animate-pulse'
                        : isDark
                        ? 'bg-slate-800 text-slate-400'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {stop.status === 'completed' ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      idx + 1
                    )}
                  </div>

                  <div>
                    <div className="flex items-center space-x-2">
                      <span className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {stop.stopName}
                      </span>
                      {stop.status === 'arriving_next' && (
                        <span className="px-2 py-0.2 rounded-full text-[10px] font-black uppercase bg-emerald-500 text-slate-950 animate-bounce">
                          Arriving Next
                        </span>
                      )}
                    </div>
                    {stop.landmark && (
                      <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {stop.landmark}
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-right font-mono">
                  <div className="flex items-center space-x-2 justify-end">
                    <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-400'} line-through`}>
                      {stop.scheduledTime}
                    </span>
                    <ArrowRight className="w-3 h-3 text-slate-400" />
                    <span
                      className={`text-xs font-black ${
                        stop.delayMinutes > 0 ? 'text-amber-400' : 'text-emerald-400'
                      }`}
                    >
                      {stop.trafficAdjustedTime}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {stop.status === 'completed'
                      ? 'Departed'
                      : stop.delayMinutes > 0
                      ? `+${stop.delayMinutes} min delay`
                      : 'On Time'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
