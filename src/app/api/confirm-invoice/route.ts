import { NextResponse } from 'next/server';
import { updateProductStock, saveProduct, getProductById } from '@/lib/storage';
import { UserRole } from '@/lib/types';

interface ConfirmItemPayload {
  rawName: string;
  quantity: number;
  unitPrice?: number;
  productId?: string | null;
  createNew?: boolean;
  newProductDetails?: {
    name: string;
    category: string;
    presentation: string;
    salePrice: number;
    minStock?: number;
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      supplier, 
      invoiceNumber, 
      items, 
      user 
    }: { 
      supplier: string; 
      invoiceNumber: string; 
      items: ConfirmItemPayload[];
      user?: { id: string; name: string; role: UserRole };
    } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'Lista de ítems vacía' }, { status: 400 });
    }

    const processed = [];
    const operatorName = user?.name || 'Usuario';
    const reason = `Factura #${invoiceNumber || 'S/N'} (${supplier || 'Proveedor'}) - Ingresado por ${operatorName}`;

    for (const item of items) {
      let targetId = item.productId;

      // Si se crea un producto nuevo a partir de la factura
      if (item.createNew && item.newProductDetails) {
        const created = saveProduct({
          name: item.newProductDetails.name,
          category: item.newProductDetails.category || 'Gaseosas',
          presentation: item.newProductDetails.presentation || 'Unidad',
          stock: 0,
          minStock: item.newProductDetails.minStock || 12,
          costPrice: item.unitPrice || 0,
          salePrice: item.newProductDetails.salePrice || (item.unitPrice ? Math.round(item.unitPrice * 1.6) : 5000),
          aliases: [item.rawName]
        }, user);
        targetId = created.id;
      }

      if (targetId) {
        // Asegurar que el alias del producto guarde el nombre de la factura para la próxima vez
        const existing = getProductById(targetId);
        if (existing && !existing.aliases.includes(item.rawName)) {
          saveProduct({
            ...existing,
            aliases: [...existing.aliases, item.rawName],
            costPrice: item.unitPrice && item.unitPrice > 0 ? item.unitPrice : existing.costPrice
          }, user);
        }

        // Sumar al stock registrando el usuario operador
        const result = updateProductStock(targetId, item.quantity, 'ENTRADA', reason, user);
        processed.push(result);
      }
    }

    return NextResponse.json({
      success: true,
      count: processed.length,
      processed
    });
  } catch (error: any) {
    console.error('Error confirmando factura:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
