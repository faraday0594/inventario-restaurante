import { NextResponse } from 'next/server';
import { getAllProducts, saveProduct, updateProductStock, deleteProduct } from '@/lib/storage';

export async function GET() {
  try {
    const products = await getAllProducts();
    return NextResponse.json({ success: true, products });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { user, ...productData } = body;
    const product = await saveProduct(productData, user);
    return NextResponse.json({ success: true, product });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { productId, delta, type, reason, user } = body;

    if (!productId || typeof delta !== 'number') {
      return NextResponse.json({ success: false, error: 'productId y delta son requeridos' }, { status: 400 });
    }

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Permiso denegado: Solo el Administrador puede modificar directamente números de stock o restar unidades sin factura.' 
        }, 
        { status: 403 }
      );
    }

    const result = await updateProductStock(
      productId, 
      delta, 
      type || (delta >= 0 ? 'ENTRADA' : 'SALIDA'), 
      reason,
      user
    );
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
      return NextResponse.json({ success: false, error: 'ID es requerido' }, { status: 400 });
    }

    if (userRole !== 'ADMIN') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Permiso denegado: Solo el Administrador puede eliminar referencias del catálogo.' 
        }, 
        { status: 403 }
      );
    }

    const deleted = await deleteProduct(id, { role: 'ADMIN' });
    return NextResponse.json({ success: true, deleted });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
