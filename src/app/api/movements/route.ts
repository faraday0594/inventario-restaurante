import { NextResponse } from 'next/server';
import { getAllMovements } from '@/lib/storage';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userRole = searchParams.get('userRole');

    // SEGURIDAD: Solo ADMIN puede ver el historial de auditoría
    if (userRole !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Acceso restringido: Solo el Administrador puede ver el historial de auditoría.' },
        { status: 403 }
      );
    }

    const movements = getAllMovements(200, { role: 'ADMIN' });
    return NextResponse.json({ success: true, movements });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
