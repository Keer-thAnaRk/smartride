'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import {
  Car,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Lock,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Zap,
  Clock,
  AlertCircle,
  X,
} from 'lucide-react';
import { useAuth } from '@/components/auth-context';

function PlansCheckoutContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRouteId = searchParams.get('routeId') || '';
  const initialPlanId = searchParams.get('planId') || '';

  const [routes, setRoutes] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>(initialRouteId);
  const [selectedPlanId, setSelectedPlanId] = useState<string>(initialPlanId);
  const [pickupStop, setPickupStop] = useState<string>('');
  const [dropStop, setDropStop] = useState<string>('');
  const [morningTime, setMorningTime] = useState<string>('08:30 AM');
  const [eveningTime, setEveningTime] = useState<string>('06:00 PM');

  // Checkout modal state
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CARD' | 'UPI' | 'NETBANKING'>('CARD');
  const [gateway, setGateway] = useState<'STRIPE' | 'RAZORPAY'>('STRIPE');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [routesRes, plansRes] = await Promise.all([
          axios.get('/api/routes'),
          axios.get('/api/plans'),
        ]);

        const fetchedRoutes = routesRes.data?.routes || [];
        const fetchedPlans = plansRes.data?.plans || [];

        setRoutes(fetchedRoutes);
        setPlans(fetchedPlans);

        if (!selectedRouteId && fetchedRoutes.length > 0) {
          setSelectedRouteId(fetchedRoutes[0].id);
          const firstRoute = fetchedRoutes[0];
          if (firstRoute.waypoints?.length >= 2) {
            setPickupStop(firstRoute.waypoints[1]?.stopName || firstRoute.origin);
            setDropStop(firstRoute.destination);
          }
        }

        if (!selectedPlanId && fetchedPlans.length > 0) {
          const popular = fetchedPlans.find((p: any) => p.isPopular) || fetchedPlans[0];
          setSelectedPlanId(popular.id);
        }
      } catch (err) {
        console.error('Error fetching plans/routes:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const currentRoute = routes.find((r) => r.id === selectedRouteId);
  const currentPlan = plans.find((p) => p.id === selectedPlanId);

  // When route changes, set default stops
  const handleRouteChange = (routeId: string) => {
    setSelectedRouteId(routeId);
    const r = routes.find((route) => route.id === routeId);
    if (r) {
      if (r.waypoints && r.waypoints.length > 1) {
        setPickupStop(r.waypoints[0].stopName);
        setDropStop(r.waypoints[r.waypoints.length - 1].stopName);
      } else {
        setPickupStop(r.origin);
        setDropStop(r.destination);
      }
      setMorningTime(r.morningStartTime);
      setEveningTime(r.eveningStartTime);
    }
  };

  const handleStartCheckout = () => {
    if (!user) {
      router.push('/login?callbackUrl=/commuter/plans');
      return;
    }
    setErrorMessage(null);
    setIsCheckoutOpen(true);
  };

  const handleCompletePayment = async () => {
    try {
      setIsProcessing(true);
      setErrorMessage(null);

      const res = await axios.post('/api/subscriptions', {
        planId: selectedPlanId,
        routeId: selectedRouteId,
        pickupAddress: pickupStop || currentRoute?.origin,
        dropAddress: dropStop || currentRoute?.destination,
        morningPickupTime: morningTime,
        eveningPickupTime: eveningTime,
        paymentMethod,
        gateway,
      });

      if (res.data?.success) {
        setPaymentSuccess(true);
        setTimeout(() => {
          setIsCheckoutOpen(false);
          router.push('/commuter/dashboard');
        }, 2000);
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || 'Payment transaction failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-slate-50">
        <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-10">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-2">
          <div className="inline-flex items-center space-x-1.5 text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Guaranteed Seat Checkout</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Customize Your Daily Commute Subscription
          </h1>
          <p className="text-sm text-slate-600">
            Select your corridor route, boarding stop, drop hub, and subscription duration.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Step 1 & 2: Route & Stops Selection (Col 7) */}
          <div className="lg:col-span-7 space-y-6">
            {/* 1. Select Route */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                  1
                </div>
                <h3 className="text-lg font-bold text-slate-900">Select Corridor Route</h3>
              </div>

              <div className="grid grid-cols-1 gap-3 pt-2">
                {routes.map((r) => {
                  const isSelected = r.id === selectedRouteId;
                  return (
                    <div
                      key={r.id}
                      onClick={() => handleRouteChange(r.id)}
                      className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50/50 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-xs font-bold bg-slate-900 text-white px-2 py-0.5 rounded">
                            {r.code}
                          </span>
                          <span className="font-bold text-sm text-slate-900">{r.name}</span>
                        </div>
                        {isSelected && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                      </div>
                      <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
                        <span>{r.origin} ➔ {r.destination}</span>
                        <span className="font-semibold text-slate-700">{r.distanceKm} km • ~{r.estimatedMinutes}m</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. Select Pickup & Drop Stops */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                  2
                </div>
                <h3 className="text-lg font-bold text-slate-900">Pickup & Drop Stops</h3>
              </div>

              {currentRoute && (
                <div className="space-y-4 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Morning Boarding Stop
                    </label>
                    <select
                      value={pickupStop}
                      onChange={(e) => setPickupStop(e.target.value)}
                      className="w-full p-3 rounded-xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                    >
                      {currentRoute.waypoints?.map((w: any, idx: number) => (
                        <option key={idx} value={w.stopName}>
                          {w.stopName} ({w.estimatedPickupTime}) - {w.landmark}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Destination Office / Drop Hub
                    </label>
                    <select
                      value={dropStop}
                      onChange={(e) => setDropStop(e.target.value)}
                      className="w-full p-3 rounded-xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                    >
                      {currentRoute.waypoints?.map((w: any, idx: number) => (
                        <option key={idx} value={w.stopName}>
                          {w.stopName} ({w.estimatedDropTime})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Morning Pickup Slot
                      </label>
                      <input
                        type="text"
                        value={morningTime}
                        onChange={(e) => setMorningTime(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Evening Return Slot
                      </label>
                      <input
                        type="text"
                        value={eveningTime}
                        onChange={(e) => setEveningTime(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Step 3: Plan Selection & Order Summary (Col 5) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                  3
                </div>
                <h3 className="text-lg font-bold text-slate-900">Choose Duration Plan</h3>
              </div>

              <div className="space-y-3">
                {plans.map((p) => {
                  const isSelected = p.id === selectedPlanId;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPlanId(p.id)}
                      className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50/50 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-sm text-slate-900">{p.name}</span>
                          {p.discountPercent > 0 && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                              Save {p.discountPercent}%
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{p.billingCycle.toLowerCase()} recurring pass</p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-black text-slate-900">${p.price}</div>
                        <div className="text-[10px] text-slate-400">Total Billed</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Order Breakdown Box */}
              {currentPlan && currentRoute && (
                <div className="pt-4 border-t border-slate-100 space-y-3 text-xs">
                  <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Subscription Summary
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Corridor Route:</span>
                    <span className="font-semibold text-slate-900">{currentRoute.code} ({currentRoute.name})</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Morning Pickup:</span>
                    <span className="font-semibold text-slate-900 truncate max-w-[200px]">{pickupStop}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Evening Drop:</span>
                    <span className="font-semibold text-slate-900 truncate max-w-[200px]">{dropStop}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Base Subscription ({currentPlan.durationMonths} mo):</span>
                    <span className="font-semibold text-slate-900">${currentPlan.price}.00</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Surge & Cancellation Shield:</span>
                    <span className="font-semibold text-emerald-600">FREE ($0.00)</span>
                  </div>

                  <div className="pt-3 border-t border-slate-200 flex justify-between items-baseline text-sm">
                    <span className="font-bold text-slate-900">Total Amount Due:</span>
                    <span className="text-2xl font-black text-emerald-700">${currentPlan.price}.00</span>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleStartCheckout}
                className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-600/20 hover:shadow-emerald-600/30 transition-all flex items-center justify-center space-x-2"
              >
                <CreditCard className="w-4 h-4" />
                <span>Proceed to Secure Payment</span>
              </button>

              <div className="flex items-center justify-center space-x-2 text-slate-400 text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>256-Bit SSL Encrypted Mock Gateway</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Interactive Mock Payment Modal (Stripe / Razorpay) */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 relative space-y-6">
            <button
              onClick={() => !isProcessing && setIsCheckoutOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            {paymentSuccess ? (
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto animate-bounce">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-black text-slate-900">Payment Successful!</h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Your Smart Ride subscription is activated. Your route captain and seat manifest have been reserved.
                </p>
                <div className="text-xs font-semibold text-emerald-700">
                  Redirecting to your Commuter Dashboard...
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Payment Authorization
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500">
                    Simulated Stripe / Razorpay Webhook Payment Gateway
                  </p>
                </div>

                {errorMessage && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Gateway Switcher */}
                <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setGateway('STRIPE')}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                      gateway === 'STRIPE' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Stripe Mock
                  </button>
                  <button
                    type="button"
                    onClick={() => setGateway('RAZORPAY')}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                      gateway === 'RAZORPAY' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Razorpay Mock
                  </button>
                </div>

                {/* Payment Method Selector */}
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('CARD')}
                      className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all ${
                        paymentMethod === 'CARD'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      Card
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('UPI')}
                      className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all ${
                        paymentMethod === 'UPI'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      UPI / QR
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('NETBANKING')}
                      className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all ${
                        paymentMethod === 'NETBANKING'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      Netbanking
                    </button>
                  </div>

                  {paymentMethod === 'CARD' && (
                    <div className="space-y-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Card Number
                        </label>
                        <input
                          type="text"
                          readOnly
                          value="4242 •••• •••• 4242 (Test Card)"
                          className="w-full p-2 rounded-lg bg-white border border-slate-300 text-xs font-mono text-slate-700"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                            Expires
                          </label>
                          <input
                            type="text"
                            readOnly
                            value="12 / 28"
                            className="w-full p-2 rounded-lg bg-white border border-slate-300 text-xs font-mono text-slate-700"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                            CVC
                          </label>
                          <input
                            type="text"
                            readOnly
                            value="999"
                            className="w-full p-2 rounded-lg bg-white border border-slate-300 text-xs font-mono text-slate-700"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {paymentMethod === 'UPI' && (
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-2">
                      <div className="text-xs font-bold text-slate-800">Simulated VPA / UPI ID</div>
                      <div className="text-xs font-mono text-emerald-700 bg-white p-2 rounded border">
                        {user?.email || 'commuter'}@oksmartride
                      </div>
                      <div className="text-[11px] text-slate-500">Auto-approved instant mock settlement</div>
                    </div>
                  )}

                  {paymentMethod === 'NETBANKING' && (
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-2">
                      <div className="text-xs font-bold text-slate-800">Corporate Bank Transfer</div>
                      <div className="text-xs text-slate-600">Simulating HDFC / Chase Direct Debit Authorization</div>
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={handleCompletePayment}
                    className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Authorizing & Triggering Webhook...</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        <span>Pay ${currentPlan?.price}.00 (Mock Pay)</span>
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PlansCheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    }>
      <PlansCheckoutContent />
    </Suspense>
  );
}
