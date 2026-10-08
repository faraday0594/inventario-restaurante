import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { Product, Movement, MovementType, User, UserRole, MenuItem, Order, OrderItem, OrderStatus, OrderType } from './types';

// En entornos serverless como Vercel o AWS Lambda, solo /tmp es escribible
const IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const BUNDLED_FILE = path.join(process.cwd(), 'data', 'inventory.json');
const WRITABLE_DIR = IS_SERVERLESS ? '/tmp' : path.join(process.cwd(), 'data');
const WRITABLE_FILE = path.join(WRITABLE_DIR, 'inventory.json');

export interface InventoryData {
  products: Product[];
  movements: Movement[];
  users: User[];
  menuItems: MenuItem[];
  orders: Order[];
}

export const INITIAL_MENU_ITEMS: MenuItem[] = [
  {
    id: 'dish-1',
    name: 'Almuerzo Ejecutivo del Día',
    category: 'Almuerzos',
    price: 14000,
    description: 'Sopa, principio, carne al gusto, arroz, ensalada y tajada',
    available: true
  },
  {
    id: 'dish-2',
    name: 'Bandeja Paisa Especial',
    category: 'Especiales',
    price: 24000,
    description: 'Frijoles, arroz, carne molida, chicharrón, huevo, chorizo, tajada y aguacate',
    available: true
  },
  {
    id: 'dish-3',
    name: 'Pechuga a la Plancha c/ Papas',
    category: 'Almuerzos',
    price: 18000,
    description: 'Pechuga asada con papas a la francesa, ensalada y arroz',
    available: true
  },
  {
    id: 'dish-4',
    name: 'Carne Asada de Res c/ Patacón',
    category: 'Almuerzos',
    price: 19000,
    description: 'Carne de res asada con patacón, ensalada y arroz',
    available: true
  },
  {
    id: 'dish-5',
    name: 'Sancocho Tradicional c/ Presa',
    category: 'Sopas',
    price: 18000,
    description: 'Sancocho con presa de gallina criolla o carne, arroz y aguacate',
    available: true
  },
  {
    id: 'dish-6',
    name: 'Hamburguesa de la Casa Especial',
    category: 'Comidas Rápidas',
    price: 16000,
    description: 'Carne de res 150g, queso mozzarella, tocineta y papas fritas',
    available: true
  },
  {
    id: 'dish-7',
    name: 'Porción de Papas a la Francesa',
    category: 'Adicionales',
    price: 7000,
    description: 'Papas crocantes con salsa tártara y tomate',
    available: true
  },
  {
    id: 'dish-8',
    name: 'Porción de Patacones con Hogao',
    category: 'Adicionales',
    price: 8000,
    description: 'Patacones de plátano verde con hogao tradicional',
    available: true
  }
];

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
  },
  {
    id: 'user-mesera-1',
    name: 'Laura (Mesera)',
    role: 'MESERA',
    pin: '2222',
    active: true
  },
  {
    id: 'user-mesera-2',
    name: 'Valentina (Mesera)',
    role: 'MESERA',
    pin: '3333',
    active: true
  },
  {
    id: 'user-cocina',
    name: 'Cocina Principal',
    role: 'COCINA',
    pin: '4444',
    active: true
  }
];

let pgPool: Pool | null = null;

function getPgPool(): Pool | null {
  const dbUrl = 
    process.env.POSTGRES_URL || 
    process.env.STORAGE_URL || 
    process.env.STORAGE_POSTGRES_URL || 
    process.env.DATABASE_URL || 
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.STORAGE_URL_NON_POOLING;

  if (!dbUrl) return null;

  if (!pgPool) {
    pgPool = new Pool({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false }
    });
  }
  return pgPool;
}

function normalizeData(data: InventoryData): InventoryData {
  if (!data.users || !Array.isArray(data.users) || data.users.length === 0) {
    data.users = INITIAL_USERS;
  } else {
    for (const initU of INITIAL_USERS) {
      if (!data.users.some(u => u.id === initU.id)) {
        data.users.push(initU);
      }
    }
  }
  if (!data.products || !Array.isArray(data.products)) data.products = [];
  if (!data.movements || !Array.isArray(data.movements)) data.movements = [];
  if (!data.menuItems || !Array.isArray(data.menuItems) || data.menuItems.length === 0) {
    data.menuItems = INITIAL_MENU_ITEMS;
  }
  if (!data.orders || !Array.isArray(data.orders)) data.orders = [];
  return data;
}

