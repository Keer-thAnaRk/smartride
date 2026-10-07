import { NextRequest, NextResponse } from 'next/server';
import {
  verifyPaymentWebhook,
  parseAndValidatePayload,
  logWebhookSecurityEvent,
} from '@/lib/security/payment-webhook';
import {
  getSubscriptionById,
  isWebhookEventProcessed,
  markWebhookEventProcessed,
  getPaymentByTransactionId,
} from '@/lib/firestore-db';
import { processMockPayment } from '@/lib/mock-payment';
import { enforceRateLimit, RATE_LIMIT_CONFIG } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const rateLimitError = enforceRateLimit(req, RATE_LIMIT_CONFIG.PAYMENT_WEBHOOK);
  if (rateLimitError) return rateLimitError;

  let rawBody = '';
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: 'Failed to read raw request body' }, { status: 400 });
  }

  // 1. Server-authoritative Webhook Cryptographic Verification Boundary
  const verification = verifyPaymentWebhook(req.headers, rawBody);
  if (!verification.isValid) {
    logWebhookSecurityEvent({
      provider: verification.gateway,
      result: 'REJECTED',
      reason: verification.error,
      statusCode: verification.statusCode,
    });
    return NextResponse.json(
      { error: verification.error || 'Webhook verification failed' },
      { status: verification.statusCode }
    );
  }

  // 2. Strict Payload Validation & Schema Normalization
  const validation = parseAndValidatePayload(rawBody, verification.gateway!);
  if (!validation.isValid) {
    logWebhookSecurityEvent({
      provider: verification.gateway,
      result: 'REJECTED',
      reason: validation.error,
      statusCode: validation.statusCode,
    });
    return NextResponse.json(
      { error: validation.error },
      { status: validation.statusCode }
    );
  }

  const { data: eventData } = validation;

  // 3. Database Ownership & Relational Integrity Verification
  const subscription = await getSubscriptionById(eventData.subscriptionId);
  if (!subscription) {
    logWebhookSecurityEvent({
      eventId: eventData.eventId,
      eventType: eventData.eventType,
      provider: eventData.gateway,
      result: 'REJECTED',
      reason: `Referenced subscription ${eventData.subscriptionId} does not exist`,
      statusCode: 400,
    });
    return NextResponse.json(
      { error: 'Invalid reference: subscription not found' },
      { status: 400 }
    );
  }

  if (subscription.commuterId !== eventData.commuterId) {
    logWebhookSecurityEvent({
      eventId: eventData.eventId,
      eventType: eventData.eventType,
      provider: eventData.gateway,
      result: 'REJECTED',
      reason: 'Ownership mismatch detected: commuter does not own subscription',
      statusCode: 400,
    });
    return NextResponse.json(
      { error: 'Forbidden: commuter does not own subscription' },
      { status: 400 }
    );
  }

  // 4. Payment State Transition Protection: Handle Failure Events Without Escalation
  if (!eventData.isSuccess) {
    await markWebhookEventProcessed({
      eventId: eventData.eventId,
      provider: eventData.gateway,
      transactionId: eventData.transactionId,
      subscriptionId: eventData.subscriptionId,
      commuterId: eventData.commuterId,
      amount: eventData.amount,
    });

    logWebhookSecurityEvent({
      eventId: eventData.eventId,
      eventType: eventData.eventType,
      provider: eventData.gateway,
      result: 'ACCEPTED',
      reason: 'Payment failure acknowledged without state escalation',
      statusCode: 200,
    });

    return NextResponse.json({
      received: true,
      status: 'FAILED',
      message: 'Payment failure recorded; subscription remains inactive',
    });
  }

  // 5. Idempotency Check: Event ID Deduplication
  const eventAlreadyProcessed = await isWebhookEventProcessed(eventData.eventId);
  if (eventAlreadyProcessed) {
    logWebhookSecurityEvent({
      eventId: eventData.eventId,
      eventType: eventData.eventType,
      provider: eventData.gateway,
      result: 'IDEMPOTENT',
      reason: 'Duplicate event ID detected',
      statusCode: 200,
    });
    return NextResponse.json({
      received: true,
      idempotent: true,
      message: 'Event previously processed',
      eventId: eventData.eventId,
    });
  }

  // 6. Idempotency Check: Transaction ID Deduplication
  const existingPayment = await getPaymentByTransactionId(eventData.transactionId);
  if (existingPayment) {
    await markWebhookEventProcessed({
      eventId: eventData.eventId,
      provider: eventData.gateway,
      transactionId: eventData.transactionId,
      subscriptionId: eventData.subscriptionId,
      commuterId: eventData.commuterId,
      amount: eventData.amount,
    });

    logWebhookSecurityEvent({
      eventId: eventData.eventId,
      eventType: eventData.eventType,
      provider: eventData.gateway,
      result: 'IDEMPOTENT',
      reason: 'Duplicate transaction ID detected',
      statusCode: 200,
    });

    return NextResponse.json({
      received: true,
      idempotent: true,
      message: 'Payment already recorded for this transaction',
      transactionId: eventData.transactionId,
      invoiceNumber: existingPayment.invoiceNumber,
    });
  }

  // 7. Atomic Mutation: Process Verified Payment
  try {
    const result = await processMockPayment({
      subscriptionId: eventData.subscriptionId,
      commuterId: eventData.commuterId,
      amount: eventData.amount,
      paymentMethod: eventData.paymentMethod,
      gateway: eventData.gateway,
      transactionId: eventData.transactionId,
    });

    await markWebhookEventProcessed({
      eventId: eventData.eventId,
      provider: eventData.gateway,
      transactionId: eventData.transactionId,
      subscriptionId: eventData.subscriptionId,
      commuterId: eventData.commuterId,
      amount: eventData.amount,
    });

    logWebhookSecurityEvent({
      eventId: eventData.eventId,
      eventType: eventData.eventType,
      provider: eventData.gateway,
      result: 'ACCEPTED',
      reason: 'Payment successfully verified and processed',
      statusCode: 200,
    });

    return NextResponse.json({
      received: true,
      success: true,
      subscriptionId: result.subscription.id,
      invoiceNumber: result.payment.invoiceNumber,
      transactionId: eventData.transactionId,
    });
  } catch (err: any) {
    logWebhookSecurityEvent({
      eventId: eventData.eventId,
      eventType: eventData.eventType,
      provider: eventData.gateway,
      result: 'REJECTED',
      reason: 'Payment processing failed: ' + (err?.message || 'unknown error'),
      statusCode: 500,
    });
    return NextResponse.json(
      { error: 'Internal payment processing failed' },
      { status: 500 }
    );
  }
}
