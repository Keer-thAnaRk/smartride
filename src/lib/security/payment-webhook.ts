import crypto from 'crypto';

export type PaymentGateway = 'STRIPE' | 'RAZORPAY';

export interface VerifiedWebhookPayload {
  eventId: string;
  eventType: string;
  gateway: PaymentGateway;
  transactionId: string;
  subscriptionId: string;
  commuterId: string;
  amount: number;
  currency: string;
  paymentMethod: 'CARD' | 'UPI' | 'NETBANKING' | 'WALLET';
  isSuccess: boolean;
  rawPayload: any;
}

export interface WebhookVerificationResult {
  isValid: boolean;
  gateway?: PaymentGateway | 'DEV_MOCK';
  error?: string;
  statusCode: 200 | 400 | 401 | 403 | 500;
}

/**
 * Verify Stripe webhook signature against raw request body using HMAC-SHA256.
 * Header format: t=<unix_timestamp>,v1=<hex_signature>
 * Signed payload: `<unix_timestamp>.<rawBody>`
 */
export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string,
  toleranceSeconds: number = 300
): { isValid: boolean; error?: string } {
  if (!signatureHeader || typeof signatureHeader !== 'string') {
    return { isValid: false, error: 'Missing or empty stripe-signature header' };
  }
  if (!secret) {
    return { isValid: false, error: 'Stripe webhook secret is not configured' };
  }

  const elements = signatureHeader.split(',');
  let timestamp: number | null = null;
  const signatures: string[] = [];

  for (const element of elements) {
    const parts = element.trim().split('=');
    if (parts.length === 2) {
      const prefix = parts[0].trim();
      const val = parts[1].trim();
      if (prefix === 't') {
        const parsed = parseInt(val, 10);
        if (!isNaN(parsed)) {
          timestamp = parsed;
        }
      } else if (prefix === 'v1') {
        signatures.push(val);
      }
    }
  }

  if (timestamp === null || signatures.length === 0) {
    return { isValid: false, error: 'Malformed stripe-signature header format' };
  }

  // Tolerance window check against replay attacks
  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - timestamp) > toleranceSeconds) {
    return { isValid: false, error: 'Webhook timestamp outside tolerance window' };
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(signedPayload, 'utf8');
  const expectedSignatureHex = hmac.digest('hex');
  const expectedBuf = Buffer.from(expectedSignatureHex, 'hex');

  const matched = signatures.some((sig) => {
    try {
      const sigBuf = Buffer.from(sig, 'hex');
      return sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf);
    } catch {
      return false;
    }
  });

  if (!matched) {
    return { isValid: false, error: 'Invalid Stripe signature' };
  }

  return { isValid: true };
}

/**
 * Verify Razorpay webhook signature against raw request body using HMAC-SHA256.
 * Header format: 64-character hex signature
 * Signed payload: `<rawBody>`
 */
export function verifyRazorpaySignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string
): { isValid: boolean; error?: string } {
  if (!signatureHeader || typeof signatureHeader !== 'string') {
    return { isValid: false, error: 'Missing or empty x-razorpay-signature header' };
  }
  if (!secret) {
    return { isValid: false, error: 'Razorpay webhook secret is not configured' };
  }

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(rawBody, 'utf8');
  const expectedSignatureHex = hmac.digest('hex');
  const expectedBuf = Buffer.from(expectedSignatureHex, 'hex');

  try {
    const sigBuf = Buffer.from(signatureHeader.trim(), 'hex');
    if (sigBuf.length !== expectedBuf.length) {
      return { isValid: false, error: 'Invalid Razorpay signature length' };
    }
    const isValid = crypto.timingSafeEqual(sigBuf, expectedBuf);
    if (!isValid) {
      return { isValid: false, error: 'Invalid Razorpay signature' };
    }
    return { isValid: true };
  } catch {
    return { isValid: false, error: 'Malformed Razorpay signature' };
  }
}

/**
 * Dispatcher to verify incoming payment webhook request.
 * Strictly rejects mock/unverified requests in production.
 */
