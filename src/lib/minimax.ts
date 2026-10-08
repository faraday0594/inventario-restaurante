import { InvoiceScanResult } from './types';

export async function parseInvoiceWithMiniMax(imageBase64Url: string): Promise<InvoiceScanResult> {
  const apiKey = process.env.MINIMAX_API_KEY;
  const baseUrl = process.env.MINIMAX_BASE_URL || 'https://api.minimax.io/v1';
  const model = process.env.MINIMAX_MODEL || 'MiniMax-M3';

  if (!apiKey) {
    throw new Error('MINIMAX_API_KEY no está configurada en el archivo de entorno.');
  }

  const systemInstruction = `
Eres un asistente contable y de inventario experto en restaurantes y bares de Colombia y Latinoamérica.
Tu tarea es analizar la foto de una factura de compra, remisión o SOPORTE DE ENTREGA de proveedores (Coca-Cola FEMSA, Postobón, Bavaria, Makro, etc.).

Debes leer atentamente la tabla de posiciones y columnas del documento:
- Revisa las columnas: "Descripción", "Cantidad", "Cantidad por unidades", "Valor unitario", "Valor de venta", "Reducción".
- ATENCIÓN CON LAS CANTIDADES: Si la factura tiene una columna de "Cantidad por unidades" o unidades totales (ej. 1 caja con 30 unidades), usa la cantidad TOTAL DE UNIDADES (ej: 30, no 1).
- ATENCIÓN CON EL PRECIO: Si el valor de venta es por caja, calcula el precio unitario por botella (Valor de venta / Cantidad de unidades).
- IDENTIFICA SI ES BEBIDA: Si es una bebida (gaseosa, agua, cerveza, jugo, té, energizante), marca isBeverage: true. Si es un dulce, confitería, golosina (como Chao Fresa, Chicles, Galletas), hielo o descartable, marca isBeverage: false y categoría "Snacks y Golosinas".
- GENERA UN NOMBRE LIMPIO (cleanName) y PRESENTACIÓN (presentation) amigables para el restaurante:
  Ejemplos:
  "QUATRO CHOICE 350ML VIR(30)" -> cleanName: "Quatro Toronja 350ml Retornable", presentation: "Botella Vidrio 350ml", suggestedCategory: "Gaseosas"
  "COCA COLA 1.5LT PET(12) Nvo" -> cleanName: "Coca-Cola Original 1.5L", presentation: "Botella PET 1.5L", suggestedCategory: "Gaseosas"
  "COCA-COLA 350ML VIR(30)" -> cleanName: "Coca-Cola Original 350ml Retornable", presentation: "Botella Vidrio 350ml", suggestedCategory: "Gaseosas"
  "COCA-COLA 400ML PET# (12)" -> cleanName: "Coca-Cola Original 400ml", presentation: "Botella PET 400ml", suggestedCategory: "Gaseosas"
  "AGUA BRISA GAS PET 600ML (24)" -> cleanName: "Agua Brisa Con Gas 600ml", presentation: "Botella PET 600ml", suggestedCategory: "Aguas"
  "CHAO FRESA 350GR KIT24(1)" -> cleanName: "Chao Fresa 350g (Kit 24)", presentation: "Paquete 350g", suggestedCategory: "Snacks y Golosinas", isBeverage: false

Responde ÚNICAMENTE un objeto JSON válido con este formato:
{
  "supplier": "Coca-Cola FEMSA",
  "invoiceNumber": "00001",
  "date": "2026-10-05",
  "items": [
    {
      "rawName": "QUATRO CHOICE 350ML VIR(30)",
      "cleanName": "Quatro Toronja 350ml Retornable",
      "presentation": "Botella Vidrio 350ml",
      "quantity": 30,
      "unitPrice": 1667,
      "totalPrice": 50000,
      "isBeverage": true,
      "suggestedCategory": "Gaseosas"
    }
  ]
}
`;

  const payload = {
    model: model,
    messages: [
      {
        role: 'system',
        content: systemInstruction
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Extrae con total precisión todos los productos de esta factura/soporte de entrega en formato JSON.'
          },
          {
            type: 'image_url',
            image_url: {
              url: imageBase64Url
            }
          }
        ]
      }
    ],
    temperature: 0.1
  };

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error en MiniMax API (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const rawContent: string = data.choices?.[0]?.message?.content || '';

  // Limpiar posibles etiquetas <think>...</think> o bloques markdown ```json ... ```
  let cleaned = rawContent.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  cleaned = cleaned.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  // Buscar el primer { y último }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error('MiniMax no devolvió un formato JSON reconocible. Respuesta: ' + rawContent);
  }

  const jsonString = cleaned.substring(firstBrace, lastBrace + 1);
  const parsed = JSON.parse(jsonString) as InvoiceScanResult;

  if (!parsed.items || !Array.isArray(parsed.items)) {
    parsed.items = [];
  }

  return parsed;
}
