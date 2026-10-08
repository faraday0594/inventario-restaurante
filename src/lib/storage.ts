import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { Product, Movement, MovementType, User, UserRole } from './types';

// En entornos serverless como Vercel o AWS Lambda, solo /tmp es escribible
const IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const BUNDLED_FILE = path.join(process.cwd(), 'data', 'inventory.json');
const WRITABLE_DIR = IS_SERVERLESS ? '/tmp' : path.join(process.cwd(), 'data');
const WRITABLE_FILE = path.join(WRITABLE_DIR, 'inventory.json');

export interface InventoryData {
  products: Product[];
  movements: Movement[];
  users: User[];
}

export const INITIAL_USERS: User[] = [
  {
    id: 'user-admin',
    name: 'Administrador / Dueño',
    role: 'ADMIN',
    pin: '9999',
    active: true
  },
  {
    id: 'user-emp-1',
    name: 'Carlos (Bodega)',
    role: 'EMPLEADO',
    pin: '1234',
    active: true
  },
  {
    id: 'user-emp-2',
    name: 'Ana (Turno Barra)',
    role: 'EMPLEADO',
    pin: '5678',
    active: true
  }
];

let pgPool: Pool | null = null;

function getPgPool(): Pool | null {
  const dbUrl = 
    process.env.POSTGRES_URL || 
    process.env.DATABASE_URL || 
    process.env.POSTGRES_URL_NON_POOLING;

  if (!dbUrl) return null;

  if (!pgPool) {
    pgPool = new Pool({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false }
    });
  }
  return pgPool;
}

function getLocalData(): InventoryData {
  // 1. Intentar leer del archivo modificable (/tmp en Vercel, o data/ en local)
  if (fs.existsSync(WRITABLE_FILE)) {
    try {
      const content = fs.readFileSync(WRITABLE_FILE, 'utf-8');
      const parsed = JSON.parse(content) as InventoryData;
      if (!parsed.users || !Array.isArray(parsed.users) || parsed.users.length === 0) {
        parsed.users = INITIAL_USERS;
      }
      return parsed;
    } catch (err) {
      console.warn('Error leyendo WRITABLE_FILE:', err);
    }
  }

  // 2. Si no existe en /tmp, leer la copia empaquetada de solo lectura del proyecto
  if (fs.existsSync(BUNDLED_FILE)) {
    try {
      const content = fs.readFileSync(BUNDLED_FILE, 'utf-8');
      const parsed = JSON.parse(content) as InventoryData;
      if (!parsed.users || !Array.isArray(parsed.users) || parsed.users.length === 0) {
        parsed.users = INITIAL_USERS;
      }
      return parsed;
    } catch (err) {
      console.warn('Error leyendo BUNDLED_FILE:', err);
    }
  }

  return {
    products: [],
    movements: [],
    users: INITIAL_USERS
  };
}

function saveLocalData(data: InventoryData) {
  try {
    if (!fs.existsSync(WRITABLE_DIR)) {
      fs.mkdirSync(WRITABLE_DIR, { recursive: true });
    }
    fs.writeFileSync(WRITABLE_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error escribiendo en WRITABLE_FILE:', err);
  }
}

async function ensureData(): Promise<InventoryData> {
  const pool = getPgPool();
  if (pool) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS inventory_data (
          id VARCHAR(50) PRIMARY KEY,
          data JSONB NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      const res = await pool.query(`SELECT data FROM inventory_data WHERE id = 'main' LIMIT 1;`);
      if (res.rows.length > 0) {
        const cloudData = res.rows[0].data as InventoryData;
        if (!cloudData.users || cloudData.users.length === 0) {
          cloudData.users = INITIAL_USERS;
        }
        return cloudData;
      }

      // Si la tabla en la nube está vacía, sembrar con los datos actuales
      const localData = getLocalData();
      await pool.query(
        `INSERT INTO inventory_data (id, data) VALUES ('main', $1) ON CONFLICT (id) DO NOTHING;`,
        [JSON.stringify(localData)]
      );
      return localData;
    } catch (err) {
      console.error('Error conectando a PostgreSQL en la nube, usando almacenamiento seguro temporal:', err);
    }
  }

  return getLocalData();
}