export function verifyPaymentWebhook(
  headers: Headers,
  rawBody: string
): WebhookVerificationResult {
  const stripeSig = headers.get('stripe-signature');
  const razorpaySig = headers.get('x-razorpay-signature');
  const mockSecretHeader = headers.get('x-mock-payment-secret');
  const mockFlagHeader = headers.get('x-mock-webhook');

  const isProduction = process.env.NODE_ENV === 'production';

  // 1. Stripe webhook check
  if (stripeSig) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      return { isValid: false, gateway: 'STRIPE', error: 'Stripe webhook secret is not configured', statusCode: 500 };
    }
    const res = verifyStripeSignature(rawBody, stripeSig, secret);
    if (!res.isValid) {
      return { isValid: false, gateway: 'STRIPE', error: res.error || 'Invalid Stripe signature', statusCode: 401 };
    }
    return { isValid: true, gateway: 'STRIPE', statusCode: 200 };
  }

  // 2. Razorpay webhook check
  if (razorpaySig) {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      return { isValid: false, gateway: 'RAZORPAY', error: 'Razorpay webhook secret is not configured', statusCode: 500 };
    }
    const res = verifyRazorpaySignature(rawBody, razorpaySig, secret);
    if (!res.isValid) {
      return { isValid: false, gateway: 'RAZORPAY', error: res.error || 'Invalid Razorpay signature', statusCode: 401 };
    }
    return { isValid: true, gateway: 'RAZORPAY', statusCode: 200 };
  }

  // 3. Mock / Simulated Webhook Boundary
  // In production, mock webhooks are strictly rejected.
  if (isProduction) {
    return {
      isValid: false,
      error: 'Unverified webhook request: production requires valid provider cryptographic signature',
      statusCode: 403,
    };
  }

  // In non-production, only accept mock webhooks if explicitly enabled and authorized with dev secret
  const allowMock = process.env.ALLOW_MOCK_PAYMENT_WEBHOOK === 'true';
  const devMockSecret = process.env.DEV_MOCK_WEBHOOK_SECRET || 'dev_mock_smartride_webhook_secret';

  if (allowMock && (mockSecretHeader === devMockSecret || (mockFlagHeader === 'true' && mockSecretHeader === devMockSecret))) {
    return { isValid: true, gateway: 'DEV_MOCK', statusCode: 200 };
  }

  // Otherwise, missing or rejected signature
  return {
    isValid: false,
    error: 'Missing required payment provider signature header',
    statusCode: 401,
  };
}

export interface PayloadValidationSuccess {
  isValid: true;
  data: VerifiedWebhookPayload;
}

export interface PayloadValidationError {
  isValid: false;
  error: string;
  statusCode: number;
  isUnsupportedEvent?: boolean;
}

export type PayloadValidationResult = PayloadValidationSuccess | PayloadValidationError;

/**
 * Validates, normalizes, and sanitizes verified payment webhook payload.
 */
