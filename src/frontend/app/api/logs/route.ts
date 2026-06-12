import { NextResponse } from 'next/server';
import { logEvent, LogSeverity } from '../../../../backend/utils/logger';
import { getSession } from '../../../../backend/auth/sessionManager';

export async function POST(request: Request) {
  try {
    const session = await getSession(request as any);
    const userId = session?.id || null;
    
    // Get client IP address
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';

    const body = await request.json().catch(() => ({}));
    const { action, severity = 'INFO', payload = {} } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    const validSeverities: LogSeverity[] = ['INFO', 'WARN', 'ERROR', 'CRITICAL'];
    const resolvedSeverity = validSeverities.includes(severity) ? (severity as LogSeverity) : 'INFO';

    await logEvent(userId, action, resolvedSeverity, payload, ipAddress);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Logger API failed:', error.message);
    return NextResponse.json({ error: 'Logger error' }, { status: 500 });
  }
}