function getLocalData(): InventoryData {
  // 1. Intentar leer del archivo modificable (/tmp en Vercel, o data/ en local)
  if (fs.existsSync(WRITABLE_FILE)) {
    try {
      const content = fs.readFileSync(WRITABLE_FILE, 'utf-8');
      const parsed = JSON.parse(content) as InventoryData;
      return normalizeData(parsed);
    } catch (err) {
      console.warn('Error leyendo WRITABLE_FILE:', err);
    }
  }

  // 2. Si no existe en /tmp, leer la copia empaquetada de solo lectura del proyecto
  if (fs.existsSync(BUNDLED_FILE)) {
    try {
      const content = fs.readFileSync(BUNDLED_FILE, 'utf-8');
      const parsed = JSON.parse(content) as InventoryData;
      return normalizeData(parsed);
    } catch (err) {
      console.warn('Error leyendo BUNDLED_FILE:', err);
    }
  }

  return normalizeData({
    products: [],
    movements: [],
    users: INITIAL_USERS,
    menuItems: INITIAL_MENU_ITEMS,
    orders: []
  });
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
        return normalizeData(cloudData);
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

// ==========================================
// MENÚ DE PLATILLOS (COCINA)
// ==========================================

export async function getAllMenuItems(): Promise<MenuItem[]> {
  const data = await ensureData();
  return data.menuItems || INITIAL_MENU_ITEMS;
}

export async function saveMenuItem(
  item: Omit<MenuItem, 'id'> & { id?: string }
): Promise<MenuItem> {
  const data = await ensureData();
  if (item.id) {
    const idx = data.menuItems.findIndex(m => m.id === item.id);
    if (idx !== -1) {
      data.menuItems[idx] = { ...data.menuItems[idx], ...item };
      await saveData(data);
      return data.menuItems[idx];
    }
  }
  const newItem: MenuItem = {
    ...item,
    id: `dish-${Date.now()}`,
    available: item.available !== false
  };
  data.menuItems.push(newItem);
  await saveData(data);
  return newItem;
}

export async function deleteMenuItem(id: string): Promise<boolean> {
  const data = await ensureData();
  const initialLen = data.menuItems.length;
  data.menuItems = data.menuItems.filter(m => m.id !== id);
  if (data.menuItems.length !== initialLen) {
    await saveData(data);
    return true;
  }
  return false;
}

// ==========================================
// COMANDAS Y PEDIDOS (MESERAS & COCINA)
// ==========================================

export async function getAllOrders(filter?: {
  date?: string; // YYYY-MM-DD
  status?: OrderStatus;
  activeOnly?: boolean; // PENDIENTE, EN_PREPARACION, LISTO
  waiterId?: string;
}): Promise<Order[]> {
  const data = await ensureData();
  let orders = data.orders || [];

  if (filter?.activeOnly) {
    orders = orders.filter(o => o.status === 'PENDIENTE' || o.status === 'EN_PREPARACION' || o.status === 'LISTO');
  }

  if (filter?.status) {
    orders = orders.filter(o => o.status === filter.status);
  }

  if (filter?.waiterId) {
    orders = orders.filter(o => o.waiterId === filter.waiterId);
  }

  if (filter?.date) {
    orders = orders.filter(o => o.createdAt.startsWith(filter.date!));
  }

  return orders;
}

export async function createOrder(
  orderInput: {
    type: OrderType;
    tableNumber?: string;
    customerName?: string;
    items: Array<{
      itemType: 'DISH' | 'PRODUCT';
      itemId: string;
      name: string;
      category: string;
      quantity: number;
      unitPrice: number;
      notes?: string;
    }>;
    notes?: string;
  },
  waiter: { id: string; name: string }
): Promise<Order> {
  const data = await ensureData();
  const now = new Date();
  const nowIso = now.toISOString();
  const todayStr = nowIso.slice(0, 10); // YYYY-MM-DD

  // Consecutivo diario: número de pedidos de hoy + 1
  const todayOrders = (data.orders || []).filter(o => o.createdAt.startsWith(todayStr));
  const orderNumber = todayOrders.length + 1;

  let subtotal = 0;
  const processedItems: OrderItem[] = orderInput.items.map((it, idx) => {
    const total = it.quantity * it.unitPrice;
    subtotal += total;
    return {
      id: `item-${Date.now()}-${idx}`,
      itemType: it.itemType,
      itemId: it.itemId,
      name: it.name,
      category: it.category,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      totalPrice: total,
      notes: it.notes?.trim() || undefined
    };
  });

  const newOrder: Order = {
    id: `ord-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    orderNumber,
    type: orderInput.type,
    tableNumber: orderInput.type === 'MESA' ? (orderInput.tableNumber || 'Mesa 1') : undefined,
    customerName: orderInput.customerName?.trim() || undefined,
    items: processedItems,
    status: 'PENDIENTE',
    subtotal,
    total: subtotal,
    notes: orderInput.notes?.trim() || undefined,
    waiterId: waiter.id,
    waiterName: waiter.name,
    createdAt: nowIso,
    updatedAt: nowIso
  };

  // Descuento automático de inventario para bebidas / productos
  for (const item of processedItems) {
    if (item.itemType === 'PRODUCT') {
      const prod = data.products.find(p => p.id === item.itemId);
      if (prod) {
        const prevStock = prod.stock;
        const newStock = Math.max(0, prevStock - item.quantity);
        prod.stock = newStock;
        prod.updatedAt = nowIso;

        // Registrar movimiento de SALIDA
        const mov: Movement = {
          id: `mov-sale-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          productId: prod.id,
          productName: prod.name,
          type: 'SALIDA',
          quantity: item.quantity,
          previousStock: prevStock,
          newStock: newStock,
          reason: `Venta Comanda #${orderNumber} (${newOrder.tableNumber || 'Para llevar'}) - Mesera: ${waiter.name}`,
          userId: waiter.id,
          userName: waiter.name,
          userRole: 'MESERA',
          createdAt: nowIso
        };
        data.movements.unshift(mov);
      }
    }
  }

  data.orders.push(newOrder);
  await saveData(data);
  return newOrder;
}