async function saveData(data: InventoryData): Promise<void> {
  const pool = getPgPool();
  if (pool) {
    try {
      await pool.query(`
        INSERT INTO inventory_data (id, data, updated_at)
        VALUES ('main', $1, NOW())
        ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();
      `, [JSON.stringify(data)]);
      return;
    } catch (err) {
      console.error('Error guardando en PostgreSQL:', err);
    }
  }

  // En Vercel sin DB, guarda en /tmp sin arrojar EROFS
  saveLocalData(data);
}

// ==========================================
// USUARIOS Y AUTENTICACIÓN
// ==========================================

export async function getAllUsers(): Promise<Omit<User, 'pin'>[]> {
  const data = await ensureData();
  return (data.users || INITIAL_USERS).map(({ pin, ...rest }) => rest);
}

export async function authenticateUser(userId: string, pin: string): Promise<Omit<User, 'pin'> | null> {
  const data = await ensureData();
  const users = data.users || INITIAL_USERS;
  const user = users.find(u => u.id === userId && u.active);
  if (user && user.pin === pin) {
    const { pin: _, ...safeUser } = user;
    return safeUser;
  }
  return null;
}

// ==========================================
// PRODUCTOS
// ==========================================

export async function getAllProducts(): Promise<Product[]> {
  const data = await ensureData();
  return data.products;
}

export async function getProductById(id: string): Promise<Product | undefined> {
  const products = await getAllProducts();
  return products.find(p => p.id === id);
}

export async function saveProduct(
  productData: Omit<Product, 'id' | 'updatedAt'> & { id?: string },
  user?: { id: string; name: string; role: UserRole }
): Promise<Product> {
  const data = await ensureData();
  const now = new Date().toISOString();

  if (productData.id) {
    const index = data.products.findIndex(p => p.id === productData.id);
    if (index !== -1) {
      const existing = data.products[index];

      let targetStock = existing.stock;
      if (typeof productData.stock === 'number') {
        if (user && user.role !== 'ADMIN' && productData.stock !== existing.stock) {
          throw new Error('Solo el Administrador puede modificar directamente el número de stock de un producto.');
        }
        targetStock = productData.stock;
      }

      const updated: Product = {
        ...existing,
        ...productData,
        stock: targetStock,
        id: productData.id,
        aliases: Array.from(new Set([...existing.aliases, ...(productData.aliases || [])])),
        updatedAt: now
      };
      data.products[index] = updated;
      await saveData(data);
      return updated;
    }
  }

  const newProduct: Product = {
    ...productData,
    id: `prod-${Date.now()}`,
    aliases: productData.aliases || [],
    updatedAt: now
  };
  data.products.push(newProduct);

  if (user) {
    const creationMovement: Movement = {
      id: `mov-new-${Date.now()}`,
      productId: newProduct.id,
      productName: newProduct.name,
      type: 'ENTRADA',
      quantity: newProduct.stock,
      previousStock: 0,
      newStock: newProduct.stock,
      reason: `Nueva referencia creada por ${user.name} (${user.role})`,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      createdAt: now
    };
    data.movements.unshift(creationMovement);
  }

  await saveData(data);
  return newProduct;
}

export async function updateProductStock(
  productId: string,
  delta: number,
  type: MovementType,
  reason: string,
  user?: { id: string; name: string; role: UserRole }
): Promise<{ product: Product; movement: Movement }> {
  if (user && user.role !== 'ADMIN') {
    if (delta <= 0 || type !== 'ENTRADA') {
      throw new Error('Permiso denegado: Solo el Administrador puede restar o modificar manualmente números de stock.');
    }
  }

  const data = await ensureData();
  const product = data.products.find(p => p.id === productId);

  if (!product) {
    throw new Error(`Producto con ID ${productId} no encontrado`);
  }

  const previousStock = product.stock;
  const newStock = Math.max(0, previousStock + delta);
  product.stock = newStock;
  product.updatedAt = new Date().toISOString();

  const movement: Movement = {
    id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    productId: product.id,
    productName: product.name,
    type,
    quantity: Math.abs(delta),
    previousStock,
    newStock,
    reason: reason || `Movimiento de ${type}`,
    userId: user?.id,
    userName: user?.name || 'Sistema',
    userRole: user?.role || 'ADMIN',
    createdAt: new Date().toISOString()
  };

  data.movements.unshift(movement);
  if (data.movements.length > 500) {
    data.movements = data.movements.slice(0, 500);
  }

  await saveData(data);
  return { product, movement };
}

