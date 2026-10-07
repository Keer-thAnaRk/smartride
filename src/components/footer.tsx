import React from 'react';
import Link from 'next/link';
import { Car, ShieldCheck, Clock, Award, HeartHandshake } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-300 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 lg:gap-12">
          {/* Col 1: Brand */}
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center space-x-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-md">
                <Car className="w-6 h-6" />
              </div>
              <span className="text-xl font-extrabold tracking-tight text-white">
                Smart<span className="text-emerald-400">Ride</span>
              </span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              The predictable, comfortable daily commute subscription network. Guaranteed reserved seats, verified route captains, and zero surge pricing.
            </p>
            <div className="flex items-center space-x-2 text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-3 py-1.5 rounded-lg w-fit">
              <ShieldCheck className="w-4 h-4" />
              <span>100% Police Verified Fleet Captains</span>
            </div>
          </div>

          {/* Col 2: Commuters */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Commuter Network</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/#routes" className="hover:text-emerald-400 transition-colors">Popular Corridor Routes</Link></li>
              <li><Link href="/#pricing" className="hover:text-emerald-400 transition-colors">Monthly & Quarterly Plans</Link></li>
              <li><Link href="/#calculator" className="hover:text-emerald-400 transition-colors">Commute Savings Calculator</Link></li>
              <li><Link href="/commuter/dashboard" className="hover:text-emerald-400 transition-colors">Commuter Portal</Link></li>
            </ul>
          </div>

          {/* Col 3: Drivers */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Driver Partners</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/register?role=DRIVER" className="hover:text-emerald-400 transition-colors">Become a Route Captain</Link></li>
              <li><Link href="/driver/onboarding" className="hover:text-emerald-400 transition-colors">Vehicle Onboarding</Link></li>
              <li><Link href="/driver/earnings" className="hover:text-emerald-400 transition-colors">Earnings & Guaranteed Payouts</Link></li>
              <li><Link href="/driver/dashboard" className="hover:text-emerald-400 transition-colors">Driver Manifest & Roster</Link></li>
            </ul>
          </div>

          {/* Col 4: Platform Trust */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Smart Ride Guarantee</h4>
            <ul className="space-y-2.5 text-sm text-slate-400">
              <li className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>On-time morning & evening dispatch</span>
              </li>
              <li className="flex items-center space-x-2">
                <Award className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Clean, sanitized, AC vehicles</span>
              </li>
              <li className="flex items-center space-x-2">
                <HeartHandshake className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>24/7 SOS & Real-time Live Tracking</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Smart Ride Inc. All rights reserved. Production-grade Commute Platform.</p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <span className="hover:text-slate-400 cursor-pointer">Privacy Policy</span>
            <span className="hover:text-slate-400 cursor-pointer">Terms of Service</span>
            <span className="hover:text-slate-400 cursor-pointer">Security Compliance</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
