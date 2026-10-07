import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  evaluateFleetGovernance,
  evaluateCorridorGovernance,
} from '@/lib/operations/governance-engine';
import { recordOperationalAuditEvent } from '@/lib/operations/operational-audit-store';

export const dynamic = 'force-dynamic';

/**
 * GET /api/operations/governance
 * Admin-only: Evaluates and retrieves deterministic governance and compliance metrics.
 *
 * Query Parameters:
 * - routeId: Optional. Filter to a single corridor (returns 404 if not found).
 * - audit: Optional. If 'true', records an immutable GOVERNANCE_REVIEWED audit event.
 *
 * RBAC:
 * - Guest: 401 Unauthorized
 * - Commuter / Driver: 403 Forbidden
 * - Admin: 200 OK
 */
export async function GET(req: NextRequest) {
  try {
    // 1. RBAC Authentication Enforcement
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    if (session.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // 2. Query Parameter Parsing (Anti-forgery: only routeId and audit are respected)
    const { searchParams } = new URL(req.url);
    const routeId = searchParams.get('routeId') || undefined;
    const shouldAudit = searchParams.get('audit') === 'true';

    // 3. Execution
    if (routeId) {
      const result = await evaluateCorridorGovernance(routeId);
      if (!result) {
        return NextResponse.json(
          { error: `Corridor '${routeId}' not found` },
          { status: 404 }
        );
      }

      // Record audit event only if explicitly requested
      if (shouldAudit) {
        try {
          await recordOperationalAuditEvent({
            eventType: 'GOVERNANCE_REVIEWED',
            actor: {
              id: session.id,
              role: session.role || 'ADMIN',
              email: (session as any).email || null,
              name: (session as any).name || null,
            },
            resourceType: 'GOVERNANCE_REVIEW',
            resourceId: result.corridor.routeId,
            routeId: result.corridor.routeId,
            routeCode: result.corridor.routeCode,
            routeName: result.corridor.routeName,
            action: 'CORRIDOR_GOVERNANCE_REVIEW',
            description: `Administrator conducted governance compliance review for corridor ${result.corridor.routeCode}`,
            evidence: {
              governanceStatus: result.corridor.governanceStatus,
              governanceSeverity: result.corridor.governanceSeverity,
              governanceScore: result.corridor.governanceScore,
              exceptionCount: result.corridor.exceptionCount,
            },
            sourceModule: 'GOVERNANCE',
            correlationId: result.corridor.routeId,
          });
        } catch (auditErr) {
          console.warn('[GovernanceAPI] Failed to record audit event for corridor review:', auditErr);
        }
      }

      return NextResponse.json({
        success: true,
        summary: result.summary,
        corridor: result.corridor,
      });
    }

    // Fleet-wide evaluation
    const fleetResult = await evaluateFleetGovernance();

    // Record audit event only if explicitly requested
    if (shouldAudit) {
      try {
        await recordOperationalAuditEvent({
          eventType: 'GOVERNANCE_REVIEWED',
          actor: {
            id: session.id,
            role: session.role || 'ADMIN',
            email: (session as any).email || null,
            name: (session as any).name || null,
          },
          resourceType: 'GOVERNANCE_REVIEW',
          resourceId: 'FLEET',
          action: 'FLEET_GOVERNANCE_REVIEW',
          description: `Administrator conducted fleet-wide operational governance compliance review (${fleetResult.summary.totalRoutes} routes, ${fleetResult.summary.totalGovernanceExceptions} exceptions)`,
          evidence: {
            totalRoutes: fleetResult.summary.totalRoutes,
            compliantRoutes: fleetResult.summary.compliantRoutes,
            monitorRoutes: fleetResult.summary.monitorRoutes,
            atRiskRoutes: fleetResult.summary.atRiskRoutes,
            criticalRoutes: fleetResult.summary.criticalRoutes,
            totalExceptions: fleetResult.summary.totalGovernanceExceptions,
          },
          sourceModule: 'GOVERNANCE',
          correlationId: 'FLEET_GOVERNANCE',
        });
      } catch (auditErr) {
        console.warn('[GovernanceAPI] Failed to record audit event for fleet review:', auditErr);
      }
    }

    return NextResponse.json({
      success: true,
      summary: fleetResult.summary,
      corridors: fleetResult.corridors,
    });
  } catch (error: any) {
    console.error('[GovernanceAPI] Error evaluating governance:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to evaluate operational governance' },
      { status: 500 }
    );
  }
}

/**
 * Step 9 Governance is strictly read-only and advisory.
 * Mutation endpoints return 405 Method Not Allowed.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Method Not Allowed: Operational Governance is strictly read-only and computed server-side' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method Not Allowed: Operational Governance is strictly read-only' },
    { status: 405 }
  );
}

export async function PATCH() {
  return NextResponse.json(
    { error: 'Method Not Allowed: Operational Governance is strictly read-only' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method Not Allowed: Operational Governance records cannot be deleted' },
    { status: 405 }
  );
}
