import { NextResponse } from 'next/server';
import { getAllUsers, authenticateUser } from '@/lib/storage';

export async function GET() {
  try {
    const users = getAllUsers();
    return NextResponse.json({ success: true, users });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { userId, pin } = await request.json();

    if (!userId || !pin) {
      return NextResponse.json({ success: false, error: 'Usuario y PIN requeridos' }, { status: 400 });
    }

    const user = authenticateUser(userId, String(pin).trim());
    if (!user) {
      return NextResponse.json({ success: false, error: 'PIN incorrecto para este usuario' }, { status: 401 });
    }

    return NextResponse.json({ success: true, user });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
