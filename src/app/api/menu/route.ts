import { NextResponse } from 'next/server';
import { getAllMenuItems, saveMenuItem, deleteMenuItem } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const items = await getAllMenuItems();
    return NextResponse.json({ success: true, items });
  } catch (error: any) {
    console.error('Error al obtener menú:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error al obtener menú' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, category, price, description, available, id } = body;

    if (!name || typeof price !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Nombre y precio son obligatorios' },
        { status: 400 }
      );
    }

    const saved = await saveMenuItem({
      id,
      name: name.trim(),
      category: category?.trim() || 'General',
      price: Number(price),
      description: description?.trim() || '',
      available: available !== false
    });

    return NextResponse.json({ success: true, item: saved });
  } catch (error: any) {
    console.error('Error al guardar platillo:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error al guardar platillo' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID es requerido' },
        { status: 400 }
      );
    }

    const deleted = await deleteMenuItem(id);
    return NextResponse.json({ success: true, deleted });
  } catch (error: any) {
    console.error('Error al eliminar platillo:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error al eliminar platillo' },
      { status: 500 }
    );
  }
}
