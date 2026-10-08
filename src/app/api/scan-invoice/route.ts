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

    // Enlazar cada ítem extraído con los productos existentes
    const enrichedItems = scanResult.items.map(item => {
      const match = matchProduct(item.rawName, existingProducts);
      return {
        ...item,
        matchedProductId: match.product ? match.product.id : null,
        matchedProductName: match.product ? match.product.name : null,
        confidence: match.confidence,
        isNew: !match.product
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
