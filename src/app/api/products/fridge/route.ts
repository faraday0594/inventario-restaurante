import { NextResponse } from 'next/server';
import { transferToFridge } from '@/lib/storage';
import { UserRole } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      productId, 
      quantity, 
      direction = 'TO_FRIDGE', 
      user 
    }: { 
      productId: string; 
      quantity: number; 
      direction?: 'TO_FRIDGE' | 'TO_BODEGA';
      user?: { id: string; name: string; role: UserRole };
    } = body;

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'productId es requerido' },
        { status: 400 }
      );
    }

    if (!quantity || quantity <= 0) {
      return NextResponse.json(
        { success: false, error: 'La cantidad debe ser mayor a 0' },
        { status: 400 }
      );
    }

    // Permitir a Administradores y Empleados (y Meseras en caso de turno de servicio)
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Debe iniciar sesión para registrar traslados a nevera' },
        { status: 401 }
      );
    }

    const result = await transferToFridge(productId, Number(quantity), direction, user);

    return NextResponse.json({
      success: true,
      product: result.product,
      movement: result.movement
    });
  } catch (error: any) {
    console.error('Error al registrar traslado a nevera:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error al procesar el traslado' },
      { status: 400 }
    );
  }
}
