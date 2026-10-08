export type UserRole = 'ADMIN' | 'EMPLEADO';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  pin: string;
  active: boolean;
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
