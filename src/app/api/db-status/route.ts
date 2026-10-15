import { NextResponse } from 'next/server';
import { checkDbStatus } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const status = await checkDbStatus();
    return NextResponse.json(status, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      { 
        connected: false, 
        configured: false, 
        error: error.message || 'Error al verificar la base de datos' 
      }, 
      { status: 500 }
    );
  }
}
