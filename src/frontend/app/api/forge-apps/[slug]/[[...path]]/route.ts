import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../../../database/connection';
import { sql } from 'drizzle-orm';

async function handleProxy(
  request: NextRequest,
  context: any
) {
  // Await context.params for Next.js 15+ safety
  const params = await context.params;
  const slug = params?.slug as string;
  const subpath = params?.path as string[] | undefined;

  // Retrieve app entryUrl from DB
  const appResult = await db.execute(sql`
    SELECT entry_url FROM forge_apps WHERE slug = ${slug}
  `);
  const rows = appResult.rows || appResult;
  if (!rows || rows.length === 0) {
    return new NextResponse('Application not found', { status: 404 });
  }

  const entryUrl = rows[0].entry_url as string;
  const pathStr = subpath ? subpath.join('/') : '';
  const queryStr = request.nextUrl.search;
  
  // Construct destination URL
  const targetUrlStr = entryUrl.endsWith('/') ? entryUrl : entryUrl + '/';
  const targetUrl = new URL(pathStr + queryStr, targetUrlStr).toString();

  try {
    const headers = new Headers();
    request.headers.forEach((value, key) => {
      if (!['host', 'cookie', 'connection', 'origin', 'referer'].includes(key.toLowerCase())) {
        headers.set(key, value);
      }
    });

    const body = request.body && ['POST', 'PUT', 'PATCH'].includes(request.method)
      ? await request.arrayBuffer()
      : undefined;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
      signal: controller.signal,
      redirect: 'manual',
    });

    clearTimeout(timeoutId);

    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      responseHeaders.set(key, value);
    });

    responseHeaders.set('Access-Control-Allow-Origin', '*');

    const responseBody = await response.arrayBuffer();
    return new NextResponse(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error: any) {
    console.error(`Proxy error for ${slug} to ${targetUrl}:`, error);
    return new NextResponse('⚠️ Extension Network Offline: Verify Local Intranet Connection Configuration Address', {
      status: 504,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      }
    });
  }
}

export async function GET(request: NextRequest, context: any) {
  return handleProxy(request, context);
}

export async function POST(request: NextRequest, context: any) {
  return handleProxy(request, context);
}

export async function PUT(request: NextRequest, context: any) {
  return handleProxy(request, context);
}

export async function DELETE(request: NextRequest, context: any) {
  return handleProxy(request, context);
}
