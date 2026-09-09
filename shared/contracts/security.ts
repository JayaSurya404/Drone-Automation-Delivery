import crypto from 'crypto';

export const DEFAULT_MAX_TIMESTAMP_SKEW_MS = 300000; // 5 minutes

export function generateHmacSignature(payload: any, secret: string, timestamp: string): string {
  const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const data = `${timestamp}:${serialized}`;
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

export function verifyHmacSignature(
  payload: any,
  signature: string,
  secret: string,
  timestamp: string,
  maxSkewMs: number = DEFAULT_MAX_TIMESTAMP_SKEW_MS
): boolean {
  if (!signature || !secret || !timestamp) {
    return false;
  }

  // Check timestamp skew to prevent replay attacks
  const reqTime = new Date(timestamp).getTime();
  if (isNaN(reqTime)) {
    return false;
  }

  const now = Date.now();
  if (Math.abs(now - reqTime) > maxSkewMs) {
    console.warn(`HMAC verification failed: timestamp skew ${Math.abs(now - reqTime)}ms exceeds ${maxSkewMs}ms`);
    return false;
  }

  const expectedSignature = generateHmacSignature(payload, secret, timestamp);

  try {
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    const actualBuffer = Buffer.from(signature, 'hex');

    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
  } catch (err) {
    console.error('Error during timing-safe HMAC comparison:', err);
    return false;
  }
}
