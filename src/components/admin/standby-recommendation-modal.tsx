'use client';

import React, { useState } from 'react';
import axios from 'axios';
import {
  X,
  UserCheck,
  Star,
  MapPin,
  Car,
  Compass,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Award,
  ShieldCheck,
  Clock,
  Info,
} from 'lucide-react';
import {
  CandidateEvaluationResult,
  StandbyCandidate,
} from '@/lib/operations/driver-coverage-types';

interface StandbyRecommendationModalProps {
  evaluation: CandidateEvaluationResult;
  onClose: () => void;
  onAssigned: () => void;
}

export default function StandbyRecommendationModal({
  evaluation,
  onClose,
  onAssigned,
}: StandbyRecommendationModalProps) {
  const [selectedDriverId, setSelectedDriverId] = useState<string>(
    evaluation.recommendedDriver?.driverId || ''
  );
  const [assigning, setAssigning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const selectedCandidate = evaluation.allCandidates.find(
    (c) => c.driverId === selectedDriverId
  );

  const handleAssign = async (driverToAssignId: string) => {
    try {
      setAssigning(true);
      setErrorMessage(null);

      const candidate = evaluation.allCandidates.find(
        (c) => c.driverId === driverToAssignId
      );

      const res = await axios.post(
        `/api/admin/driver-coverage/${evaluation.tripId}/assign`,
        {
          replacementDriverId: driverToAssignId,
          suitabilityScore: candidate?.suitabilityScore || 90,
          candidateBreakdown: candidate?.scores,
        }
      );

      if (res.data?.success) {
        setSuccessMessage(res.data.message || 'Standby driver assigned successfully!');
        setTimeout(() => {
          onAssigned();
          onClose();
        }, 1500);
      }
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.error || 'Failed to assign standby replacement driver'
      );
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 to-orange-600 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
              <UserCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-black tracking-wide">STANDBY DRIVER CONTINGENCY</h2>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-white/20">
                  {evaluation.routeCode}
                </span>
              </div>
              <p className="text-xs text-amber-100 mt-0.5">
                Primary Driver: <strong>{evaluation.primaryDriverName}</strong> • Scheduled:{' '}
                <strong>{evaluation.scheduledDispatch}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Status Alert Banner */}
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start space-x-3 text-xs text-amber-900">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold">Primary Driver No-Show Detected</div>
              <p className="text-amber-800">
                Primary driver has not checked in past the check-in deadline ({evaluation.checkInDeadline}).
                The candidate ranking engine has evaluated the standby pool based on availability, corridor qualification, proximity, and capacity.
              </p>
            </div>
          </div>

          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Similar Scores Warning */}
          {evaluation.hasSimilarScores && evaluation.advisoryNote && (
            <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-900 flex items-center space-x-2">
              <Info className="w-4 h-4 text-indigo-600 flex-shrink-0" />
              <span className="font-medium">{evaluation.advisoryNote}</span>
            </div>
          )}

          {/* Top Recommended Driver Card */}
          {evaluation.recommendedDriver && (
            <div className="p-5 rounded-3xl bg-gradient-to-br from-emerald-50/70 to-teal-50/40 border-2 border-emerald-500/50 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-black uppercase tracking-wider flex items-center space-x-1">
                    <Star className="w-3 h-3 fill-current" />
                    <span>Top Recommendation</span>
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    Suitability Score:
                  </span>
                </div>
                <div className="flex items-center space-x-1 text-emerald-700">
                  <span className="text-2xl font-black">{evaluation.recommendedDriver.suitabilityScore}</span>
                  <span className="text-xs font-bold text-slate-400">/ 100</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {evaluation.recommendedDriver.driverName}
                  </h3>
                  <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                    <span>
                      Rating: <strong>★ {evaluation.recommendedDriver.rating.toFixed(1)}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Proximity: <strong>{evaluation.recommendedDriver.distanceKm} km</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Corridor: <strong>{evaluation.recommendedDriver.corridorQualified ? 'Qualified' : 'Cross-corridor'}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Vehicle: <strong>{evaluation.recommendedDriver.vehicleMake} {evaluation.recommendedDriver.vehicleModel} ({evaluation.recommendedDriver.licensePlate || 'KA-01-EQ-5544'})</strong>
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleAssign(evaluation.recommendedDriver!.driverId)}
                  disabled={assigning}
                  className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center space-x-1.5 self-start sm:self-auto disabled:opacity-50"
                >
                  {assigning ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Assigning...</span>
                    </>
                  ) : (
                    <>
                      <span>Auto Assign Recommended</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>

              {/* Explainable Causal Reason Box */}
              <div className="p-3.5 rounded-2xl bg-white border border-emerald-200 text-xs space-y-1">
                <div className="font-bold text-emerald-900 uppercase text-[10px] tracking-wider">
                  Why {evaluation.recommendedDriver.driverName}?
                </div>
                <p className="text-slate-700 leading-relaxed font-medium">
                  {evaluation.recommendedDriver.recommendationReason}
                </p>
              </div>
            </div>
          )}

          {/* Candidate Comparison Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Evaluated Standby Driver Pool ({evaluation.allCandidates.length})
              </h4>
              <span className="text-[11px] text-slate-400">
                Click driver to inspect or assign manually
              </span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Driver</th>
                    <th className="py-3 px-4">Proximity</th>
                    <th className="py-3 px-4">Corridor</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Suitability</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {evaluation.allCandidates.map((c) => {
                    const isSelected = c.driverId === selectedDriverId;
                    return (
                      <tr
                        key={c.driverId}
                        onClick={() => c.isEligible && setSelectedDriverId(c.driverId)}
                        className={`transition-colors cursor-pointer ${
                          isSelected ? 'bg-slate-100/80' : 'hover:bg-slate-50'
                        } ${!c.isEligible ? 'opacity-60 bg-slate-50/40 cursor-not-allowed' : ''}`}
                      >
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{c.driverName}</div>
                          <div className="text-[11px] text-slate-400">
                            ★ {c.rating.toFixed(1)} • {c.experienceYears} yrs exp
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono">
                          {c.distanceKm} km
                          {c.isSimulatedDistance && (
                            <span className="ml-1 text-[9px] text-slate-400 font-sans">(depot)</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {c.corridorQualified ? (
                            <span className="text-emerald-700 font-bold flex items-center space-x-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Qualified</span>
                            </span>
                          ) : (
                            <span className="text-amber-700 font-semibold">
                              Different corridor
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {c.isEligible ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase">
                              Available
                            </span>
                          ) : (
                            <span
                              className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold uppercase"
                              title={c.ineligibilityReason || 'Ineligible'}
                            >
                              Ineligible
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-bold">
                          {c.isEligible ? (
                            <span className="text-slate-900 font-mono text-sm">
                              {c.suitabilityScore}/100
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {c.isEligible && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAssign(c.driverId);
                              }}
                              disabled={assigning}
                              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold transition-all shadow-xs disabled:opacity-50"
                            >
                              Assign
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Selected Driver Detail (Why / Why not) */}
          {selectedCandidate && (
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-2 text-xs">
              <div className="font-bold text-slate-800 uppercase text-[11px]">
                Detailed Candidate Profile: {selectedCandidate.driverName}
              </div>
              <p className="text-slate-600 font-medium">
                {selectedCandidate.recommendationReason}
              </p>
              {selectedCandidate.caveatNotes && selectedCandidate.caveatNotes.length > 0 && (
                <div className="space-y-0.5 pt-1 text-[11px] text-amber-800">
                  {selectedCandidate.caveatNotes.map((note, idx) => (
                    <div key={idx} className="flex items-center space-x-1">
                      <span>•</span>
                      <span>{note}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            Operational suitability score based on configured business criteria.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
