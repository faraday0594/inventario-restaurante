export type UserRole = 'ADMIN' | 'EMPLEADO' | 'MESERA' | 'COCINA';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  pin: string;
  active: boolean;
}

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  description?: string;
  available: boolean;
}

export type OrderType = 'MESA' | 'PARA_LLEVAR' | 'DOMICILIO';
export type OrderStatus = 'PENDIENTE' | 'EN_PREPARACION' | 'LISTO' | 'ENTREGADO' | 'CANCELADO';

export interface OrderItem {
  id: string;
  itemType: 'DISH' | 'PRODUCT'; // Platillo de cocina o bebida de inventario
  itemId: string;
  name: string;
  category: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
}

export interface Order {
  id: string;
  orderNumber: number; // Consecutivo diario: #1, #2...
  type: OrderType;
  tableNumber?: string;
  subAccount?: string; // Ej: 'Cuenta 1', 'Cuenta 2', o nombre del comensal
  customerName?: string;
  items: OrderItem[];
  status: OrderStatus;
  subtotal: number;
  total: number;
  notes?: string;
  waiterId: string;
  waiterName: string;
  createdAt: string;
  updatedAt: string;
  preparedAt?: string;
  deliveredAt?: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  presentation: string;
  stock: number;
  minStock: number;
  costPrice: number;
  salePrice: number;
  barcode?: string;
  aliases: string[];
  updatedAt: string;
}

export type MovementType = 'ENTRADA' | 'SALIDA' | 'MERMA' | 'AJUSTE';

export interface Movement {
  id: string;
  productId: string;
  productName: string;
  type: MovementType;
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
  userId?: string;
  userName?: string;
  userRole?: UserRole;
  createdAt: string;
}

export interface InvoiceExtractedItem {
  rawName: string;
  cleanName?: string;
  presentation?: string;
  quantity: number;
  unitPrice?: number;
  totalPrice?: number;
  matchedProductId?: string | null;
  confidence?: number;
  isNew?: boolean;
  isBeverage?: boolean;
  suggestedCategory?: string;
}

export interface InvoiceScanResult {
  supplier?: string;
  invoiceNumber?: string;
  date?: string;
  items: InvoiceExtractedItem[];
}