export async function deleteProduct(productId: string, user?: { role: UserRole }): Promise<boolean> {
  if (user && user.role !== 'ADMIN') {
    throw new Error('Permiso denegado: Solo el Administrador puede eliminar productos del stock.');
  }

  const data = await ensureData();
  const initialLength = data.products.length;
  data.products = data.products.filter(p => p.id !== productId);
  if (data.products.length !== initialLength) {
    await saveData(data);
    return true;
  }
  return false;
}

export async function getAllMovements(limit = 100, user?: { role: UserRole }): Promise<Movement[]> {
  if (user && user.role !== 'ADMIN') {
    throw new Error('Acceso restringido: Solo el Administrador puede consultar el historial de auditoría.');
  }

  const data = await ensureData();
  return data.movements.slice(0, limit);
}

// ==========================================
// EMPAREJAMIENTO INTELIGENTE
// ==========================================

function extractVolume(text: string): string | null {
  const lower = text.toLowerCase();
  if (lower.match(/1\.5\s*(l|lt|litro)/)) return '1.5l';
  if (lower.match(/2\s*(l|lt|litro)/)) return '2l';
  if (lower.match(/2\.5\s*(l|lt|litro)/)) return '2.5l';
  if (lower.match(/3\s*(l|lt|litro)/)) return '3l';
  if (lower.match(/600\s*(ml|cc)/)) return '600ml';
  if (lower.match(/500\s*(ml|cc)/)) return '500ml';
  if (lower.match(/400\s*(ml|cc)/)) return '400ml';
  if (lower.match(/355\s*(ml|cc)/)) return '355ml';
  if (lower.match(/350\s*(ml|cc)/)) return '350ml';
  if (lower.match(/330\s*(ml|cc)/)) return '330ml';
  if (lower.match(/250\s*(ml|cc)/)) return '250ml';
  return null;
}

function extractPackaging(text: string): 'VIDRIO' | 'PET' | 'LATA' | null {
  const lower = text.toLowerCase();
  if (lower.includes('vir') || lower.includes('vidrio') || lower.includes('ret')) return 'VIDRIO';
  if (lower.includes('pet') || lower.includes('plastico')) return 'PET';
  if (lower.includes('lata')) return 'LATA';
  return null;
}

export function matchProduct(rawName: string, products: Product[]): { product: Product | null; confidence: number } {
  const cleanRaw = rawName.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
  const rawTokens = cleanRaw.split(/\s+/).filter(t => t.length > 1);
  const rawVol = extractVolume(rawName);
  const rawPack = extractPackaging(rawName);

  let bestProduct: Product | null = null;
  let bestScore = 0;

  for (const prod of products) {
    const prodTarget = `${prod.name} ${prod.presentation}`.toLowerCase();
    const prodVol = extractVolume(prodTarget);
    const prodPack = extractPackaging(prodTarget);

    if (rawVol && prodVol && rawVol !== prodVol) continue;
    if (rawPack && prodPack && rawPack !== prodPack) continue;

    if (cleanRaw.includes('brisa') && prodTarget.includes('cristal')) continue;
    if (cleanRaw.includes('cristal') && prodTarget.includes('brisa')) continue;
    if (cleanRaw.includes('quatro') && !prodTarget.includes('quatro')) continue;
    if (cleanRaw.includes('colombiana') && prodTarget.includes('manzana')) continue;
    if (cleanRaw.includes('manzana') && prodTarget.includes('colombiana')) continue;

    for (const alias of prod.aliases || []) {
      const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
      if (cleanRaw === cleanAlias) {
        return { product: prod, confidence: 0.98 };
      }
    }

    const prodTokens = prodTarget.replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(t => t.length > 1);
    let matchCount = 0;
    for (const token of rawTokens) {
      if (prodTokens.some(pt => pt === token || (token.length > 3 && pt.includes(token)))) {
        matchCount++;
      }
    }

    const score = rawTokens.length > 0 ? matchCount / rawTokens.length : 0;
    if (score > bestScore) {
      bestScore = score;
      bestProduct = prod;
    }
  }

  if (bestScore >= 0.50 && bestProduct) {
    return { product: bestProduct, confidence: Math.min(0.95, bestScore) };
  }

  return { product: null, confidence: 0 };
}
