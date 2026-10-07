'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Info,
  RotateCw,
  Search,
  Filter,
  Eye,
  Database,
  Layers,
  Activity,
  X,
  FileCheck,
  Server,
  Zap,
} from 'lucide-react';

export type HealthStatus =
  | 'HEALTHY'
  | 'WARNING'
  | 'DEGRADED'
  | 'CRITICAL'
  | 'INSUFFICIENT_DATA';

export type ValidationDomain =
  | 'authentication'
  | 'routeRisk'
  | 'riskHistory'
  | 'safetyAlerts'
  | 'incidents'
  | 'demandPrediction'
  | 'decisionSupport'
  | 'recommendations'
  | 'auditIntegrity'
  | 'governance'
  | 'analytics'
  | 'executiveDashboard'
  | 'scenarioIsolation'
  | 'crossModuleConsistency';

export interface ValidationCheckResult {
  domain: ValidationDomain;
  status: HealthStatus;
  ruleId: string;
  title: string;
  description: string;
  observedValue: any;
  expectedValue: any;
  affectedRoutes: string[];
  evidence: string;
  checkedAt: string;
}

export interface DomainHealthSummary {
  status: HealthStatus;
  checkCount: number;
  healthyCount: number;
  warningCount: number;
  degradedCount: number;
  criticalCount: number;
  insufficientDataCount: number;
  issueCount: number;
  affectedRoutes: string[];
  lastCheckedAt: string;
}

export interface SystemHealthSummary {
  overallStatus: HealthStatus;
  totalChecks: number;
  healthyChecks: number;
  warningChecks: number;
  degradedChecks: number;
  criticalChecks: number;
  insufficientDataChecks: number;
  affectedRoutes: string[];
  lastValidatedAt: string;
  domains: Record<ValidationDomain, DomainHealthSummary>;
}

export interface SystemHealthReport {
  success: boolean;
  summary: SystemHealthSummary;
  checks: ValidationCheckResult[];
  mandatoryNotice: string;
  targetRouteId?: string | null;
}

const DOMAIN_LABELS: Record<ValidationDomain, { label: string; icon: any }> = {
  authentication: { label: 'Auth & RBAC', icon: ShieldCheck },
  routeRisk: { label: 'Route Risk', icon: Activity },
  riskHistory: { label: 'Historical Trend', icon: Layers },
  safetyAlerts: { label: 'Safety Alerts', icon: AlertTriangle },
  incidents: { label: 'Incident Lifecycle', icon: AlertOctagon },
  demandPrediction: { label: 'Demand & Capacity', icon: Zap },
  decisionSupport: { label: 'Decision Support', icon: Server },
  recommendations: { label: 'Recommendations', icon: FileCheck },
  auditIntegrity: { label: 'Audit SHA-256', icon: Database },
  governance: { label: 'Governance & SLA', icon: ShieldCheck },
  analytics: { label: 'Executive Analytics', icon: Activity },
  executiveDashboard: { label: 'Executive Dashboard', icon: Layers },
  scenarioIsolation: { label: 'Scenario Isolation', icon: Server },
  crossModuleConsistency: { label: 'Cross-Module Reconcile', icon: CheckCircle2 },
};

