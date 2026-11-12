import { NextResponse } from 'next/server';
import {
  getAllProteins,
  saveProtein,
  adjustProteinPortions,
  deleteProtein
} from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await getAllProteins();
    return NextResponse.json(
      { success: true, ...result },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { user, ...proteinData } = body;

    if (!proteinData.name || !String(proteinData.name).trim()) {
      return NextResponse.json(
        { success: false, error: 'El nombre de la proteína es requerido.' },
        { status: 400 }
      );
    }

    const protein = await saveProtein(proteinData, user);
    return NextResponse.json({ success: true, protein });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { user, ...params } = body;

    if (!params.proteinId || typeof params.delta !== 'number') {
      return NextResponse.json(
        { success: false, error: 'proteinId y delta numérico son requeridos.' },
        { status: 400 }
      );
    }

    const result = await adjustProteinPortions(params, user);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const userRole = searchParams.get('userRole');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID es requerido.' }, { status: 400 });
    }

    if (userRole !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Solo el Administrador puede eliminar proteínas.' },
        { status: 403 }
      );
    }

    const deleted = await deleteProtein(id, { role: 'ADMIN' });
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Proteína no encontrada.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, deleted: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
