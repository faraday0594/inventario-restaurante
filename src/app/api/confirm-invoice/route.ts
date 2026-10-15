import { NextResponse } from 'next/server';
import { updateProductStock, saveProduct, getProductById } from '@/lib/storage';
import { UserRole } from '@/lib/types';

interface ConfirmItemPayload {
  rawName: string;
  quantity: number;
  unitPrice?: number;
  productId?: string | null;
  createNew?: boolean;
  updateExistingName?: boolean; // Bandera para actualizar el nombre del producto existente
  newProductName?: string | null; // El nuevo nombre técnico a asignar al producto existente
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
        const created = await saveProduct({
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
        const existing = await getProductById(targetId);
        if (existing) {
          const newAliases = [...(existing.aliases || [])];
          if (!newAliases.includes(item.rawName)) {
            newAliases.push(item.rawName);
          }

          // Si el usuario aprobó corregir/actualizar el nombre de acuerdo a la factura
          let finalName = existing.name;
          if (item.updateExistingName && item.newProductName && item.newProductName.trim()) {
            const proposedName = item.newProductName.trim();
            if (proposedName.toLowerCase() !== existing.name.toLowerCase()) {
              // Guardar el nombre viejo en los aliases para no perder búsquedas previas
              if (!newAliases.includes(existing.name)) {
                newAliases.push(existing.name);
              }
              finalName = proposedName;
            }
          }

          await saveProduct({
            ...existing,
            name: finalName,
            aliases: newAliases,
            costPrice: item.unitPrice && item.unitPrice > 0 ? item.unitPrice : existing.costPrice
          }, user);
        }

        // Sumar al stock registrando el usuario operador
        const result = await updateProductStock(targetId, item.quantity, 'ENTRADA', reason, user);
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
