import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  runOperationalScenarioSimulation,
  MANDATORY_SCENARIO_SIMULATION_NOTICE,
} from '@/lib/operations/scenario-simulation-engine';
import { enforceRateLimit, RATE_LIMIT_CONFIG } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 1. Authentication & RBAC Authorization
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    if (session.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    const rateLimitError = enforceRateLimit(request, RATE_LIMIT_CONFIG.EXPENSIVE_OPERATIONS, undefined, session);
    if (rateLimitError) return rateLimitError;

    // 2. Parse Request Body
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON request payload' },
        { status: 400 }
      );
    }

    // 3. Execute Deterministic Simulation
    const result = await runOperationalScenarioSimulation(body);

    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    const message = err?.message || 'Scenario simulation failed';

    // Route not found error mapping to 404
    if (message.toLowerCase().includes('route not found')) {
      return NextResponse.json(
        { success: false, error: message },
        { status: 404 }
      );
    }

    // Input validation errors mapping to 400
    if (
      message.includes('must be') ||
      message.includes('required') ||
      message.includes('Invalid')
    ) {
      return NextResponse.json(
        { success: false, error: message },
        { status: 400 }
      );
    }

    console.error('[ScenarioSimulationAPI] Unexpected error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal operational simulation error' },
      { status: 500 }
    );
  }
}

/**
 * Mutation and unsupported method guards:
 * The What-If Scenario Analysis Center is strictly non-mutative and advisory.
 * Any other HTTP methods return 405 Method Not Allowed.
 */
export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: 'Method Not Allowed: Operational scenario simulation requires POST request with scenario modifiers',
      notice: MANDATORY_SCENARIO_SIMULATION_NOTICE,
    },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    {
      success: false,
      error: 'Method Not Allowed: Operational scenario simulation is strictly read-only and non-mutative',
      notice: MANDATORY_SCENARIO_SIMULATION_NOTICE,
    },
    { status: 405 }
  );
}

export async function PATCH() {
  return NextResponse.json(
    {
      success: false,
      error: 'Method Not Allowed: Operational scenario simulation is strictly read-only and non-mutative',
      notice: MANDATORY_SCENARIO_SIMULATION_NOTICE,
    },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    {
      success: false,
      error: 'Method Not Allowed: Operational scenario simulation is strictly read-only and non-mutative',
      notice: MANDATORY_SCENARIO_SIMULATION_NOTICE,
    },
    { status: 405 }
  );
}
