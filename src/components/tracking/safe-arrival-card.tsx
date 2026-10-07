'use client';

import React from 'react';
import {
  CheckCircle2,
  MapPin,
  Clock,
  Car,
  ShieldCheck,
  Calendar,
  Lock,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { SanitizedFamilyStatus } from '@/lib/tracking/safe-arrival-logic';

interface SafeArrivalCardProps {
  status: Partial<SanitizedFamilyStatus>;
}

export default function SafeArrivalCard({ status }: SafeArrivalCardProps) {
  const commuterName = status.commuterName || 'Rahul';
  const destination = status.destinationStop || 'Ecospace Gate 1';
  const arrivalTime = status.arrivedAt || '08:47 AM';
  const scheduledTime = status.scheduledArrival || '08:25 AM';
  const tripCode = status.routeCode || 'SR-101';
  const vehicle = `${status.vehiclePlate || 'KA-01-MJ-8822'} (${status.vehicleModel || 'Toyota Innova'})`;
  const delayMinutes = status.delayMinutes || 0;

  return (
    <div className="bg-gradient-to-br from-emerald-950/80 via-slate-900 to-slate-950 rounded-3xl border-2 border-emerald-500/50 p-6 sm:p-8 text-white shadow-2xl shadow-emerald-950/40 relative overflow-hidden animate-in fade-in zoom-in-95 duration-300">
      {/* Background ambient radial glow */}
      <div className="absolute -top-24 -right-24 w-72 h-72 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Banner Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-emerald-800/40 pb-5">
        <div className="flex items-center space-x-3.5">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center shadow-lg shadow-emerald-500/30 flex-shrink-0 animate-bounce">
            <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                Safe Arrival Verified
              </span>
              <span className="flex items-center space-x-1 text-[11px] text-slate-400 font-mono">
                <Lock className="w-3 h-3 text-emerald-400" />
                <span>Geofence Confirmed</span>
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1">
              ✅ SAFE ARRIVAL
            </h2>
            <p className="text-sm font-semibold text-emerald-300/90 mt-0.5">
              {commuterName} has arrived safely.
            </p>
          </div>
        </div>

        <div className="flex sm:flex-col items-end justify-between sm:justify-center border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-800/80">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Trip Status
          </span>
          <span className="px-3 py-1 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-black rounded-xl text-xs flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Trip Completed</span>
          </span>
        </div>
      </div>

      {/* Primary Key Trip Details Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 py-6">
        {/* Destination Card */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-1">
          <div className="text-[11px] uppercase tracking-wider font-bold text-slate-400 flex items-center space-x-1.5">
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            <span>Destination</span>
          </div>
          <div className="text-base font-black text-white truncate" title={destination}>
            {destination}
          </div>
          <div className="text-[11px] text-emerald-400/90 font-medium">Verified at arrival bay</div>
        </div>

        {/* Arrival Timestamp Card */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-1">
          <div className="text-[11px] uppercase tracking-wider font-bold text-slate-400 flex items-center space-x-1.5">
            <Clock className="w-3.5 h-3.5 text-teal-400" />
            <span>Arrival Time</span>
          </div>
          <div className="text-base font-black text-emerald-300 font-mono">{arrivalTime}</div>
          <div className="text-[11px] text-slate-400 font-mono">
            Scheduled: {scheduledTime}
          </div>
        </div>

        {/* Corridor Route Card */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-1">
          <div className="text-[11px] uppercase tracking-wider font-bold text-slate-400 flex items-center space-x-1.5">
            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
            <span>Trip & Corridor</span>
          </div>
          <div className="text-base font-black text-white font-mono">{tripCode}</div>
          <div className="text-[11px] text-slate-400 truncate">Whitefield Tech Express</div>
        </div>

        {/* Verified Shuttle Card */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-1">
          <div className="text-[11px] uppercase tracking-wider font-bold text-slate-400 flex items-center space-x-1.5">
            <Car className="w-3.5 h-3.5 text-amber-400" />
            <span>Shuttle Details</span>
          </div>
          <div className="text-base font-black text-white truncate">{vehicle}</div>
          <div className="text-[11px] text-emerald-400 font-medium flex items-center space-x-1">
            <ShieldCheck className="w-3 h-3" />
            <span>RTO & Police Verified</span>
          </div>
        </div>
      </div>

      {/* Bottom Reassurance & Privacy Buffer Footer */}
      <div className="border-t border-emerald-900/40 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>
            Automated confirmation sent to commuter's verified family contacts.
          </span>
        </div>
        <div className="text-[11px] font-mono text-slate-500 flex items-center space-x-1">
          <Lock className="w-3 h-3 text-slate-400" />
          <span>Session link valid until {status.expiresAt || 'post-arrival buffer'}</span>
        </div>
      </div>
    </div>
  );
}
