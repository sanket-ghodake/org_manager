import { NextResponse } from 'next/server';
import { getKeys } from '@backend/auth/keyManager';

export async function GET() {
  try {
    const { jwk } = getKeys();
    return NextResponse.json({
      keys: [jwk]
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
