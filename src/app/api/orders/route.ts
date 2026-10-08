import { NextResponse } from 'next/server';
import { 
  getAllOrders, 
  createOrder, 
  updateOrderStatus, 
  getDailyOrdersSummary 
} from '@/lib/storage';
import { OrderStatus, OrderType } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const summary = searchParams.get('summary');
    const date = searchParams.get('date') || undefined;

    if (summary === 'true') {
      const summaryData = await getDailyOrdersSummary(date);
      return NextResponse.json({ success: true, summary: summaryData });
    }

    const activeOnly = searchParams.get('active') === 'true';
    const status = (searchParams.get('status') as OrderStatus) || undefined;
    const waiterId = searchParams.get('waiterId') || undefined;

    const orders = await getAllOrders({
      date,
      status,
      activeOnly,
      waiterId
    });

    return NextResponse.json({ success: true, orders });
  } catch (error: any) {
    console.error('Error al obtener pedidos:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error al obtener pedidos' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, tableNumber, customerName, items, notes, user } = body;

    if (!user || !user.id || !user.name) {
      return NextResponse.json(
        { success: false, error: 'Debe iniciar sesión como mesera o usuario para tomar el pedido' },
        { status: 401 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'El pedido debe incluir al menos un platillo o bebida' },
        { status: 400 }
      );
    }

    if (type === 'MESA' && !tableNumber) {
      return NextResponse.json(
        { success: false, error: 'Debe indicar el número de la mesa' },
        { status: 400 }
      );
    }

    const newOrder = await createOrder(
      {
        type: (type as OrderType) || 'MESA',
        tableNumber,
        customerName,
        items,
        notes
      },
      { id: user.id, name: user.name }
    );

    return NextResponse.json({ success: true, order: newOrder });
  } catch (error: any) {
    console.error('Error al crear pedido:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error al registrar pedido' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { orderId, status, user } = body;

    if (!orderId || !status) {
      return NextResponse.json(
        { success: false, error: 'Datos incompletos para actualizar pedido' },
        { status: 400 }
      );
    }

    const updated = await updateOrderStatus(orderId, status as OrderStatus, user);
    return NextResponse.json({ success: true, order: updated });
  } catch (error: any) {
    console.error('Error al actualizar pedido:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error al actualizar pedido' },
      { status: 500 }
    );
  }
}
