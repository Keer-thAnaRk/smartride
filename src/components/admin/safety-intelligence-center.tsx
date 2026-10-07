'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  ShieldCheck,
  ShieldAlert,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Car,
  Navigation,
  Compass,
  MapPin,
  FileText,
  UserCheck,
  Activity,
  Radio,
  ExternalLink,
  ChevronRight,
  Eye,
  Check,
  X,
  Search,
  RefreshCw,
  Info,
} from 'lucide-react';
import {
  FirestoreTrip,
  listenToAllActiveTrips,
  listenToTrip,
  getOrCreateDefaultTrip,
} from '@/lib/firebase';
import { calculateTripSafetyScore } from '@/lib/safety/scoring-engine';
import { SafetyEvent, SafetyScoreResult } from '@/lib/safety/types';
import SafetyScoreCard from '@/components/safety/safety-score-card';

export default function SafetyIntelligenceCenter() {
  const [activeTrips, setActiveTrips] = useState<FirestoreTrip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<FirestoreTrip | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [eventToResolve, setEventToResolve] = useState<SafetyEvent | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Simulated fleet data across multiple active routes
  const [allFleetTrips, setAllFleetTrips] = useState<any[]>([
    {
      tripId: 'trip-sr101-today',
      routeCode: 'SR-101',
      routeName: 'HSR Layout → ITPB Whitefield',
      driverName: 'Rajesh Sharma',
      vehiclePlate: 'KA-01-MJ-8822',
      vehicleModel: 'Toyota Innova Crysta',
      driver: { isVerified: true, name: 'Rajesh Sharma' },
      vehicle: { isApproved: true, licensePlate: 'KA-01-MJ-8822', rcDocUrl: 'valid', insuranceDocUrl: 'valid' },
      liveLocation: { lat: 12.9360, lng: 77.6920, speedKmH: 42, heading: 68, updatedAt: new Date().toISOString() },
      status: 'in_transit',
      passengers: [
        { name: 'Rahul Verma', boarded: true },
        { name: 'Priya Sharma', boarded: true },
        { name: 'Amit Patel', boarded: true },
        { name: 'Demo Explorer', boarded: true },
      ],
    },
    {
      tripId: 'trip-sr102-today',
      routeCode: 'SR-102',
      routeName: 'Koramangala 4th Block → Bellandur EcoSpace',
      driverName: 'Arun Kumar',
      vehiclePlate: 'KA-03-AA-4411',
      vehicleModel: 'Maruti Ertiga Hybrid',
      driver: { isVerified: true, name: 'Arun Kumar' },
      vehicle: { isApproved: true, licensePlate: 'KA-03-AA-4411', rcDocUrl: 'valid', insuranceDocUrl: 'valid' },
      liveLocation: { lat: 12.9390, lng: 77.6980, speedKmH: 62, heading: 75, updatedAt: new Date().toISOString() },
      status: 'in_transit',
      passengers: [
        { name: 'Neha Joshi', boarded: true },
        { name: 'Siddharth Rao', boarded: true },
      ],
    },
    {
      tripId: 'trip-sr103-today',
      routeCode: 'SR-103',
      routeName: 'Indiranagar 100ft Rd → Manyata Embassy Park',
      driverName: 'Suresh Babu',
      vehiclePlate: 'KA-04-NB-1092',
      vehicleModel: 'Force Urbania AC',
      driver: { isVerified: true, name: 'Suresh Babu' },
      vehicle: { isApproved: true, licensePlate: 'KA-04-NB-1092', rcDocUrl: 'valid', insuranceDocUrl: 'valid' },
      liveLocation: { lat: 13.0450, lng: 77.6210, speedKmH: 36, heading: 12, updatedAt: new Date().toISOString() },
      status: 'in_transit',
      passengers: [
        { name: 'Kavita Nair', boarded: true },
        { name: 'Rohan Mehra', boarded: true },
        { name: 'Tanvi Desai', boarded: true },
      ],
    },
  ]);

  // Real-time synchronization with primary simulated trip
  useEffect(() => {
    const unsub = listenToTrip('trip-sr101-today', (liveTrip) => {
      if (liveTrip) {
        setAllFleetTrips((prev) =>
          prev.map((t) =>
            t.tripId === 'trip-sr101-today'
              ? {
                  ...t,
                  liveLocation: liveTrip.liveLocation,
                  status: liveTrip.status,
                  sosDetails: liveTrip.sosDetails,
                  passengers: liveTrip.passengers,
                }
              : t
          )
        );
      }
    });

    return () => unsub();
  }, []);

  // Compute live scores for all trips
  const evaluatedTrips = allFleetTrips.map((t) => {
    const result: SafetyScoreResult = calculateTripSafetyScore({
      tripId: t.tripId,
      status: t.status,
      liveLocation: t.liveLocation,
      driver: t.driver,
      vehicle: t.vehicle,
      passengers: t.passengers,
      sosDetails: t.sosDetails,
      existingEvents: t.activeSafetyEvents || [],
    });
    return {
      ...t,
      safety: result,
    };
  });

  // Calculate fleet aggregated safety metrics
  const totalTrips = evaluatedTrips.length;
  const avgScore = totalTrips > 0 ? Math.round(evaluatedTrips.reduce((acc, curr) => acc + curr.safety.score, 0) / totalTrips) : 100;
  const activeEventsCount = evaluatedTrips.reduce((acc, curr) => acc + curr.safety.activeEvents.length, 0);
  const criticalCount = evaluatedTrips.filter((t) => t.safety.riskLevel === 'CRITICAL').length;

  // Active prominent safety alert (e.g. Any trip with active SOS or High/Critical risk)
  const alertTrip = evaluatedTrips.find((t) => t.safety.riskLevel === 'CRITICAL' || t.safety.riskLevel === 'HIGH');

  const handleOpenResolveModal = (event: SafetyEvent) => {
    setEventToResolve(event);
    setResolutionNote(`Resolved following central dispatcher communication on route.`);
    setShowResolveModal(true);
  };

  const handleConfirmResolveEvent = async () => {
    if (!eventToResolve) return;
    setIsResolving(true);
    try {
      await axios.post('/api/safety/events/resolve', {
        eventId: eventToResolve.id,
        status: 'RESOLVED',
        resolutionNote,
      });

      // Update local fleet event state
      setAllFleetTrips((prev) =>
        prev.map((trip) => ({
          ...trip,
          activeSafetyEvents: (trip.activeSafetyEvents || []).map((e: any) =>
            e.id === eventToResolve.id
              ? { ...e, status: 'RESOLVED', resolutionNote, resolvedAt: new Date().toISOString() }
              : e
          ),
        }))
      );

      setToastMessage(`✓ Event "${eventToResolve.title}" marked as RESOLVED.`);
      setShowResolveModal(false);
      setEventToResolve(null);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      setToastMessage('Failed to update event resolution.');
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <section id="safety-intelligence" className="space-y-6 pt-4">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold flex-shrink-0 shadow-inner">
            <ShieldCheck className="w-7 h-7 text-emerald-600" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-black text-slate-900">
                Safety Intelligence Center
              </h2>
              <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
                Telemetry Telematics
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Continuous 6-dimension risk evaluation across active corridors: driver verification, vehicle roadworthiness, OTP onboarding & corridor telemetry.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs font-mono bg-slate-900 text-white px-3 py-1.5 rounded-xl flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Telemetry Bus Live</span>
          </span>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-4 rounded-2xl bg-slate-900 text-white flex items-center justify-between text-xs font-medium border border-slate-700 shadow-lg animate-fadeIn">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* High-Priority Active Alert Banner (Section 17) */}
      {alertTrip && (
        <div className="p-5 rounded-3xl bg-rose-50 border-2 border-rose-500 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-2xl bg-rose-600 text-white flex items-center justify-center font-bold animate-bounce flex-shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-black uppercase tracking-wider bg-rose-600 text-white px-2 py-0.5 rounded-md">
                  Active Safety Alert
                </span>
                <span className="text-xs font-bold text-rose-900">
                  Trip {alertTrip.routeCode} ({alertTrip.routeName})
                </span>
              </div>
              <div className="text-sm font-black text-slate-900 mt-0.5">
                Safety Score: <span className="text-rose-600">{alertTrip.safety.score}/100</span> ({alertTrip.safety.riskLabel})
              </div>
              <p className="text-xs text-rose-800 mt-0.5">
                Primary Reason: {alertTrip.safety.primaryReason}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2.5 self-start sm:self-auto">
            <button
              onClick={() => {
                setSelectedTrip(alertTrip);
                setShowDetailModal(true);
              }}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all"
            >
              Investigate Telemetry
            </button>
            {alertTrip.safety.activeEvents[0] && (
              <button
                onClick={() => handleOpenResolveModal(alertTrip.safety.activeEvents[0])}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all"
              >
                Resolve Event
              </button>
            )}
          </div>
        </div>
      )}

      {/* 4 Core Executive Safety KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Monitored Active Trips */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-1">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Active Monitored Trips</span>
            <Compass className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{totalTrips} Trips</div>
          <div className="text-xs text-slate-500">100% under GPS telemetry tracking</div>
        </div>

        {/* KPI 2: Fleet Average Safety Score */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-1">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Fleet Avg Safety Score</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-black text-emerald-600">{avgScore} / 100</span>
            <span className="text-xs font-black text-emerald-700 uppercase">
              {avgScore >= 90 ? '🟢 Low Risk' : avgScore >= 75 ? '🟡 Moderate' : '🔴 Critical'}
            </span>
          </div>
          <div className="text-xs text-slate-500">Weighted operational telemetry</div>
        </div>

        {/* KPI 3: Active Safety Anomalies */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-1">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Active Safety Events</span>
            <Activity className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{activeEventsCount} Events</div>
          <div className="text-xs text-slate-500">
            {activeEventsCount === 0 ? 'Zero active corridor anomalies' : 'Corridor deviations or speed alerts'}
          </div>
        </div>

        {/* KPI 4: Critical Alerts */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-1">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Critical Alerts</span>
            <ShieldAlert className="w-4 h-4 text-rose-600" />
          </div>
          <div className={`text-2xl font-black ${criticalCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
            {criticalCount} Critical
          </div>
          <div className="text-xs text-slate-500">Immediate response required</div>
        </div>
      </div>

      {/* Primary Trip Safety Score Card (Route SR-101 Highlight) */}
      <SafetyScoreCard
        trip={evaluatedTrips[0]}
        liveLocation={evaluatedTrips[0]?.liveLocation}
        theme="light"
        mode="full"
      />

      {/* Live Fleet Trip Safety Table (Section 16) */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Live Corridor Trip Safety Roster
            </h3>
            <p className="text-xs text-slate-500">
              Real-time multi-shuttle telemetry risk matrix with one-click investigative drilldown
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Auto-refreshing via Firestore telemetry bus
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3 px-4">Trip / Corridor</th>
                <th className="py-3 px-4">Driver & Vehicle</th>
                <th className="py-3 px-4 text-center">Safety Score</th>
                <th className="py-3 px-4">Risk Status</th>
                <th className="py-3 px-4">Active Telemetry Event</th>
                <th className="py-3 px-4">Last GPS Ping</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium">
              {evaluatedTrips.map((t) => (
                <tr key={t.tripId} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-slate-900">{t.routeCode}</div>
                    <div className="text-[11px] text-slate-500 line-clamp-1">{t.routeName}</div>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="font-bold text-slate-800">{t.driverName}</div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      {t.vehiclePlate} • {t.vehicleModel}
                    </div>
                  </td>

                  <td className="py-3.5 px-4 text-center">
                    <span
                      className={`inline-block px-3 py-1 rounded-xl font-black text-sm ${
                        t.safety.score >= 90
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : t.safety.score >= 75
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-rose-100 text-rose-800 border border-rose-200'
                      }`}
                    >
                      {t.safety.score}
                    </span>
                  </td>

                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        t.safety.riskLevel === 'LOW'
                          ? 'bg-emerald-100 text-emerald-800'
                          : t.safety.riskLevel === 'MODERATE'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {t.safety.riskLabel}
                    </span>
                  </td>

                  <td className="py-3.5 px-4">
                    {t.safety.activeEvents.length > 0 ? (
                      <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[11px] font-bold inline-flex items-center space-x-1">
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        <span>{t.safety.activeEvents[0].title}</span>
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs flex items-center space-x-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span>All systems nominal</span>
                      </span>
                    )}
                  </td>

                  <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                    {t.liveLocation?.speedKmH || 0} km/h • 6 sec ago
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => {
                        setSelectedTrip(t);
                        setShowDetailModal(true);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all flex items-center space-x-1 ml-auto"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-600" />
                      <span>Investigate</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* EVENT RESOLUTION MODAL (Section 18) */}
      {showResolveModal && eventToResolve && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 space-y-5 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">Resolve Safety Anomaly</h3>
              </div>
              <button
                onClick={() => setShowResolveModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-1">
              <div className="text-xs font-bold text-amber-900">{eventToResolve.title}</div>
              <p className="text-xs text-amber-800">{eventToResolve.description}</p>
              <div className="text-[10px] text-amber-700 font-mono pt-1">
                Detected: {new Date(eventToResolve.detectedAt).toLocaleString()}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Resolution & Audit Note</label>
              <textarea
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                rows={3}
                className="w-full p-3 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Enter dispatcher notes (e.g. Route obstruction bypassed, verified with captain via radio)."
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setShowResolveModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmResolveEvent}
                disabled={isResolving}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all flex items-center space-x-1.5 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{isResolving ? 'Resolving...' : 'Confirm Resolution'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INVESTIGATIVE DRILLDOWN MODAL */}
      {showDetailModal && selectedTrip && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full border border-slate-200 shadow-2xl p-6 space-y-6 max-h-[85vh] overflow-y-auto animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Corridor Safety Drilldown: {selectedTrip.routeCode}
                </h3>
                <p className="text-xs text-slate-500">{selectedTrip.routeName}</p>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <SafetyScoreCard
              trip={selectedTrip}
              liveLocation={selectedTrip.liveLocation}
              theme="light"
              mode="full"
              compact={false}
            />

            <div className="flex justify-end">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
              >
                Close Drilldown
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