export default function OperationalSystemHealth() {
  const [report, setReport] = useState<SystemHealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'ALL' | HealthStatus>('ALL');
  const [selectedRoute, setSelectedRoute] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCheck, setSelectedCheck] = useState<ValidationCheckResult | null>(null);

  const fetchHealth = useCallback(async (routeCode?: string) => {
    try {
      setLoading(true);
      setError(null);

      const url =
        routeCode && routeCode !== 'ALL'
          ? `/api/operations/system-health?routeId=${encodeURIComponent(routeCode)}`
          : '/api/operations/system-health';

      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}: Failed to fetch system health`);
      }

      const data: SystemHealthReport = await res.json();
      setReport(data);
    } catch (err: any) {
      console.error('[OperationalSystemHealth] Fetch error:', err);
      setError(err.message || 'Failed to load system health report');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth(selectedRoute);
  }, [fetchHealth, selectedRoute]);

  // Status Styling Helpers
  const getStatusBadge = (status: HealthStatus) => {
    switch (status) {
      case 'HEALTHY':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            HEALTHY
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3 mr-1" />
            WARNING
          </span>
        );
      case 'DEGRADED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-500/20 text-orange-300 border border-orange-500/30">
            <AlertOctagon className="w-3 h-3 mr-1" />
            DEGRADED
          </span>
        );
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse">
            <AlertOctagon className="w-3 h-3 mr-1" />
            CRITICAL
          </span>
        );
      case 'INSUFFICIENT_DATA':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/30">
            <Info className="w-3 h-3 mr-1" />
            INSUFFICIENT DATA
          </span>
        );
      default:
        return null;
    }
  };

  const filteredChecks = (report?.checks || []).filter((check) => {
    if (statusFilter !== 'ALL' && check.status !== statusFilter) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = check.ruleId.toLowerCase().includes(q);
      const matchTitle = check.title.toLowerCase().includes(q);
      const matchDesc = check.description.toLowerCase().includes(q);
      const matchDomain = check.domain.toLowerCase().includes(q);
      if (!matchId && !matchTitle && !matchDesc && !matchDomain) {
        return false;
      }
    }

    return true;
  });

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl text-white relative overflow-hidden">
      {/* Background Accent Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-800 gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold tracking-tight">
                  Operational Intelligence Validation & System Health Center
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Step 17 Validation
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Deterministic server-side validation pipeline verifying pipeline health, integrity, and cross-module consistency across Steps 1–16.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => fetchHealth(selectedRoute)}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 transition"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Run System Health Validation</span>
          </button>
        </div>
      </div>

      {/* Mandatory Advisory Notice */}
      <div className="mt-5 p-4 bg-slate-950/70 border border-slate-800 rounded-xl flex items-start space-x-3">
        <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 leading-relaxed">
          <strong className="text-white font-semibold block mb-0.5">
            MANDATORY SYSTEM SAFETY & READ-ONLY NOTICE
          </strong>
          System Health Validation is read-only and advisory. It verifies existing operational intelligence but does not modify routes, schedules, vehicles, drivers, subscriptions, bookings, dispatch assignments, alerts, incidents, recommendations, or audit records.
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="mt-4 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-center space-x-2">
          <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Executive KPI Strip */}
      {report && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mt-6">
          <div className="p-3.5 bg-slate-950/50 border border-slate-800/80 rounded-xl">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
              Overall Status
            </span>
            <div>{getStatusBadge(report.summary.overallStatus)}</div>
          </div>

          <div className="p-3.5 bg-slate-950/50 border border-slate-800/80 rounded-xl">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
              Total Checks
            </span>
            <span className="text-lg font-bold text-white">{report.summary.totalChecks}</span>
          </div>

          <div className="p-3.5 bg-slate-950/50 border border-slate-800/80 rounded-xl">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
              Healthy
            </span>
            <span className="text-lg font-bold text-emerald-400">
              {report.summary.healthyChecks}
            </span>
          </div>

          <div className="p-3.5 bg-slate-950/50 border border-slate-800/80 rounded-xl">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
              Warnings
            </span>
            <span className="text-lg font-bold text-amber-400">
              {report.summary.warningChecks}
            </span>
          </div>

          <div className="p-3.5 bg-slate-950/50 border border-slate-800/80 rounded-xl">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
              Degraded
            </span>
            <span className="text-lg font-bold text-orange-400">
              {report.summary.degradedChecks}
            </span>
          </div>

          <div className="p-3.5 bg-slate-950/50 border border-slate-800/80 rounded-xl">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
              Critical
            </span>
            <span className="text-lg font-bold text-rose-400">
              {report.summary.criticalChecks}
            </span>
          </div>

          <div className="p-3.5 bg-slate-950/50 border border-slate-800/80 rounded-xl">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
              Insufficient Data
            </span>
            <span className="text-lg font-bold text-sky-400">
              {report.summary.insufficientDataChecks}
            </span>
          </div>
        </div>
      )}

      {/* Domain Health Grid */}
      {report && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>Intelligence Domain Health Status (14 Domains)</span>
            </h3>
            <span className="text-[11px] text-slate-400">
              Last Validated:{' '}
              {new Date(report.summary.lastValidatedAt).toLocaleTimeString()}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            {(Object.keys(report.summary.domains) as ValidationDomain[]).map((domainKey) => {
              const dom = report.summary.domains[domainKey];
              const config = DOMAIN_LABELS[domainKey] || {
                label: domainKey,
                icon: ShieldCheck,
              };
              const Icon = config.icon;

              return (
                <div
                  key={domainKey}
                  className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl flex flex-col justify-between hover:border-slate-700 transition"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-200">
                        <Icon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="truncate">{config.label}</span>
                      </div>
                    </div>
                    <div className="mb-2">{getStatusBadge(dom.status)}</div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400">
                    <span>{dom.checkCount} Check(s)</span>
                    <span
                      className={
                        dom.issueCount > 0
                          ? 'font-bold text-amber-400'
                          : 'text-slate-500'
                      }
                    >
                      {dom.issueCount > 0 ? `${dom.issueCount} Issue(s)` : '0 Issues'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Controls & Filter Strip */}
      <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          {(
            ['ALL', 'HEALTHY', 'WARNING', 'DEGRADED', 'CRITICAL', 'INSUFFICIENT_DATA'] as const
          ).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                statusFilter === tab
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {tab.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Corridor Selector & Search */}
        <div className="flex items-center space-x-2 w-full md:w-auto">
          <div className="relative">
            <select
              value={selectedRoute}
              onChange={(e) => setSelectedRoute(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">ALL CORRIDORS</option>
              <option value="SR-101">SR-101</option>
              <option value="SR-102">SR-102</option>
              <option value="SR-103">SR-103</option>
            </select>
          </div>

          <div className="relative flex-1 md:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search checks, rules, descriptions..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Validation Checks Table */}
      <div className="mt-4 border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Rule ID</th>
                <th className="py-3 px-4">Domain</th>
                <th className="py-3 px-4">Validation Description</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Observed</th>
                <th className="py-3 px-4">Expected</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading && !report ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    <RotateCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-400" />
                    Running server-side health checks...
                  </td>
                </tr>
              ) : filteredChecks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No validation checks match the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredChecks.map((check) => (
                  <tr
                    key={check.ruleId}
                    className="hover:bg-slate-800/40 transition cursor-pointer"
                    onClick={() => setSelectedCheck(check)}
                  >
                    <td className="py-3 px-4 font-mono font-bold text-indigo-300">
                      {check.ruleId}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {DOMAIN_LABELS[check.domain]?.label || check.domain}
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate">
                      <div className="font-semibold text-white truncate">{check.title}</div>
                      <div className="text-[11px] text-slate-400 truncate">{check.description}</div>
                    </td>
                    <td className="py-3 px-4">{getStatusBadge(check.status)}</td>
                    <td className="py-3 px-4 max-w-xs font-mono text-[11px] text-slate-300 truncate">
                      {typeof check.observedValue === 'object'
                        ? JSON.stringify(check.observedValue)
                        : String(check.observedValue)}
                    </td>
                    <td className="py-3 px-4 max-w-xs font-mono text-[11px] text-slate-400 truncate">
                      {typeof check.expectedValue === 'object'
                        ? JSON.stringify(check.expectedValue)
                        : String(check.expectedValue)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCheck(check);
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Validation Detail Drawer */}
      {selectedCheck && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/80 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-xl bg-slate-900 border-l border-slate-800 h-full p-6 shadow-2xl flex flex-col justify-between overflow-y-auto">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-sm font-bold text-indigo-400">
                    {selectedCheck.ruleId}
                  </span>
                  <span className="text-xs text-slate-400">
                    ({DOMAIN_LABELS[selectedCheck.domain]?.label || selectedCheck.domain})
                  </span>
                </div>
                <button
                  onClick={() => setSelectedCheck(null)}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-base font-bold text-white">{selectedCheck.title}</h3>
                  <div>{getStatusBadge(selectedCheck.status)}</div>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {selectedCheck.description}
                </p>
              </div>

              {/* Observed vs Expected */}
              <div className="mt-6 space-y-4">
                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1.5">
                    Observed Pipeline Value
                  </span>
                  <pre className="text-xs font-mono text-indigo-300 whitespace-pre-wrap overflow-x-auto">
                    {typeof selectedCheck.observedValue === 'object'
                      ? JSON.stringify(selectedCheck.observedValue, null, 2)
                      : String(selectedCheck.observedValue)}
                  </pre>
                </div>

                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1.5">
                    Expected Invariant Value
                  </span>
                  <pre className="text-xs font-mono text-emerald-300 whitespace-pre-wrap overflow-x-auto">
                    {typeof selectedCheck.expectedValue === 'object'
                      ? JSON.stringify(selectedCheck.expectedValue, null, 2)
                      : String(selectedCheck.expectedValue)}
                  </pre>
                </div>
              </div>

              {/* Evidence & Affected Routes */}
              <div className="mt-6 space-y-4">
                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1.5">
                    Authoritative Deterministic Evidence
                  </span>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {selectedCheck.evidence}
                  </p>
                </div>

                {selectedCheck.affectedRoutes.length > 0 && (
                  <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1.5">
                      Affected Corridors
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedCheck.affectedRoutes.map((r) => (
                        <span
                          key={r}
                          className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-xs"
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-[11px] text-slate-500 pt-2">
                  Validated at:{' '}
                  {new Date(selectedCheck.checkedAt).toLocaleString()}
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-800 mt-6">
              <button
                onClick={() => setSelectedCheck(null)}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
