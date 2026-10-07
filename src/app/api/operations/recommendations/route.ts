import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  getOperationalRecommendations,
  RecommendationPriority,
  RecommendationStatus,
} from '@/lib/operations/recommendation-engine';

export const dynamic = 'force-dynamic';

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

    // 2. Query Parameter Parsing
    const { searchParams } = new URL(req.url);
    const routeId = searchParams.get('routeId') || undefined;
    const priority = (searchParams.get('priority')?.toUpperCase() as RecommendationPriority) || undefined;
    const status = (searchParams.get('status')?.toUpperCase() as RecommendationStatus) || undefined;
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;

    // 3. Retrieve Recommendations
    const { recommendations, summary } = await getOperationalRecommendations({
      routeId,
      priority,
      status,
      limit,
    });

    return NextResponse.json({
      success: true,
      recommendations,
      summary,
    });
  } catch (error: any) {
    console.error('[RecommendationsAPI] Error retrieving recommendations:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve operational recommendations' },
      { status: 500 }
    );
  }
}
