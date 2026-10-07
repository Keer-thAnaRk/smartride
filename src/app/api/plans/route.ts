import { NextResponse } from 'next/server';
import { getAllPlans, setPlan } from '@/lib/firestore-db';

const DEFAULT_INR_PLANS = [
  {
    id: 'plan_monthly',
    name: 'Smart Standard (Monthly)',
    billingCycle: 'MONTHLY' as const,
    durationMonths: 1,
    price: 3499,
    discountPercent: 0,
    description: 'Guaranteed daily morning pickup and evening drop with reserved AC seating and zero surge pricing.',
    features: [
      'Door-to-door morning pickup & evening drop',
      'Guaranteed reserved AC seat',
      'Live vehicle GPS tracking & ETA alerts',
      'Free 2 skip ride credits per month',
      'Dedicated route captain & 24/7 SOS support',
    ],
    isPopular: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'plan_quarterly',
    name: 'Smart Pro (Quarterly)',
    billingCycle: 'QUARTERLY' as const,
    durationMonths: 3,
    price: 9499,
    discountPercent: 10,
    description: 'Most popular choice for hybrid & office commuters. Save 10% with flexible pickup slot swaps.',
    features: [
      'Everything in Standard plan',
      '10% direct savings on quarterly billing',
      'Flexible 15-minute slot time adjustment',
      'Priority driver dispatch & window seats',
      'Free 8 skip ride roll-over credits',
      'Priority commuter concierge assistance',
    ],
    isPopular: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'plan_yearly',
    name: 'Smart Executive (Yearly)',
    billingCycle: 'YEARLY' as const,
    durationMonths: 12,
    price: 34999,
    discountPercent: 16,
    description: 'Maximum savings and exclusive executive perks for long-term daily corporate commuters.',
    features: [
      'Everything in Pro plan',
      '16% ultimate annual cost savings',
      'Guaranteed premium luxury SUV/Van seating',
      'Complimentary weekend airport shuttle voucher (2x/yr)',
      'Unlimited skip ride bank with cash-back credit',
      'VIP Corporate billing & GST automated invoicing',
    ],
    isPopular: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export async function GET() {
  try {
    let plans = await getAllPlans();

    if (!plans || plans.length === 0) {
      for (const p of DEFAULT_INR_PLANS) {
        await setPlan(p);
      }
      plans = DEFAULT_INR_PLANS;
    }

    return NextResponse.json({ success: true, plans });
  } catch (error: any) {
    console.error('Plans fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch plans' }, { status: 500 });
  }
}
