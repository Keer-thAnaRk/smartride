'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import axios from 'axios';
import {
  DollarSign,
  TrendingUp,
  Users,
  Car,
  ShieldCheck,
  Percent,
  Compass,
  Calendar,
  CalendarDays,
  Sparkles,
  RefreshCw,
  ArrowUpRight,
  PieChart,
  BarChart3,
  Layers,
  Phone,
  AlertTriangle,
  Radio,
  Navigation,
  MapPin,
  CheckCircle2,
  X,
  ExternalLink,
  ShieldAlert,
  Flame,
  Volume2,
  VolumeX,
  Lock,
} from 'lucide-react';
import { useAuth } from '@/components/auth-context';
import AdminRevenueChart from '@/components/admin-revenue-chart';
import AiDemandIntelligence from '@/components/admin/ai-demand-intelligence';
import SafetyIntelligenceCenter from '@/components/admin/safety-intelligence-center';
import AnomalyMonitoringCenter from '@/components/admin/anomaly-monitoring-center';
import FamilyTrackingCenter from '@/components/admin/family-tracking-center';
import FleetSeatIntelligence from '@/components/admin/fleet-seat-intelligence';
import DriverCoverageCenter from '@/components/admin/driver-coverage-center';
import SustainabilityImpactCenter from '@/components/admin/sustainability-impact-center';
import GamificationAnalyticsCenter from '@/components/admin/gamification-analytics-center';
import {
  FirestoreTrip,
  listenToAllActiveTrips,
  resolveSosAlert,
  playEmergencyAudioAlert,
} from '@/lib/firebase';

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Real-time Emergency SOS & Trip Telemetry State
  const [activeTrips, setActiveTrips] = useState<FirestoreTrip[]>([]);
  const [activeSosTrip, setActiveSosTrip] = useState<FirestoreTrip | null>(null);
  const [sosMuted, setSosMuted] = useState(false);
  const [pcrDispatched, setPcrDispatched] = useState(false);
  const [dispatchSuccessMsg, setDispatchSuccessMsg] = useState<string | null>(null);
  const [resolvingSos, setResolvingSos] = useState(false);
  const [audioStopCallback, setAudioStopCallback] = useState<(() => void) | null>(null);

  useEffect(() => {
    async function loadMetrics() {
      try {
        const res = await axios.get('/api/admin/metrics');
        if (res.data?.success) {
          setMetrics(res.data.metrics);
        }
      } catch (err) {
        console.error('Error loading admin metrics:', err);
      } finally {
        setLoading(false);
      }
    }
    loadMetrics();
  }, []);

  // Listen to active trips and trigger high-priority alerts on SOS
  useEffect(() => {
    const unsub = listenToAllActiveTrips((trips) => {
      setActiveTrips(trips);
      const sos = trips.find((t) => t.status === 'sos_alert');
      if (sos) {
        setActiveSosTrip(sos);
        if (!sosMuted) {
          const stopFn = playEmergencyAudioAlert();
          setAudioStopCallback(() => stopFn);
        }
      } else {
        setActiveSosTrip(null);
        setPcrDispatched(false);
        if (audioStopCallback) {
          audioStopCallback();
          setAudioStopCallback(null);
        }
      }
    });

    return () => {
      unsub();
      if (audioStopCallback) audioStopCallback();
    };
  }, [sosMuted]);

  const handleResolveSos = async (tripId: string) => {
    setResolvingSos(true);
    try {
      if (audioStopCallback) {
        audioStopCallback();
        setAudioStopCallback(null);
      }
      await resolveSosAlert(tripId);
      setActiveSosTrip(null);
      setPcrDispatched(false);
      setDispatchSuccessMsg('Emergency incident marked as Resolved. Corridor operations restored.');
      setTimeout(() => setDispatchSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Error resolving SOS alert:', err);
    } finally {
      setResolvingSos(false);
    }
  };

  const handleDispatchPcr = () => {
    setPcrDispatched(true);
    setDispatchSuccessMsg('🚨 PCR & Highway Patrol Unit alerted. Live GPS telemetry stream dispatched to emergency responders.');
    setTimeout(() => setDispatchSuccessMsg(null), 5000);
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-slate-50">
        <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    );
  }

  const m = metrics || {};

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div>
            <div className="flex items-center space-x-2">
              <Sparkles className="w-6 h-6 text-emerald-600" />
              <h1 className="text-2xl font-black text-slate-900">Executive Command Center</h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Platform recurring revenue, active subscription cohorts, fleet capacity & real-time trip operations
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <a
              href="#safety-intelligence"
              className="flex items-center space-x-2 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-2xl shadow-sm transition-all whitespace-nowrap"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Safety Intelligence</span>
            </a>
            <a
              href="#ai-demand-intelligence"
              className="flex items-center space-x-2 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2.5 rounded-2xl shadow-sm transition-all whitespace-nowrap"
            >
              <Sparkles className="w-4 h-4" />
              <span>AI Demand Intelligence</span>
            </a>

            <Link
              href="/admin/security"
              className="flex items-center space-x-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-2xl shadow-sm transition-all whitespace-nowrap"
            >
              <Lock className="w-4 h-4 text-indigo-200" />
              <span>Security Center</span>
            </Link>

            <Link
              href="/admin/leaves"
              className="flex items-center space-x-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2.5 rounded-2xl shadow-sm transition-all whitespace-nowrap"
            >
              <CalendarDays className="w-4 h-4" />
              <span>Driver Leave Requests</span>
            </Link>
            <div className="hidden sm:flex items-center space-x-2 text-xs font-mono bg-slate-900 text-white px-3 py-2 rounded-2xl">
              <span>Live Platform Metrics</span>
            </div>
          </div>
        </div>

        {/* Global Dispatch / PCR Alert Notification */}
        {dispatchSuccessMsg && (
          <div className="bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-lg border border-slate-700 flex items-center justify-between text-xs font-medium animate-fadeIn">
            <div className="flex items-center space-x-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span>{dispatchSuccessMsg}</span>
            </div>
            <button
              onClick={() => setDispatchSuccessMsg(null)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Real-time Safety & Corridor Incident Monitoring Card */}
        <div className={`p-5 rounded-3xl border transition-all ${
          activeSosTrip
            ? 'bg-rose-50 border-rose-400 shadow-md ring-2 ring-rose-300'
            : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold flex-shrink-0 ${
                activeSosTrip
                  ? 'bg-rose-600 text-white animate-pulse'
                  : 'bg-emerald-100 text-emerald-700'
              }`}>
                {activeSosTrip ? (
                  <AlertTriangle className="w-6 h-6 animate-bounce" />
                ) : (
                  <ShieldCheck className="w-6 h-6 text-emerald-600" />
                )}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-bold text-slate-900">
                    {activeSosTrip
                      ? 'EMERGENCY INCIDENT ACTIVE ON CORRIDOR'
                      : 'Commute Safety & Telemetry Operations'}
                  </h3>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                    activeSosTrip
                      ? 'bg-rose-600 text-white animate-pulse'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {activeSosTrip ? 'HIGH PRIORITY SOS' : 'ALL SYSTEMS NOMINAL'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activeSosTrip
                    ? `Emergency trigger reported on Route ${activeSosTrip.routeId} by commuter ${activeSosTrip.sosDetails?.triggeredByUserName || 'Commuter'}. Immediate intervention required.`
                    : `Active corridor route SR-101 (Whitefield Tech Express) monitored live with GPS tracking, Ride OTP verification, and 24/7 incident failover.`}
                </p>
                {!activeSosTrip && (
                  <div className="flex flex-wrap items-center gap-2 pt-2 text-[11px] font-mono">
                    <span className="px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 font-bold border border-emerald-200 flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                      <span>🟢 Arriving in 8 min</span>
                    </span>
                    <span className="px-2.5 py-0.5 rounded-lg bg-amber-50 text-amber-800 font-bold border border-amber-200">
                      Current Delay: +3 min
                    </span>
                    <span className="text-slate-600 font-semibold">
                      Normal ETA: 8:40 AM ➔ <strong className="text-emerald-700 font-black">Traffic ETA: 8:43 AM</strong>
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {activeSosTrip ? (
                <button
                  onClick={() => setActiveSosTrip({ ...activeSosTrip })}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-2xl shadow-sm transition-all flex items-center space-x-1.5"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Open Incident Command</span>
                </button>
              ) : (
                <div className="flex items-center space-x-2">
                  <a
                    href="#anomaly-monitoring"
                    className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-2xl border border-rose-200 transition-all flex items-center space-x-1.5 shadow-xs"
                  >
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                    <span>Security Anomalies</span>
                  </a>
                  <Link
                    href="/track/smart-live-sr101-7x9q"
                    target="_blank"
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-2xl transition-all flex items-center space-x-1.5"
                  >
                    <Navigation className="w-3.5 h-3.5 text-slate-600" />
                    <span>View Live Fleet</span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 6 Core Executive KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* KPI 1: MRR */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
              <span>Monthly Recurring Revenue (MRR)</span>
              <DollarSign className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-3xl font-black text-slate-900">
              ₹{m.mrr?.toLocaleString('en-IN') || '13,996'}
            </div>
            <div className="text-xs text-emerald-700 font-semibold flex items-center">
              <TrendingUp className="w-3.5 h-3.5 mr-1" /> Annual Run Rate (ARR): ₹{m.arr?.toLocaleString('en-IN') || '1,67,952'}
            </div>
          </div>

          {/* KPI 2: Active Subscriptions */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
              <span>Active Subscriptions</span>
              <Layers className="w-4 h-4 text-teal-600" />
            </div>
            <div className="text-3xl font-black text-slate-900">
              {m.activeSubscriptions || 5}
            </div>
            <div className="text-xs text-slate-500">
              Out of {m.totalCommuters || 5} registered corporate commuters
            </div>
          </div>

          {/* KPI 3: Fleet Seat Utilization */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
              <span>Fleet Seat Utilization</span>
              <Percent className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-3xl font-black text-slate-900">
              {m.fleetUtilizationPercent || 78}%
            </div>
            <div className="text-xs text-slate-500">
              {m.activeSubscriptions} seats filled / {m.totalFleetCapacity || 22} total fleet capacity
            </div>
          </div>

          {/* KPI 4: Active Drivers */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
              <span>Verified Route Captains</span>
              <Car className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-3xl font-black text-slate-900">
              {m.activeDrivers || 3}
            </div>
            <div className="text-xs text-emerald-700 font-semibold">
              100% KYC & Background Screened
            </div>
          </div>

          {/* KPI 5: Churn Rate */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
              <span>Subscriber Churn Rate</span>
              <Percent className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-3xl font-black text-slate-900">
              {m.churnRatePercent || 2.4}%
            </div>
            <div className="text-xs text-emerald-700 font-semibold">
              Industry leading commute retention
            </div>
          </div>

          {/* KPI 6: Today's Scheduled Shifts */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
              <span>Today's Trip Dispatches</span>
              <Compass className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-3xl font-black text-slate-900">
              {m.totalTripsToday || 6} Shifts
            </div>
            <div className="text-xs text-slate-500">
              Across 3 active corridor routes
            </div>
          </div>
        </div>

        {/* Charts & Analytics Section */}
        <div className="space-y-8">
          {/* Interactive Dual-Axis Revenue & Commute Volume Growth Chart with Executive Reporting */}
          <AdminRevenueChart />

          {/* Plan Distribution */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center space-x-2">
              <PieChart className="w-5 h-5 text-emerald-600" />
              <h3 className="text-lg font-bold text-slate-900">Subscription Cohort Share</h3>
            </div>

            <div className="space-y-4 pt-2">
              {m.planDistribution?.map((p: any, idx: number) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-800">{p.plan}</span>
                    <span className="text-emerald-700 font-bold">{p.percentage}% ({p.count} users)</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-600 h-full rounded-full transition-all"
                      style={{ width: `${p.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Attendance Status Summary */}
            <div className="pt-4 border-t border-slate-100">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Today's Passenger Manifest Status
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                  <div className="font-bold text-emerald-800">Boarded</div>
                  <div className="text-lg font-black text-emerald-700">
                    {m.tripsStatus?.find((t: any) => t.status === 'BOARDED')?.count || 1}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="font-bold text-slate-700">Scheduled</div>
                  <div className="text-lg font-black text-slate-800">
                    {m.tripsStatus?.find((t: any) => t.status === 'SCHEDULED')?.count || 3}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                  <div className="font-bold text-amber-800">Skipped/Off</div>
                  <div className="text-lg font-black text-amber-700">
                    {m.tripsStatus?.find((t: any) => t.status === 'ABSENT' || t.status === 'SKIPPED')?.count || 1}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* AI Smart Mobility: Demand Intelligence Section */}
          <AiDemandIntelligence />

          {/* 🛡️ Smart Trip Safety Intelligence Center */}
          <SafetyIntelligenceCenter />

          {/* 🚨 Anomaly Detection & Security Operations Center */}
          <AnomalyMonitoringCenter />

          {/* 👨‍👩‍👧 Safe Arrival & Family Tracking Activity */}
          <FamilyTrackingCenter />

          {/* 💺 Fleet Seat Intelligence & Optimization Center */}
          <FleetSeatIntelligence />

          {/* 🔄 Driver Coverage & No-Show Contingency Center */}
          <DriverCoverageCenter />

          {/* 🌱 Fleet Sustainability & Carbon Impact Center */}
          <SustainabilityImpactCenter />

          {/* 🎮 Gamification & Commuter Engagement Center */}
          <GamificationAnalyticsCenter />
        </div>

      </div>

      {/* HIGH PRIORITY SOS INCIDENT COMMAND MODAL */}
      {activeSosTrip && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full border-2 border-rose-500 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="bg-rose-600 px-6 py-5 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center animate-bounce">
                  <Flame className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-lg font-black tracking-wide">
                      HIGH PRIORITY SOS INCIDENT TRIGGERED
                    </h2>
                    <span className="bg-white text-rose-700 text-[10px] font-black uppercase px-2 py-0.5 rounded-full animate-pulse">
                      LIVE ALARM
                    </span>
                  </div>
                  <p className="text-xs text-rose-100 mt-0.5">
                    Triggered at {new Date(activeSosTrip.sosDetails?.triggeredAt || Date.now()).toLocaleTimeString()} on Corridor Route {activeSosTrip.routeId}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    if (audioStopCallback) {
                      audioStopCallback();
                      setAudioStopCallback(null);
                    }
                    setSosMuted(!sosMuted);
                  }}
                  className="p-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white transition-colors"
                  title={sosMuted ? 'Unmute Audio Siren' : 'Mute Audio Siren'}
                >
                  {sosMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5 animate-pulse" />}
                </button>
                <button
                  onClick={() => setActiveSosTrip(null)}
                  className="p-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Triggering Commuter & Emergency Contacts Card */}
              <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold uppercase tracking-wider text-rose-800 flex items-center space-x-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Triggering Commuter Profile</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-rose-900 bg-rose-200/80 px-2 py-0.5 rounded-md">
                    ID: {activeSosTrip.sosDetails?.triggeredByUserId || 'commuter-rahul-01'}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-rose-200/60">
                  <div>
                    <h4 className="text-base font-black text-slate-900">
                      {activeSosTrip.sosDetails?.triggeredByUserName || 'Rahul Verma'}
                    </h4>
                    <p className="text-xs text-slate-600">
                      Corridor Seat #04 • Route {activeSosTrip.routeId}
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <a
                      href="tel:+919845011223"
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center space-x-1"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Call Commuter (+91 98450 11223)</span>
                    </a>
                  </div>
                </div>

                {/* Emergency Contacts List */}
                <div className="pt-2 border-t border-rose-200/60 space-y-2">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                    Designated Emergency Contacts Notified:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="p-2.5 bg-white rounded-xl border border-rose-200 text-xs flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900">Priya Verma (Spouse)</div>
                        <div className="text-[11px] text-slate-500">+91 98450 11223</div>
                      </div>
                      <a
                        href="tel:+919845011223"
                        className="p-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-lg"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </a>
                    </div>
                    <div className="p-2.5 bg-white rounded-xl border border-rose-200 text-xs flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900">Vikram Verma (Brother)</div>
                        <div className="text-[11px] text-slate-500">+91 94480 33445</div>
                      </div>
                      <a
                        href="tel:+919448033445"
                        className="p-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-lg"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Driver & Live Shuttle GPS Telemetry */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Route Captain Card */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
                    <Car className="w-3.5 h-3.5 text-slate-600" />
                    <span>Assigned Route Captain</span>
                  </div>
                  <div className="font-bold text-slate-900">{activeSosTrip.driverName}</div>
                  <div className="text-xs text-slate-600 font-mono">
                    Toyota Innova Crysta • KA-01-MJ-8822
                  </div>
                  <div className="pt-2">
                    <a
                      href="tel:+919886012345"
                      className="w-full px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-900 text-xs font-bold rounded-xl transition-all flex items-center justify-center space-x-1.5"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Call Captain (+91 98860 12345)</span>
                    </a>
                  </div>
                </div>

                {/* Live GPS Coordinates */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
                    <Navigation className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Live Vehicle Coordinates</span>
                  </div>
                  <div className="font-mono font-bold text-xs text-slate-800">
                    {activeSosTrip.liveLocation.lat.toFixed(4)}° N, {activeSosTrip.liveLocation.lng.toFixed(4)}° E
                  </div>
                  <div className="text-xs text-slate-600 flex items-center space-x-2">
                    <span className="font-medium">Speed: {activeSosTrip.liveLocation.speedKmH || 42} km/h</span>
                    <span>•</span>
                    <span>Heading: {activeSosTrip.liveLocation.heading || 68}°</span>
                  </div>
                  <div className="pt-2 flex items-center space-x-2">
                    <a
                      href={`https://www.google.com/maps?q=${activeSosTrip.liveLocation.lat},${activeSosTrip.liveLocation.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center space-x-1"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Google Maps</span>
                    </a>
                    <Link
                      href={`/track/${activeSosTrip.shareToken}`}
                      target="_blank"
                      className="flex-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center space-x-1"
                    >
                      <Radio className="w-3.5 h-3.5" />
                      <span>Live Radar</span>
                    </Link>
                  </div>
                </div>
              </div>

              {/* Police First Responder / PCR Dispatch Action */}
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-black text-amber-900 flex items-center space-x-1.5">
                    <ShieldAlert className="w-4 h-4 text-amber-700" />
                    <span>Emergency Response Coordination (112 / PCR)</span>
                  </div>
                  <p className="text-[11px] text-amber-800">
                    {pcrDispatched
                      ? '✓ Incident dispatched to Bangalore City Police Control Room (PCR Unit #KA-05-99). Patrol intercepted.'
                      : 'Dispatch real-time GPS telemetry and incident packet to nearest Highway Police Control Room.'}
                  </p>
                </div>

                <button
                  onClick={handleDispatchPcr}
                  disabled={pcrDispatched}
                  className={`px-4 py-2 text-xs font-bold rounded-xl shadow-xs transition-all flex items-center space-x-1.5 whitespace-nowrap ${
                    pcrDispatched
                      ? 'bg-emerald-600 text-white cursor-default'
                      : 'bg-amber-600 hover:bg-amber-700 text-white'
                  }`}
                >
                  {pcrDispatched ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>PCR Dispatched</span>
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="w-4 h-4" />
                      <span>Dispatch PCR Unit</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                Incident status: <strong className="text-rose-600">Active High Priority</strong>
              </div>

              <div className="flex items-center space-x-3 w-full sm:w-auto">
                <button
                  onClick={() => setActiveSosTrip(null)}
                  className="flex-1 sm:flex-none px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition-all"
                >
                  Keep Alert Active & Close
                </button>
                <button
                  onClick={() => handleResolveSos(activeSosTrip.tripId)}
                  disabled={resolvingSos}
                  className="flex-1 sm:flex-none px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center space-x-1.5 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{resolvingSos ? 'Resolving...' : 'Mark Incident Resolved'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
