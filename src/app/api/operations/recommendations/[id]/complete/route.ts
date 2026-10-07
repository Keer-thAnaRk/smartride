import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { completeOperationalRecommendation } from '@/lib/operations/recommendation-engine';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id } = params;
    if (!id) {
      return NextResponse.json(
        { error: 'Recommendation ID is required' },
        { status: 400 }
      );
    }

    const updated = await completeOperationalRecommendation(id, {
      id: session.id,
      name: session.name,
      email: session.email,
    });

    return NextResponse.json({
      success: true,
      message: 'Operational recommendation marked as completed by operations admin.',
      recommendation: updated,
    });
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error.message?.includes('Cannot complete')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('[RecommendationCompleteAPI] Error completing recommendation:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to complete recommendation' },
      { status: 500 }
    );
  }
}
