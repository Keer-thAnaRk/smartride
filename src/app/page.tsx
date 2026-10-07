'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import axios from 'axios';
import {
  Car,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  CreditCard,
  DollarSign,
  MapPin,
  Navigation,
  Percent,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingDown,
  Users,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/components/auth-context';

export default function LandingPage() {
  const { user, quickDemoLogin } = useAuth();
  const [routes, setRoutes] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [dailyKm, setDailyKm] = useState<number>(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [routesRes, plansRes] = await Promise.all([
          axios.get('/api/routes'),
          axios.get('/api/plans'),
        ]);
        if (routesRes.data?.routes) setRoutes(routesRes.data.routes);
        if (plansRes.data?.plans) setPlans(plansRes.data.plans);
      } catch (err) {
        console.error('Failed to load landing data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Savings Calculator math
  const workingDaysPerMonth = 22;
  const onDemandCabCost = Math.round(dailyKm * 0.75 * 2 * workingDaysPerMonth); // ~$990
  const personalCarCost = Math.round(dailyKm * 0.45 * 2 * workingDaysPerMonth + 120); // fuel + parking maintenance
  const smartRideMonthly = 129;
  const monthlySavings = Math.max(0, onDemandCabCost - smartRideMonthly);
  const yearlySavings = monthlySavings * 12;

  return (
    <div className="flex flex-col min-h-screen">
      {/* 1. Hero Section - Full-Bleed Video Background */}
      <section className="relative overflow-hidden bg-slate-950 text-white min-h-[calc(100vh-4rem)] flex items-center py-16 lg:py-24">
        {/* Full-Bleed Video Background */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <video
            autoPlay
            loop
            muted
            playsInline
            controls={false}
            preload="auto"
            className="w-full h-full object-cover object-center"
          >
            <source src="/videos/smartride-car.mp4" type="video/mp4" />
          </video>

          {/* Sophisticated Cinematic Gradient Overlays (Refined for ~15% higher video/car visibility) */}
          {/* Base ambient dark tint to blend video with deep slate theme */}
          <div className="absolute inset-0 bg-slate-950/30" />

          {/* Left-to-right gradient: ensures 100% crisp typography on the left while keeping the car animation on the right bright & vivid */}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-950/55 to-transparent" />

          {/* Top and bottom subtle vignettes */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/50 via-transparent to-slate-950/65" />

          {/* SmartRide emerald atmospheric glow */}
          <div className="absolute top-0 left-1/3 -translate-x-1/2 w-full max-w-5xl h-96 bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-transparent blur-3xl pointer-events-none rounded-full" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Column: Headlines */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 text-xs font-semibold uppercase tracking-wider backdrop-blur-md">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Zero Surge • Guaranteed Reserved Seat</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight text-balance">
                Your Daily Office Commute,{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
                  Predictable & Stress-Free.
                </span>
              </h1>

              <p className="text-lg sm:text-xl text-slate-200 font-normal leading-relaxed text-balance max-w-2xl mx-auto lg:mx-0">
                Subscribe to reliable monthly pickup & drop shuttles tailored for working professionals. No cancellations, no surge prices, and guaranteed air-conditioned comfort every morning and evening.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-4">
                <Link
                  href={user ? '/commuter/plans' : '/register'}
                  className="w-full sm:w-auto px-8 py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-base shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all flex items-center justify-center space-x-2"
                >
                  <span>Subscribe to a Route</span>
                  <ChevronRight className="w-5 h-5" />
                </Link>
                <Link
                  href="#routes"
                  className="w-full sm:w-auto px-7 py-4 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-white font-semibold text-base border border-slate-700/80 hover:border-slate-600 backdrop-blur-md transition-all flex items-center justify-center space-x-2 shadow-lg"
                >
                  <MapPin className="w-4 h-4 text-emerald-400" />
                  <span>View Tech Corridor Routes</span>
                </Link>
              </div>

              {/* Trust Metrics */}
              <div className="grid grid-cols-3 gap-4 pt-8 border-t border-slate-800/80 max-w-lg mx-auto lg:mx-0">
                <div>
                  <div className="text-2xl sm:text-3xl font-black text-white">99.4%</div>
                  <div className="text-xs text-slate-300 mt-0.5">On-Time Dispatch</div>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-black text-emerald-400">100%</div>
                  <div className="text-xs text-slate-300 mt-0.5">Reserved Seat</div>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-black text-teal-400">65%</div>
                  <div className="text-xs text-slate-300 mt-0.5">Cost Savings vs Cabs</div>
                </div>
              </div>
            </div>

            {/* Right Column: Live Morning Pickup Card */}
            <div className="lg:col-span-5 relative w-full max-w-md mx-auto">
              <div className="relative mx-auto max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-6 shadow-2xl space-y-5">
                {/* Live Ride Status Header */}
                <div className="flex items-center justify-between border-b border-slate-700/80 pb-4">
                  <div className="flex items-center space-x-2.5">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                      Live Morning Pickup
                    </span>
                  </div>
                  <span className="text-xs font-mono bg-slate-950 px-2.5 py-1 rounded text-slate-300 border border-slate-700">
                    Route SR-101
                  </span>
                </div>

                {/* Driver & Vehicle snapshot */}
                <div className="flex items-center space-x-3.5 bg-slate-950/80 p-3.5 rounded-xl border border-slate-700/50">
                  <div className="w-12 h-12 rounded-full bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center text-emerald-300 font-bold overflow-hidden">
                    <img
                      src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80"
                      alt="Captain Rajesh"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-1.5">
                      <h4 className="text-sm font-semibold text-white truncate">Rajesh Sharma</h4>
                      <span className="flex items-center text-[11px] text-amber-400 font-bold">
                        <Star className="w-3 h-3 fill-amber-400 mr-0.5" /> 4.96
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 truncate">
                      Toyota Innova Crysta • KA-01-MJ-8822
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block text-[11px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-semibold">
                      Seat #1
                    </span>
                  </div>
                </div>

                {/* Stop progress timeline */}
                <div className="space-y-3 pl-2 border-l-2 border-dashed border-emerald-500/40 ml-3">
                  <div className="relative pl-5">
                    <div className="absolute -left-[19px] top-1 w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-slate-900" />
                    <div className="text-xs font-semibold text-slate-200">HSR Layout 27th Main</div>
                    <div className="text-[11px] text-emerald-400 font-medium">Your Pickup • 08:20 AM</div>
                  </div>
                  <div className="relative pl-5">
                    <div className="absolute -left-[19px] top-1 w-3 h-3 rounded-full bg-slate-600 ring-4 ring-slate-900" />
                    <div className="text-xs font-semibold text-slate-400">ITPB Tech Park Hub</div>
                    <div className="text-[11px] text-slate-500">Destination • 08:55 AM</div>
                  </div>
                </div>

                {/* Quick Action Button for Guest Demo */}
                <div className="pt-2">
                  <Link
                    href="/dashboard?mode=guest"
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs transition-all shadow flex items-center justify-center space-x-2"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>⚡ Try Interactive Commuter Dashboard</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Interactive Commute Savings & Fuel Calculator */}
      <section id="calculator" className="py-16 lg:py-24 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <div className="inline-flex items-center space-x-1.5 text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full uppercase tracking-wider">
              <TrendingDown className="w-3.5 h-3.5" />
              <span>Smart Commute Economics</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              See How Much You Save Every Month
            </h2>
            <p className="text-base text-slate-600">
              Compare your current daily on-demand cab or self-driving costs against a Smart Ride monthly subscription.
            </p>
          </div>

          <div className="mt-12 max-w-4xl mx-auto bg-white rounded-3xl p-6 sm:p-10 shadow-xl border border-slate-200/80">
            {/* Slider Control */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-sm font-bold text-slate-800">
                  Daily Roundtrip Distance:
                </label>
                <span className="text-lg font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200">
                  {dailyKm} km / day
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="80"
                step="5"
                value={dailyKm}
                onChange={(e) => setDailyKm(parseInt(e.target.value))}
                className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />
              <div className="flex justify-between text-xs text-slate-400 font-medium">
                <span>10 km (Short City Route)</span>
                <span>40 km (Average Tech Corridor)</span>
                <span>80 km (Cross-city Shuttle)</span>
              </div>
            </div>

            {/* Comparison Grid */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Option 1: On-demand Cabs */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="text-xs font-semibold text-slate-500 uppercase">On-Demand Cabs (Daily)</div>
                <div className="text-2xl font-black text-slate-800">${onDemandCabCost}<span className="text-xs font-normal text-slate-500">/mo</span></div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Subject to peak surge pricing, high cancellation rates, and daily morning booking stress.
                </p>
              </div>

              {/* Option 2: Self Driving */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="text-xs font-semibold text-slate-500 uppercase">Self Driving + Fuel + Parking</div>
                <div className="text-2xl font-black text-slate-800">${personalCarCost}<span className="text-xs font-normal text-slate-500">/mo</span></div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Tiring bumper-to-bumper traffic fatigue, parking hassles, toll charges, and vehicle wear & tear.
                </p>
              </div>

              {/* Option 3: Smart Ride */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-lg shadow-emerald-600/20 space-y-2 relative overflow-hidden">
                <div className="absolute top-2 right-2 bg-emerald-400/30 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                  Best Value
                </div>
                <div className="text-xs font-semibold text-emerald-100 uppercase">Smart Ride Subscription</div>
                <div className="text-3xl font-black text-white">${smartRideMonthly}<span className="text-xs font-normal text-emerald-200">/mo</span></div>
                <p className="text-xs text-emerald-100 leading-relaxed">
                  Fixed guaranteed AC seat, on-time morning & evening pickup, zero surge, relax or work on laptop.
                </p>
              </div>
            </div>

            {/* Savings Callout */}
            <div className="mt-8 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">
                    You save approximately <span className="text-emerald-700 font-extrabold">${monthlySavings}/month</span> (${yearlySavings}/year)
                  </div>
                  <div className="text-xs text-slate-500">Plus 40+ hours saved from driving stress and cab booking wait times.</div>
                </div>
              </div>
              <Link
                href="/register"
                className="whitespace-nowrap px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm"
              >
                Claim Subscription
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Corridor Routes Showcase */}
      <section id="routes" className="py-16 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
            <div>
              <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2">
                Tech Hub Network
              </div>
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                Active Metro Corridor Routes
              </h2>
              <p className="text-slate-600 text-sm mt-1 max-w-xl">
                Fixed scheduled shuttles running daily along major office tech parks, residential clusters, and metro corridors.
              </p>
            </div>
            <Link
              href="/commuter/plans"
              className="mt-4 md:mt-0 text-sm font-semibold text-emerald-600 hover:text-emerald-700 flex items-center space-x-1"
            >
              <span>Explore all routes & stops</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {routes.map((route) => (
              <div
                key={route.id}
                className="rounded-2xl border border-slate-200 bg-white p-6 hover:shadow-xl transition-all duration-200 flex flex-col justify-between space-y-4 group hover:border-emerald-300"
              >
                <div>
                  {/* Route Header */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-slate-100 text-slate-800 font-mono">
                      {route.code}
                    </span>
                    <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      {route.distanceKm} km • {route.estimatedMinutes} mins
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                    {route.name}
                  </h3>

                  {/* Timings */}
                  <div className="mt-3 flex items-center space-x-4 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl">
                    <div className="flex items-center space-x-1.5">
                      <Clock className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Morning: <strong>{route.morningStartTime}</strong></span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Clock className="w-3.5 h-3.5 text-teal-600" />
                      <span>Return: <strong>{route.eveningStartTime}</strong></span>
                    </div>
                  </div>

                  {/* Waypoints snippet */}
                  <div className="mt-4 space-y-1.5">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Stops Sequence ({route.waypoints.length} stops)
                    </div>
                    <div className="text-xs text-slate-600 space-y-1">
                      <div className="flex items-center space-x-1.5 text-slate-800 font-medium">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        <span className="truncate">{route.origin}</span>
                      </div>
                      <div className="pl-4 text-slate-400 text-[11px]">↓ via {route.waypoints.length > 2 ? `${route.waypoints.length - 2} major tech hubs` : 'expressway'}</div>
                      <div className="flex items-center space-x-1.5 text-slate-800 font-medium">
                        <Navigation className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" />
                        <span className="truncate">{route.destination}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer specs & CTA */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-xs text-slate-500">
                    Vehicle: <span className="font-semibold text-slate-700">{route.assignedVehicle?.make || 'AC'} {route.assignedVehicle?.model || 'Shuttle'}</span>
                  </div>
                  <Link
                    href={`/commuter/plans?routeId=${route.id}`}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white text-xs font-bold transition-all"
                  >
                    Select Route
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Pricing Plans */}
      <section id="pricing" className="py-16 lg:py-24 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <div className="inline-flex items-center space-x-1.5 text-xs font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-3 py-1 rounded-full uppercase tracking-wider">
              <Percent className="w-3.5 h-3.5" />
              <span>Transparent Predictable Plans</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Simple Monthly & Multi-Month Subscriptions
            </h2>
            <p className="text-slate-400 text-base">
              All plans include guaranteed seat reservation, dual morning/evening trips, and certified captain guarantee.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            {plans.map((plan) => {
              const isPopular = plan.isPopular;
              return (
                <div
                  key={plan.id}
                  className={`relative rounded-3xl p-8 flex flex-col justify-between transition-all duration-200 ${
                    isPopular
                      ? 'bg-slate-800 border-2 border-emerald-500 shadow-2xl shadow-emerald-500/10 scale-105'
                      : 'bg-slate-800/60 border border-slate-700'
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black text-[11px] uppercase tracking-wider px-3 py-1 rounded-full shadow">
                      Most Popular
                    </div>
                  )}

                  <div>
                    <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                    <p className="text-xs text-slate-400 mt-1 min-h-[36px]">{plan.description}</p>

                    <div className="mt-6 flex items-baseline space-x-2">
                      <span className="text-4xl font-black text-white">${plan.price}</span>
                      <span className="text-xs text-slate-400">/ {plan.billingCycle.toLowerCase()}</span>
                      {plan.discountPercent > 0 && (
                        <span className="text-xs font-bold text-emerald-400 bg-emerald-950 border border-emerald-800 px-2 py-0.5 rounded">
                          Save {plan.discountPercent}%
                        </span>
                      )}
                    </div>

                    <div className="mt-6 pt-6 border-t border-slate-700/80 space-y-3">
                      <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">What's Included:</div>
                      <ul className="space-y-2.5 text-xs text-slate-300">
                        {plan.features.map((feat: string, idx: number) => (
                          <li key={idx} className="flex items-start space-x-2.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-8 pt-6">
                    <Link
                      href={`/commuter/plans?planId=${plan.id}`}
                      className={`w-full py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center space-x-2 transition-all ${
                        isPopular
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/25'
                          : 'bg-slate-700 hover:bg-slate-600 text-white'
                      }`}
                    >
                      <span>Choose {plan.billingCycle} Plan</span>
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. Driver Partner Callout */}
      <section className="py-16 bg-gradient-to-r from-emerald-700 to-teal-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-8 space-y-4">
              <div className="inline-flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider bg-emerald-900/60 px-3 py-1 rounded-full text-emerald-200">
                <Car className="w-3.5 h-3.5" />
                <span>Driver Partner Program</span>
              </div>
              <h2 className="text-3xl font-extrabold sm:text-4xl">
                Earn Predictable Monthly Income on Fixed Corridor Routes
              </h2>
              <p className="text-emerald-100 text-base max-w-2xl">
                Drive fixed morning and evening shifts for verified corporate commuters. No random mid-day chasing, guaranteed monthly payouts, and fixed passenger manifests.
              </p>
            </div>
            <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-3 justify-center">
              <Link
                href="/register?role=DRIVER"
                className="px-6 py-3.5 bg-white text-emerald-900 hover:bg-emerald-50 font-bold rounded-xl text-center shadow-lg transition-all"
              >
                Register as Driver Partner
              </Link>
              <button
                onClick={() => quickDemoLogin('DRIVER')}
                className="px-6 py-3.5 bg-emerald-900/80 hover:bg-emerald-900 text-white font-semibold rounded-xl text-center border border-emerald-400/40 text-xs transition-all"
              >
                Explore Driver Manifest Demo
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
