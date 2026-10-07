import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import prisma from '@/lib/prisma';
import {
  getAllRoutes,
  getRouteById,
  getRouteByCode,
  getDriverProfileById,
  getUserById,
  getVehicleById,
  DEFAULT_CORRIDOR_ROUTES,
  setRoute,
} from '@/lib/firestore-db';
import { getOrCreateDefaultTrip } from '@/lib/firebase';
import { calculateRouteRiskScore, RouteRiskResult } from '@/lib/safety/route-risk-engine';
import { recordOperationalAuditEvent } from '@/lib/operations/operational-audit-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate request - Strict Admin RBAC
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    if (session.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Admin command center privileges required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const hasRouteIdParam = searchParams.has('routeId');
    const rawRouteId = searchParams.get('routeId');

    // 2. Fetch safety events from database
    let allSafetyEvents: any[] = [];
    try {
      allSafetyEvents = await prisma.safetyEvent.findMany({
        orderBy: { detectedAt: 'desc' },
        take: 100,
      });
    } catch (e) {
      // In-memory fallback if SQLite is temporarily locked
      allSafetyEvents = [];
    }

    const activeTrip = getOrCreateDefaultTrip();

    // 3. Single Route View: GET /api/safety/route-risk?routeId=<routeId>
    if (hasRouteIdParam) {
      const routeId = rawRouteId?.trim();
      if (!routeId) {
        return NextResponse.json(
          { error: 'Route ID parameter is required and cannot be empty' },
          { status: 400 }
        );
      }

      // Check if routes are initialized
      let route = (await getRouteById(routeId)) || (await getRouteByCode(routeId));

      if (!route) {
        // Fallback check against default corridors if first load
        for (const defRoute of DEFAULT_CORRIDOR_ROUTES) {
          if (defRoute.id === routeId || defRoute.code.toLowerCase() === routeId.toLowerCase()) {
            await setRoute(defRoute);
            route = defRoute;
            break;
          }
        }
      }

      if (!route) {
        return NextResponse.json(
          { error: `Route not found with identifier '${routeId}'` },
          { status: 404 }
        );
      }

      // Retrieve driver and vehicle
      let driver = null;
      let driverUserName = 'Captain';
      if (route.assignedDriverId) {
        driver = await getDriverProfileById(route.assignedDriverId);
        if (driver) {
          const user = await getUserById(driver.userId);
          driverUserName = user?.name || 'Captain';
        }
      }

      const vehicle = route.assignedVehicleId
        ? await getVehicleById(route.assignedVehicleId)
        : null;

      const riskResult: RouteRiskResult = calculateRouteRiskScore({
        route,
        events: allSafetyEvents,
        driver,
        driverUserName,
        vehicle,
        activeTrip: activeTrip?.routeCode === route.code || activeTrip?.routeId === route.id ? activeTrip : null,
      });

      if (searchParams.get('audit') === 'true') {
        try {
          await recordOperationalAuditEvent({
            eventType: 'ROUTE_RISK_VIEWED',
            actor: {
              id: session.id,
              role: session.role || 'ADMIN',
              email: session.email,
              name: session.name,
            },
            resourceType: 'ROUTE_RISK',
            resourceId: route.id,
            routeId: route.id,
            routeCode: route.code,
            routeName: route.name,
            action: 'VIEW_ROUTE_RISK',
            description: `Admin viewed route risk score for ${route.code} (${riskResult.risk.score}/100 - ${riskResult.risk.level})`,
            resultingState: {
              riskScore: riskResult.risk.score,
              riskLevel: riskResult.risk.level,
            },
            evidence: {
              factors: riskResult.factors,
              sosAlerts: riskResult.metrics.sosAlerts,
            },
            sourceModule: 'ROUTE_RISK',
            correlationId: route.id,
          });
        } catch (auditErr) {
          console.warn('[RouteRiskAPI] Failed to record audit event:', auditErr);
        }
      }

      return NextResponse.json({
        success: true,
        route: riskResult.route,
        risk: riskResult.risk,
        factors: riskResult.factors,
        metrics: riskResult.metrics,
        calculatedAt: riskResult.calculatedAt,
      });
    }

    // 4. All Routes View: GET /api/safety/route-risk
    let routes = await getAllRoutes();
    if (!routes || routes.length === 0) {
      for (const r of DEFAULT_CORRIDOR_ROUTES) {
        await setRoute(r);
      }
      routes = await getAllRoutes();
    }

    const routeRiskSummaries = await Promise.all(
      routes.map(async (r) => {
        let driver = null;
        let driverUserName = 'Captain';
        if (r.assignedDriverId) {
          driver = await getDriverProfileById(r.assignedDriverId);
          if (driver) {
            const user = await getUserById(driver.userId);
            driverUserName = user?.name || 'Captain';
          }
        }

        const vehicle = r.assignedVehicleId
          ? await getVehicleById(r.assignedVehicleId)
          : null;

        const riskResult = calculateRouteRiskScore({
          route: r,
          events: allSafetyEvents,
          driver,
          driverUserName,
          vehicle,
          activeTrip: activeTrip?.routeCode === r.code || activeTrip?.routeId === r.id ? activeTrip : null,
        });

        return {
          routeId: r.id,
          routeCode: r.code,
          routeName: r.name,
          origin: r.origin,
          destination: r.destination,
          distanceKm: r.distanceKm,
          score: riskResult.risk.score,
          level: riskResult.risk.level,
          badgeColor: riskResult.risk.badgeColor,
          summary: riskResult.risk.summary,
          factors: riskResult.factors,
          metrics: riskResult.metrics,
          assignedDriver: riskResult.route.assignedDriver,
          assignedVehicle: riskResult.route.assignedVehicle,
        };
      })
    );

    // Sort corridors by risk score descending (highest risk first)
    routeRiskSummaries.sort((a, b) => b.score - a.score);

    return NextResponse.json({
      success: true,
      count: routeRiskSummaries.length,
      routes: routeRiskSummaries,
      calculatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Route risk calculation error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate corridor route risk score' },
      { status: 500 }
    );
  }
}
