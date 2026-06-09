import { NextRequest, NextResponse } from 'next/server';

const GELDIG_TOKEN = "fearless_x9k2m";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('t') || '';
  const geldig = token === GELDIG_TOKEN;
  return NextResponse.json({ geldig }, {
    headers: { 'Access-Control-Allow-Origin': '*' }
  });
}
