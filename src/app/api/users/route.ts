import { NextResponse } from 'next/server';
import { getAllUsers, saveUser, deleteUser } from '@/lib/storage';
import { UserRole } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const users = await getAllUsers();
    return NextResponse.json({ success: true, users });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userData, requester } = body;

    if (!requester || requester.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Solo el Administrador tiene permiso para crear o modificar usuarios' },
        { status: 403 }
      );
    }

    if (!userData || !userData.name || !userData.role) {
      return NextResponse.json(
        { success: false, error: 'Nombre y Rol son obligatorios' },
        { status: 400 }
      );
    }

    const saved = await saveUser(userData, requester);
    return NextResponse.json({ success: true, user: saved });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('id');
    const role = (searchParams.get('role') as UserRole) || 'EMPLEADO';

    if (role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Solo el Administrador puede eliminar usuarios' },
        { status: 403 }
      );
    }

    if (!userId) {
      return NextResponse.json({ success: false, error: 'ID de usuario requerido' }, { status: 400 });
    }

    const deleted = await deleteUser(userId, { role: 'ADMIN' });
    return NextResponse.json({ success: true, deleted });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
