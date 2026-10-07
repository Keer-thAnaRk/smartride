'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  ShieldAlert,
  AlertTriangle,
  Radio,
  CheckCircle2,
  Clock,
  Car,
  Navigation,
  RefreshCw,
  Search,
  Filter,
  Eye,
  Check,
  X,
  FileText,
  Sliders,
  Play,
  RotateCcw,
  Zap,
  Info,
  ExternalLink,
  ChevronRight,
  Lock,
  UserX,
  Compass,
} from 'lucide-react';
import { listenToTrip } from '@/lib/firebase';
import { AnomalyEvent, AnomalySeverity, AnomalyType, SecurityAuditLogEntry } from '@/lib/security/anomaly-types';

export default function AnomalyMonitoringCenter() {
  const [activeTab, setActiveTab] = useState<'anomalies' | 'simulator' | 'audit'>('anomalies');
  const [loading, setLoading] = useState(false);
  const [anomalies, setAnomalies] = useState<AnomalyEvent[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [criticalCount, setCriticalCount] = useState(0);
  const [correlatedAlert, setCorrelatedAlert] = useState<AnomalyEvent | null>(null);
  const [safetyScore, setSafetyScore] = useState<number>(94);
  const [etaDelay, setEtaDelay] = useState<number>(0);
  const [auditLogs, setAuditLogs] = useState<SecurityAuditLogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Selected Anomaly for Deep Investigation Modal
  const [selectedAnomaly, setSelectedAnomaly] = useState<AnomalyEvent | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Resolution / Action Modal
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionAnomaly, setActionAnomaly] = useState<AnomalyEvent | null>(null);
  const [actionType, setActionType] = useState<'ACKNOWLEDGE' | 'INVESTIGATE' | 'RESOLVE' | 'DISMISS'>('RESOLVE');
  const [resolutionReason, setResolutionReason] = useState('Traffic diversion confirmed by Bangalore Traffic Police');
  const [actionNotes, setActionNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Simulator state
  const [simulatingScenario, setSimulatingScenario] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const RESOLUTION_REASONS = [
    'Traffic diversion confirmed by Bangalore Traffic Police',
    'Corridor roadworks bypass authorized by central dispatch',
    'Driver verified commuter boarding credentials verbally via phone',
    'GPS sensor temporary glitch / multipath reflection resolved',
    'Authorized roadside assistance / emergency maintenance completed',
    'False positive sensor glitch — vehicle within permissible tolerance',
    'Commuter entered wrong code repeatedly — identity re-verified by dispatcher',
  ];

  // Fetch anomaly data from backend
  const fetchAnomalies = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/security/anomalies?tripId=trip-sr101-today');
      if (res.data?.success && res.data.result) {
        const r = res.data.result;
        setAnomalies(r.anomalies || []);
        setActiveCount(r.activeAnomalies?.length || 0);
        setCriticalCount(
          (r.activeAnomalies || []).filter((a: AnomalyEvent) => a.severity === 'CRITICAL' || a.severity === 'HIGH').length
        );
        setCorrelatedAlert(r.multiSignalAnomaly || null);
        if (r.safetyScoreImpact) {
          setSafetyScore(r.safetyScoreImpact.currentScore);
        }
        if (r.etaImpact) {
          setEtaDelay(r.etaImpact.delayMinutes || 0);
        }
      }
    } catch (err) {
      console.warn('Failed to load anomalies:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch security audit logs
  const fetchAuditLogs = async () => {
    try {
      const res = await axios.get('/api/security/audit-log?limit=50');
      if (res.data?.success) {
        setAuditLogs(res.data.logs || []);
      }
    } catch (err) {
      console.warn('Failed to load security audit logs:', err);
    }
  };

  // Real-time trip listener to re-evaluate on GPS tick
  useEffect(() => {
    fetchAnomalies();
    fetchAuditLogs();

    const unsub = listenToTrip('trip-sr101-today', () => {
      fetchAnomalies();
    });

    const interval = setInterval(() => {
      fetchAnomalies();
    }, 8000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  // Handle Administrative Action execution
  const handleExecuteAction = async () => {
    if (!actionAnomaly) return;
    try {
      setActionLoading(true);
      const res = await axios.post('/api/security/anomalies/action', {
        eventId: actionAnomaly.id,
        action: actionType,
        reason: resolutionReason,
        notes: actionNotes,
        tripId: actionAnomaly.tripId,
      });

      if (res.data?.success) {
        setToastMessage(`✓ Event marked as ${res.data.status}. Immutable audit entry logged.`);
        setShowActionModal(false);
        setActionAnomaly(null);
        setActionNotes('');
        await fetchAnomalies();
        await fetchAuditLogs();
        setTimeout(() => setToastMessage(null), 4000);
      }
    } catch (err: any) {
      setToastMessage(err.response?.data?.error || 'Failed to submit incident action');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Demo Simulator Trigger
  const handleTriggerSimulation = async (scenario: string) => {
    try {
      setSimulatingScenario(scenario);
      const res = await axios.post('/api/security/anomalies/simulate', {
        scenario,
        tripId: 'trip-sr101-today',
      });

      if (res.data?.success) {
        setToastMessage(`⚡ Simulation scenario '${scenario}' executed! Telemetry evaluated.`);
        await fetchAnomalies();
        await fetchAuditLogs();
        setTimeout(() => setToastMessage(null), 4000);
      }
    } catch (err: any) {
      setToastMessage(err.response?.data?.error || 'Failed to run simulation');
    } finally {
      setSimulatingScenario(null);
    }
  };

  // Filtered anomalies
  const filteredAnomalies = anomalies.filter((a) => {
    const matchesSearch =
      searchQuery === '' ||
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.type.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSeverity = severityFilter === 'ALL' || a.severity === severityFilter;
    const matchesStatus = statusFilter === 'ALL' || a.status === statusFilter;

    return matchesSearch && matchesSeverity && matchesStatus;
  });

  const getSeverityBadge = (sev: AnomalySeverity) => {
    switch (sev) {
      case 'CRITICAL':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'MEDIUM':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'LOW':
      case 'WARNING':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusBadge = (st: string) => {
    switch (st) {
      case 'ACTIVE':
        return 'bg-rose-50 text-rose-700 border-rose-300 font-semibold animate-pulse';
      case 'ACKNOWLEDGED':
        return 'bg-blue-50 text-blue-700 border-blue-200 font-medium';
      case 'INVESTIGATING':
        return 'bg-purple-50 text-purple-700 border-purple-200 font-medium';
      case 'RESOLVED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 font-medium';
      case 'DISMISSED':
        return 'bg-slate-50 text-slate-500 border-slate-200 line-through';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  return (
    <section id="anomaly-monitoring" className="space-y-6 pt-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-xl border border-slate-700 flex items-center space-x-3 animate-fade-in text-sm font-medium">
          <Info className="w-5 h-5 text-indigo-400 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="w-13 h-13 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold flex-shrink-0 shadow-inner p-3">
            <ShieldAlert className="w-7 h-7 text-rose-600" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h2 className="text-xl font-bold text-slate-900">
                Anomaly Detection & Security Operations Center
              </h2>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700 border border-rose-200">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5 animate-ping" />
                Live Rule Engine
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Active telemetry correlation, route corridor boundaries, persistent speed spikes, long stop exemptions & zero-OTP exposure guard.
            </p>
          </div>
        </div>

        {/* Tab & Refresh Controls */}
        <div className="flex items-center space-x-2">
          <div className="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('anomalies')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'anomalies'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Incidents ({activeCount})
            </button>
            <button
              onClick={() => setActiveTab('simulator')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 ${
                activeTab === 'simulator'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Simulator</span>
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'audit'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Audit Trail ({auditLogs.length})
            </button>
          </div>

          <button
            onClick={() => {
              fetchAnomalies();
              fetchAuditLogs();
            }}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition border border-slate-200"
            title="Refresh active anomalies"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Correlated Multi-Signal Banner (if active) */}
      {correlatedAlert && (
        <div className="bg-gradient-to-r from-rose-500 to-red-600 text-white p-5 rounded-3xl shadow-md border border-rose-400 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="p-2.5 bg-white/20 rounded-2xl flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-amber-200 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 bg-white/20 rounded-md text-xs font-bold uppercase tracking-wide">
                  Multi-Signal Correlated Incident
                </span>
                <span className="text-xs text-rose-100">
                  {correlatedAlert.metadata?.correlatedTypes?.length || 2} concurrent variances
                </span>
              </div>
              <h3 className="text-base font-bold text-white mt-1">
                {correlatedAlert.title}
              </h3>
              <p className="text-sm text-rose-100 mt-0.5">
                {correlatedAlert.description}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3 flex-shrink-0">
            <button
              onClick={() => {
                setSelectedAnomaly(correlatedAlert);
                setShowDetailModal(true);
              }}
              className="px-4 py-2 bg-white text-rose-700 hover:bg-rose-50 text-xs font-bold rounded-xl shadow-sm transition"
            >
              Inspect Correlation
            </button>
            <button
              onClick={() => {
                setActionAnomaly(correlatedAlert);
                setActionType('RESOLVE');
                setShowActionModal(true);
              }}
              className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-xl border border-white/20 transition"
            >
              Resolve Incident
            </button>
          </div>
        </div>
      )}

      {/* 4 KPIs Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Active Anomalies */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Active Anomalies
            </span>
            <span className={`w-2.5 h-2.5 rounded-full ${activeCount > 0 ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'}`} />
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-slate-900">{activeCount}</span>
            <span className="text-xs text-slate-500">of 6 rules monitored</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center">
            {activeCount === 0 ? (
              <span className="text-emerald-600 font-medium">✓ All corridors within bounds</span>
            ) : (
              <span className="text-rose-600 font-medium">Operational variances active</span>
            )}
          </div>
        </div>

        {/* KPI 2: High & Critical Severities */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              High / Critical
            </span>
            <ShieldAlert className="w-4 h-4 text-orange-500" />
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-slate-900">{criticalCount}</span>
            <span className="text-xs text-slate-500">requiring intervention</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {criticalCount > 0 ? 'Immediate dispatcher review' : 'No critical alerts active'}
          </div>
        </div>

        {/* KPI 3: Dynamic Safety Impact */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Corridor Safety Score
            </span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
              safetyScore >= 85 ? 'bg-emerald-100 text-emerald-800' :
              safetyScore >= 70 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
            }`}>
              {safetyScore} / 100
            </span>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-slate-900">{safetyScore}</span>
            <span className="text-xs text-slate-500">live score</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {etaDelay > 0 ? `+${etaDelay} min detour delay adjusted` : 'On schedule'}
          </div>
        </div>

        {/* KPI 4: Security Audit Trail */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Audit Log Trail
            </span>
            <Lock className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-slate-900">{auditLogs.length}</span>
            <span className="text-xs text-slate-500">immutable records</span>
          </div>
          <div className="mt-2 text-xs text-emerald-600 font-medium">
            Zero PII & zero OTP exposed
          </div>
        </div>
      </div>

      {/* MAIN TAB 1: INCIDENTS TABLE & FEED */}
      {activeTab === 'anomalies' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Filters Bar */}
          <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search incidents by rule, corridor, or details..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition"
              />
            </div>

            <div className="flex items-center space-x-3">
              {/* Severity filter */}
              <div className="flex items-center space-x-1.5 text-xs text-slate-500 font-medium">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span>Severity:</span>
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 focus:outline-none"
                >
                  <option value="ALL">All Severities</option>
                  <option value="CRITICAL">Critical</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>

              {/* Status filter */}
              <div className="flex items-center space-x-1.5 text-xs text-slate-500 font-medium">
                <span>Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 focus:outline-none"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="ACKNOWLEDGED">Acknowledged</option>
                  <option value="INVESTIGATING">Investigating</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="DISMISSED">Dismissed</option>
                </select>
              </div>
            </div>
          </div>

          {/* Incidents Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3 px-5">Rule / Severity</th>
                  <th className="py-3 px-4">Incident Title & Details</th>
                  <th className="py-3 px-4">Corridor & Vehicle</th>
                  <th className="py-3 px-4">Trigger Metric vs Safe Bound</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {filteredAnomalies.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <div className="max-w-xs mx-auto space-y-2">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                        <p className="font-semibold text-slate-700">No matching security anomalies found</p>
                        <p className="text-[11px] text-slate-400">All live telemetry readings and operational events are operating within verified safety thresholds.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredAnomalies.map((anom) => (
                    <tr key={anom.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Rule & Severity */}
                      <td className="py-4 px-5">
                        <div className="space-y-1">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getSeverityBadge(
                              anom.severity
                            )}`}
                          >
                            {anom.severity}
                          </span>
                          <p className="text-[11px] font-mono text-slate-400">
                            {anom.type.replace('_ANOMALY', '').replace('_', ' ')}
                          </p>
                        </div>
                      </td>

                      {/* Incident Title & Details */}
                      <td className="py-4 px-4 max-w-sm">
                        <div className="font-semibold text-slate-900">{anom.title}</div>
                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                          {anom.description}
                        </p>
                        <div className="text-[10px] text-slate-400 mt-1 flex items-center space-x-2">
                          <Clock className="w-3 h-3" />
                          <span>Detected: {new Date(anom.detectedAt).toLocaleTimeString()}</span>
                          {anom.lastDetectedAt && anom.lastDetectedAt !== anom.detectedAt && (
                            <span>• Last: {new Date(anom.lastDetectedAt).toLocaleTimeString()}</span>
                          )}
                        </div>
                      </td>

                      {/* Corridor & Vehicle */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="font-medium text-slate-800">
                          {anom.metadata?.routeName || 'SR-101 Tech Corridor'}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center space-x-1.5 mt-0.5">
                          <Car className="w-3 h-3 text-slate-400" />
                          <span>{anom.metadata?.vehiclePlate || 'KA-01-MJ-8822'}</span>
                        </div>
                      </td>

                      {/* Trigger Metric vs Safe Bound */}
                      <td className="py-4 px-4">
                        {anom.type === 'SPEED_ANOMALY' && (
                          <div className="space-y-0.5">
                            <span className="font-bold text-rose-600">
                              {anom.metadata?.currentSpeedKmH || 0} km/h
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              Max safe limit: 55 km/h
                            </span>
                          </div>
                        )}
                        {anom.type === 'ROUTE_DEVIATION' && (
                          <div className="space-y-0.5">
                            <span className="font-bold text-orange-600">
                              {anom.metadata?.latestDeviationMeters || anom.metadata?.deviationMeters || 0}m off-route
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              Max corridor allowance: 150m
                            </span>
                          </div>
                        )}
                        {anom.type === 'LONG_STOP' && (
                          <div className="space-y-0.5">
                            <span className="font-bold text-amber-600">
                              {Math.round((anom.metadata?.durationSeconds || 0) / 60)}m stationary
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              Max stop: 3m (exempt at stops)
                            </span>
                          </div>
                        )}
                        {anom.type === 'GPS_LOSS' && (
                          <div className="space-y-0.5">
                            <span className="font-bold text-purple-600">
                              {anom.metadata?.durationSeconds || 0}s signal lost
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              Max threshold: 15s
                            </span>
                          </div>
                        )}
                        {anom.type === 'MULTIPLE_FAILED_OTP' && (
                          <div className="space-y-0.5">
                            <span className="font-bold text-rose-600">
                              {anom.metadata?.failedAttempts || 3} failed entries
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              Security lockout at 3
                            </span>
                          </div>
                        )}
                        {anom.type === 'UNEXPECTED_TRIP_START' && (
                          <div className="space-y-0.5">
                            <span className="font-bold text-rose-600">
                              0 Verified Commuters
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              Manifest guard violated
                            </span>
                          </div>
                        )}
                        {anom.type === 'MULTI_SIGNAL_ANOMALY' && (
                          <div className="space-y-0.5">
                            <span className="font-bold text-rose-700">
                              {anom.metadata?.correlatedTypes?.length || 2} signals co-occurring
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              Detour + Speed variance
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[11px] border ${getStatusBadge(
                            anom.status
                          )}`}
                        >
                          {anom.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => {
                              setSelectedAnomaly(anom);
                              setShowDetailModal(true);
                            }}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                            title="Inspect Deep Telemetry Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {anom.status !== 'RESOLVED' && anom.status !== 'DISMISSED' && (
                            <>
                              <button
                                onClick={() => {
                                  setActionAnomaly(anom);
                                  setActionType('INVESTIGATE');
                                  setShowActionModal(true);
                                }}
                                className="px-2.5 py-1 text-[11px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition"
                              >
                                Investigate
                              </button>
                              <button
                                onClick={() => {
                                  setActionAnomaly(anom);
                                  setActionType('RESOLVE');
                                  setShowActionModal(true);
                                }}
                                className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition"
                              >
                                Resolve
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MAIN TAB 2: ADMIN DEMO SIMULATOR */}
      {activeTab === 'simulator' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Zap className="w-5 h-5 text-amber-500" />
                <span>Live Telemetry & Anomaly Scenario Simulator</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Inject deterministic simulated variances into active corridor trip <code className="text-slate-800 font-mono">trip-sr101-today</code> to demonstrate rule evaluation, persistence checks, and multi-signal correlation for academic demonstration.
              </p>
            </div>
            <button
              onClick={() => handleTriggerSimulation('RESET')}
              disabled={simulatingScenario !== null}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center space-x-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to Normal Baseline</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Scenario 1: Speed Surge */}
            <div className="border border-slate-200 rounded-2xl p-4 hover:border-rose-300 transition-all bg-slate-50/50">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                  SPEED SURGE
                </span>
                <span className="text-xs text-slate-400">Rule 1</span>
              </div>
              <h4 className="font-bold text-slate-900 text-sm mt-2">Sudden Speed Surge (68 km/h)</h4>
              <p className="text-xs text-slate-500 mt-1">
                Sets speed to 68 km/h with 2 consecutive readings to satisfy persistence verification.
              </p>
              <button
                onClick={() => handleTriggerSimulation('SPEED')}
                disabled={simulatingScenario !== null}
                className="mt-4 w-full py-2 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Trigger Speed Surge</span>
              </button>
            </div>

            {/* Scenario 2: Corridor Deviation */}
            <div className="border border-slate-200 rounded-2xl p-4 hover:border-orange-300 transition-all bg-slate-50/50">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-800">
                  ROUTE DEVIATION
                </span>
                <span className="text-xs text-slate-400">Rule 2</span>
              </div>
              <h4 className="font-bold text-slate-900 text-sm mt-2">Route Deviation (450m Off-Path)</h4>
              <p className="text-xs text-slate-500 mt-1">
                Positions vehicle 450m away from Whitefield Tech Corridor polyline into side streets.
              </p>
              <button
                onClick={() => handleTriggerSimulation('DEVIATION')}
                disabled={simulatingScenario !== null}
                className="mt-4 w-full py-2 bg-white hover:bg-orange-50 text-orange-700 border border-orange-200 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Trigger Route Deviation</span>
              </button>
            </div>

            {/* Scenario 3: Unexpected Long Stop */}
            <div className="border border-slate-200 rounded-2xl p-4 hover:border-amber-300 transition-all bg-slate-50/50">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                  LONG STOP
                </span>
                <span className="text-xs text-slate-400">Rule 3</span>
              </div>
              <h4 className="font-bold text-slate-900 text-sm mt-2">Long Stop Outside Designated Hub</h4>
              <p className="text-xs text-slate-500 mt-1">
                Vehicle stopped for 280s (&gt; 180s threshold) outside 150m radius of any designated stop.
              </p>
              <button
                onClick={() => handleTriggerSimulation('STOP')}
                disabled={simulatingScenario !== null}
                className="mt-4 w-full py-2 bg-white hover:bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Trigger Long Stop</span>
              </button>
            </div>

            {/* Scenario 4: GPS Telemetry Loss */}
            <div className="border border-slate-200 rounded-2xl p-4 hover:border-purple-300 transition-all bg-slate-50/50">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
                  GPS LOSS
                </span>
                <span className="text-xs text-slate-400">Rule 4</span>
              </div>
              <h4 className="font-bold text-slate-900 text-sm mt-2">GPS Telemetry Blackout (75s)</h4>
              <p className="text-xs text-slate-500 mt-1">
                Simulates 75s telemetry blackout triggering Tier 2 High Severity investigation alert.
              </p>
              <button
                onClick={() => handleTriggerSimulation('GPS')}
                disabled={simulatingScenario !== null}
                className="mt-4 w-full py-2 bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Trigger GPS Blackout</span>
              </button>
            </div>

            {/* Scenario 5: Multiple Failed OTPs */}
            <div className="border border-slate-200 rounded-2xl p-4 hover:border-rose-300 transition-all bg-slate-50/50">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                  OTP SECURITY
                </span>
                <span className="text-xs text-slate-400">Rule 5</span>
              </div>
              <h4 className="font-bold text-slate-900 text-sm mt-2">3 Consecutive Failed OTP Attempts</h4>
              <p className="text-xs text-slate-500 mt-1">
                Simulates 3 incorrect commuter boarding attempts without logging or exposing any OTP value.
              </p>
              <button
                onClick={() => handleTriggerSimulation('OTP')}
                disabled={simulatingScenario !== null}
                className="mt-4 w-full py-2 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Trigger Failed OTP (3x)</span>
              </button>
            </div>

            {/* Scenario 6: Multi-Signal Correlation */}
            <div className="border border-indigo-200 rounded-2xl p-4 hover:border-indigo-400 transition-all bg-indigo-50/30">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                  CORRELATION
                </span>
                <span className="text-xs text-indigo-500 font-bold">MULTI-SIGNAL</span>
              </div>
              <h4 className="font-bold text-slate-900 text-sm mt-2">Route Deviation + Speed Surge</h4>
              <p className="text-xs text-slate-500 mt-1">
                Co-occurring 420m off-route detour + 64 km/h speed surge creating an elevated operational incident.
              </p>
              <button
                onClick={() => handleTriggerSimulation('CORRELATION')}
                disabled={simulatingScenario !== null}
                className="mt-4 w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow-sm"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Trigger Correlated Event</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN TAB 3: IMMUTABLE AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Lock className="w-4 h-4 text-indigo-600" />
                <span>Cybersecurity Audit Trail Log</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Cryptographically sanitized, append-only operational audit history. All authentication credentials, commuter passwords, and 4-digit ride OTPs are permanently redacted.
              </p>
            </div>
            <button
              onClick={fetchAuditLogs}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
            >
              Refresh Log
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3 px-5">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Details & Sanitized Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-mono">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400 font-sans">
                      No security audit events recorded yet.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="py-3 px-5 whitespace-nowrap text-slate-500 text-[11px]">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[10px] font-bold">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-slate-800 font-sans text-xs">
                        {log.actorName} ({log.actorId})
                      </td>
                      <td className="py-3 px-4 font-sans text-xs text-slate-600">
                        <div>{log.details}</div>
                        {log.metadata && Object.keys(log.metadata).length > 0 && (
                          <div className="mt-1 text-[10px] font-mono text-slate-400 bg-slate-50 p-1.5 rounded border border-slate-100">
                            {JSON.stringify(log.metadata)}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DETAIL & INVESTIGATION MODAL */}
      {showDetailModal && selectedAnomaly && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-5 animate-scale-up">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-rose-100 text-rose-700 rounded-2xl">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getSeverityBadge(selectedAnomaly.severity)}`}>
                    {selectedAnomaly.severity} SEVERITY
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 mt-1">
                    {selectedAnomaly.title}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3 text-xs">
              <p className="text-slate-700 leading-relaxed">
                {selectedAnomaly.description}
              </p>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/60 text-slate-600">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Incident ID</span>
                  <span className="font-mono text-slate-900">{selectedAnomaly.id}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Rule Type</span>
                  <span className="font-medium text-slate-900">{selectedAnomaly.type}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">First Detected</span>
                  <span className="text-slate-900">{new Date(selectedAnomaly.detectedAt).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Current Status</span>
                  <span className="font-bold text-slate-900">{selectedAnomaly.status}</span>
                </div>
              </div>

              {selectedAnomaly.metadata && (
                <div className="pt-2 border-t border-slate-200/60">
                  <span className="text-slate-400 block text-[10px] uppercase mb-1">Telemetry Diagnostics</span>
                  <pre className="p-2.5 bg-slate-900 text-emerald-400 rounded-xl text-[11px] overflow-x-auto font-mono">
                    {JSON.stringify(selectedAnomaly.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
              >
                Close
              </button>
              {selectedAnomaly.status !== 'RESOLVED' && selectedAnomaly.status !== 'DISMISSED' && (
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setActionAnomaly(selectedAnomaly);
                    setActionType('RESOLVE');
                    setShowActionModal(true);
                  }}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition shadow-sm"
                >
                  Proceed to Resolution
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* RESOLUTION / ACTION MODAL */}
      {showActionModal && actionAnomaly && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4 animate-scale-up">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-semibold text-rose-600 uppercase tracking-wider">
                  Security Incident Lifecycle Action
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  {actionAnomaly.title}
                </h3>
              </div>
              <button
                onClick={() => setShowActionModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Action Type Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Action to Execute:</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'ACKNOWLEDGE', label: 'Acknowledge', desc: 'Confirm receipt at desk' },
                  { id: 'INVESTIGATE', label: 'Investigate', desc: 'Dispatch follow-up active' },
                  { id: 'RESOLVE', label: 'Resolve', desc: 'Incident cleared' },
                  { id: 'DISMISS', label: 'Dismiss', desc: 'False positive / approved' },
                ].map((act) => (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => setActionType(act.id as any)}
                    className={`p-2.5 text-left rounded-xl border text-xs transition ${
                      actionType === act.id
                        ? 'border-rose-500 bg-rose-50/50 text-rose-900 font-bold shadow-sm'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50 font-medium'
                    }`}
                  >
                    <div>{act.label}</div>
                    <div className="text-[10px] text-slate-400 font-normal">{act.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Reason Dropdown */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Standard Resolution Reason:</label>
              <select
                value={resolutionReason}
                onChange={(e) => setResolutionReason(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              >
                {RESOLUTION_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {/* Additional Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Dispatcher Operational Notes (Optional):</label>
              <textarea
                rows={3}
                placeholder="Add contextual details for security audit log..."
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              />
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800 flex items-start space-x-2">
              <Lock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Audit Trail Guarantee:</strong> This action will be immutably recorded in the security audit log with your operator ID.
              </span>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowActionModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteAction}
                disabled={actionLoading}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition shadow-sm flex items-center space-x-1.5"
              >
                {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm {actionType}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