export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  user?: { id: string; name: string }
): Promise<Order> {
  const data = await ensureData();
  const order = data.orders.find(o => o.id === orderId);
  if (!order) {
    throw new Error('Comanda o pedido no encontrado');
  }

  const nowIso = new Date().toISOString();
  order.status = newStatus;
  order.updatedAt = nowIso;

  if (newStatus === 'EN_PREPARACION' && !order.preparedAt) {
    order.preparedAt = nowIso;
  } else if ((newStatus === 'LISTO' || newStatus === 'ENTREGADO') && !order.deliveredAt) {
    order.deliveredAt = nowIso;
  }

  // Si se cancela una orden, revertir stock de productos que se habían descontado
  if (newStatus === 'CANCELADO') {
    for (const item of order.items) {
      if (item.itemType === 'PRODUCT') {
        const prod = data.products.find(p => p.id === item.itemId);
        if (prod) {
          const prevStock = prod.stock;
          const restoredStock = prevStock + item.quantity;
          prod.stock = restoredStock;
          prod.updatedAt = nowIso;

          const mov: Movement = {
            id: `mov-rev-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
            productId: prod.id,
            productName: prod.name,
            type: 'ENTRADA',
            quantity: item.quantity,
            previousStock: prevStock,
            newStock: restoredStock,
            reason: `Reversión por cancelación de Comanda #${order.orderNumber}`,
            userId: user?.id,
            userName: user?.name,
            createdAt: nowIso
          };
          data.movements.unshift(mov);
        }
      }
    }
  }

  await saveData(data);
  return order;
}

export async function getDailyOrdersSummary(dateStr?: string): Promise<{
  date: string;
  totalOrders: number;
  pendingOrders: number;
  preparingOrders: number;
  readyOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  totalRevenue: number;
  waiterStats: Array<{ waiterName: string; orderCount: number; totalSales: number }>;
}> {
  const data = await ensureData();
  const targetDate = dateStr || new Date().toISOString().slice(0, 10);
  const dayOrders = (data.orders || []).filter(o => o.createdAt.startsWith(targetDate));

  let totalRevenue = 0;
  let pendingOrders = 0;
  let preparingOrders = 0;
  let readyOrders = 0;
  let deliveredOrders = 0;
  let cancelledOrders = 0;

  const waiterMap: { [name: string]: { count: number; sales: number } } = {};

  for (const o of dayOrders) {
    if (o.status === 'PENDIENTE') pendingOrders++;
    else if (o.status === 'EN_PREPARACION') preparingOrders++;
    else if (o.status === 'LISTO') readyOrders++;
    else if (o.status === 'ENTREGADO') deliveredOrders++;
    else if (o.status === 'CANCELADO') cancelledOrders++;

    if (o.status !== 'CANCELADO') {
      totalRevenue += o.total;
      const wName = o.waiterName || 'Mesera General';
      if (!waiterMap[wName]) waiterMap[wName] = { count: 0, sales: 0 };
      waiterMap[wName].count++;
      waiterMap[wName].sales += o.total;
    }
  }

  const waiterStats = Object.entries(waiterMap).map(([waiterName, st]) => ({
    waiterName,
    orderCount: st.count,
    totalSales: st.sales
  }));

  return {
    date: targetDate,
    totalOrders: dayOrders.length,
    pendingOrders,
    preparingOrders,
    readyOrders,
    deliveredOrders,
    cancelledOrders,
    totalRevenue,
    waiterStats
  };
}
