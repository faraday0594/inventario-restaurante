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

export interface ReconcileDecision {
  rawName: string;
  matchedProductId: string | null;
  confidence: number;
  isNew: boolean;
  suggestedNameUpdate?: string | null; // Nombre técnico/estandarizado si el producto existente tenía un nombre informal o desactualizado
  reason?: string;
}

/**
 * Utiliza IA MiniMax para comparar inteligentemente los ítems de la factura
 * con los productos existentes en el catálogo del restaurante.
 * Si encuentra un producto equivalente que fue creado con un nombre informal o diferente
 * (ejemplo: "agua litro crystal" vs "Agua Cristal PET 1000ml"),
 * empareja el producto y propone corregir el nombre en lugar de duplicarlo.
 */
export async function reconcileProductsWithAI(
  extractedItems: { rawName: string; cleanName?: string; presentation?: string }[],
  existingProducts: { id: string; name: string; presentation: string; category: string; aliases: string[] }[]
): Promise<Record<string, ReconcileDecision>> {
  if (!extractedItems.length || !existingProducts.length) {
    return {};
  }

  const apiKey = process.env.MINIMAX_API_KEY;
  const baseUrl = process.env.MINIMAX_BASE_URL || 'https://api.minimax.io/v1';
  const model = process.env.MINIMAX_MODEL || 'MiniMax-M3';

  if (!apiKey) return {};

  const prompt = `
Eres un experto en inventarios y auditoría de restaurantes y bares.
Tu misión es EMPAREJAR los productos que vienen en una factura con los productos que el restaurante YA TIENE registrados en su bodega, y DETECTAR si el restaurante le había puesto un nombre informal o incompleto para CORREGIRLO con el nombre técnico/oficial de la factura.

REGLA CLAVE:
Si el usuario creó un producto llamado por ejemplo "agua litro crystal" o "coca cola grande", y en la factura viene "AGUA CRISTAL PET 1000ML" o "Agua Cristal 1000ml":
- NO crees un producto nuevo.
- Empareja con el producto existente ("agua litro crystal").
- Sugiere en 'suggestedNameUpdate' el nombre mejorado y técnico (ej: "Agua Cristal PET 1000ml" o "Agua Cristal 1L").
- De esta manera se corrige el nombre en el inventario en lugar de crear un producto duplicado.

Lista de productos en bodega actualmente:
${JSON.stringify(existingProducts.map(p => ({ id: p.id, name: p.name, presentation: p.presentation, aliases: p.aliases })), null, 2)}

Lista de productos leídos de la factura:
${JSON.stringify(extractedItems.map(it => ({ rawName: it.rawName, cleanName: it.cleanName, presentation: it.presentation })), null, 2)}

Devuelve ÚNICAMENTE un JSON con este formato:
{
  "matches": [
    {
      "rawName": "nombre exacto en factura",
      "matchedProductId": "id_del_producto_en_bodega" o null si es realmente nuevo,
      "confidence": 0.95,
      "isNew": false,
      "suggestedNameUpdate": "Nombre técnico corregido si amerita cambiar el nombre actual en bodega, o null si no se debe cambiar",
      "reason": "Explicación breve de por qué corresponde a este producto"
    }
  ]
}
`;

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: 'Eres un sistema experto en cotejo de inventarios de restaurantes. Responde solo JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1
      })
    });

    if (!response.ok) return {};

    const data = await response.json();
    const rawContent: string = data.choices?.[0]?.message?.content || '';
    let cleaned = rawContent.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    cleaned = cleaned.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1) return {};

    const parsed = JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
    const result: Record<string, ReconcileDecision> = {};

    if (Array.isArray(parsed.matches)) {
      for (const m of parsed.matches) {
        if (m.rawName) {
          result[m.rawName] = {
            rawName: m.rawName,
            matchedProductId: m.matchedProductId || null,
            confidence: typeof m.confidence === 'number' ? m.confidence : 0.9,
            isNew: !m.matchedProductId,
            suggestedNameUpdate: m.suggestedNameUpdate || null,
            reason: m.reason || ''
          };
        }
      }
    }
    return result;
  } catch (err) {
    console.warn('Error en reconciliación semántica con IA:', err);
    return {};
  }
}

