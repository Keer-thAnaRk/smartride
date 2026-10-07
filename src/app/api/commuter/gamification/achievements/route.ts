import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { evaluateAchievement } from '@/lib/gamification/gamification-engine';
import { INITIAL_ACHIEVEMENTS } from '@/lib/gamification/points-config';
import { AchievementItem } from '@/lib/gamification/gamification-types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Sign in required' }, { status: 401 });
    }
    if (session.role !== 'COMMUTER' && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Commuter access required' }, { status: 403 });
    }

    const userId = session.id;
    const isDemo = false;

    let profile = null;
    if (!isDemo) {
      profile = await prisma.gamificationProfile.findUnique({
        where: { userId },
        include: {
          achievements: true,
        },
      });
    }

    const attendances = await prisma.attendance.findMany({
      where: {
        commuterId: session?.id ? session.id : undefined,
      },
    });

    const completedCount = isDemo
      ? 38
      : attendances.filter((a) => a.status === 'COMPLETED' || a.status === 'BOARDED').length;
    const streak = isDemo ? 8 : profile?.currentStreak || 5;

    const achievements: AchievementItem[] = INITIAL_ACHIEVEMENTS.map((ach) => {
      const userAch = profile?.achievements.find((ua) => ua.achievementId === ach.id);
      const evalResult = evaluateAchievement(ach, {
        completedTrips: completedCount,
        onTimeRatePercent: 95,
        co2SavedKg: 42.6,
        otpBoardings: completedCount,
        consecutiveStreak: streak,
        commuteDays: Math.min(22, completedCount),
        eligibleTripsSample: completedCount,
      });

      const isUnlocked = isDemo
        ? ach.threshold <= (ach.metric === 'CO2_SAVED_KG' ? 42.6 : completedCount)
        : userAch?.isUnlocked || evalResult.isUnlocked;

      return {
        id: ach.id,
        name: ach.name,
        description: ach.description,
        icon: ach.icon,
        category: ach.category,
        metric: ach.metric,
        threshold: ach.threshold,
        minSampleSize: ach.minSampleSize,
        xpReward: ach.xpReward,
        currentProgress: evalResult.currentProgress,
        progressPercent: isUnlocked ? 100 : evalResult.progressPercent,
        isUnlocked,
        unlockedAt: userAch?.unlockedAt?.toISOString() || (isUnlocked ? '2026-09-01T00:00:00.000Z' : null),
        notified: userAch?.notified || false,
      };
    });

    return NextResponse.json({ success: true, achievements });
  } catch (error: any) {
    console.error('Achievements fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve achievements' },
      { status: 500 }
    );
  }
}
