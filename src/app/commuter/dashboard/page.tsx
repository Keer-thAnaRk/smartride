'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import axios from 'axios';
import UserAvatar from '@/components/ui/UserAvatar';
import {
  Car,
  Clock,
  Compass,
  MapPin,
  Phone,
  ShieldCheck,
  Star,
  User,
  Calendar,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  XCircle,
  X,
  FileText,
  CreditCard,
  ChevronRight,
  RefreshCw,
  Navigation,
  Lock,
  ArrowRight,
  Sparkles,
  Zap,
  Sliders,
  DollarSign,
  Info,
  PauseCircle,
  Map,
  Shield,
  ShieldAlert,
  AlertOctagon,
  Share2,
  Copy,
  Check,
  Siren,
  PhoneCall,
  UserCheck,
  Users,
} from 'lucide-react';
import { useAuth } from '@/components/auth-context';
import {
  listenToTrip,
  triggerSosAlert,
  resolveSosAlert,
  getOrCreateDefaultTrip,
  FirestoreTrip,
  EmergencyContact,
} from '@/lib/firebase';
import SmartEtaCard from '@/components/smart-eta-card';
import SafetyScoreCard from '@/components/safety/safety-score-card';
import SustainabilityCard from '@/components/commuter/sustainability-card';
import GamificationCard from '@/components/commuter/gamification-card';

// Realistic static mock profile for Guest / Demo mode
const GUEST_MOCK_PROFILE = {
  id: 'guest-demo-user',
  name: 'Demo Guest Explorer',
  email: 'guest.explorer@smartride.demo',
  phone: '+1 (555) 019-2834',
  avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
  subscriptions: [
    {
      id: 'guest-sub-101',
      status: 'ACTIVE',
      seatNumber: 1,
      pickupAddress: 'HSR Layout 27th Main (Near Sector 2)',
      dropAddress: 'ITPB Tech Park Hub (Gate 2)',
      morningPickupTime: '08:20 AM',
      eveningPickupTime: '06:15 PM',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      plan: {
        id: 'plan-monthly-1',
        name: 'Standard Monthly (5-Day Office Pass)',
        price: 129,
        billingCycle: 'MONTHLY',
      },
      route: {
        id: 'route-sr-101',
        name: 'HSR Layout 27th Main → ITPB Tech Park Hub',
        code: 'SR-101',
        origin: 'HSR Layout 27th Main',
        destination: 'ITPB Tech Park Hub',
        distanceKm: 24.5,
        estimatedMinutes: 50,
        waypoints: JSON.stringify([
          { stopName: 'HSR Layout 27th Main', landmark: 'Near Sector 2 Circle', estimatedPickupTime: '08:20 AM' },
          { stopName: 'Agara Lake Junction', landmark: 'Opposite Shell Fuel Station', estimatedPickupTime: '08:32 AM' },
          { stopName: 'Bellandur EcoSpace Flyover', landmark: 'Pedestrian Skywalk', estimatedPickupTime: '08:44 AM' },
          { stopName: 'Marathahalli Bridge', landmark: 'Multiplex Bus Stop', estimatedPickupTime: '08:55 AM' },
          { stopName: 'ITPB Tech Park Hub', landmark: 'Gate 2 Main Entrance', estimatedPickupTime: '09:10 AM' },
        ]),
        assignedDriver: {
          id: 'driver-rajesh',
          rating: 4.96,
          user: {
            name: 'Rajesh Sharma',
            phone: '+91 98450 12345',
            avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
          },
        },
        assignedVehicle: {
          id: 'veh-innova-1',
          make: 'Toyota',
          model: 'Innova Crysta',
          licensePlate: 'KA-01-MJ-8822',
          capacity: 6,
          type: 'AC Premium SUV',
        },
      },
    },
  ],
};

function CommuterDashboardContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const isGuestMode = searchParams.get('mode') === 'guest' || (!user && searchParams.get('mode') !== 'auth');

  const [profileData, setProfileData] = useState<any>(null);
  const [activeSubstitute, setActiveSubstitute] = useState<any>(null);
  const [attendances, setAttendances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Gated Feature Modal State
  const [showLockedModal, setShowLockedModal] = useState(false);
  const [lockedFeatureName, setLockedFeatureName] = useState<string>('');

  // 🛡️ Commute Safety Suite State
  const [activeTrip, setActiveTrip] = useState<FirestoreTrip | null>(null);
  const [showSosCountdownModal, setShowSosCountdownModal] = useState(false);
  const [sosCountdown, setSosCountdown] = useState(3);
  const [sosDispatched, setSosDispatched] = useState(false);
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareLinkCopied, setShareLinkCopied] = useState(false);
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([
    { name: 'Ananya Verma', phone: '+91 98765 43210', relationship: 'Spouse' },
    { name: 'Dr. R.K. Verma', phone: '+91 98111 44556', relationship: 'Father' },
    { name: 'Vikram Malhotra', phone: '+91 98111 22334', relationship: 'Brother' },
  ]);
  const [contactNameInput, setContactNameInput] = useState('');
  const [contactPhoneInput, setContactPhoneInput] = useState('');
  const [contactRelInput, setContactRelInput] = useState('Spouse');
  const [savingContacts, setSavingContacts] = useState(false);

  // Expiration Alert & Sandbox State
  const [expiryBannerDismissed, setExpiryBannerDismissed] = useState(false);
  const [showExpiryToast, setShowExpiryToast] = useState(false);
  const [simulatedDays, setSimulatedDays] = useState<number | null>(null);
  const [simulatedAutoRenew, setSimulatedAutoRenew] = useState<boolean | null>(null);

  // Interactive Route Fare Estimator (Allowed for exploration in guest mode)
  const [calcDistance, setCalcDistance] = useState(25);

  // Sanitized Transit & Delay Notice from Anomaly Engine
  const [transitNotice, setTransitNotice] = useState<any>(null);

  // 🔒 Dynamic Server-Authoritative Ride Start OTP
  const [commuterOtp, setCommuterOtp] = useState<string | null>(null);
  const [otpConsumed, setOtpConsumed] = useState(false);

  useEffect(() => {
    async function loadRideOtp() {
      if (isGuestMode) {
        setCommuterOtp('DEMO');
        return;
      }
      try {
        const res = await axios.get('/api/commuter/otp');
        if (res.data?.success && res.data.otp) {
          setCommuterOtp(res.data.otp);
          setOtpConsumed(res.data.isConsumed);
        }
      } catch (e) {
        setCommuterOtp('----');
      }
    }
    loadRideOtp();
  }, [isGuestMode, profileData]);

  useEffect(() => {
    async function loadTransitNotice() {
      try {
        const res = await axios.get('/api/security/anomalies?tripId=trip-sr101-today');
        if (res.data?.success && res.data.sanitizedStatus) {
          setTransitNotice(res.data.sanitizedStatus);
        }
      } catch (e) {
        // fallback
      }
    }
    loadTransitNotice();
    const interval = setInterval(loadTransitNotice, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    // 1. If in Guest Demo mode: load realistic static mock commuter profile without server calls
    if (isGuestMode) {
      setProfileData(GUEST_MOCK_PROFILE);
      setAttendances([
        { tripType: 'MORNING_PICKUP', status: 'SCHEDULED' },
        { tripType: 'EVENING_DROP', status: 'SCHEDULED' },
      ]);
      setLoading(false);
      return;
    }

    // 2. Authenticated user mode
    try {
      setLoading(true);
      const [profileRes, attendanceRes] = await Promise.all([
        axios.get('/api/commuter/profile'),
        axios.get('/api/commuter/attendance'),
      ]);

      if (profileRes.data?.user) setProfileData(profileRes.data.user);
      if (profileRes.data?.activeSubstitute) {
        setActiveSubstitute(profileRes.data.activeSubstitute);
      } else {
        setActiveSubstitute(null);
      }
      if (attendanceRes.data?.attendances) setAttendances(attendanceRes.data.attendances);
    } catch (err) {
      console.error('Failed to load commuter data:', err);
      // If unauthorized on direct access, gracefully fall back to demo data
      setProfileData(GUEST_MOCK_PROFILE);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleRefresh = () => {
      loadData();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('driver-leave-updated', handleRefresh);
      window.addEventListener('refresh-leaves-list', handleRefresh);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('driver-leave-updated', handleRefresh);
        window.removeEventListener('refresh-leaves-list', handleRefresh);
      }
    };
  }, [isGuestMode]);

  // Real-time trip listener & Safety Suite synchronization
  useEffect(() => {
    const unsub = listenToTrip('trip-sr101-today', (trip) => {
      if (trip) {
        setActiveTrip(trip);
        if (trip.status === 'sos_alert') {
          setSosDispatched(true);
        } else {
          setSosDispatched(false);
        }
      }
    });

    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('smartride_emergency_contacts');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) setEmergencyContacts(parsed);
        } catch (e) {}
      }
    }

    return () => {
      unsub();
    };
  }, []);

  // SOS Countdown Timer effect (3 seconds countdown)
  useEffect(() => {
    let timer: any = null;
    if (showSosCountdownModal && sosCountdown > 0) {
      timer = setTimeout(() => {
        setSosCountdown((prev) => prev - 1);
      }, 1000);
    } else if (showSosCountdownModal && sosCountdown === 0) {
      handleConfirmDispatchSos();
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [showSosCountdownModal, sosCountdown]);

  const handleStartSosFlow = () => {
    setSosCountdown(3);
    setShowSosCountdownModal(true);
  };

  const handleCancelSos = () => {
    setShowSosCountdownModal(false);
    setSosCountdown(3);
  };

  const handleConfirmDispatchSos = async () => {
    setShowSosCountdownModal(false);
    const tripId = activeTrip?.tripId || 'trip-sr101-today';
    const userId = user?.id || 'user_commuter_1';
    const userName = profileData?.name || 'Rahul Verma';
    await triggerSosAlert(tripId, userId, userName, activeTrip?.liveLocation);
    setSosDispatched(true);
    setNotification({
      type: 'error',
      message: '🚨 EMERGENCY SOS DISPATCHED: Admin Command Center alerted & automated SMS sent to your emergency contacts.',
    });
  };

  const handleResolveSos = async () => {
    const tripId = activeTrip?.tripId || 'trip-sr101-today';
    await resolveSosAlert(tripId);
    setSosDispatched(false);
    setNotification({
      type: 'success',
      message: '✓ Emergency SOS cleared. Safe commute status restored.',
    });
  };

  const handleShareTrip = () => {
    const token = activeTrip?.shareToken || 'smart-live-sr101-7x9q';
    const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/track/${token}` : `/track/${token}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      setShareLinkCopied(true);
      setTimeout(() => setShareLinkCopied(false), 3000);
    }
    setShowShareModal(true);
  };

  const handleSaveContacts = async (updated: EmergencyContact[]) => {
    setEmergencyContacts(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('smartride_emergency_contacts', JSON.stringify(updated));
    }
    try {
      setSavingContacts(true);
      await axios.patch('/api/commuter/profile', {
        emergencyContact: JSON.stringify(updated),
      });
      setNotification({
        type: 'success',
        message: '✓ Emergency contacts updated successfully!',
      });
    } catch (e) {
      // offline / mock
    } finally {
      setSavingContacts(false);
    }
  };

  const userSub = profileData?.subscriptions?.find(
    (sub: any) => sub.status === 'ACTIVE'
  ) || profileData?.subscriptions?.[0];

  const activeSubscription = isGuestMode ? GUEST_MOCK_PROFILE.subscriptions[0] : (userSub || GUEST_MOCK_PROFILE.subscriptions[0]);

  const morningAttendance = attendances.find((a) => a.tripType === 'MORNING_PICKUP');
  const eveningAttendance = attendances.find((a) => a.tripType === 'EVENING_DROP');

  // 1. Subscription Expiration Calculation Logic (Hooks MUST be top-level before if (loading))
  const effectiveAutoRenew = simulatedAutoRenew !== null
    ? simulatedAutoRenew
    : (activeSubscription?.autoRenew ?? false);

  const now = new Date();
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let computedDays: number;
  let computedExpiryDate: Date;

  if (simulatedDays !== null) {
    computedDays = simulatedDays;
    computedExpiryDate = new Date(todayDate.getTime() + simulatedDays * 86400000);
  } else {
    computedExpiryDate = new Date(activeSubscription?.endDate || Date.now() + 30 * 86400000);
    const expiryDay = new Date(computedExpiryDate.getFullYear(), computedExpiryDate.getMonth(), computedExpiryDate.getDate());
    computedDays = Math.ceil((expiryDay.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  const remainingDays = computedDays;
  const formattedExpiryDate = computedExpiryDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const isExpired = remainingDays < 0;
  const isCriticalExpiry = remainingDays >= 0 && remainingDays <= 3;
  const isUpcomingExpiry = remainingDays >= 4 && remainingDays <= 7;
  const showExpiryAlert = (remainingDays <= 7 || isExpired);

  // Auto-trigger slide-in toast on dashboard load if remainingDays <= 7
  useEffect(() => {
    if (!loading && showExpiryAlert && !effectiveAutoRenew) {
      setShowExpiryToast(true);
    }
  }, [loading, showExpiryAlert, effectiveAutoRenew]);

  // Trigger locked feature modal for disabled actions in Guest Mode
  const handleLockedAction = (featureName: string) => {
    setLockedFeatureName(featureName);
    setShowLockedModal(true);
  };

  const handleSkipRide = async (tripType: 'MORNING_PICKUP' | 'EVENING_DROP') => {
    // If in Guest Mode, intercept and show locked modal without altering database
    if (isGuestMode) {
      handleLockedAction('Skip Ride Action');
      return;
    }

    try {
      setActionLoading(true);
      const res = await axios.post('/api/commuter/attendance', {
        tripType,
        status: 'SKIPPED',
        notes: 'Commuter marked ride as skipped via dashboard',
      });

      if (res.data?.success) {
        setNotification({
          type: 'success',
          message: `Successfully skipped ${tripType === 'MORNING_PICKUP' ? 'Morning Pickup' : 'Evening Drop'}. Your driver has been notified!`,
        });
        loadData();
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.response?.data?.error || 'Failed to update ride status',
      });
    } finally {
      setActionLoading(false);
      setTimeout(() => setNotification(null), 5000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center space-y-3">
          <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
          <p className="text-sm font-medium text-slate-600">Loading your commute dashboard...</p>
        </div>
      </div>
    );
  }

  const assignedDriver = activeSubscription?.route?.assignedDriver;
  const assignedVehicle = activeSubscription?.route?.assignedVehicle;

  const isSubstituteActive = Boolean(activeSubstitute && activeSubstitute.driver);

  const effectiveDriver = isSubstituteActive
    ? {
        name: activeSubstitute.driver.name,
        phone: activeSubstitute.driver.phone || '+1 (555) 789-0123',
        avatar: activeSubstitute.driver.avatar,
        rating: activeSubstitute.driver.rating || 4.98,
        isStandby: true,
        originalName: activeSubstitute.originalDriverName,
      }
    : {
        name: assignedDriver?.user?.name || 'Rajesh Sharma',
        phone: assignedDriver?.user?.phone || '+91 98450 12345',
        avatar: assignedDriver?.user?.avatar,
        rating: assignedDriver?.rating || 4.96,
        isStandby: false,
        originalName: null,
      };

  const effectiveVehicle = isSubstituteActive && activeSubstitute.vehicle
    ? activeSubstitute.vehicle
    : assignedVehicle;

  let waypoints: any[] = [];
  try {
    if (activeSubscription?.route?.waypoints) {
      waypoints = JSON.parse(activeSubscription.route.waypoints);
    }
  } catch (e) {
    waypoints = [];
  }

  // Calculate simulated fare for interactive fare tool
  const estSmartRideMonthly = Math.round(99 + calcDistance * 1.5);
  const estCabMonthly = Math.round(calcDistance * 18 * 22);

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Slide-in Expiry Toast Notification on Load */}
        {showExpiryToast && showExpiryAlert && !effectiveAutoRenew && (
          <div className="fixed bottom-5 right-5 z-50 max-w-sm bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-3xl shadow-2xl border border-slate-700 flex items-start space-x-3.5 animate-in slide-in-from-bottom-5 duration-300">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold flex-shrink-0 shadow-sm">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-white">Pass Expiry Notice</span>
                <span className="text-[10px] text-amber-400 font-bold bg-amber-400/10 px-2 py-0.5 rounded-full">
                  {remainingDays < 0 ? 'Expired' : remainingDays === 0 ? 'Expires Today' : `${remainingDays}d Left`}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-snug">
                Your pass expires on <strong className="text-white">{formattedExpiryDate}</strong>. Tap here to renew.
              </p>
              <div className="pt-1.5 flex items-center space-x-2">
                <Link
                  href={isGuestMode ? '/plans?mode=guest' : '/plans'}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs inline-flex items-center space-x-1 shadow-md shadow-emerald-500/20"
                >
                  <span>Renew Now</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <button
                  onClick={() => setShowExpiryToast(false)}
                  className="px-2.5 py-1 text-slate-400 hover:text-white text-xs font-semibold"
                >
                  Dismiss
                </button>
              </div>
            </div>
            <button
              onClick={() => setShowExpiryToast(false)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 2. Prominent Top Expiration Alert Banner */}
        {showExpiryAlert && !expiryBannerDismissed && (
          <div
            className={`border-2 rounded-3xl p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 ${
              effectiveAutoRenew
                ? 'bg-gradient-to-r from-sky-500/15 via-teal-500/10 to-sky-500/15 border-sky-400/90'
                : isExpired
                ? 'bg-gradient-to-r from-rose-500/20 via-rose-500/10 to-rose-500/20 border-rose-500'
                : isCriticalExpiry
                ? 'bg-gradient-to-r from-rose-500/20 via-orange-500/15 to-rose-500/20 border-rose-500'
                : 'bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-amber-500/20 border-amber-400'
            }`}
          >
            <div className="flex items-start sm:items-center space-x-3.5">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center text-lg flex-shrink-0 shadow-sm ${
                  effectiveAutoRenew
                    ? 'bg-sky-500 text-white'
                    : isExpired || isCriticalExpiry
                    ? 'bg-rose-600 text-white'
                    : 'bg-amber-500 text-slate-950'
                }`}
              >
                {effectiveAutoRenew ? (
                  <Info className="w-5 h-5" />
                ) : isExpired || isCriticalExpiry ? (
                  <AlertCircle className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
              </div>

              <div className="space-y-0.5">
                <div className="flex items-center space-x-2">
                  <span
                    className={`text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      effectiveAutoRenew
                        ? 'bg-sky-100 text-sky-900 border border-sky-300'
                        : isExpired
                        ? 'bg-rose-100 text-rose-900 border border-rose-300'
                        : isCriticalExpiry
                        ? 'bg-rose-100 text-rose-900 border border-rose-300'
                        : 'bg-amber-100 text-amber-900 border border-amber-300'
                    }`}
                  >
                    {effectiveAutoRenew
                      ? 'Auto-Renewal Enabled'
                      : isExpired
                      ? 'Subscription Expired'
                      : isCriticalExpiry
                      ? 'Critical Expiry Notice'
                      : 'Upcoming Expiry Notice'}
                  </span>
                </div>

                <p className="text-sm font-bold text-slate-900">
                  {effectiveAutoRenew ? (
                    <>
                      ℹ️ Your pass renews automatically on <span className="underline font-black">{formattedExpiryDate}</span>. No action needed. Manage auto-renewal.
                    </>
                  ) : isExpired ? (
                    <>
                      🚨 Action Required: Your commute pass expired on <span className="underline font-black">{formattedExpiryDate}</span>! Renew now to restore your reserved seat and scheduled rides.
                    </>
                  ) : isCriticalExpiry ? (
                    <>
                      🚨 Action Required: Your commute pass expires in <span className="underline font-black">{remainingDays === 0 ? 'today' : `${remainingDays} day(s)`}</span>! Auto-renewal is OFF. Renew now to avoid service interruption.
                    </>
                  ) : (
                    <>
                      ⚠️ Your monthly pass expires in <span className="underline font-black">{remainingDays} days</span> on {formattedExpiryDate}. Renew early to lock in your seat and regular driver.
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 self-end sm:self-center">
              <Link
                href={isGuestMode ? '/plans?mode=guest' : '/plans'}
                className={`px-4 py-2 rounded-xl text-xs font-black shadow-sm transition-all flex items-center space-x-1.5 whitespace-nowrap ${
                  effectiveAutoRenew
                    ? 'bg-sky-600 hover:bg-sky-700 text-white'
                    : isExpired || isCriticalExpiry
                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
                    : 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/20'
                }`}
              >
                <span>{effectiveAutoRenew ? 'Manage Plans' : isExpired ? 'Renew Subscription' : 'Renew Pass'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>

              <button
                onClick={() => setExpiryBannerDismissed(true)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-black/5 transition-colors"
                title="Dismiss Banner"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* 3. Guest Preview Mode Banner (Displayed when in Demo Mode) */}
        {isGuestMode && (
          <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border-2 border-amber-400/80 rounded-3xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center space-x-3.5">
              <div className="px-3 py-1 rounded-full bg-amber-500 text-slate-950 text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 shadow-sm">
                <span>👁️</span>
                <span>Guest Preview Mode</span>
              </div>
              <p className="text-xs sm:text-sm font-medium text-slate-700">
                You are viewing an interactive demo with mock route data.
              </p>
            </div>
            <Link
              href="/register"
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-md shadow-emerald-600/20 transition-all flex items-center space-x-1.5 whitespace-nowrap"
            >
              <span>Create Account to Book / Sign In</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {/* 2. Welcome Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center space-x-4">
            <UserAvatar
              src={profileData?.avatar}
              name={profileData?.name}
              size="lg"
              alt={profileData?.name}
              className="flex-shrink-0"
            />
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl font-black text-slate-900">
                  Welcome, {profileData?.name || 'Commuter'}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  {isGuestMode ? 'Demo Pass Active' : 'Active Subscriber'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {profileData?.email} • {profileData?.phone || 'No phone set'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Change Plan Button -> Routes to Plans & Pricing */}
            <Link
              href={isGuestMode ? '/plans?mode=guest' : '/plans'}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all flex items-center space-x-1.5 group shadow-xs"
            >
              <CreditCard className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
              <span>Change Plan</span>
            </Link>

            {/* Invoices Button */}
            {isGuestMode ? (
              <button
                type="button"
                onClick={() => handleLockedAction('Payment Invoices')}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold shadow-sm transition-all flex items-center space-x-1.5"
              >
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                <span>Invoices (Locked)</span>
              </button>
            ) : (
              <Link
                href="/commuter/invoices"
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all flex items-center space-x-1.5"
              >
                <FileText className="w-4 h-4" />
                <span>View Invoices</span>
              </Link>
            )}
          </div>
        </div>

        {/* Notifications Toast */}
        {notification && (
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between text-sm font-medium ${
              notification.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <div className="flex items-center space-x-2">
              {notification.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              )}
              <span>{notification.message}</span>
            </div>
            <button onClick={() => setNotification(null)} className="text-xs font-bold underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Active Commute Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Today's Schedule, Driver Info & Route Sequence */}
          <div className="lg:col-span-8 space-y-6">
            {/* Sanitized Operational Transit Notice */}
            {transitNotice && transitNotice.status !== 'OPERATIONAL_NORMAL' && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between text-xs animate-fade-in shadow-xs">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold flex-shrink-0">
                    <Clock className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <span className="font-bold text-amber-900 block">{transitNotice.headline}</span>
                    <span className="text-amber-700 text-[11px]">{transitNotice.message}</span>
                  </div>
                </div>
                {transitNotice.delayMinutes > 0 && (
                  <span className="px-3 py-1 bg-amber-200/80 text-amber-950 font-bold rounded-lg whitespace-nowrap ml-3">
                    +{transitNotice.delayMinutes} min delay
                  </span>
                )}
              </div>
            )}

            {/* 🚦 Smart ETA + Delay Prediction Card */}
            <SmartEtaCard
              currentLocation={activeTrip?.liveLocation}
              theme="light"
              compact={false}
            />

            {/* 🛡️ Smart Trip Safety Score Card */}
            <SafetyScoreCard
              trip={activeTrip}
              liveLocation={activeTrip?.liveLocation}
              theme="light"
              mode="commuter"
            />

            {/* 🌱 Green Commute Sustainability & Carbon Impact Card */}
            <SustainabilityCard theme="light" />

            {/* 🎮 My Smart Commute Gamification & Achievements Card */}
            <GamificationCard />


            {/* 1. Today's Commute Schedule Box */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-lg font-bold text-slate-900">Today's Ride Schedule</h2>
                </div>
                <span className="text-xs font-semibold text-slate-500">
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>

              {/* 🔒 Ride Start OTP Security Badge Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white border-2 border-emerald-400 shadow-lg shadow-emerald-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center space-x-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/50 text-emerald-400 flex items-center justify-center font-black text-xl flex-shrink-0 shadow-inner">
                    <Lock className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-slate-950 px-2.5 py-0.5 rounded-full shadow-xs">
                        🔒 Ride Start OTP
                      </span>
                      <span className="text-xs font-bold text-slate-300">Daily Boarding Verification</span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-200">
                      Share this 4-digit security code with Captain <strong className="text-white font-extrabold">{effectiveDriver.name}</strong> when you board to initiate ride tracking.
                    </p>
                  </div>
                </div>
                <div className="bg-black/70 border border-emerald-500/40 rounded-2xl px-6 py-3 text-center sm:text-right flex-shrink-0 flex items-center sm:flex-col justify-between sm:justify-center">
                  <span className="text-[10px] uppercase font-bold text-emerald-300 tracking-wider">Ride Start OTP</span>
                  <span className="font-mono text-2xl sm:text-3xl font-black text-emerald-400 tracking-widest">
                    {otpConsumed ? 'BOARDED' : (commuterOtp || '••••')}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Morning Trip Card */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-emerald-700 tracking-wider">
                      Morning Pickup
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      SCHEDULED
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs text-slate-500">Pickup Spot:</div>
                    <div className="text-sm font-bold text-slate-800 line-clamp-1">
                      {activeSubscription?.pickupAddress || 'HSR Layout 27th Main'}
                    </div>
                    <div className="flex items-center space-x-1.5 text-xs text-emerald-700 font-semibold pt-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Pickup Time: {activeSubscription?.morningPickupTime || '08:20 AM'}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">Not riding this morning?</span>
                    <button
                      type="button"
                      onClick={() => handleSkipRide('MORNING_PICKUP')}
                      disabled={actionLoading}
                      className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                    >
                      Skip Morning
                    </button>
                  </div>
                </div>

                {/* Evening Drop Card */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-teal-700 tracking-wider">
                      Evening Return
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                      SCHEDULED
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs text-slate-500">Destination:</div>
                    <div className="text-sm font-bold text-slate-800 line-clamp-1">
                      {activeSubscription?.dropAddress || 'ITPB Tech Park Hub'}
                    </div>
                    <div className="flex items-center space-x-1.5 text-xs text-teal-700 font-semibold pt-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Return Time: {activeSubscription?.eveningPickupTime || '06:15 PM'}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">Leaving early today?</span>
                    <button
                      type="button"
                      onClick={() => handleSkipRide('EVENING_DROP')}
                      disabled={actionLoading}
                      className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                    >
                      Skip Evening
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Standby Route Captain Alert Banner (Displayed when active driver on approved leave for today) */}
            {isSubstituteActive && (
              <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border-2 border-amber-400 rounded-3xl p-5 shadow-xs flex items-start sm:items-center space-x-3.5 animate-in fade-in slide-in-from-top-2">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold flex-shrink-0 shadow-sm">
                  <Info className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <div className="text-[11px] font-black text-amber-950 uppercase tracking-wider flex items-center space-x-1.5">
                    <span>⚠️ Operational Notice</span>
                    <span>•</span>
                    <span>Route Standby Coverage</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-800">
                    Notice: Your regular Route Captain is on approved leave. Today's route is operated by standby Captain <strong className="text-slate-950 font-black underline decoration-amber-500 decoration-2">{effectiveDriver.name}</strong>.
                  </p>
                </div>
              </div>
            )}

            {/* 2. Assigned Captain & Vehicle Card */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-lg font-bold text-slate-900">Your Route Captain & Vehicle</h2>
                  {isSubstituteActive && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-900 border border-amber-300">
                      Standby Route Captain
                    </span>
                  )}
                </div>
                <span className="text-xs font-mono font-bold bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-lg border border-emerald-200">
                  Seat #{activeSubscription.seatNumber || 1} Reserved
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                {/* Driver details */}
                <div className="flex items-center space-x-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-200 flex items-center justify-center text-emerald-800 font-bold overflow-hidden flex-shrink-0">
                    {effectiveDriver.avatar ? (
                      <img src={effectiveDriver.avatar} alt={effectiveDriver.name} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-6 h-6" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-base font-bold text-slate-900 truncate">
                        {effectiveDriver.name}
                      </h3>
                      <span className="flex items-center text-xs font-bold text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                        <Star className="w-3 h-3 fill-amber-400 mr-0.5" />
                        {effectiveDriver.rating}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-1">
                      <button
                        type="button"
                        onClick={() => handleLockedAction('Contact Driver')}
                        className="text-xs text-emerald-700 font-bold hover:underline flex items-center space-x-1"
                      >
                        <Phone className="w-3 h-3" />
                        <span>{effectiveDriver.phone}</span>
                      </button>
                      <span className="text-[10px] text-slate-400">
                        {isSubstituteActive ? 'Standby Coverage' : '1,420 trips'}
                      </span>
                    </div>
                    <div className={`text-[11px] font-semibold mt-1 ${isSubstituteActive ? 'text-amber-800' : 'text-emerald-700'}`}>
                      {isSubstituteActive
                        ? `Covering regular Captain ${effectiveDriver.originalName}`
                        : '✓ Background & Commercial License Verified'}
                    </div>
                  </div>
                </div>

                {/* Vehicle details */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {isSubstituteActive ? 'Temporary Standby Shuttle' : 'Assigned Shuttle Fleet'}
                  </div>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-base font-black text-slate-800">
                      {effectiveVehicle?.make || 'Toyota'} {effectiveVehicle?.model || 'Innova Crysta'}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">({effectiveVehicle?.type || 'AC SUV'})</span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="font-mono font-bold bg-white px-2.5 py-1 rounded border border-slate-200 text-slate-700">
                      {effectiveVehicle?.licensePlate || 'KA-01-MJ-8822'}
                    </span>
                    <span className="text-emerald-700 font-semibold">
                      Capacity: {effectiveVehicle?.capacity || 6} Seats
                    </span>
                  </div>
                </div>

                {/* Driver & Vehicle Safety Verification Badges */}
                <div className="md:col-span-2 pt-4 border-t border-slate-200/80 flex flex-wrap items-center gap-2 sm:gap-3">
                  <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold shadow-2xs">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>✓ Police Background Verified</span>
                  </span>
                  <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold shadow-2xs">
                    <UserCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>✓ Commercial Driving License Checked</span>
                  </span>
                  <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold shadow-2xs">
                    <Car className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>✓ Vehicle RC & Active Insurance Verified</span>
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Route Waypoints Sequence */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center space-x-2">
                  <Compass className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-lg font-bold text-slate-900">
                    Route {activeSubscription.route?.code || 'SR-101'} Stop Sequence
                  </h2>
                </div>
                <span className="text-xs text-slate-500">
                  {activeSubscription.route?.distanceKm} km • ~{activeSubscription.route?.estimatedMinutes} mins
                </span>
              </div>

              <div className="space-y-4 pt-2">
                {waypoints.map((stop: any, index: number) => {
                  const isPickup = activeSubscription.pickupAddress.includes(stop.stopName);
                  const isDrop = activeSubscription.dropAddress.includes(stop.stopName);

                  return (
                    <div key={index} className="flex items-start space-x-4 relative">
                      {index < waypoints.length - 1 && (
                        <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-slate-200" />
                      )}
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold z-10 ${
                          isPickup
                            ? 'bg-emerald-600 text-white ring-4 ring-emerald-100'
                            : isDrop
                            ? 'bg-teal-600 text-white ring-4 ring-teal-100'
                            : 'bg-slate-100 text-slate-600 border border-slate-300'
                        }`}
                      >
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4
                            className={`text-sm font-bold ${
                              isPickup || isDrop ? 'text-emerald-700 font-extrabold' : 'text-slate-800'
                            }`}
                          >
                            {stop.stopName}
                            {isPickup && ' (Your Morning Pickup)'}
                            {isDrop && ' (Your Destination)'}
                          </h4>
                          <span className="text-xs font-mono font-semibold text-slate-500">
                            {stop.estimatedPickupTime}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 truncate">{stop.landmark}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 4. Interactive Route Fare & Distance Estimator (Allowed for Exploration) */}
            <div className="bg-gradient-to-br from-emerald-50/80 to-teal-50/50 rounded-3xl p-6 border border-emerald-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Sliders className="w-5 h-5 text-emerald-700" />
                  <h3 className="text-base font-bold text-slate-900">
                    Explore Route Fare & Savings Estimator
                  </h3>
                </div>
                <span className="text-xs font-bold text-emerald-800 bg-emerald-100/80 px-2.5 py-1 rounded-full">
                  Interactive Simulator
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
                  <span>Round-Trip Commute Distance:</span>
                  <span className="text-sm font-black text-emerald-800 font-mono">{calcDistance} km / day</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="60"
                  value={calcDistance}
                  onChange={(e) => setCalcDistance(parseInt(e.target.value))}
                  className="w-full h-2 bg-emerald-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                />
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="bg-white p-3 rounded-2xl border border-emerald-200 text-center shadow-xs">
                  <div className="text-[11px] font-bold text-slate-400 uppercase">Smart Ride Pass</div>
                  <div className="text-xl font-black text-emerald-700">${estSmartRideMonthly}<span className="text-xs font-normal">/mo</span></div>
                </div>
                <div className="bg-white p-3 rounded-2xl border border-slate-200 text-center shadow-xs">
                  <div className="text-[11px] font-bold text-slate-400 uppercase">Daily Cab Surges</div>
                  <div className="text-xl font-black text-slate-700">${estCabMonthly}<span className="text-xs font-normal">/mo</span></div>
                </div>
                <div className="bg-emerald-600 text-white p-3 rounded-2xl text-center shadow-xs">
                  <div className="text-[11px] font-bold text-emerald-100 uppercase">You Save</div>
                  <div className="text-xl font-black text-white">${estCabMonthly - estSmartRideMonthly}<span className="text-xs font-normal">/mo</span></div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Active Subscription Card, Invoices & Sandbox Controls */}
          <div className="lg:col-span-4 space-y-6">
            {/* Plan Card */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 text-white shadow-xl space-y-5 border border-slate-700 group">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span
                    className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                      isExpired
                        ? 'text-rose-400 bg-rose-950 border-rose-800'
                        : isCriticalExpiry
                        ? 'text-amber-400 bg-amber-950 border-amber-800'
                        : 'text-emerald-400 bg-emerald-950 border-emerald-800'
                    }`}
                  >
                    {isExpired
                      ? 'Pass Expired'
                      : isGuestMode
                      ? 'Demo Pass Active'
                      : 'Active Subscription'}
                  </span>

                  {isCriticalExpiry && (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping mr-1" />
                      Expiring Soon
                    </span>
                  )}
                </div>
                <Link
                  href={isGuestMode ? '/plans?mode=guest' : '/plans'}
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center space-x-1 transition-colors group-hover:translate-x-0.5"
                  title="Modify or Upgrade Subscription Plan"
                >
                  <span>Modify Plan</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <Link
                href={isGuestMode ? '/plans?mode=guest' : '/plans'}
                className="block hover:opacity-95 transition-opacity"
                title="Click to view all plans and pricing options"
              >
                <h3 className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors">
                  {activeSubscription.plan?.name || 'Standard Monthly'}
                </h3>
                <div className="mt-2 flex items-baseline space-x-1">
                  <span className="text-3xl font-black text-emerald-400">
                    ${activeSubscription.plan?.price}
                  </span>
                  <span className="text-xs text-slate-400">
                    /{activeSubscription.plan?.billingCycle?.toLowerCase()}
                  </span>
                </div>
              </Link>

              <div className="pt-4 border-t border-slate-700/80 space-y-2.5 text-xs text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">Route Corridor:</span>
                  <span className="font-semibold text-white">{activeSubscription.route?.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Validity Ends:</span>
                  <div className="flex items-center space-x-2">
                    <span
                      className={`font-semibold ${
                        isExpired
                          ? 'text-rose-400 font-bold'
                          : isCriticalExpiry
                          ? 'text-amber-300 font-bold'
                          : 'text-emerald-300'
                      }`}
                    >
                      {formattedExpiryDate}
                    </span>
                    {isCriticalExpiry && (
                      <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/40">
                        {remainingDays === 0 ? 'Today' : `${remainingDays}d left`}
                      </span>
                    )}
                    {isExpired && (
                      <span className="text-[10px] font-bold bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded border border-rose-500/40">
                        Expired
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Seat Number:</span>
                  <span className="font-semibold text-white">Seat #{activeSubscription.seatNumber || 1}</span>
                </div>
              </div>

              {/* Shortcut to Plans & Receipt Download */}
              <div className="pt-2 space-y-2">
                {isExpired ? (
                  <Link
                    href={isGuestMode ? '/plans?mode=guest' : '/plans'}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/20 transition-all"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Renew Subscription</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                ) : (
                  <>
                    <Link
                      href={isGuestMode ? '/plans?mode=guest' : '/plans'}
                      className="w-full py-2.5 px-4 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs flex items-center justify-center space-x-2 transition-all border border-slate-600 hover:border-emerald-500"
                    >
                      <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{isCriticalExpiry ? 'Renew / Extend Pass' : 'Change / Upgrade Plan'}</span>
                    </Link>
                    {isGuestMode ? (
                      <button
                        type="button"
                        onClick={() => handleLockedAction('Download Payment Receipt')}
                        className="w-full py-2.5 px-4 rounded-xl bg-slate-700/80 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center space-x-2 transition-all border border-slate-600"
                      >
                        <Lock className="w-3.5 h-3.5 text-amber-400" />
                        <span>Download Payment Receipt (Locked)</span>
                      </button>
                    ) : (
                      <Link
                        href="/commuter/invoices"
                        className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center space-x-2 transition-all"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Download Payment Receipt</span>
                      </Link>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Locked Invoices Overlay in Guest Mode */}
            {isGuestMode ? (
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm relative overflow-hidden space-y-3">
                <div className="flex items-center space-x-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <Lock className="w-4 h-4 text-amber-500" />
                  <span>Billing & Payment History</span>
                </div>
                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-center space-y-2">
                  <p className="text-xs font-bold text-amber-900">
                    Invoices available only on authenticated commuter accounts.
                  </p>
                  <p className="text-[11px] text-amber-700">
                    Create your free Smart Ride account to view monthly tax invoices and payment receipts.
                  </p>
                  <Link
                    href="/login"
                    className="inline-block px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition-colors"
                  >
                    Sign In to Access
                  </Link>
                </div>
              </div>
            ) : null}

            {/* Sandbox Gated Controls Box */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
              <h4 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Subscription Controls</span>
              </h4>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => handleLockedAction('Pause Subscription')}
                  className="w-full py-2 px-3 text-left rounded-xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50/50 text-xs font-semibold text-slate-700 flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <PauseCircle className="w-4 h-4 text-slate-500" />
                    <span>Pause Subscription</span>
                  </div>
                  {isGuestMode && <Lock className="w-3.5 h-3.5 text-slate-400" />}
                </button>

                <button
                  type="button"
                  onClick={() => handleLockedAction('Change Pickup Stop')}
                  className="w-full py-2 px-3 text-left rounded-xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50/50 text-xs font-semibold text-slate-700 flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4 text-slate-500" />
                    <span>Change Pickup Stop</span>
                  </div>
                  {isGuestMode && <Lock className="w-3.5 h-3.5 text-slate-400" />}
                </button>

                <button
                  type="button"
                  onClick={() => handleLockedAction('Contact Driver')}
                  className="w-full py-2 px-3 text-left rounded-xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50/50 text-xs font-semibold text-slate-700 flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <Phone className="w-4 h-4 text-slate-500" />
                    <span>Contact Driver</span>
                  </div>
                  {isGuestMode && <Lock className="w-3.5 h-3.5 text-slate-400" />}
                </button>
              </div>
            </div>

            {/* Interactive Expiration Alert Simulator Sandbox */}
            <div className="bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-slate-50 rounded-3xl p-5 border-2 border-amber-300/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-amber-600 fill-amber-500" />
                  <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Expiry Alert Sandbox
                  </span>
                </div>
                <span className="text-[10px] font-bold text-amber-800 bg-amber-200/70 px-2 py-0.5 rounded-full">
                  Instant Preview
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-snug">
                Simulate different subscription expiry states and auto-renew status in real-time without modifying the database:
              </p>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setSimulatedDays(2);
                    setSimulatedAutoRenew(false);
                    setExpiryBannerDismissed(false);
                  }}
                  className={`px-2.5 py-2 rounded-xl text-[11px] font-bold border transition-all text-left ${
                    simulatedDays === 2 && !effectiveAutoRenew
                      ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-rose-400'
                  }`}
                >
                  <div className="font-extrabold">🚨 2 Days Left</div>
                  <div className="text-[9px] opacity-80">Critical (Red Banner)</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSimulatedDays(5);
                    setSimulatedAutoRenew(false);
                    setExpiryBannerDismissed(false);
                  }}
                  className={`px-2.5 py-2 rounded-xl text-[11px] font-bold border transition-all text-left ${
                    simulatedDays === 5 && !effectiveAutoRenew
                      ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-amber-400'
                  }`}
                >
                  <div className="font-extrabold">⚠️ 5 Days Left</div>
                  <div className="text-[9px] opacity-80">Warning (Amber Banner)</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSimulatedDays(-1);
                    setSimulatedAutoRenew(false);
                    setExpiryBannerDismissed(false);
                  }}
                  className={`px-2.5 py-2 rounded-xl text-[11px] font-bold border transition-all text-left ${
                    simulatedDays === -1
                      ? 'bg-rose-900 text-white border-rose-900 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-rose-700'
                  }`}
                >
                  <div className="font-extrabold">✕ Pass Expired</div>
                  <div className="text-[9px] opacity-80">-1 Day In Past</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSimulatedDays(2);
                    setSimulatedAutoRenew(true);
                    setExpiryBannerDismissed(false);
                  }}
                  className={`px-2.5 py-2 rounded-xl text-[11px] font-bold border transition-all text-left ${
                    effectiveAutoRenew && simulatedDays !== null
                      ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-sky-400'
                  }`}
                >
                  <div className="font-extrabold">ℹ️ Auto-Renew ON</div>
                  <div className="text-[9px] opacity-80">Safe Notice (Blue)</div>
                </button>
              </div>

              {simulatedDays !== null && (
                <button
                  type="button"
                  onClick={() => {
                    setSimulatedDays(null);
                    setSimulatedAutoRenew(null);
                    setExpiryBannerDismissed(false);
                  }}
                  className="w-full text-center text-[10px] font-bold text-slate-500 hover:text-slate-800 underline pt-1"
                >
                  Reset to Actual Database Dates
                </button>
              )}
            </div>

            {/* Commuter Concierge Card */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-3">
              <h4 className="text-sm font-bold text-slate-900">24/7 Commuter Concierge</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Dedicated shuttle coordinator support for tech corridor routes across Bangalore, Hyderabad, and Pune.
              </p>
              <Link
                href={isGuestMode ? '/register' : '/commuter/profile'}
                className="inline-block text-xs font-bold text-emerald-600 hover:text-emerald-700"
              >
                {isGuestMode ? 'Create Account to Book →' : 'Manage Profile & Addresses →'}
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Locked Feature Modal in Guest Demo Mode */}
      {showLockedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 sm:p-8 shadow-2xl border border-amber-100 space-y-5 animate-in zoom-in-95 duration-200 text-center">
            <div className="w-16 h-16 rounded-3xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-sm">
              <Lock className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-extrabold text-slate-900">
                Feature Locked in Demo Mode
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Please create an account or sign in to manage live subscriptions, pause rides, or communicate with assigned drivers.
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl text-xs text-slate-500 font-mono">
              Action Attempted: <span className="font-bold text-slate-800">{lockedFeatureName || 'Restricted Action'}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowLockedModal(false)}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs transition-all"
              >
                Cancel
              </button>

              <Link
                href="/register"
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center justify-center space-x-1.5 transition-all"
              >
                <span>Sign Up Now</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}
      {/* 🚨 Live Emergency Floating Bar (When Ride is In-Transit or SOS Alert) */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-40 px-4 py-3 sm:px-8 border-t-2 backdrop-blur-md shadow-2xl transition-all duration-300 ${
          sosDispatched
            ? 'bg-rose-950/95 border-rose-500 text-white'
            : 'bg-slate-950/95 border-slate-700/80 text-white'
        }`}
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
          {/* Left: Telemetry & Safety Status */}
          <div className="flex items-center space-x-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold flex-shrink-0 ${
                sosDispatched
                  ? 'bg-rose-600 text-white animate-pulse'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              }`}
            >
              {sosDispatched ? <Siren className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <span
                  className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    sosDispatched
                      ? 'bg-rose-600 text-white'
                      : 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
                  }`}
                >
                  {sosDispatched ? '🚨 SOS DISPATCH ACTIVE' : 'SHUTTLE IN-TRANSIT'}
                </span>
                <span className="text-xs font-bold text-slate-300 truncate">
                  Route SR-101 • Innova Crysta (KA-01-MJ-8822)
                </span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5 flex items-center space-x-2 truncate">
                <span className="flex items-center space-x-1">
                  <Navigation className="w-3 h-3 text-emerald-400" />
                  <span>GPS: 12.9121° N, 77.6446° E</span>
                </span>
                <span>•</span>
                <span>Speed: ~42 km/h</span>
                <span>•</span>
                <span className="text-emerald-400">Driver: Rajesh Sharma (★ 4.96)</span>
              </div>
            </div>
          </div>

          {/* Right: Emergency SOS, Share Trip & Contacts Actions */}
          <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
            {/* Share Live Trip Button */}
            <button
              type="button"
              onClick={handleShareTrip}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-bold flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer"
              title="Share live vehicle tracking link with family"
            >
              <Share2 className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Share Live Trip</span>
              <span className="sm:hidden">Share</span>
            </button>

            {/* Emergency Contacts Drawer Trigger */}
            <button
              type="button"
              onClick={() => setShowContactsModal(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-bold flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer"
              title="Manage Emergency Contacts"
            >
              <Users className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Emergency Contacts ({emergencyContacts.length})</span>
              <span className="sm:hidden">Contacts ({emergencyContacts.length})</span>
            </button>

            {/* Emergency SOS Button */}
            {!sosDispatched ? (
              <button
                type="button"
                onClick={handleStartSosFlow}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:from-rose-500 hover:to-red-600 text-white font-black text-xs uppercase tracking-wider flex items-center space-x-2 shadow-lg shadow-rose-600/30 transition-all active:scale-95 cursor-pointer animate-pulse"
              >
                <Siren className="w-4 h-4" />
                <span>🚨 Emergency SOS</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleResolveSos}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider flex items-center space-x-2 shadow-lg shadow-emerald-600/30 transition-all active:scale-95 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Resolve SOS</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 🚨 SOS 3-Second Confirmation Countdown Modal */}
      {showSosCountdownModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border-2 border-rose-500 max-w-md w-full rounded-3xl p-6 sm:p-8 text-white shadow-2xl text-center space-y-5 animate-in zoom-in-95">
            <div className="w-20 h-20 rounded-3xl bg-rose-600/20 border-2 border-rose-500 text-rose-400 flex items-center justify-center mx-auto animate-pulse">
              <Siren className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <span className="text-xs font-black uppercase tracking-widest text-rose-400 bg-rose-950 px-3 py-1 rounded-full border border-rose-800">
                Confirm Emergency SOS Dispatch
              </span>
              <h3 className="text-2xl font-black text-white">
                Dispatching Emergency SOS
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Operations Command Center and your registered emergency contacts will be alerted immediately with current vehicle GPS coordinates.
              </p>
            </div>

            {/* Large Countdown Circle */}
            <div className="flex justify-center my-4">
              <div className="w-20 h-20 rounded-full border-4 border-rose-500 flex items-center justify-center bg-rose-600 text-white text-3xl font-black shadow-lg shadow-rose-600/40 animate-ping">
                {sosCountdown}
              </div>
            </div>

            <div className="text-xs text-slate-400 font-mono">
              Auto-dispatching in {sosCountdown} second(s)...
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={handleCancelSos}
                className="w-full py-3 px-4 rounded-xl border border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-all"
              >
                Cancel SOS
              </button>
              <button
                type="button"
                onClick={handleConfirmDispatchSos}
                className="w-full py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-rose-600/40 transition-all"
              >
                Dispatch Immediately
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🚨 SOS Active Emergency Response Modal */}
      {sosDispatched && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border-2 border-rose-500 max-w-lg w-full rounded-3xl p-6 sm:p-8 text-white shadow-2xl space-y-5 animate-in zoom-in-95">
            <div className="flex items-center space-x-3 border-b border-rose-900/60 pb-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-600 flex items-center justify-center text-white flex-shrink-0 animate-bounce">
                <Siren className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-rose-400 bg-rose-950 px-2.5 py-0.5 rounded-full border border-rose-800">
                  SOS DISPATCH ACTIVE
                </span>
                <h3 className="text-xl font-black text-white mt-0.5">
                  Emergency Support Dispatched
                </h3>
              </div>
            </div>

            {/* GPS & Incident Telemetry */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Live GPS Coordinates:</span>
                <span className="text-emerald-400 font-bold">12.9121° N, 77.6446° E</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Vehicle:</span>
                <span className="text-white">KA-01-MJ-8822 (Innova Crysta)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Captain Rajesh Sharma:</span>
                <span className="text-white">+91 98450 12345</span>
              </div>
            </div>

            {/* Simulated SMS Alert Feedback */}
            <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl text-xs space-y-1">
              <div className="font-bold text-emerald-300 flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Automated Emergency SMS Sent to {emergencyContacts.length} Contacts:</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed pl-5 font-mono">
                "{profileData?.name || 'Rahul Verma'} triggered SOS on SmartRide Shuttle SR-101. Coordinates: 12.9121, 77.6446. Driver: Rajesh Sharma (+91 98450 12345). Track live: /track/{activeTrip?.shareToken || 'smart-live-sr101-7x9q'}"
              </p>
            </div>

            {/* One-Tap Direct Dialers */}
            <div className="space-y-2 pt-1">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Direct Emergency Call Buttons:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <a
                  href="tel:112"
                  className="py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center justify-center space-x-2 transition-all shadow-sm"
                >
                  <PhoneCall className="w-4 h-4" />
                  <span>Call 112 / 911 (Police)</span>
                </a>
                <a
                  href="tel:108"
                  className="py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs flex items-center justify-center space-x-2 transition-all shadow-sm"
                >
                  <PhoneCall className="w-4 h-4" />
                  <span>Call 108 (Ambulance)</span>
                </a>
              </div>
              <a
                href="tel:+918040009999"
                className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center space-x-2 transition-all border border-slate-700"
              >
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span>Call SmartRide 24/7 Safety Desk (+91 80 4000 9999)</span>
              </a>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleResolveSos}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 font-bold text-xs transition-all"
              >
                Stand Down / Mark SOS Resolved
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🛡️ Emergency Contacts Drawer / Modal */}
      {showContactsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Emergency Contacts</h3>
                  <p className="text-xs text-slate-500">Up to 3 verified family / emergency contacts</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowContactsModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List of Contacts */}
            <div className="space-y-2.5">
              {emergencyContacts.map((c, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-bold text-slate-900">{c.name}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                        {c.relationship}
                      </span>
                    </div>
                    <p className="text-xs font-mono text-slate-600">{c.phone}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const updated = emergencyContacts.filter((_, i) => i !== idx);
                      handleSaveContacts(updated);
                    }}
                    className="text-xs text-rose-600 hover:text-rose-700 font-bold p-1 rounded hover:bg-rose-50"
                    title="Remove Contact"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add Contact Form (if < 3 contacts) */}
            {emergencyContacts.length < 3 && (
              <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200/80 space-y-3">
                <div className="text-xs font-bold text-emerald-900">
                  + Add Emergency Contact ({3 - emergencyContacts.length} remaining)
                </div>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Full Name (e.g. Ananya Verma)"
                    value={contactNameInput}
                    onChange={(e) => setContactNameInput(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                  <input
                    type="tel"
                    placeholder="Phone Number (e.g. +91 98765 43210)"
                    value={contactPhoneInput}
                    onChange={(e) => setContactPhoneInput(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                  <select
                    value={contactRelInput}
                    onChange={(e) => setContactRelInput(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden bg-white"
                  >
                    <option value="Spouse">Spouse</option>
                    <option value="Parent">Parent</option>
                    <option value="Sibling">Sibling</option>
                    <option value="Family">Family</option>
                    <option value="Friend / Colleague">Friend / Colleague</option>
                  </select>
                </div>
                <button
                  type="button"
                  disabled={!contactNameInput || !contactPhoneInput || savingContacts}
                  onClick={() => {
                    if (contactNameInput && contactPhoneInput) {
                      const updated = [
                        ...emergencyContacts,
                        {
                          name: contactNameInput.trim(),
                          phone: contactPhoneInput.trim(),
                          relationship: contactRelInput,
                        },
                      ];
                      handleSaveContacts(updated);
                      setContactNameInput('');
                      setContactPhoneInput('');
                    }
                  }}
                  className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs transition-all shadow-xs"
                >
                  {savingContacts ? 'Saving...' : 'Add Contact'}
                </button>
              </div>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowContactsModal(false)}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-all"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔗 Share Live Trip & Safe Arrival Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white max-w-lg w-full rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-200 text-center">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
              <Share2 className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-center space-x-2">
                <h3 className="text-xl font-bold text-slate-900">Family Tracking & Safe Arrival</h3>
                <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
                  Auto-Verified
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Family members can track your shuttle's live GPS movement in real-time without logging in. When you reach your destination, the page automatically switches to a Safe Arrival confirmation.
              </p>
            </div>

            {/* Tracking Link Box */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between space-x-2">
              <span className="text-xs font-mono text-slate-700 truncate select-all">
                {typeof window !== 'undefined'
                  ? `${window.location.origin}/track/${activeTrip?.shareToken || 'smart-live-sr101-7x9q'}`
                  : `/track/${activeTrip?.shareToken || 'smart-live-sr101-7x9q'}`}
              </span>
              <button
                type="button"
                onClick={handleShareTrip}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center space-x-1 flex-shrink-0 transition-all cursor-pointer"
              >
                {shareLinkCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{shareLinkCopied ? 'Copied' : 'Copy Link'}</span>
              </button>
            </div>

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-2 gap-2 text-left text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                <div className="font-bold text-slate-900 flex items-center space-x-1 text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Safe Arrival Card</span>
                </div>
                <div className="text-[10px] text-slate-500">
                  Switches automatically to arrival confirmation at destination.
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                <div className="font-bold text-slate-900 flex items-center space-x-1 text-[11px]">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Delay Notifications</span>
                </div>
                <div className="text-[10px] text-slate-500">
                  Displays reassuring delay updates if corridor traffic builds up.
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs transition-all cursor-pointer"
              >
                Done
              </button>
              <a
                href={`/track/${activeTrip?.shareToken || 'smart-live-sr101-7x9q'}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center space-x-1.5 transition-all"
              >
                <span>Open Family View</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CommuterDashboard() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-slate-50">
          <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
        </div>
      }
    >
      <CommuterDashboardContent />
    </Suspense>
  );
}
