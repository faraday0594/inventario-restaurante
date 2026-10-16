import { NextResponse } from 'next/server';
import { parsePriceListWithMiniMax } from '@/lib/minimax';
import { getAllProducts, matchProduct } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { image } = await request.json();

    if (!image || typeof image !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Imagen en base64 requerida' },
        { status: 400 }
      );
    }

    const scanResult = await parsePriceListWithMiniMax(image);
    const existingProducts = await getAllProducts();

    // Emparejar cada ítem con los productos existentes en catálogo
    const enrichedItems = scanResult.items.map(item => {
      // 1. Intentar match por cleanName o rawName
      const matchClean = matchProduct(item.cleanName, existingProducts);
      const matchRaw = matchProduct(item.rawName, existingProducts);
      const bestMatch = (matchClean.confidence >= matchRaw.confidence) ? matchClean : matchRaw;

      const matchedProd = bestMatch.confidence >= 0.75 ? bestMatch.product : null;

      return {
        ...item,
        matchedProductId: matchedProd ? matchedProd.id : null,
        matchedProductName: matchedProd ? matchedProd.name : null,
        currentPrice: matchedProd ? matchedProd.salePrice : undefined,
        isNew: !matchedProd,
        confidence: bestMatch.confidence,
        initialStock: 0,
        selected: true
      };
    });

    return NextResponse.json({
      success: true,
      title: scanResult.title || 'Lista de Precios',
      date: scanResult.date || new Date().toISOString().split('T')[0],
      items: enrichedItems
    });
  } catch (error: any) {
    console.error('Error al escanear lista de precios:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error al procesar la lista de precios con IA' },
      { status: 500 }
    );
  }
}
