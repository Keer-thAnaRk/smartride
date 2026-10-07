'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  ShieldCheck,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Play,
  RotateCcw,
  Lock,
  Share2,
  Radio,
} from 'lucide-react';
import axios from 'axios';
import { FAMILY_TRACKING_CONFIG } from '@/lib/tracking/family-tracking-config';

export default function FamilyTrackingCenter() {
  const [kpis, setKpis] = useState({
    activeSessions: 3,
    delayedShuttles: 1,
    safeArrivalsToday: 12,
    expiredSessions: 4,
  });
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [simMessage, setSimMessage] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/admin/family-tracking');
      if (res.data?.success) {
        setKpis(res.data.kpis);
        if (res.data.sessions && res.data.sessions.length > 0) {
          setSessions(res.data.sessions);
        }
      }
    } catch (err) {
      console.warn('Could not fetch admin family tracking data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleSimulate = async (action: string) => {
    try {
      setSimulating(true);
      setSimMessage(null);
      const res = await axios.post('/api/tracking/simulate', {
        action,
        shareToken: FAMILY_TRACKING_CONFIG.DEFAULT_DEMO_SHARE_TOKEN,
      });
      if (res.data?.success) {
        setSimMessage(res.data.message);
        await loadData();
      }
    } catch (err: any) {
      setSimMessage('Simulation error: ' + (err.response?.data?.error || err.message));
    } finally {
      setSimulating(false);
    }
  };

  const handleCopyLink = (token: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${origin}/track/${token}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2500);
    }
  };

  return (
    <div
      id="family-tracking"
      className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-xs">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-bold text-slate-900">
                Safe Arrival & Family Tracking Center
              </h2>
              <span className="text-[10px] uppercase font-black tracking-widest bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full">
                Zero PII Public Stream
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Live monitoring of commuter family share links, automated arrival confirmations, and delay alerts
            </p>
          </div>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center space-x-1.5 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* 4 Family Tracking KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
            <Radio className="w-3.5 h-3.5 text-indigo-600" />
            <span>Active Sessions</span>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {kpis.activeSessions}
          </div>
          <div className="text-[11px] text-slate-500">Live corridor tracking links</div>
        </div>

        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/80 space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700 flex items-center space-x-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Delayed Shuttles</span>
          </div>
          <div className="text-2xl font-black text-amber-900 font-mono">
            {kpis.delayedShuttles}
          </div>
          <div className="text-[11px] text-amber-700">Family delay notifications active</div>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200/80 space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 flex items-center space-x-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Safe Arrivals Today</span>
          </div>
          <div className="text-2xl font-black text-emerald-900 font-mono">
            {kpis.safeArrivalsToday}
          </div>
          <div className="text-[11px] text-emerald-700">Automated geofence confirmations</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>Expired Sessions</span>
          </div>
          <div className="text-2xl font-black text-slate-700 font-mono">
            {kpis.expiredSessions}
          </div>
          <div className="text-[11px] text-slate-500">Privacy buffer completed</div>
        </div>
      </div>

      {/* 🧪 Academic Viva & Dev Simulator Controls */}
      <div className="p-5 rounded-2xl bg-slate-900 text-white space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-0.5">
            <div className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center space-x-1.5">
              <Play className="w-3.5 h-3.5 text-indigo-400" />
              <span>Interactive Viva Demonstration & Telemetry Simulator</span>
            </div>
            <p className="text-xs text-slate-400">
              Trigger real-time state transitions on demo shuttle SR-101 and observe public family tracking responses
            </p>
          </div>

          <a
            href={`/track/${FAMILY_TRACKING_CONFIG.DEFAULT_DEMO_SHARE_TOKEN}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all self-start sm:self-auto"
          >
            <span>Open Public Family Tracker</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="flex flex-wrap gap-2.5 pt-2">
          <button
            onClick={() => handleSimulate('SIMULATE_MINOR_DELAY')}
            disabled={simulating}
            className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all flex items-center space-x-1.5"
          >
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Simulate Minor Delay (+7 min)</span>
          </button>

          <button
            onClick={() => handleSimulate('SIMULATE_SIGNIFICANT_DELAY')}
            disabled={simulating}
            className="px-3 py-2 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-500/40 text-xs font-bold transition-all flex items-center space-x-1.5"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
            <span>Simulate Significant Delay (+17 min)</span>
          </button>

          <button
            onClick={() => handleSimulate('SIMULATE_SAFE_ARRIVAL')}
            disabled={simulating}
            className="px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition-all flex items-center space-x-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Simulate Safe Arrival (Destination Halted)</span>
          </button>

          <button
            onClick={() => handleSimulate('RESET_TRACKING')}
            disabled={simulating}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all flex items-center space-x-1.5 ml-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demo</span>
          </button>
        </div>

        {simMessage && (
          <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-emerald-400 flex items-center space-x-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{simMessage}</span>
          </div>
        )}
      </div>

      {/* Recent Family Tracking Sessions Feed */}
      <div className="space-y-3">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Recent Family Tracking Sessions
        </div>

        <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
          {/* Primary Demo Session Row */}
          <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 hover:bg-slate-50 transition-colors">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                RV
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-slate-900 text-xs">Rahul Verma</span>
                  <span className="text-[10px] font-mono text-slate-400">
                    token: smart-live-sr101-7x9q
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 flex items-center space-x-1">
                  <span>Destination: Ecospace Gate 1 • Shuttle SR-101 (KA-01-MJ-8822)</span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 self-end sm:self-auto">
              <button
                onClick={() => handleCopyLink(FAMILY_TRACKING_CONFIG.DEFAULT_DEMO_SHARE_TOKEN)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white text-xs font-medium flex items-center space-x-1 transition-all"
                title="Copy public tracking link"
              >
                {copiedToken === FAMILY_TRACKING_CONFIG.DEFAULT_DEMO_SHARE_TOKEN ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedToken === FAMILY_TRACKING_CONFIG.DEFAULT_DEMO_SHARE_TOKEN ? 'Copied' : 'Copy'}</span>
              </button>

              <a
                href={`/track/${FAMILY_TRACKING_CONFIG.DEFAULT_DEMO_SHARE_TOKEN}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center space-x-1 transition-all"
              >
                <span>Live View</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Dynamic Sessions */}
          {sessions.map((s) => (
            <div
              key={s.id}
              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors text-xs"
            >
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-slate-900">
                    {s.commuterId === 'commuter_rahul_1' ? 'Rahul Verma' : 'Commuter'}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      s.isArrived
                        ? 'bg-emerald-100 text-emerald-800'
                        : s.status === 'EXPIRED'
                        ? 'bg-slate-200 text-slate-700'
                        : 'bg-indigo-100 text-indigo-800'
                    }`}
                  >
                    {s.isArrived ? 'ARRIVED' : s.status}
                  </span>
                </div>
                <div className="text-slate-500 text-[11px]">
                  {s.destinationStop} • Scheduled: {s.scheduledArrival || '08:25 AM'}
                </div>
              </div>

              <div className="flex items-center space-x-2 self-end sm:self-auto">
                <span className="text-[11px] font-mono text-slate-400">
                  {s.shareTokenPrefix}...
                </span>
                <a
                  href={`/track/${s.shareTokenPrefix ? FAMILY_TRACKING_CONFIG.DEFAULT_DEMO_SHARE_TOKEN : ''}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium flex items-center space-x-1"
                >
                  <span>Tracker</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
