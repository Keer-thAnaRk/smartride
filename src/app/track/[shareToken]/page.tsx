'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ShieldCheck,
  Car,
  Navigation,
  Compass,
  Phone,
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Radio,
  ExternalLink,
  ChevronRight,
  Shield,
  LifeBuoy,
  Users,
  Activity,
  Award,
  RefreshCw,
} from 'lucide-react';
import { PublicTripProjection, listenToTripByShareToken } from '@/lib/firebase';
import axios from 'axios';

import SmartEtaCard from '@/components/smart-eta-card';
import SafetyScoreCard from '@/components/safety/safety-score-card';
import SafeArrivalCard from '@/components/tracking/safe-arrival-card';
import FamilyDelayBanner from '@/components/tracking/family-delay-banner';
import { SanitizedFamilyStatus } from '@/lib/tracking/safe-arrival-logic';

export default function PublicLiveTrackingPage() {
  const routerParams = useParams();
  const shareToken = (routerParams?.shareToken as string) || 'smart-live-sr101-7x9q';

  const [trip, setTrip] = useState<PublicTripProjection | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastPingTime, setLastPingTime] = useState<string>('Just now');
  const [operationalStatus, setOperationalStatus] = useState<any>(null);
  const [familyTracking, setFamilyTracking] = useState<SanitizedFamilyStatus | null>(null);
  const [isSessionExpiredState, setIsSessionExpiredState] = useState(false);
  const [expiredSummary, setExpiredSummary] = useState<any>(null);

  useEffect(() => {
    async function loadSanitizedStatus() {
      try {
        const res = await axios.get('/api/security/anomalies?tripId=trip-sr101-today');
        if (res.data?.success && res.data.sanitizedStatus) {
          setOperationalStatus(res.data.sanitizedStatus);
        }
      } catch (e) {
        // fallback
      }
    }
    loadSanitizedStatus();
    const interval = setInterval(loadSanitizedStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unsub = listenToTripByShareToken(shareToken, (liveTrip) => {
      if (liveTrip) {
        setTrip(liveTrip);
        setLastPingTime(new Date().toLocaleTimeString());
      }
      setLoading(false);
    });

    return () => {
      unsub();
    };
  }, [shareToken]);

  // Corridor stops
  const stops = [
    { name: 'HSR Layout BDA Complex', time: '08:00 AM', status: 'completed' },
    { name: 'Agara Lake Junction', time: '08:12 AM', status: 'completed' },
    { name: 'Bellandur Ecospace Gate 1', time: '08:25 AM', status: 'in_transit' },
    { name: 'Marathahalli Multiplex', time: '08:35 AM', status: 'upcoming' },
    { name: 'ITPB Tech Park Hub', time: '08:45 AM', status: 'upcoming' },
  ];

  useEffect(() => {
    async function loadFamilyTracking() {
      try {
        const res = await axios.get(`/api/track/${shareToken}`);
        if (res.data?.success) {
          if (res.data.isExpired) {
            setIsSessionExpiredState(true);
            setExpiredSummary(res.data.session);
          } else if (res.data.tracking) {
            setFamilyTracking(res.data.tracking);
          }
        }
      } catch (err) {
        // graceful fallback to live projection
      }
    }
    loadFamilyTracking();
    const interval = setInterval(loadFamilyTracking, 5000);
    return () => clearInterval(interval);
  }, [shareToken]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white space-y-4">
        <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin" />
        <div className="text-center">
          <h2 className="text-lg font-bold">Connecting to Live Corridor Telemetry...</h2>
          <p className="text-xs text-slate-400">Authenticating encrypted trip token {shareToken}</p>
        </div>
      </div>
    );
  }

  // 🔒 Expired Family Tracking Session View
  if (isSessionExpiredState) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full">
              Journey Concluded
            </span>
            <h2 className="text-2xl font-black text-white">Tracking Session Concluded</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              This secure tracking link has expired in accordance with SmartRide privacy protocols. The shuttle safely reached its destination.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-left text-xs space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Commuter</span>
              <span className="font-bold text-white">{expiredSummary?.commuterName || 'Rahul'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Destination</span>
              <span className="font-bold text-white truncate max-w-[200px]">{expiredSummary?.destinationStop || 'Ecospace Gate 1'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Arrival Time</span>
              <span className="font-bold text-emerald-400 font-mono">{expiredSummary?.arrivedAt || '08:47 AM'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Status</span>
              <span className="font-bold text-emerald-400 flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Trip Completed</span>
              </span>
            </div>
          </div>

          <a
            href="tel:+918007627891"
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl text-xs font-bold transition-all flex items-center justify-center space-x-2 border border-slate-700"
          >
            <Phone className="w-3.5 h-3.5 text-emerald-400" />
            <span>Contact Corridor Support Desk (+91 800 762 7891)</span>
          </a>
        </div>
      </div>
    );
  }

  const loc = trip?.liveLocation || { lat: 12.936, lng: 77.692, speedKmH: 42, heading: 68 };
  const isSos = trip?.status === 'sos_alert';
  const isTransit = trip?.status === 'in_transit';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-white">
      {/* Top Navigation Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-base font-black tracking-tight text-white">CommuteSync</span>
                <span className="text-[10px] uppercase font-bold tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  Live Radar
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Official Encrypted Family Commute Stream</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-slate-300">Ping: {lastPingTime}</span>
            </div>
            <a
              href="tel:+918007627891"
              className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition-all flex items-center space-x-1.5"
            >
              <LifeBuoy className="w-3.5 h-3.5" />
              <span>24/7 Safety Desk</span>
            </a>
          </div>
        </div>
      </header>

      {/* Emergency Incident Banner if active */}
      {isSos && (
        <div className="bg-rose-600 px-4 py-3 text-white">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-semibold">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 animate-bounce" />
              <span>
                Safety Alert Triggered on Shuttle KA-01-MJ-8822. Central Operations & Police Control Room actively tracking and responding.
              </span>
            </div>
            <a
              href="tel:+918007627891"
              className="px-3 py-1 bg-white text-rose-700 rounded-lg text-xs font-bold hover:bg-rose-50"
            >
              Contact Emergency Officer
            </a>
          </div>
        </div>
      )}

      {/* Main Stream Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Route Overview & Live Telemetry Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Corridor Info */}
          <div className="lg:col-span-2 bg-slate-900/90 rounded-3xl border border-slate-800 p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center space-x-1.5">
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Active Corporate Corridor • Route {trip?.routeId || 'SR-101'}</span>
                </div>
                <h1 className="text-2xl font-black text-white mt-1">
                  Whitefield Tech Express
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Direct nonstop express corridor connecting HSR residential hub to IT corridor
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Sanitized Operational Anomaly Status Badge */}
                {operationalStatus && (
                  <span
                    className={`px-3 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider flex items-center space-x-1.5 ${
                      operationalStatus.status === 'SAFETY_MONITORING'
                        ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30 animate-pulse'
                        : operationalStatus.status === 'MINOR_DELAY'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        operationalStatus.status === 'SAFETY_MONITORING'
                          ? 'bg-orange-400'
                          : operationalStatus.status === 'MINOR_DELAY'
                          ? 'bg-amber-400'
                          : 'bg-emerald-400'
                      }`}
                    />
                    <span>{operationalStatus.headline}</span>
                  </span>
                )}

                <span
                  className={`px-3 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider flex items-center space-x-1.5 ${
                    isSos
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse'
                      : isTransit
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isSos ? 'bg-rose-400' : isTransit ? 'bg-emerald-400 animate-ping' : 'bg-indigo-400'
                    }`}
                  />
                  <span>{isSos ? 'EMERGENCY SOS' : isTransit ? 'IN TRANSIT (LIVE)' : 'SCHEDULED'}</span>
                </span>
              </div>
            </div>

            {/* Sanitized Operational Reassurance Notice */}
            {operationalStatus && operationalStatus.status !== 'OPERATIONAL_NORMAL' && (
              <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span className="text-slate-300">{operationalStatus.message}</span>
                </div>
                {operationalStatus.delayMinutes > 0 && (
                  <span className="text-amber-400 font-mono font-bold whitespace-nowrap">
                    +{operationalStatus.delayMinutes} min
                  </span>
                )}
              </div>
            )}

            {/* Safe Arrival Card or Active Radar Stream */}
            {(() => {
              const isArrived = familyTracking?.isArrived || trip?.isArrived || trip?.status === 'completed';

              if (isArrived) {
                const safeArrivalStatus: Partial<SanitizedFamilyStatus> = familyTracking || {
                  commuterName: trip?.commuterName || 'Rahul',
                  destinationStop: trip?.destinationStop || 'Ecospace Gate 1',
                  arrivedAt: trip?.arrivedAt || '08:47 AM',
                  scheduledArrival: trip?.scheduledArrival || '08:25 AM',
                  routeCode: trip?.routeCode || 'SR-101',
                  vehiclePlate: trip?.vehiclePlate || 'KA-01-MJ-8822',
                  vehicleModel: trip?.vehicleModel || 'Toyota Innova Crysta',
                  delayMinutes: trip?.delayMinutes ?? 0,
                  expiresAt: trip?.expiresAt || '60 min post-arrival',
                };

                return (
                  <div className="pt-2">
                    <SafeArrivalCard status={safeArrivalStatus} />
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  {/* ⚠️ Commute Delay Banner */}
                  <FamilyDelayBanner
                    status={
                      familyTracking || {
                        commuterName: trip?.commuterName || 'Rahul',
                        delayMinutes: trip?.delayMinutes || 0,
                        updatedEta: '09:04 AM',
                        lastKnownLocation: 'Bellandur EcoSpace',
                      }
                    }
                  />

                  {/* 🚦 Smart ETA + Delay Prediction Card */}
                  <div className="pt-1">
                    <SmartEtaCard currentLocation={loc} theme="dark" compact={false} />
                  </div>

                  {/* Simulated Live Corridor Radar Map Canvas */}
                  <div className="relative h-64 rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center p-4">
                    {/* Radar Grid Pattern */}
                    <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px]" />

                    {/* Corridor Path Line */}
                    <div className="relative w-full max-w-lg h-2 bg-slate-800 rounded-full flex items-center justify-between px-2">
                      <div className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full w-3/5" />

                      {/* Animated Moving Shuttle Marker */}
                      <div
                        className="absolute z-20 flex flex-col items-center -top-8 transition-all duration-1000 ease-linear"
                        style={{ left: '58%' }}
                      >
                        <div className="bg-emerald-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg flex items-center space-x-1 animate-pulse">
                          <Car className="w-3 h-3" />
                          <span>KA-01-MJ-8822</span>
                        </div>
                        <div className="w-4 h-4 rounded-full bg-white border-2 border-emerald-500 shadow-md flex items-center justify-center mt-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
                        </div>
                      </div>

                      {/* Waypoint markers */}
                      <div className="w-3 h-3 rounded-full bg-emerald-400 ring-4 ring-emerald-500/20 z-10" title="HSR Layout" />
                      <div className="w-3 h-3 rounded-full bg-emerald-400 ring-4 ring-emerald-500/20 z-10" title="Agara" />
                      <div className="w-3.5 h-3.5 rounded-full bg-white ring-4 ring-emerald-400/40 z-10 animate-pulse" title="Ecospace" />
                      <div className="w-3 h-3 rounded-full bg-slate-700 z-10" title="Marathahalli" />
                      <div className="w-3 h-3 rounded-full bg-slate-700 z-10" title="ITPB Whitefield" />
                    </div>

                    {/* Bottom Corridor Label */}
                    <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <div className="flex items-center space-x-1">
                        <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                        <span>HSR Layout (Departed 08:00 AM)</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span>ITPB Whitefield (Est. 08:45 AM)</span>
                        <MapPin className="w-3.5 h-3.5 text-teal-400" />
                      </div>
                    </div>

                    {/* Floating Coordinates Tag */}
                    <div className="absolute top-3 left-4 bg-slate-900/80 border border-slate-800 px-3 py-1 rounded-xl text-[11px] font-mono text-slate-300 flex items-center space-x-2">
                      <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                      <span>GPS: {loc.lat.toFixed(4)}° N, {loc.lng.toFixed(4)}° E</span>
                    </div>

                    <a
                      href={`https://www.google.com/maps?q=${loc.lat},${loc.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute top-3 right-4 bg-slate-900/90 hover:bg-slate-800 border border-slate-700 px-3 py-1 rounded-xl text-[11px] font-bold text-emerald-400 flex items-center space-x-1 transition-all"
                    >
                      <span>Google Maps</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Captain Verification & Trust Badges */}
          <div className="space-y-6">
            {/* 🛡️ Sanitized Public Safety Indicator */}
            <SafetyScoreCard
              trip={trip}
              liveLocation={loc}
              theme="dark"
              mode="public"
            />

            <div className="bg-slate-900/90 rounded-3xl border border-slate-800 p-6 space-y-5">

              <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
                <span>Verified Route Captain</span>
              </div>

              <div className="flex items-center space-x-3.5">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-slate-950 font-black text-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  RS
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Captain {trip?.driverPublicName || 'Rajesh'}</h3>
                  <div className="flex items-center space-x-2 text-xs text-slate-400 mt-0.5">
                    <span className="text-amber-400 font-bold">★ 4.96</span>
                    <span>•</span>
                    <span>5,200+ Verified Trips</span>
                  </div>
                  <div className="text-xs font-mono text-emerald-400 font-semibold mt-0.5">
                    {trip?.vehicleModel || 'Toyota Innova Crysta'} • {trip?.vehiclePlate || 'KA-01-MJ-8822'}
                  </div>
                </div>
              </div>

              {/* 3 Trust & Safety Badges */}
              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center space-x-2.5">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center flex-shrink-0">
                    <Shield className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-xs">
                    <div className="font-bold text-slate-200">Police Background Verified</div>
                    <div className="text-[10px] text-slate-400">Clear criminal record authenticated</div>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center space-x-2.5">
                  <div className="w-6 h-6 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center flex-shrink-0">
                    <Award className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-xs">
                    <div className="font-bold text-slate-200">Commercial License (HMV/LMV)</div>
                    <div className="text-[10px] text-slate-400">Karnataka Transport RTO verified</div>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center space-x-2.5">
                  <div className="w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center flex-shrink-0">
                    <Car className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-xs">
                    <div className="font-bold text-slate-200">Comprehensive Fleet Insurance</div>
                    <div className="text-[10px] text-slate-400">Rs. 20,00,000 passenger cover active</div>
                  </div>
                </div>
              </div>

              {/* Corridor Operations Support Desk (Protects private driver phone) */}
              <a
                href="tel:+918007627891"
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl text-xs font-bold transition-all flex items-center justify-center space-x-2 border border-slate-700"
              >
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                <span>Contact Corridor Operations Desk (+91 800 762 7891)</span>
              </a>
            </div>

            {/* Commuter Boarding Status - Sanitized (Zero PII / No Names / No OTPs) */}
            <div className="bg-slate-900/90 rounded-3xl border border-slate-800 p-6 space-y-4">
              <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Reserved Seat Manifest (Privacy Protected)</span>
              </div>

              <div className="space-y-2">
                <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 font-mono font-bold flex items-center justify-center text-[10px]">
                      01
                    </div>
                    <div>
                      <div className="font-bold text-white">Reserved Commuter Seat #01</div>
                      <div className="text-[10px] text-slate-400">Corridor Pass Active</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1.5 text-emerald-400 text-[11px] font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Boarded & Verified</span>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 font-mono font-bold flex items-center justify-center text-[10px]">
                      02
                    </div>
                    <div>
                      <div className="font-bold text-white">Reserved Commuter Seat #02</div>
                      <div className="text-[10px] text-slate-400">Corridor Pass Active</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1.5 text-teal-400 text-[11px] font-bold">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Pickup Scheduled</span>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 font-mono font-bold flex items-center justify-center text-[10px]">
                      03
                    </div>
                    <div>
                      <div className="font-bold text-white">Reserved Commuter Seat #03</div>
                      <div className="text-[10px] text-slate-400">Corridor Pass Active</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1.5 text-teal-400 text-[11px] font-bold">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Pickup Scheduled</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Emergency Operations Desk */}
            <div className="bg-gradient-to-br from-rose-950/40 to-slate-900 rounded-3xl border border-rose-900/50 p-6 space-y-3">
              <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-rose-400">
                <LifeBuoy className="w-4 h-4" />
                <span>24/7 SmartRide Emergency Operations</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Need immediate roadside dispatch or route concierge assistance? Our safety command center is standing by 24/7.
              </p>
              <div className="pt-2 flex flex-col gap-2">
                <a
                  href="tel:+918007627891"
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold text-center transition-all shadow-md shadow-rose-600/20 flex items-center justify-center space-x-1.5"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call Emergency Desk: 1800-SMART-911</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
