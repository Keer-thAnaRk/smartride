'use client';

import React from 'react';
import { AlertTriangle, Clock, MapPin, ShieldCheck, Compass } from 'lucide-react';
import { SanitizedFamilyStatus } from '@/lib/tracking/safe-arrival-logic';

interface FamilyDelayBannerProps {
  status: Partial<SanitizedFamilyStatus>;
}

export default function FamilyDelayBanner({ status }: FamilyDelayBannerProps) {
  const delayMinutes = status.delayMinutes ?? 0;
  if (delayMinutes <= 5 || status.isArrived) {
    return null; // On time or arrived, no delay alert needed
  }

  const commuterName = status.commuterName || 'Rahul';
  const updatedEta = status.updatedEta || '09:04 AM';
  const lastLocation = status.lastKnownLocation || 'Bellandur';
  const isMajor = delayMinutes > 20;

  return (
    <div
      className={`rounded-3xl border p-5 sm:p-6 text-white shadow-xl relative overflow-hidden transition-all ${
        isMajor
          ? 'bg-gradient-to-r from-rose-950/90 via-slate-900 to-slate-950 border-rose-500/50 shadow-rose-950/30'
          : 'bg-gradient-to-r from-amber-950/80 via-slate-900 to-slate-950 border-amber-500/40 shadow-amber-950/30'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center space-x-3.5">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md ${
              isMajor
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse'
                : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
            }`}
          >
            <AlertTriangle className="w-6 h-6" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span
                className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${
                  isMajor
                    ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                    : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                }`}
              >
                {isMajor ? 'Major Corridor Delay' : 'Commute Delay'}
              </span>
              <span className="text-xs font-mono font-bold text-amber-400">
                +{delayMinutes} min
              </span>
            </div>

            <h3 className="text-lg sm:text-xl font-black text-white">
              ⚠️ COMMUTE DELAY
            </h3>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
              <span className="font-bold text-white">{commuterName}'s</span> shuttle is currently{' '}
              <span className="font-bold text-amber-300">{delayMinutes} minutes</span> behind schedule due to tech corridor congestion.
            </p>
          </div>
        </div>

        {/* Updated ETA & Last Location Badge */}
        <div className="grid grid-cols-2 sm:flex sm:flex-col gap-2.5 sm:items-end flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
          <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center space-x-2">
            <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <div className="text-left sm:text-right">
              <div className="text-[10px] uppercase font-bold text-slate-400">Updated ETA</div>
              <div className="text-xs font-black font-mono text-white">{updatedEta}</div>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center space-x-2">
            <MapPin className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <div className="text-left sm:text-right">
              <div className="text-[10px] uppercase font-bold text-slate-400">Last Known Location</div>
              <div className="text-xs font-black text-white truncate max-w-[130px]">{lastLocation}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Safety Reassurance Bar */}
      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Vehicle is progressing safely along the scheduled corridor. All safety checks active.</span>
        </div>
        <div className="hidden md:flex items-center space-x-1 text-slate-500 font-mono">
          <Compass className="w-3 h-3 text-slate-400" />
          <span>Smart ETA corridor sync</span>
        </div>
      </div>
    </div>
  );
}
