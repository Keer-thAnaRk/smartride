import type { OperationalAuditEventRecord } from '@/lib/operations/operational-audit-store';
import type { OperationalRecommendationRecord } from '@/lib/operations/recommendation-engine';

export const MANDATORY_GOVERNANCE_NOTICE =
  'This dashboard is advisory and read-only. It presents verified operational intelligence for administrative review. No route, schedule, vehicle, driver, subscription, booking, seat allocation, dispatch, alert, incident, or recommendation is automatically modified.';

export interface ExecutiveCorridorItem {
  routeId: string;
  routeCode: string;
  routeName: string;
  operationalStatus: string;
  riskScore: number;
  riskLevel: string;
  riskTrend: string;
  scoreDelta: number | null;
  activeAlertsCount: number;
  activeCriticalAlerts: number;
  activeHighAlerts: number;
  activeMediumAlerts: number;
  activeLowAlerts: number;
  unresolvedIncidentsCount: number;
  criticalIncidentsCount: number;
  predictedDemand: number | null;
  predictedOccupancy: number | null;
  demandLevel: string | null;
  dataQuality: string;
  capacityRecommendation: string;
  vehicleCapacity: number;
  pendingRecommendationsCount: number;
  pendingRecommendations: OperationalRecommendationRecord[];
  briefing: string;
  explanation: string[];
  evidence: any;
  recentAuditEvents: OperationalAuditEventRecord[];
}
