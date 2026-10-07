import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  getPaymentByInvoice,
  getPaymentsByCommuterId,
  getAllPayments,
  getSubscriptionById,
  getPlanById,
  getRouteById,
  getUserById,
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

    const { searchParams } = new URL(req.url);
    const invoiceNumber = searchParams.get('invoice');

    if (invoiceNumber) {
      const payment = await getPaymentByInvoice(invoiceNumber);

      if (!payment) {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
      }

      if (payment.commuterId !== session.id && session.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized to view this invoice' }, { status: 403 });
      }

      let subscription: any = null;
      if (payment.subscriptionId) {
        const sub = await getSubscriptionById(payment.subscriptionId);
        if (sub) {
          const plan = await getPlanById(sub.planId);
          const route = await getRouteById(sub.routeId);
          subscription = {
            ...sub,
            plan,
            route,
          };
        }
      }

      const commuterUser = await getUserById(payment.commuterId);
      const commuter = commuterUser
        ? {
            name: commuterUser.name,
            email: commuterUser.email,
            phone: commuterUser.phone,
          }
        : null;

      return NextResponse.json({
        success: true,
        payment: {
          ...payment,
          subscription,
          commuter,
        },
      });
    }

    const rawPayments =
      session.role === 'ADMIN' ? await getAllPayments() : await getPaymentsByCommuterId(session.id);

    const payments = await Promise.all(
      rawPayments.map(async (p) => {
        let subscription: any = null;
        if (p.subscriptionId) {
          const sub = await getSubscriptionById(p.subscriptionId);
          if (sub) {
            const plan = await getPlanById(sub.planId);
            const route = await getRouteById(sub.routeId);
            subscription = {
              ...sub,
              plan,
              route,
            };
          }
        }

        return {
          ...p,
          subscription,
        };
      })
    );

    return NextResponse.json({ success: true, payments });
  } catch (error: any) {
    console.error('Payments fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }
}
