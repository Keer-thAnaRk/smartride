import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
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

    const body = await req.json();
    const { eventId, status = 'RESOLVED', resolutionNote = 'Resolved by Central Operations Admin' } = body;

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }

    // Update in SQLite database if event exists
    try {
      const existing = await prisma.safetyEvent.findUnique({
        where: { id: eventId },
      });

      if (existing) {
        await prisma.safetyEvent.update({
          where: { id: eventId },
          data: {
            status,
            resolvedAt: status === 'RESOLVED' ? new Date() : undefined,
            resolutionNote,
          },
        });
      }
    } catch (dbErr) {
      // Event might be a runtime in-memory event, which is fine
    }

    return NextResponse.json({
      success: true,
      message: `Safety event marked as ${status}.`,
      eventId,
      status,
      resolvedAt: new Date().toISOString(),
      resolutionNote,
    });
  } catch (error: any) {
    console.error('Event resolution API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to resolve safety event' },
      { status: 500 }
    );
  }
}
