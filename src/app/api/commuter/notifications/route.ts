import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  getNotificationsForUser,
  markNotificationRead,
  markAllNotificationsRead,
  getSubscriptionsByCommuterId,
} from '@/lib/firestore-db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role !== 'COMMUTER' && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Unauthorized role' }, { status: 403 });
    }

    // Fetch existing notifications from Firestore
    const dbNotifications = await getNotificationsForUser(session.id, 10);

    const notifications: any[] = dbNotifications.map((n) => {
      let createdIso: string;
      if (!n.createdAt) {
        createdIso = new Date().toISOString();
      } else if (typeof n.createdAt === 'string') {
        createdIso = n.createdAt;
      } else if (n.createdAt.toDate && typeof n.createdAt.toDate === 'function') {
        createdIso = n.createdAt.toDate().toISOString();
      } else if (n.createdAt instanceof Date) {
        createdIso = n.createdAt.toISOString();
      } else {
        createdIso = new Date().toISOString();
      }

      return {
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        read: n.read,
        createdAt: createdIso,
        actionUrl: '/plans',
      };
    });

    // Safe check commuter subscription for upcoming expiration
    if (session.role === 'COMMUTER') {
      const subs = await getSubscriptionsByCommuterId(session.id);
      const activeSub = subs.find((s) => s.status === 'ACTIVE');

      if (activeSub && activeSub.endDate) {
        const now = new Date();
        const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const expiryDate = new Date(activeSub.endDate);
        const expiryDay = new Date(
          expiryDate.getFullYear(),
          expiryDate.getMonth(),
          expiryDate.getDate()
        );
        const diffDays = Math.ceil(
          (expiryDay.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (diffDays <= 7) {
          const formattedExpiry = expiryDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });

          // Check if already in list to avoid duplicates
          const hasExpiryNotice = notifications.some(
            (n) => n.title.includes('Expiry') || n.title.includes('Pass')
          );
          if (!hasExpiryNotice) {
            notifications.unshift({
              id: 'notif-expiry-dynamic',
              title: 'Pass Expiry Notice',
              message: `Your commute pass is expiring soon. Click to review your renewal plan.`,
              type: diffDays <= 3 ? 'WARNING' : 'INFO',
              read: false,
              createdAt: new Date().toISOString(),
              actionUrl: '/plans',
              remainingDays: diffDays,
              expiryDate: formattedExpiry,
            });
          }
        }
      }
    }

    const unreadCount = notifications.filter((n) => !n.read).length;

    return NextResponse.json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role !== 'COMMUTER' && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Unauthorized role' }, { status: 403 });
    }

    const body = await req.json();
    const { notificationId, markAllRead } = body;

    if (markAllRead) {
      await markAllNotificationsRead(session.id);
      return NextResponse.json({ success: true, message: 'All notifications marked as read' });
    }

    if (notificationId && notificationId !== 'notif-expiry-dynamic') {
      if (session.role !== 'ADMIN') {
        const userNotifs = await getNotificationsForUser(session.id, 50);
        const ownsNotification = userNotifs.some((n) => n.id === notificationId);
        if (!ownsNotification) {
          return NextResponse.json(
            { error: 'Forbidden: You do not own this notification' },
            { status: 403 }
          );
        }
      }
      await markNotificationRead(notificationId);
    }

    return NextResponse.json({ success: true, message: 'Notification marked as read' });
  } catch (error: any) {
    console.error('Error updating notification:', error);
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 });
  }
}

