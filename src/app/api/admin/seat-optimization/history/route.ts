import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 });
    }
    if (session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const runs = await prisma.seatOptimizationRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        changes: true,
      },
    });

    return NextResponse.json({
      success: true,
      runs,
    });
  } catch (error: any) {
    console.error('Error fetching seat optimization history:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch optimization history' },
      { status: 500 }
    );
  }
}
