import { NextResponse } from 'next/server';
import { getProductById, saveProduct } from '@/lib/storage';
import { UserRole } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface AuditConfirmItem {
  productId: string;
  suggestedName: string;
  suggestedCategory?: string;
  suggestedPresentation: string;
  suggestedCostPrice: number;
  suggestedAliases?: string[];
  selected?: boolean;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      items,
      user
    }: {
      items: AuditConfirmItem[];
      user?: { id: string; name: string; role: UserRole };
    } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No se enviaron productos para actualizar' },
        { status: 400 }
      );
    }

    let updatedCount = 0;

    for (const item of items) {
      if (item.selected === false || !item.productId) continue;

      const existing = await getProductById(item.productId);
      if (!existing) continue;

      const mergedAliases = Array.from(
        new Set([
          ...(existing.aliases || []),
          ...(item.suggestedAliases || []).map(a => a.trim()).filter(Boolean)
        ])
      );

      // GARANTÍA ESTRICTA: Se conservan intactos stock, fridgeStock, minStock y salePrice
      await saveProduct(
        {
          ...existing,
          name: item.suggestedName?.trim() || existing.name,
          category: item.suggestedCategory?.trim() || existing.category,
          presentation: item.suggestedPresentation?.trim() || existing.presentation,
          costPrice:
            typeof item.suggestedCostPrice === 'number' && item.suggestedCostPrice >= 0
              ? Math.round(item.suggestedCostPrice)
              : existing.costPrice,
          stock: existing.stock,
          fridgeStock: existing.fridgeStock || 0,
          minStock: existing.minStock,
          salePrice: existing.salePrice,
          aliases: mergedAliases
        },
        user
      );
      updatedCount++;
    }

    return NextResponse.json({
      success: true,
      updatedCount
    });
  } catch (error: any) {
    console.error('Error al confirmar auditoría de bebidas:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error al guardar cambios de auditoría' },
      { status: 500 }
    );
  }
}
