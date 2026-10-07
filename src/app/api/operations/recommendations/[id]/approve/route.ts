import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { approveOperationalRecommendation } from '@/lib/operations/recommendation-engine';

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

    const updated = await approveOperationalRecommendation(id, {
      id: session.id,
      name: session.name,
      email: session.email,
    });

    return NextResponse.json({
      success: true,
      message: 'Recommendation approved by operations admin for operational consideration.',
      recommendation: updated,
    });
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error.message?.includes('Cannot approve')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('[RecommendationApproveAPI] Error approving recommendation:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to approve recommendation' },
      { status: 500 }
    );
  }
}