export function parseAndValidatePayload(
  rawBody: string,
  verifiedGateway: PaymentGateway | 'DEV_MOCK'
): PayloadValidationResult {
  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return { isValid: false, error: 'Malformed JSON payload', statusCode: 400 };
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { isValid: false, error: 'Webhook payload must be a non-null JSON object', statusCode: 400 };
  }

  // Extract event type
  const eventType = body.type || body.event;
  if (!eventType || typeof eventType !== 'string') {
    return { isValid: false, error: 'Missing or invalid event type', statusCode: 400 };
  }

  // Supported event types
  const supportedSuccessEvents = ['payment_intent.succeeded', 'payment.captured'];
  const supportedFailureEvents = ['payment_intent.payment_failed', 'payment.failed'];

  const isSuccess = supportedSuccessEvents.includes(eventType);
  const isFailure = supportedFailureEvents.includes(eventType);

  if (!isSuccess && !isFailure) {
    return {
      isValid: false,
      error: `Unsupported webhook event type: ${eventType}`,
      statusCode: 400,
      isUnsupportedEvent: true,
    };
  }

  // Extract nested or flat objects:
  // - Stripe official format: body.data.object
  // - Razorpay official format: body.payload.payment.entity
  // - SmartRide flat/nested format: body.data || body
  const stripeObj = body.data?.object;
  const razorpayObj = body.payload?.payment?.entity;
  const flatData = body.data || body;
  const dataContainer = stripeObj || razorpayObj || flatData;

  // Extract unique eventId
  const eventId =
    body.id ||
    body.eventId ||
    body.event_id ||
    (stripeObj && stripeObj.id ? `evt_stripe_${stripeObj.id}` : null) ||
    (razorpayObj && razorpayObj.id ? `evt_rzp_${razorpayObj.id}` : null);

  if (!eventId || typeof eventId !== 'string' || eventId.trim().length === 0) {
    return { isValid: false, error: 'Missing unique event identifier in payload', statusCode: 400 };
  }

  // Extract transactionId
  const transactionId =
    stripeObj?.id ||
    razorpayObj?.id ||
    dataContainer.transactionId ||
    dataContainer.paymentIntentId ||
    body.transactionId ||
    eventId;

  // Extract metadata / notes
  const metadata = stripeObj?.metadata || razorpayObj?.notes || dataContainer;

  const subscriptionId = metadata.subscriptionId || dataContainer.subscriptionId;
  const commuterId = metadata.commuterId || dataContainer.commuterId;

  if (!subscriptionId || typeof subscriptionId !== 'string' || subscriptionId.trim().length === 0) {
    return { isValid: false, error: 'Missing subscriptionId reference in payment event', statusCode: 400 };
  }

  if (!commuterId || typeof commuterId !== 'string' || commuterId.trim().length === 0) {
    return { isValid: false, error: 'Missing commuterId reference in payment event', statusCode: 400 };
  }

  // Amount parsing
  const rawAmount = dataContainer.amount ?? metadata.amount;
  if (rawAmount === undefined || rawAmount === null || isNaN(Number(rawAmount))) {
    return { isValid: false, error: 'Missing or invalid payment amount', statusCode: 400 };
  }

  let amount = Number(rawAmount);
  // Handle Stripe/Razorpay standard smallest currency units (paise/cents)
  if ((stripeObj || razorpayObj) && amount > 10000) {
    amount = amount / 100;
  }

  if (amount <= 0) {
    return { isValid: false, error: 'Payment amount must be greater than zero', statusCode: 400 };
  }

  // Gateway determination
  let gateway: PaymentGateway = 'STRIPE';
  if (verifiedGateway === 'RAZORPAY' || eventType.startsWith('payment.') || dataContainer.gateway === 'RAZORPAY') {
    gateway = 'RAZORPAY';
  } else if (verifiedGateway === 'STRIPE' || eventType.startsWith('payment_intent.') || dataContainer.gateway === 'STRIPE') {
    gateway = 'STRIPE';
  }

  // Payment method normalization
  const rawMethod = String(dataContainer.paymentMethod || dataContainer.method || 'CARD').toUpperCase();
  const paymentMethod = ['CARD', 'UPI', 'NETBANKING', 'WALLET'].includes(rawMethod)
    ? (rawMethod as 'CARD' | 'UPI' | 'NETBANKING' | 'WALLET')
    : 'CARD';

  return {
    isValid: true,
    data: {
      eventId: eventId.trim(),
      eventType,
      gateway,
      transactionId: String(transactionId).trim(),
      subscriptionId: subscriptionId.trim(),
      commuterId: commuterId.trim(),
      amount,
      currency: 'INR',
      paymentMethod,
      isSuccess,
      rawPayload: body,
    },
  };
}

/**
 * Sanitized security audit logging for webhook lifecycle events.
 * Crucially NEVER logs webhook secrets, signatures, authorization headers, or customer PII.
 */
export function logWebhookSecurityEvent(event: {
  eventId?: string;
  eventType?: string;
  provider?: string;
  result: 'ACCEPTED' | 'REJECTED' | 'IDEMPOTENT';
  reason?: string;
  statusCode: number;
}) {
  const timestamp = new Date().toISOString();
  console.log(
    `[PAYMENT_WEBHOOK_AUDIT] ${timestamp} | Provider: ${event.provider || 'UNKNOWN'} | Event: ${
      event.eventId || 'N/A'
    } (${event.eventType || 'N/A'}) | Result: ${event.result} | Status: ${event.statusCode}${
      event.reason ? ` | ${event.reason}` : ''
    }`
  );
}
