'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import SecurityCenterDashboard from '@/components/admin/security-center-dashboard';
import RouteRiskOverview from '@/components/admin/route-risk-overview';
import RouteRiskHistoryViewer from '@/components/admin/route-risk-history-viewer';
import SafetyAlertCenter from '@/components/admin/safety-alert-center';
import SafetyIncidentCenter from '@/components/admin/safety-incident-center';
import PredictiveSafetyPanel from '@/components/admin/predictive-safety-panel';
import AnomalyMonitoringCenter from '@/components/admin/anomaly-monitoring-center';
import OperationalDecisionSupport from '@/components/admin/operational-decision-support';
import OperationalRecommendationCenter from '@/components/admin/operational-recommendation-center';
import OperationalAuditCenter from '@/components/admin/operational-audit-center';
import OperationalGovernanceCenter from '@/components/admin/operational-governance-center';
import OperationalAnalyticsCenter from '@/components/admin/operational-analytics-center';
import OperationalExecutiveDashboard from '@/components/admin/operational-executive-dashboard';
import OperationalScenarioSimulation from '@/components/admin/operational-scenario-simulation';
import OperationalScenarioComparison from '@/components/admin/operational-scenario-comparison';
import OperationalDecisionReplay from '@/components/admin/operational-decision-replay';
import OperationalResiliencePlanning from '@/components/admin/operational-resilience-planning';
import OperationalContinuityPlanning from '@/components/admin/operational-continuity-planning';
import MasterOperationalControlCenter from '@/components/admin/master-operational-control-center';
import OperationalActionWorkflow from '@/components/admin/operational-action-workflow';
import OperationalSystemHealth from '@/components/admin/operational-system-health';

export default function AdminSecurityPage() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 pb-16">
      {/* Top Navigation Bar */}
      <header className="bg-slate-950 border-b border-slate-800 text-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link
              href="/admin/dashboard"
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition flex items-center space-x-1.5 text-xs font-bold"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Command Center</span>
            </Link>
            <div className="h-5 w-px bg-slate-800" />
            <span className="text-sm font-bold text-slate-300">Security Center</span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2.5 py-1 rounded-full">
              Platform SOC
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        <MasterOperationalControlCenter />
        <OperationalActionWorkflow />
        <OperationalSystemHealth />
        <OperationalExecutiveDashboard />
        <OperationalScenarioSimulation />
        <OperationalScenarioComparison />
        <OperationalDecisionReplay />
        <OperationalResiliencePlanning />
        <OperationalContinuityPlanning />
        <OperationalDecisionSupport />
        <OperationalRecommendationCenter />
        <OperationalAuditCenter />
        <OperationalGovernanceCenter />
        <OperationalAnalyticsCenter />
        <RouteRiskOverview />
        <RouteRiskHistoryViewer />
        <SafetyAlertCenter />
        <SafetyIncidentCenter />
        <PredictiveSafetyPanel />
        <AnomalyMonitoringCenter />
        <SecurityCenterDashboard />
      </main>
    </div>
  );
}
