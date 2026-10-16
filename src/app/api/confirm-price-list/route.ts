import { NextResponse } from 'next/server';
import { saveProduct, getProductById } from '@/lib/storage';
import { PriceListExtractedItem, UserRole } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      items, 
      user 
    }: { 
      items: PriceListExtractedItem[]; 
      user?: { id: string; name: string; role: UserRole };
    } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No se enviaron productos para guardar' },
        { status: 400 }
      );
    }

    let createdCount = 0;
    let updatedCount = 0;

    for (const item of items) {
      if (item.selected === false) continue;

      if (item.isNew || !item.matchedProductId) {
        // Crear nuevo producto en el catálogo
        await saveProduct({
          name: item.cleanName.trim(),
          category: item.category || 'Gaseosas',
          presentation: item.presentation || 'Unidad',
          salePrice: Number(item.salePrice) || 0,
          costPrice: Number(item.costPrice) || Math.round((Number(item.salePrice) || 0) * 0.6),
          stock: Number(item.initialStock) || 0,
          fridgeStock: 0,
          minStock: 6,
          aliases: item.rawName ? [item.rawName.trim()] : []
        }, user);
        createdCount++;
      } else {
        // Actualizar precio de producto existente
        const existing = await getProductById(item.matchedProductId);
        if (existing) {
          const newAliases = [...(existing.aliases || [])];
          if (item.rawName && !newAliases.includes(item.rawName.trim())) {
            newAliases.push(item.rawName.trim());
          }

          await saveProduct({
            ...existing,
            salePrice: Number(item.salePrice) || existing.salePrice,
            costPrice: item.costPrice && item.costPrice > 0 ? Number(item.costPrice) : existing.costPrice,
            aliases: newAliases
          }, user);
          updatedCount++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      createdCount,
      updatedCount,
      totalProcessed: createdCount + updatedCount
    });
  } catch (error: any) {
    console.error('Error al guardar lista de precios:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error al persistir productos de la lista de precios' },
      { status: 500 }
    );
  }
}
