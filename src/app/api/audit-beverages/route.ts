import { NextResponse } from 'next/server';
import { auditBeveragesWithMiniMax } from '@/lib/minimax';
import { getAllProducts } from '@/lib/storage';

export const dynamic = 'force-dynamic';

const NON_BEVERAGE_CATEGORIES = ['Snacks y Golosinas', 'Comidas y Platos'];

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const includeAll = Boolean(body?.includeAll);

    const allProducts = await getAllProducts();
    const targetProducts = includeAll
      ? allProducts
      : allProducts.filter(p => !NON_BEVERAGE_CATEGORIES.includes(p.category));

    if (targetProducts.length === 0) {
      return NextResponse.json({
        success: true,
        items: [],
        message: 'No se encontraron bebidas en bodega para auditar.'
      });
    }

    const suggestions = await auditBeveragesWithMiniMax(
      targetProducts.map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        presentation: p.presentation,
        costPrice: p.costPrice,
        salePrice: p.salePrice,
        aliases: p.aliases || []
      }))
    );

    const suggestionMap = new Map(suggestions.map(s => [s.productId, s]));

    const items = targetProducts.map(p => {
      const sug = suggestionMap.get(p.id);
      return {
        productId: p.id,
        category: p.category,
        currentName: p.name,
        currentPresentation: p.presentation,
        currentCostPrice: p.costPrice,
        stock: p.stock,
        fridgeStock: p.fridgeStock || 0,
        salePrice: p.salePrice,
        suggestedName: sug?.suggestedName || p.name,
        suggestedPresentation: sug?.suggestedPresentation || p.presentation,
        suggestedCostPrice:
          typeof sug?.suggestedCostPrice === 'number' && sug.suggestedCostPrice > 0
            ? sug.suggestedCostPrice
            : p.costPrice,
        suggestedAliases: sug?.suggestedAliases || [],
        reason: sug?.reason || 'Sin cambios sugeridos',
        selected: true
      };
    });

    return NextResponse.json({
      success: true,
      totalAnalyzed: items.length,
      items
    });
  } catch (error: any) {
    console.error('Error al auditar bebidas con MiniMax:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error al analizar bebidas con IA' },
      { status: 500 }
    );
  }
}
