import { NextResponse } from 'next/server';
import { parseInvoiceWithMiniMax } from '@/lib/minimax';
import { getAllProducts, matchProduct } from '@/lib/storage';

export async function POST(request: Request) {
  try {
    const { image } = await request.json();

    if (!image || typeof image !== 'string') {
      return NextResponse.json({ success: false, error: 'Imagen base64 requerida' }, { status: 400 });
    }

    // Llamar a MiniMax Vision
    const scanResult = await parseInvoiceWithMiniMax(image);
    const existingProducts = await getAllProducts();

    // 1. Emparejamiento por reglas heurísticas y alias
    const heuristicMatched = scanResult.items.map(item => {
      const match = matchProduct(item.rawName, existingProducts);
      return {
        ...item,
        matchedProductId: match.product ? match.product.id : null,
        matchedProductName: match.product ? match.product.name : null,
        confidence: match.confidence,
        isNew: !match.product
      };
    });

    // 2. Reconciliación semántica con IA para detectar productos con nombres informales (ej: "agua litro crystal" vs "Agua Cristal PET 1000ml")
    let aiDecisions: Record<string, any> = {};
    if (existingProducts.length > 0 && scanResult.items.length > 0) {
      try {
        const { reconcileProductsWithAI } = await import('@/lib/minimax');
        aiDecisions = await reconcileProductsWithAI(
          scanResult.items.map(it => ({ rawName: it.rawName, cleanName: it.cleanName, presentation: it.presentation })),
          existingProducts.map(p => ({ id: p.id, name: p.name, presentation: p.presentation, category: p.category, aliases: p.aliases }))
        );
      } catch (err) {
        console.warn('Fallo opcional en reconciliación AI:', err);
      }
    }

    // 3. Fusionar resultados dando prioridad a la IA cuando detecta equivalencia y propuesta de corrección de nombre
    const enrichedItems = heuristicMatched.map(item => {
      const aiDecision = aiDecisions[item.rawName];
      let matchedId = item.matchedProductId;
      let matchedName = item.matchedProductName;
      let isNew = item.isNew;
      let confidence = item.confidence;
      let suggestedNameUpdate: string | null = null;

      if (aiDecision && aiDecision.matchedProductId) {
        const targetProd = existingProducts.find(p => p.id === aiDecision.matchedProductId);
        if (targetProd) {
          matchedId = targetProd.id;
          matchedName = targetProd.name;
          isNew = false;
          confidence = Math.max(confidence, aiDecision.confidence || 0.95);
          
          // Si el nombre técnico de la factura o de la IA es más preciso o diferente al nombre informal
          if (aiDecision.suggestedNameUpdate && aiDecision.suggestedNameUpdate.trim().toLowerCase() !== targetProd.name.trim().toLowerCase()) {
            suggestedNameUpdate = aiDecision.suggestedNameUpdate.trim();
          } else if (item.cleanName && item.cleanName.trim().toLowerCase() !== targetProd.name.trim().toLowerCase()) {
            suggestedNameUpdate = item.cleanName.trim();
          }
        }
      } else if (!isNew && matchedId) {
        const targetProd = existingProducts.find(p => p.id === matchedId);
        if (targetProd && item.cleanName && item.cleanName.trim().toLowerCase() !== targetProd.name.trim().toLowerCase()) {
          suggestedNameUpdate = item.cleanName.trim();
        }
      }

      return {
        ...item,
        matchedProductId: matchedId,
        matchedProductName: matchedName,
        confidence,
        isNew,
        suggestedNameUpdate: suggestedNameUpdate || null,
        updateExistingName: Boolean(suggestedNameUpdate) // Por defecto sugerir activado para corregir el nombre
      };
    });

    return NextResponse.json({
      success: true,
      supplier: scanResult.supplier || 'Proveedor Desconocido',
      invoiceNumber: scanResult.invoiceNumber || 'S/N',
      date: scanResult.date || new Date().toISOString().split('T')[0],
      items: enrichedItems
    });
  } catch (error: any) {
    console.error('Error procesando factura con MiniMax:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error procesando la factura con MiniMax' },
      { status: 500 }
    );
  }
}
