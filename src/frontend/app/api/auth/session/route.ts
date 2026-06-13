import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession } from '../../../../../backend/auth/sessionManager';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ session: null }, { status: 401 });
    }
    return NextResponse.json({ session });
  } catch (error: any) {
    console.error('Session retrieval error:', error);
    return NextResponse.json({ session: null }, { status: 401 });
  }
}
