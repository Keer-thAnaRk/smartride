'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Car,
  Clock,
  Compass,
  MapPin,
  Phone,
  Play,
  CheckCircle,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Users,
  RefreshCw,
  Award,
  Navigation,
  Sparkles,
  ShieldCheck,
  UserCheck,
  Calendar,
  CalendarDays,
  Send,
  X,
  AlertTriangle,
  FileText,
  KeyRound,
  Lock,
  Radio,
  Navigation2,
  ShieldAlert,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/components/auth-context';
import {
  syncLeaveRequestToFirestore,
  listenToLeaveRequests,
  listenToTrip,
  verifyPassengerOtp,
  updateTripInFirestore,
  getOrCreateDefaultTrip,
  FirestoreTrip,
} from '@/lib/firebase';
import { LeaveRequest } from '@/types';
import SmartEtaCard from '@/components/smart-eta-card';
import SafetyScoreCard from '@/components/safety/safety-score-card';
import DriverCheckInBanner from '@/components/driver/driver-check-in-banner';

export default function DriverDashboard() {
  const { user } = useAuth();
  const [tripType, setTripType] = useState<'MORNING_PICKUP' | 'EVENING_DROP'>('MORNING_PICKUP');
  const [data, setData] = useState<any>(null);
  const [onboardingProfile, setOnboardingProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tripActionLoading, setTripActionLoading] = useState(false);
  const [statusActionLoading, setStatusActionLoading] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 🛡️ Commute Safety Suite Trip State
  const [activeTrip, setActiveTrip] = useState<FirestoreTrip | null>(null);
  const [otpInputs, setOtpInputs] = useState<Record<string, string>>({});
  const [otpErrors, setOtpErrors] = useState<Record<string, string>>({});
  const [verifyingOtpId, setVerifyingOtpId] = useState<string | null>(null);
  const [gpsSimulating, setGpsSimulating] = useState(false);
  const [gpsWaypointIndex, setGpsWaypointIndex] = useState(0);

  // Verification status determination
  const isVerified = (user as any)?.driverProfile?.isVerified === true || data?.driver?.isVerified === true;

  // Load onboarding profile when driver is unverified for summary cards
  useEffect(() => {
    if (!isVerified) {
      axios.get('/api/driver/onboarding')
        .then((res) => {
          if (res.data?.driverProfile) {
            setOnboardingProfile(res.data.driverProfile);
          }
        })
        .catch(() => {});
    }
  }, [isVerified]);

  // 🚨 Anomaly Detection & Corridor Operational Advisories (Only for verified drivers with assigned route)
  const [operationalAdvisories, setOperationalAdvisories] = useState<any>(null);

  useEffect(() => {
    if (!isVerified || !data?.route?.id) {
      setOperationalAdvisories(null);
      return;
    }

    async function loadDriverAdvisories() {
      try {
        const tripId = activeTrip?.tripId || (data?.route?.code ? `trip-${data.route.code.toLowerCase()}-today` : 'trip-sr101-today');
        const res = await axios.get(`/api/security/anomalies?tripId=${tripId}`);
        if (res.data?.success && res.data.operationalAdvisories) {
          setOperationalAdvisories(res.data.operationalAdvisories);
        }
      } catch (e) {
        // fallback
      }
    }
    loadDriverAdvisories();
    const interval = setInterval(loadDriverAdvisories, 6000);
    return () => clearInterval(interval);
  }, [isVerified, data?.route?.id, data?.route?.code, activeTrip?.tripId]);

  // Leave Management State
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [leavesLoading, setLeavesLoading] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reasonCategory, setReasonCategory] = useState('Personal Emergency');
  const [reasonNotes, setReasonNotes] = useState('');
  const [dateError, setDateError] = useState<string | null>(null);
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);

  const loadLeaves = async () => {
    try {
      setLeavesLoading(true);
      const res = await axios.get('/api/driver/leave');
      if (res.data?.success) {
        setLeaves(res.data.leaves);
      }
    } catch (err) {
      console.error('Error loading driver leaves:', err);
    } finally {
      setLeavesLoading(false);
    }
  };

  const loadRoster = async () => {
    try {
      const res = await axios.get(`/api/driver/roster?tripType=${tripType}`);
      if (res.data?.success) {
        setData(res.data);
      }

    } catch (err) {
      console.error('Error loading driver roster:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoster();
  }, [tripType]);

  useEffect(() => {
    loadLeaves();

    const unsubscribe = listenToLeaveRequests(() => {
      loadLeaves();
    });

    const handleRefresh = () => {
      loadLeaves();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('refresh-leaves-list', handleRefresh);
      window.addEventListener('driver-leave-updated', handleRefresh);
    }

    return () => {
      if (unsubscribe) unsubscribe();
      if (typeof window !== 'undefined') {
        window.removeEventListener('refresh-leaves-list', handleRefresh);
        window.removeEventListener('driver-leave-updated', handleRefresh);
      }
    };
  }, []);

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDateError(null);

    const todayStr = new Date().toISOString().split('T')[0];

    if (!startDate) {
      setDateError('Please select a start date.');
      return;
    }
    if (startDate < todayStr) {
      setDateError('Start date cannot be in the past.');
      return;
    }
    if (!endDate) {
      setDateError('Please select an end date.');
      return;
    }
    if (endDate < startDate) {
      setDateError('End date must be on or after start date.');
      return;
    }

    const finalReason = reasonNotes.trim()
      ? `${reasonCategory}: ${reasonNotes.trim()}`
      : reasonCategory;

    try {
      setLeaveSubmitting(true);
      const res = await axios.post('/api/driver/leave', {
        startDate,
        endDate,
        reason: finalReason,
      });

      if (res.data?.success) {
        if (res.data.leaveRequest) {
          await syncLeaveRequestToFirestore({
            requestId: res.data.leaveRequest.id,
            driverId: res.data.leaveRequest.driverId,
            driverName: res.data.leaveRequest.driverName,
            assignedRouteId: res.data.leaveRequest.assignedRouteId,
            startDate: res.data.leaveRequest.startDate,
            endDate: res.data.leaveRequest.endDate,
            reason: res.data.leaveRequest.reason,
            status: 'pending',
          });
        }

        setToastMessage(res.data.message || 'Leave request submitted. Awaiting Operations Admin approval.');
        setShowLeaveModal(false);
        setStartDate('');
        setEndDate('');
        setReasonNotes('');
        setDateError(null);
        await loadLeaves();
      }
    } catch (err: any) {
      setDateError(err.response?.data?.error || 'Failed to submit leave request');
    } finally {
      setLeaveSubmitting(false);
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  // Route corridor coordinates for simulated live GPS broadcast
  const CORRIDOR_COORDINATES = [
    { lat: 12.9121, lng: 77.6446, heading: 68 },
    { lat: 12.9250, lng: 77.6680, heading: 72 },
    { lat: 12.9360, lng: 77.6920, heading: 65 },
    { lat: 12.9550, lng: 77.7010, heading: 55 },
    { lat: 12.9850, lng: 77.7314, heading: 45 },
  ];

  // GPS Simulation Loop (active when trip is in transit for verified drivers)
  useEffect(() => {
    if (!isVerified || !data?.route?.id) return;
    let interval: any = null;
    if (gpsSimulating || activeTrip?.status === 'in_transit') {
      const tripId = activeTrip?.tripId || (data?.route?.code ? `trip-${data.route.code.toLowerCase()}-today` : 'trip-sr101-today');
      interval = setInterval(() => {
        setGpsWaypointIndex((prev) => {
          const next = (prev + 1) % CORRIDOR_COORDINATES.length;
          const loc = CORRIDOR_COORDINATES[next];
          updateTripInFirestore(tripId, {
            liveLocation: {
              ...loc,
              speedKmH: Math.floor(38 + Math.random() * 10),
              updatedAt: new Date().toISOString(),
            },
          });
          return next;
        });
      }, 3500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isVerified, data?.route?.id, data?.route?.code, gpsSimulating, activeTrip?.status, activeTrip?.tripId]);

  // Real-time trip listener (only for verified drivers with assigned route)
  useEffect(() => {
    if (!isVerified || !data?.route?.id) {
      setActiveTrip(null);
      return;
    }

    const tripId = data?.route?.code ? `trip-${data.route.code.toLowerCase()}-today` : 'trip-sr101-today';
    const unsubTrip = listenToTrip(tripId, (trip) => {
      if (trip) setActiveTrip(trip);
    });

    return () => {
      unsubTrip();
    };
  }, [isVerified, data?.route?.id, data?.route?.code]);

  const handleVerifyOtp = async (commuterId: string, passengerName: string) => {
    const entered = (otpInputs[commuterId] || '').trim();
    if (!entered || entered.length !== 4) {
      setOtpErrors((prev) => ({ ...prev, [commuterId]: 'Enter 4-digit OTP' }));
      return;
    }

    setVerifyingOtpId(commuterId);
    setOtpErrors((prev) => ({ ...prev, [commuterId]: '' }));

    const tripId = activeTrip?.tripId || (data?.route?.code ? `trip-${data.route.code.toLowerCase()}-today` : 'trip-sr101-today');
    const todayStr = new Date().toISOString().split('T')[0];
    const res = await verifyPassengerOtp(tripId, commuterId, entered, data.route.id, tripType, todayStr);

    if (res.success) {
      setToastMessage(`✓ ${passengerName} verified successfully with OTP! Seat marked as Boarded.`);
      setGpsSimulating(true);
      await loadRoster();
      setOtpInputs((prev) => ({ ...prev, [commuterId]: '' }));
      setTimeout(() => setToastMessage(null), 4000);
    } else {
      setOtpErrors((prev) => ({
        ...prev,
        [commuterId]: res.error || 'Invalid OTP. Ask commuter for their 4-digit code.',
      }));
    }
    setVerifyingOtpId(null);
  };

  const handleTripAction = async (action: 'START' | 'COMPLETE') => {
    if (!data?.route?.id) return;

    // Lifecycle Guard: Prevent driver from marking Trip Started until at least 1 commuter OTP verified
    if (action === 'START') {
      const hasBoardedInTrip = activeTrip?.passengers?.some((p) => p.boarded);
      const hasBoardedInRoster = roster.some((r: any) => r.status === 'BOARDED');
      if (!hasBoardedInTrip && !hasBoardedInRoster) {
        setToastMessage('⚠️ Cannot Start Trip: Please verify at least 1 commuter security OTP before starting dispatch.');
        return;
      }
    }

    try {
      setTripActionLoading(true);
      const tripId = activeTrip?.tripId || (data?.route?.code ? `trip-${data.route.code.toLowerCase()}-today` : 'trip-sr101-today');

      if (action === 'START') {
        await updateTripInFirestore(tripId, {
          status: 'in_transit',
        });
        setGpsSimulating(true);
      } else {
        await updateTripInFirestore(tripId, {
          status: 'completed',
          liveLocation: {
            lat: 12.9850,
            lng: 77.7314,
            heading: 45,
            speedKmH: 0,
            updatedAt: new Date().toISOString(),
          },
        });
        setGpsSimulating(false);
      }

      const res = await axios.post('/api/driver/trip', {
        routeId: data.route.id,
        tripType,
        action,
      });

      if (res.data?.success) {
        setToastMessage(`Trip successfully marked as ${action === 'START' ? 'In Progress' : 'Completed'}!`);
        await loadRoster();
      }
    } catch (err: any) {
      setToastMessage(err.response?.data?.error || 'Trip operation failed');
    } finally {
      setTripActionLoading(false);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const handleEndCommuteRoute = async () => {
    await handleTripAction('COMPLETE');
    setToastMessage('✓ Commute route ended! Confirmation alert sent to all boarded passengers.');
  };

  const handleAttendanceChange = async (commuterId: string, status: string) => {
    if (!data?.route?.id) return;
    try {
      setStatusActionLoading(commuterId);
      const res = await axios.patch('/api/driver/roster', {
        commuterId,
        routeId: data.route.id,
        tripType,
        status,
      });

      if (res.data?.success) {
        await loadRoster();
      }
    } catch (err: any) {
      setToastMessage(err.response?.data?.error || 'Failed to update attendance');
    } finally {
      setStatusActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-slate-50">
        <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    );
  }

  // 🛡️ UNVERIFIED / PENDING DRIVER EXPERIENCE
  if (!isVerified) {
    const profile = onboardingProfile || (user as any)?.driverProfile;
    const vehicle = profile?.vehicles?.[0] || data?.vehicle;

    return (
      <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800 text-xl font-bold">
                {user?.name?.charAt(0) || 'D'}
              </div>
              <div>
                <div className="flex items-center space-x-3">
                  <h1 className="text-2xl font-black text-slate-900">
                    {user?.name || data?.driver?.name || 'Driver'}
                  </h1>
                  <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-900 border border-amber-300 flex items-center space-x-1.5 shadow-xs">
                    <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" />
                    <span>⏳ Verification Pending</span>
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Your driver profile and submitted documents are currently under review by the operations team.
                </p>
              </div>
            </div>
          </div>

          {/* Card 1: Application Status / Progress Stepper */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Application Onboarding Status</h2>
                <p className="text-xs text-slate-500">Track your driver verification and corridor deployment lifecycle</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Step 1 */}
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-start space-x-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-slate-900">1. Account Registered</div>
                  <div className="text-[11px] text-emerald-700 font-medium">Completed • Credentials initialized</div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-start space-x-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-slate-900">2. Driver Information Submitted</div>
                  <div className="text-[11px] text-emerald-700 font-medium">Completed • KYC & license submitted</div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 ring-2 ring-amber-200/50 flex items-start space-x-3">
                <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5 animate-pulse" />
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                    <span>3. Admin Verification</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-200 text-amber-900">In Progress</span>
                  </div>
                  <div className="text-[11px] text-amber-800 font-medium mt-0.5">Operations team reviewing background check & documents</div>
                </div>
              </div>

              {/* Step 4 */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 opacity-75 flex items-start space-x-3">
                <Lock className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-slate-600">4. Vehicle Assignment</div>
                  <div className="text-[11px] text-slate-400">Locked • Assigned after admin approval</div>
                </div>
              </div>

              {/* Step 5 */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 opacity-75 flex items-start space-x-3">
                <Lock className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-slate-600">5. Route Assignment</div>
                  <div className="text-[11px] text-slate-400">Locked • Assigned corridor route & schedule</div>
                </div>
              </div>

              {/* Step 6 */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 opacity-75 flex items-start space-x-3">
                <Lock className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-slate-600">6. Driver Activation</div>
                  <div className="text-[11px] text-slate-400">Locked • Passenger manifest & dispatch unlocked</div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Submitted Information Summary */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Submitted Information Summary</h2>
                  <p className="text-xs text-slate-500">Record of submitted credentials currently under verification</p>
                </div>
              </div>
              <Link
                href="/driver/documents"
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 underline"
              >
                Edit Details
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Full Name</span>
                <span className="text-sm font-bold text-slate-900 mt-0.5 block truncate">
                  {user?.name || profile?.user?.name || '—'}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Phone</span>
                <span className="text-sm font-bold text-slate-900 mt-0.5 block truncate">
                  {user?.phone || profile?.user?.phone || '—'}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Email</span>
                <span className="text-sm font-bold text-slate-900 mt-0.5 block truncate">
                  {user?.email || profile?.user?.email || '—'}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">License Number</span>
                <span className="text-sm font-mono font-bold text-slate-900 mt-0.5 block truncate">
                  {profile?.licenseNumber || 'Submitted with registration'}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Experience</span>
                <span className="text-sm font-bold text-slate-900 mt-0.5 block">
                  {profile?.experienceYears ? `${profile.experienceYears} Years` : '—'}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Vehicle Model</span>
                <span className="text-sm font-bold text-slate-900 mt-0.5 block truncate">
                  {vehicle?.model ? `${vehicle.make || ''} ${vehicle.model}`.trim() : 'Pending Assignment'}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Vehicle Number</span>
                <span className="text-sm font-mono font-bold text-slate-900 mt-0.5 block truncate">
                  {vehicle?.licensePlate || 'Pending Assignment'}
                </span>
              </div>
            </div>

            {/* Document Verification Table */}
            <div className="pt-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Verification Documents</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-700">Aadhaar / ID</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    ✓ Submitted
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-700">Driving License</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    ✓ Submitted
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-700">RC / Vehicle</span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    vehicle?.rcDocUrl ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {vehicle?.rcDocUrl ? '✓ Submitted' : 'Not Provided'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-700">Insurance</span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    vehicle?.insuranceDocUrl ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {vehicle?.insuranceDocUrl ? '✓ Submitted' : 'Not Provided'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Next Steps & Contact Support */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 sm:p-8 rounded-3xl border border-slate-700 shadow-xl space-y-5">
            <div className="space-y-2">
              <h3 className="text-lg font-black text-white">Next Steps for Captain Activation</h3>
              <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                Once the operations team verifies your background check, driving license, and vehicle registration, an admin will assign your vehicle and daily route corridor.
              </p>
              <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
                You will receive full operational access to your passenger roster, dispatch controls, and earnings after approval.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-3">
              <Link
                href="/driver/documents"
                className="inline-flex items-center justify-center space-x-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>View / Update Documents</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 🚀 APPROVED / VERIFIED DRIVER OPERATIONAL DASHBOARD
  const roster = data?.roster || [];
  const currentTrip = data?.currentTrip;
  const isTripInProgress = currentTrip?.status === 'IN_PROGRESS';
  const isTripCompleted = currentTrip?.status === 'COMPLETED';

  const boardedCount = roster.filter((r: any) => r.status === 'BOARDED' || r.status === 'COMPLETED').length;
  const capacity = data?.vehicle?.capacity || 6;

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Welcome Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-800 text-xl font-bold overflow-hidden">
              {user?.avatar ? (
                <img src={user.avatar} alt="Driver" className="w-full h-full object-cover" />
              ) : (
                user?.name?.charAt(0) || 'D'
              )}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl font-black text-slate-900">
                  Route Captain {data?.driver?.name || user?.name}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center space-x-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Verified Captain</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Rating: {data?.driver?.rating ? `★ ${data.driver.rating}` : 'New Driver'} • Assigned Vehicle: {data?.vehicle ? `${data.vehicle.make} ${data.vehicle.model} (${data.vehicle.licensePlate})` : 'No vehicle assigned'}
              </p>
            </div>
          </div>

          {/* Header Action Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Shift Tab Switcher */}
            <div className="flex items-center p-1 bg-slate-100 rounded-2xl">
              <button
                onClick={() => setTripType('MORNING_PICKUP')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  tripType === 'MORNING_PICKUP'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Morning Pickup Shift
              </button>
              <button
                onClick={() => setTripType('EVENING_DROP')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  tripType === 'EVENING_DROP'
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Evening Drop Shift
              </button>
            </div>

            {/* Apply for Leave Modal Trigger */}
            <button
              onClick={() => {
                const today = new Date().toISOString().split('T')[0];
                setStartDate(today);
                setEndDate(today);
                setDateError(null);
                setShowLeaveModal(true);
              }}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-md shadow-amber-500/20 transition-all cursor-pointer whitespace-nowrap"
            >
              <Calendar className="w-4 h-4 text-slate-950" />
              <span>Apply for Leave</span>
            </button>
          </div>
        </div>

        {/* Toast Alert */}
        {toastMessage && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>{toastMessage}</span>
            </div>
            <button onClick={() => setToastMessage(null)} className="text-xs underline">
              Dismiss
            </button>
          </div>
        )}

        {/* 🔄 Pre-Dispatch Check-In & Standby Contingency Banner (Only when route assigned) */}
        {data?.route?.id && (
          <DriverCheckInBanner
            tripId={activeTrip?.tripId || `trip-${data.route.code?.toLowerCase() || 'sr101'}-today`}
            routeId={data.route.id}
            routeCode={data.route.code}
            routeName={data.route.name}
            scheduledDispatch={
              tripType === 'MORNING_PICKUP'
                ? data.route.morningStartTime || '08:00 AM'
                : data.route.eveningStartTime || '06:00 PM'
            }
            isStandbyAssignment={Boolean(data.route.assignedDriverId && data.route.assignedDriverId === data?.driver?.id && data?.driver?.status === 'STANDBY')}
            originalDriverName={data?.driver?.name || 'Captain'}
            onCheckInSuccess={() => {
              setToastMessage('✓ Driver Check-In confirmed for scheduled dispatch!');
              setTimeout(() => setToastMessage(null), 4000);
            }}
          />
        )}

        {/* Live Trip Controller Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-slate-700 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              {data?.route ? (
                <>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded">
                      {data.route.code}
                    </span>
                    <h2 className="text-xl font-black text-white">
                      {data.route.name}
                    </h2>
                  </div>
                  <p className="text-xs text-slate-400">
                    {data.route.origin} ➔ {data.route.destination} ({data.route.distanceKm} km)
                  </p>
                </>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-bold bg-slate-700 text-slate-300 px-2.5 py-0.5 rounded">
                      UNASSIGNED
                    </span>
                    <h2 className="text-xl font-black text-white">
                      No route assigned
                    </h2>
                  </div>
                  <p className="text-xs text-slate-400">
                    Contact operations admin to receive your corridor route assignment.
                  </p>
                </div>
              )}
            </div>

            {/* Trip Action Button & Lifecycle Safety Guard (Only if route assigned) */}
            {data?.route?.id && (
              <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
                {!isTripInProgress && !isTripCompleted && (
                  <>
                    {!activeTrip?.passengers?.some((p) => p.boarded) && !roster.some((r: any) => r.status === 'BOARDED') && (
                      <span className="text-[11px] text-amber-400 font-bold bg-amber-950/80 border border-amber-500/40 px-3 py-1.5 rounded-xl flex items-center space-x-1.5 shadow-2xs">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        <span>Verify at least 1 commuter OTP to start trip</span>
                      </span>
                    )}
                    <button
                      onClick={() => handleTripAction('START')}
                      disabled={
                        tripActionLoading ||
                        (!activeTrip?.passengers?.some((p) => p.boarded) && !roster.some((r: any) => r.status === 'BOARDED'))
                      }
                      className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 flex items-center space-x-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-slate-950" />
                      <span>{tripActionLoading ? 'Starting...' : 'Start Dispatch'}</span>
                    </button>
                  </>
                )}

                {isTripInProgress && (
                  <div className="flex items-center space-x-3">
                    <div className="px-3 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 text-xs font-bold flex items-center space-x-1.5">
                      <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                      <span>Live GPS Telemetry Active</span>
                    </div>
                    <button
                      onClick={handleEndCommuteRoute}
                      disabled={tripActionLoading}
                      className="px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-rose-600/20 flex items-center space-x-2 transition-all disabled:opacity-50 cursor-pointer"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>{tripActionLoading ? 'Ending Route...' : 'End Commute Route'}</span>
                    </button>
                  </div>
                )}

                {isTripCompleted && (
                  <div className="px-5 py-2.5 rounded-xl bg-emerald-950/80 border border-emerald-600/50 text-emerald-400 text-xs font-bold flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Trip Completed for Today</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-700/80">
            <div>
              <div className="text-xs text-slate-400">Dispatch Time</div>
              <div className="text-base font-black text-white mt-0.5">
                {tripType === 'MORNING_PICKUP' ? data?.route?.morningStartTime : data?.route?.eveningStartTime}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Total Manifest</div>
              <div className="text-base font-black text-white mt-0.5">
                {roster.length} Commuters
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Boarded / Dropped</div>
              <div className="text-base font-black text-emerald-400 mt-0.5">
                {boardedCount} / {roster.length}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Fleet Seat Capacity</div>
              <div className="text-base font-black text-teal-400 mt-0.5">
                {roster.length} / {capacity} Allocated
              </div>
            </div>
          </div>
        </div>

        {/* 🚨 Operational Corridor Guidance & Telemetry Advisory */}
        {operationalAdvisories && (
          <div className="p-4 rounded-3xl bg-slate-900 border border-slate-700/80 shadow-md text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-2xl bg-slate-800 flex items-center justify-center text-emerald-400 border border-slate-700 flex-shrink-0">
                <Compass className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                    Captain Dispatch Advisory
                  </span>
                  {operationalAdvisories.speedWarning ? (
                    <span className="text-xs font-bold text-rose-400 flex items-center space-x-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Speed Surge Warning</span>
                    </span>
                  ) : operationalAdvisories.corridorDeviation ? (
                    <span className="text-xs font-bold text-orange-400 flex items-center space-x-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Corridor Variance</span>
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-emerald-400 flex items-center space-x-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Corridor Compliant</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300">
                  {operationalAdvisories.corridorDeviation ||
                    operationalAdvisories.speedWarning ||
                    'Vehicle operating inside designated Bangalore tech corridor. Safe driving limits enforced.'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 flex-shrink-0 text-xs font-mono">
              <div className="bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
                <span className="text-slate-400 block text-[10px]">CURRENT SPEED</span>
                <span className={`font-bold ${operationalAdvisories.currentSpeedKmH > 55 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {operationalAdvisories.currentSpeedKmH} km/h
                </span>
              </div>
              <div className="bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
                <span className="text-slate-400 block text-[10px]">SPEED LIMIT</span>
                <span className="font-bold text-slate-200">55 km/h</span>
              </div>
            </div>
          </div>
        )}

        {/* 🚦 Smart ETA + Delay Prediction Controller (Only when route assigned) */}
        {data?.route?.id && (
          <SmartEtaCard
            currentLocation={activeTrip?.liveLocation}
            theme="dark"
            compact={false}
          />
        )}

        {/* 🛡️ Smart Trip Safety Score (Operational Driver Mode, only when route assigned) */}
        {data?.route?.id && (
          <SafetyScoreCard
            trip={activeTrip}
            liveLocation={activeTrip?.liveLocation}
            theme="dark"
            mode="driver"
          />
        )}


        {/* Commuter Manifest Table / Roster */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-emerald-600" />
              <h3 className="text-lg font-bold text-slate-900">
                Daily Passenger Manifest & Boarding Roster
              </h3>
            </div>
            <button
              onClick={() => loadRoster()}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              title="Refresh Roster"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {roster.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">No commuters currently assigned to this shift.</p>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              {roster.map((item: any, idx: number) => {
                // Check if boarded in active Firestore trip or local attendance status
                const tripPassenger = activeTrip?.passengers?.find(
                  (p) => p.userId === item.commuterId || p.name.toLowerCase() === item.name?.toLowerCase()
                );
                const isTripOtpBoarded = tripPassenger?.boarded || false;
                const isBoarded = item.status === 'BOARDED' || isTripOtpBoarded;
                const isCompleted = item.status === 'COMPLETED';
                const isAbsent = item.status === 'ABSENT' || item.status === 'SKIPPED';

                return (
                  <div
                    key={item.id || idx}
                    className={`p-4 rounded-2xl border transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                      isBoarded
                        ? 'bg-emerald-50/70 border-emerald-300'
                        : isCompleted
                        ? 'bg-slate-50 border-slate-200 opacity-80'
                        : isAbsent
                        ? 'bg-amber-50/50 border-amber-200'
                        : 'bg-white border-slate-200 shadow-xs'
                    }`}
                  >
                    {/* Left: Commuter details & seat */}
                    <div className="flex items-start space-x-3.5">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 text-white font-mono font-bold text-xs flex items-center justify-center flex-shrink-0">
                        #{item.seatNumber}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="text-sm font-bold text-slate-900">{item.name}</h4>
                          <span
                            className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                              isBoarded
                                ? 'bg-emerald-200 text-emerald-900'
                                : isCompleted
                                ? 'bg-slate-200 text-slate-800'
                                : isAbsent
                                ? 'bg-amber-200 text-amber-900'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {isBoarded ? 'BOARDED' : item.status}
                          </span>
                        </div>

                        <div className="text-xs text-slate-600 flex items-center space-x-2">
                          <MapPin className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                          <span>
                            <strong>Stop:</strong> {tripType === 'MORNING_PICKUP' ? item.pickupAddress : item.dropAddress}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-500 flex items-center space-x-2">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>Scheduled Time: <strong>{item.pickupTime}</strong></span>
                        </div>

                        {item.notes && (
                          <div className="text-[11px] text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded w-fit">
                            Note: {item.notes}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: OTP Verification & Contact Controls */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-200/80">
                      {isBoarded ? (
                        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-emerald-100/80 border border-emerald-300 text-emerald-800 text-xs font-bold">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Boarded (OTP Verified)</span>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1 w-full sm:w-auto">
                          <div className="flex items-center space-x-1.5">
                            <div className="relative">
                              <input
                                type="text"
                                maxLength={4}
                                placeholder="4-digit OTP"
                                value={otpInputs[item.commuterId] || ''}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/\D/g, '');
                                  setOtpInputs((prev) => ({ ...prev, [item.commuterId]: val }));
                                  if (otpErrors[item.commuterId]) {
                                    setOtpErrors((prev) => ({ ...prev, [item.commuterId]: '' }));
                                  }
                                }}
                                className={`w-28 px-2.5 py-1.5 text-xs font-mono font-bold tracking-widest text-center rounded-xl border bg-slate-50 focus:bg-white focus:outline-none transition-all ${
                                  otpErrors[item.commuterId]
                                    ? 'border-rose-400 focus:border-rose-500 ring-2 ring-rose-100'
                                    : 'border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100'
                                }`}
                              />
                            </div>

                            <button
                              onClick={() => handleVerifyOtp(item.commuterId, item.name)}
                              disabled={verifyingOtpId === item.commuterId}
                              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-all flex items-center space-x-1 disabled:opacity-50"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>{verifyingOtpId === item.commuterId ? 'Verifying...' : 'Verify & Board'}</span>
                            </button>
                          </div>
                          {otpErrors[item.commuterId] && (
                            <span className="text-[10px] text-rose-600 font-bold">
                              {otpErrors[item.commuterId]}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex items-center space-x-2">
                        <a
                          href={`tel:${item.phone}`}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center space-x-1"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>Call</span>
                        </a>

                        {!isBoarded && (
                          <button
                            onClick={() => handleAttendanceChange(item.commuterId, 'ABSENT')}
                            disabled={statusActionLoading === item.commuterId || isAbsent}
                            className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold disabled:opacity-40 transition-all"
                          >
                            No-Show
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Driver Leave History List */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-6 sm:p-8 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                <CalendarDays className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Leave Applications & Standby Coverage
                </h3>
                <p className="text-xs text-slate-500">
                  Manage requested time-off and view designated standby route captains
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => loadLeaves()}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                title="Refresh Leave History"
              >
                <RefreshCw className={`w-4 h-4 ${leavesLoading ? 'animate-spin text-emerald-600' : ''}`} />
              </button>
              <button
                onClick={() => {
                  const today = new Date().toISOString().split('T')[0];
                  setStartDate(today);
                  setEndDate(today);
                  setDateError(null);
                  setShowLeaveModal(true);
                }}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors flex items-center space-x-1.5"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>New Leave Request</span>
              </button>
            </div>
          </div>

          {leaves.length === 0 ? (
            <div className="text-center py-10 text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
              <p className="text-xs font-semibold text-slate-600">No leave requests submitted yet.</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Need time off? Click "Apply for Leave" above.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
                    <th className="pb-3 pr-4">Leave Window</th>
                    <th className="pb-3 px-4">Corridor Route</th>
                    <th className="pb-3 px-4">Reason for Leave</th>
                    <th className="pb-3 px-4">Standby Route Captain</th>
                    <th className="pb-3 px-4">Status</th>
                    <th className="pb-3 pl-4 text-right">Applied On</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leaves.map((l) => {
                    const isPending = l.status === 'pending';
                    const isApproved = l.status === 'approved';
                    const isRejected = l.status === 'rejected';

                    return (
                      <tr key={l.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 pr-4 font-bold text-slate-900 whitespace-nowrap">
                          <div className="flex items-center space-x-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{l.startDate} → {l.endDate}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-700 whitespace-nowrap">
                          <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-[11px] font-bold text-slate-800 mr-1.5">
                            {l.assignedRouteCode || data?.route?.code || '—'}
                          </span>
                          <span className="text-xs text-slate-500">{l.assignedRouteName}</span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                          {l.reason}
                        </td>
                        <td className="py-3.5 px-4">
                          {isApproved && l.replacementDriverName ? (
                            <div className="space-y-0.5">
                              <div className="font-bold text-emerald-800 flex items-center space-x-1">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Captain {l.replacementDriverName}</span>
                              </div>
                              {l.replacementVehicleModel && (
                                <div className="text-[10px] text-slate-500">
                                  {l.replacementVehicleModel} ({l.replacementLicensePlate || 'Verified Shuttle'})
                                </div>
                              )}
                            </div>
                          ) : isPending ? (
                            <span className="text-slate-400 italic text-[11px]">
                              Awaiting Admin assignment
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {isPending && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              <span>⏳ Pending Review</span>
                            </span>
                          )}
                          {isApproved && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <span>✓ Approved</span>
                            </span>
                          )}
                          {isRejected && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              <span>✕ Declined</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 pl-4 text-right text-slate-400 whitespace-nowrap text-[11px]">
                          {new Date(l.appliedAt).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Apply for Leave Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <Calendar className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Apply for Route Leave</h3>
                  <p className="text-xs text-slate-500">
                    Request planned leave; standby captain will cover your commuters
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowLeaveModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Validation Error Banner */}
            {dateError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{dateError}</span>
              </div>
            )}

            {/* Leave Form */}
            <form onSubmit={handleLeaveSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      if (endDate && e.target.value > endDate) {
                        setEndDate(e.target.value);
                      }
                      setDateError(null);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    End Date
                  </label>
                  <input
                    type="date"
                    required
                    min={startDate || new Date().toISOString().split('T')[0]}
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setDateError(null);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Reason Category
                </label>
                <select
                  value={reasonCategory}
                  onChange={(e) => setReasonCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden bg-white"
                >
                  <option value="Personal Emergency">Personal Emergency</option>
                  <option value="Medical Leave">Medical Leave / Health Checkup</option>
                  <option value="Vehicle Maintenance">Vehicle Maintenance & Servicing</option>
                  <option value="Family Event">Family Occasion / Event</option>
                  <option value="Planned Vacation">Planned Vacation / Time Off</option>
                  <option value="Other">Other Reason</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Additional Notes (Optional)
                </label>
                <textarea
                  rows={3}
                  value={reasonNotes}
                  onChange={(e) => setReasonNotes(e.target.value)}
                  placeholder="Provide any details for the operations dispatcher..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden"
                />
              </div>

              {/* Form Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowLeaveModal(false)}
                  disabled={leaveSubmitting}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={leaveSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center space-x-2 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{leaveSubmitting ? 'Submitting...' : 'Submit Leave Request'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