/**
 * Analiza la foto de una lista de precios, menú, carta de bebidas, pizarra o listado
 * manuscrito donde están los nombres de los productos y su precio al frente.
 * Extrae cada producto, su precio de venta, presentación y categoría sugerida.
 */
export async function parsePriceListWithMiniMax(imageBase64Url: string): Promise<import('./types').PriceListScanResult> {
  const apiKey = process.env.MINIMAX_API_KEY;
  const baseUrl = process.env.MINIMAX_BASE_URL || 'https://api.minimax.io/v1';
  const model = process.env.MINIMAX_MODEL || 'MiniMax-M3';

  if (!apiKey) {
    throw new Error('MINIMAX_API_KEY no está configurada en el archivo de entorno.');
  }

  const systemInstruction = `
Eres un asistente de digitalización de inventarios y precios para restaurantes, bares y cafeterías en Colombia y Latinoamérica.
Tu tarea es leer la foto de un LISTADO DE PRODUCTOS CON PRECIOS (puede ser una carta de precios, menú, pizarra, lista escrita a mano o catálogo de bebidas/productos).
En el documento hay productos con su PRECIO DE VENTA al frente (por ejemplo: "Agua Cristal 600ml ... $3.000", "Coca-Cola 400ml - 5000", "Corona 8.000", etc.).

REGLAS DE EXTRACCIÓN:
1. Extrae CADA producto visible con el precio que tiene asignado.
2. Limpieza de Precios (salePrice):
   - Conviértelo siempre a número entero en pesos (COP).
   - "$3.000" -> 3000
   - "4.500" o "4,500" -> 4500
   - "5k" o "5 mil" -> 5000
   - Si no tiene precio visible, pon 0.
3. Genera un nombre comercial limpio (cleanName) y presentación (presentation):
   - Ej: "Agua Cristal 600ml" -> cleanName: "Agua Cristal 600ml", presentation: "Botella PET 600ml"
   - Ej: "Corona" -> cleanName: "Cerveza Corona Extra", presentation: "Botella 355ml"
   - Ej: "Coca Cola Pet 400" -> cleanName: "Coca-Cola Original 400ml", presentation: "Botella PET 400ml"
4. Asigna la categoría correcta:
   - "Gaseosas", "Cervezas", "Aguas", "Jugos y Té", "Energizantes", "Licores", "Snacks y Golosinas", o "Comidas y Platos".
5. Calcula un costo estimado sugerido (costPrice) como el 60% del precio de venta (Math.round(salePrice * 0.6)).
6. Identifica isBeverage: true para bebidas, false para comidas/snacks.

Responde ÚNICAMENTE un objeto JSON válido con este formato exacto:
{
  "title": "Lista de Precios Restaurante",
  "date": "2026-10-16",
  "items": [
    {
      "rawName": "Agua Cristal 600ml $3.000",
      "cleanName": "Agua Cristal Sin Gas 600ml",
      "presentation": "Botella PET 600ml",
      "category": "Aguas",
      "salePrice": 3000,
      "costPrice": 1800,
      "isBeverage": true
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
            text: 'Lee atentamente todos los productos de este listado con su respectivo precio al frente y devuélvelos en formato JSON.'
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

  let cleaned = rawContent.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  cleaned = cleaned.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error('MiniMax no devolvió un formato JSON válido. Respuesta: ' + rawContent);
  }

  const jsonString = cleaned.substring(firstBrace, lastBrace + 1);
  const parsed = JSON.parse(jsonString) as import('./types').PriceListScanResult;

  if (!parsed.items || !Array.isArray(parsed.items)) {
    parsed.items = [];
  }

  return parsed;
}



export interface BeverageAuditInput {
  id: string;
  name: string;
  category: string;
  presentation: string;
  costPrice: number;
  salePrice: number;
  aliases: string[];
}

export interface BeverageAuditSuggestion {
  productId: string;
  suggestedName: string;
  suggestedPresentation: string;
  suggestedCostPrice: number;
  suggestedAliases: string[];
  reason: string;
}

/**
 * Analiza el catálogo de bebidas de bodega con MiniMax para estandarizar
 * sus nombres técnicos, presentaciones, alias y estimar costos de fábrica/mayorista
 * de referencia en Colombia, SIN modificar stock ni precios de venta.
 */
export async function auditBeveragesWithMiniMax(
  products: BeverageAuditInput[]
): Promise<BeverageAuditSuggestion[]> {
  if (!products.length) return [];

  const apiKey = process.env.MINIMAX_API_KEY;
  const baseUrl = process.env.MINIMAX_BASE_URL || 'https://api.minimax.io/v1';
  const model = process.env.MINIMAX_MODEL || 'MiniMax-M3';

  if (!apiKey) {
    throw new Error('MINIMAX_API_KEY no está configurada en el archivo de entorno.');
  }

  const batchSize = 25;
  const allSuggestions: BeverageAuditSuggestion[] = [];

  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);

    const systemInstruction = `
Eres un auditor experto en compras, costos y catálogos de bebidas para restaurantes y bares en Colombia.
Recibirás una lista de productos de bebidas actualmente en bodega.

Tu tarea para CADA producto es:
1. Generar un "suggestedName": nombre técnico y comercial estandarizado (marca + variedad + volumen exacto).
   Ejemplos:
   - "coca grande" -> "Coca-Cola Original 1.5L"
   - "aguila light" -> "Cerveza Águila Light 330ml"
   - "agua cristal" -> "Agua Cristal Sin Gas 600ml"
2. Generar "suggestedPresentation": presentación técnica clara (ej: "Botella PET 400ml", "Botella Vidrio 350ml", "Lata 330ml", "Botella PET 1.5L").
3. Estimar "suggestedCostPrice": costo unitario aproximado de fábrica / distribuidor mayorista en Colombia en pesos colombianos (COP, número entero).
   - Toma en cuenta el mercado colombiano actual (Coca-Cola FEMSA, Postobón, Bavaria, etc.) y como referencia secundaria que el precio de venta del restaurante suele estar por encima del costo.
   - Si no estás seguro de un producto poco común, usa una estimación prudente sin inventar cifras absurdas.
4. Generar "suggestedAliases": 2 a 3 alias cortos como suelen aparecer en facturas de proveedores (ej: ["CC PET 400", "COCA COLA 400ML"]).
5. Incluir "reason": explicación muy breve (máximo 12 palabras) del ajuste sugerido.

REGLA ESTRICTA:
- Devuelve exactamente el "productId" de entrada para cada producto.
- NO sugieras cambios de stock ni de precio de venta.
- Responde ÚNICAMENTE un JSON válido con este formato:
{
  "suggestions": [
    {
      "productId": "id_exacto",
      "suggestedName": "Nombre Técnico Estándar",
      "suggestedPresentation": "Botella PET 400ml",
      "suggestedCostPrice": 2200,
      "suggestedAliases": ["ALIAS 1", "ALIAS 2"],
      "reason": "Nombre estandarizado y costo mayorista de referencia"
    }
  ]
}
`;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemInstruction },
          {
            role: 'user',
            content: `Analiza estas bebidas de bodega y devuelve las sugerencias en JSON:\n${JSON.stringify(
              batch.map(p => ({
                id: p.id,
                name: p.name,
                category: p.category,
                presentation: p.presentation,
                currentCostPrice: p.costPrice,
                restaurantSalePrice: p.salePrice,
                aliases: p.aliases
              }))
            )}`
          }
        ],
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error en MiniMax API (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const rawContent: string = data.choices?.[0]?.message?.content || '';
    let cleaned = rawContent.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    cleaned = cleaned.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1) {
      throw new Error('MiniMax no devolvió un JSON válido al auditar las bebidas.');
    }

    const parsed = JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
    if (Array.isArray(parsed.suggestions)) {
      for (const s of parsed.suggestions) {
        if (s.productId) {
          allSuggestions.push({
            productId: String(s.productId),
            suggestedName: String(s.suggestedName || '').trim(),
            suggestedPresentation: String(s.suggestedPresentation || '').trim(),
            suggestedCostPrice: Math.max(0, Math.round(Number(s.suggestedCostPrice) || 0)),
            suggestedAliases: Array.isArray(s.suggestedAliases)
              ? s.suggestedAliases.map((a: unknown) => String(a).trim()).filter(Boolean)
              : [],
            reason: String(s.reason || '').trim()
          });
        }
      }
    }
  }

  return allSuggestions;
}
