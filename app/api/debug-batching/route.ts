import { NextResponse } from 'next/server';
import { isFeatureEnabled } from '../../../lib/featureFlags';

export async function GET() {
  const testUserId = '3282789748459241'; // Giorgi

  return NextResponse.json({
    env_var: process.env.ENABLE_REDIS_BATCHING || 'NOT_SET',
    env_var_trimmed: process.env.ENABLE_REDIS_BATCHING?.trim() || 'NOT_SET',
    equals_true: process.env.ENABLE_REDIS_BATCHING?.trim() === 'true',
    feature_enabled_for_giorgi: isFeatureEnabled('REDIS_MESSAGE_BATCHING', testUserId),
    timestamp: new Date().toISOString()
  });
}