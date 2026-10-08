import fs from 'fs';
import path from 'path';
import { Product, Movement, MovementType, User, UserRole } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'inventory.json');

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

function ensureDataFile(): InventoryData {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    const initialData: InventoryData = {
      products: [],
      movements: [],
      users: INITIAL_USERS
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
    return initialData;
  }

  try {
    const content = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(content) as InventoryData;
    if (!parsed.users || !Array.isArray(parsed.users) || parsed.users.length === 0) {
      parsed.users = INITIAL_USERS;
      fs.writeFileSync(DATA_FILE, JSON.stringify(parsed, null, 2), 'utf-8');
    }
    return parsed;
  } catch {
    return { products: [], movements: [], users: INITIAL_USERS };
  }
}

function saveData(data: InventoryData) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// ==========================================
// USUARIOS Y AUTENTICACIÓN
// ==========================================

export function getAllUsers(): Omit<User, 'pin'>[] {
  const data = ensureDataFile();
  return (data.users || INITIAL_USERS).map(({ pin, ...rest }) => rest);
}

export function authenticateUser(userId: string, pin: string): Omit<User, 'pin'> | null {
  const data = ensureDataFile();
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

export function getAllProducts(): Product[] {
  const data = ensureDataFile();
  return data.products;
}

export function getProductById(id: string): Product | undefined {
  const products = getAllProducts();
  return products.find(p => p.id === id);
}

export function saveProduct(
  productData: Omit<Product, 'id' | 'updatedAt'> & { id?: string },
  user?: { id: string; name: string; role: UserRole }
): Product {
  const data = ensureDataFile();
  const now = new Date().toISOString();

  // Si se está editando un producto existente
  if (productData.id) {
    const index = data.products.findIndex(p => p.id === productData.id);
    if (index !== -1) {
      const existing = data.products[index];

      // REGLA DE SEGURIDAD: Solo ADMIN puede modificar directamente el número de stock manual
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
      saveData(data);
      return updated;
    }
  }

  // Si es un producto NUEVO (tanto Admin como Empleado pueden crear referencias nuevas)
  const newProduct: Product = {
    ...productData,
    id: `prod-${Date.now()}`,
    aliases: productData.aliases || [],
    updatedAt: now
  };
  data.products.push(newProduct);

  // Registrar auditoría de creación de nuevo producto
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

  saveData(data);
  return newProduct;
}

export function updateProductStock(
  productId: string,
  delta: number,
  type: MovementType,
  reason: string,
  user?: { id: string; name: string; role: UserRole }
): { product: Product; movement: Movement } {
  // REGLA DE SEGURIDAD:
  // Si es ajuste manual directo o reducción (salida/merma/ajuste) sin factura, SOLO ADMIN puede hacerlo
  if (user && user.role !== 'ADMIN') {
    // Los empleados solo pueden sumar stock mediante factura (ENTRADA con factura)
    if (delta <= 0 || type !== 'ENTRADA') {
      throw new Error('Permiso denegado: Solo el Administrador puede restar o modificar manualmente números de stock.');
    }
  }

  const data = ensureDataFile();
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

  saveData(data);
  return { product, movement };
}

export function deleteProduct(productId: string, user?: { role: UserRole }): boolean {
  if (user && user.role !== 'ADMIN') {
    throw new Error('Permiso denegado: Solo el Administrador puede eliminar productos del stock.');
  }

  const data = ensureDataFile();
  const initialLength = data.products.length;
  data.products = data.products.filter(p => p.id !== productId);
  if (data.products.length !== initialLength) {
    saveData(data);
    return true;
  }
  return false;
}

export function getAllMovements(limit = 100, user?: { role: UserRole }): Movement[] {
  // REGLA: "pero eso solo lo veria admin"
  if (user && user.role !== 'ADMIN') {
    throw new Error('Acceso restringido: Solo el Administrador puede consultar el historial de auditoría.');
  }

  const data = ensureDataFile();
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
