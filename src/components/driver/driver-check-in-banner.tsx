'use client';

import React, { useState } from 'react';
import axios from 'axios';
import {
  UserCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  Car,
} from 'lucide-react';
import { CheckInStatus } from '@/lib/operations/driver-coverage-types';

interface DriverCheckInBannerProps {
  tripId?: string;
  routeId?: string;
  routeCode?: string;
  routeName?: string;
  scheduledDispatch?: string;
  isStandbyAssignment?: boolean;
  originalDriverName?: string;
  onCheckInSuccess?: () => void;
}

export default function DriverCheckInBanner({
  tripId = 'trip-sr101-today',
  routeId,
  routeCode = 'SR-101',
  routeName = 'Whitefield Tech Corridor Express',
  scheduledDispatch = '08:00 AM',
  isStandbyAssignment = false,
  originalDriverName = 'Rajesh Kumar',
  onCheckInSuccess,
}: DriverCheckInBannerProps) {
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkInStatus, setCheckInStatus] = useState<CheckInStatus>('EXPECTED');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCheckIn = async () => {
    try {
      setCheckingIn(true);
      setErrorMessage(null);

      const res = await axios.post('/api/driver/check-in', {
        tripId,
        routeId,
        tripType: 'MORNING_PICKUP',
      });

      if (res.data?.success) {
        setCheckInStatus(res.data.status);
        setSuccessMessage(res.data.message || 'Check-in confirmed successfully!');
        if (onCheckInSuccess) onCheckInSuccess();
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || 'Failed to submit driver check-in');
    } finally {
      setCheckingIn(false);
    }
  };

  // If this driver is a standby replacement
  if (isStandbyAssignment) {
    return (
      <div className="p-5 rounded-3xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/5 border-2 border-amber-500/40 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-600 text-white flex items-center justify-center font-bold">
              🔄
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                  REPLACEMENT STANDBY ASSIGNMENT
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-mono text-[10px] font-black">
                  {routeCode}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Assigned as replacement captain for <strong>{originalDriverName}</strong> • {routeName}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Standby Dispatched</span>
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-900 text-emerald-400 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-slate-900">Pre-Dispatch Driver Check-In</h3>
              <span className="font-mono text-[11px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                {routeCode}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Scheduled Dispatch: <strong>{scheduledDispatch}</strong> • Check-in Deadline: 15 min prior
            </p>
          </div>
        </div>

        {checkInStatus === 'CHECKED_IN' ? (
          <div className="px-4 py-2 rounded-2xl bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center space-x-1.5 self-start sm:self-auto">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>✓ Check-In Confirmed</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleCheckIn}
            disabled={checkingIn}
            className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center space-x-1.5 self-start sm:self-auto disabled:opacity-50"
          >
            {checkingIn ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Verifying...</span>
              </>
            ) : (
              <>
                <UserCheck className="w-3.5 h-3.5" />
                <span>Confirm Check-In</span>
              </>
            )}
          </button>
        )}
      </div>

      {successMessage && (
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
