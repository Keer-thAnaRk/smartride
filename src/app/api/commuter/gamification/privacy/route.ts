import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 });
    }

    if (session.role !== 'COMMUTER' && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Commuter access required' }, { status: 403 });
    }

    const body = await req.json();
    const { showOnLeaderboard, privacyDisplayName } = body;

    const validPrivacyOptions = ['REAL_NAME', 'INITIALS', 'ANONYMOUS'];
    if (privacyDisplayName && !validPrivacyOptions.includes(privacyDisplayName)) {
      return NextResponse.json(
        { error: 'Invalid privacy display name option' },
        { status: 400 }
      );
    }

    const updated = await prisma.gamificationProfile.upsert({
      where: { userId: session.id },
      update: {
        showOnLeaderboard:
          showOnLeaderboard !== undefined ? Boolean(showOnLeaderboard) : undefined,
        privacyDisplayName: privacyDisplayName || undefined,
      },
      create: {
        userId: session.id,
        showOnLeaderboard:
          showOnLeaderboard !== undefined ? Boolean(showOnLeaderboard) : true,
        privacyDisplayName: privacyDisplayName || 'ANONYMOUS',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Gamification privacy preferences saved',
      preferences: {
        showOnLeaderboard: updated.showOnLeaderboard,
        privacyDisplayName: updated.privacyDisplayName,
      },
    });
  } catch (error: any) {
    console.error('Privacy update error:', error);
    return NextResponse.json(
      { error: 'Failed to update privacy preferences' },
      { status: 500 }
    );
  }
}
