'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Product, Movement, MovementType, User } from '@/lib/types';
import { Navbar, ActiveView } from '@/components/Navbar';
import { StockCard } from '@/components/StockCard';
import { AdjustStockModal } from '@/components/AdjustStockModal';
import { InvoiceScannerModal } from '@/components/InvoiceScannerModal';
import { NewProductModal } from '@/components/NewProductModal';
import { MovementsHistoryModal } from '@/components/MovementsHistoryModal';
import { LoginModal } from '@/components/LoginModal';
import { WaitressOrderView } from '@/components/WaitressOrderView';
import { KitchenOrdersView } from '@/components/KitchenOrdersView';
import { OrdersHistoryView } from '@/components/OrdersHistoryView';
import { MenuManagementModal } from '@/components/MenuManagementModal';
import { 
  Package, AlertTriangle, DollarSign, Boxes, Sparkles, RefreshCw, Layers, ShieldAlert
} from 'lucide-react';

export default function HomePage() {
  // Usuario activo en sesión
  const [currentUser, setCurrentUser] = useState<Omit<User, 'pin'> | null>(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  // Módulo activo: 'WAITRESS' | 'KITCHEN' | 'INVENTORY' | 'HISTORY'
  const [currentView, setCurrentView] = useState<ActiveView>('WAITRESS');

  // Datos de inventario
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Estados de búsqueda y filtros para la sección de inventario
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('TODAS');

  // Estados de Modales
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isNewProductOpen, setIsNewProductOpen] = useState(false);
  const [isMenuManagementOpen, setIsMenuManagementOpen] = useState(false);
  const [productToAdjust, setProductToAdjust] = useState<Product | null>(null);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);

  // Cargar usuario desde localStorage y configurar vista según rol
  useEffect(() => {
    try {
      const saved = localStorage.getItem('inventario_user');
      if (saved) {
        const u = JSON.parse(saved);
        setCurrentUser(u);
        if (u.role === 'COCINA') setCurrentView('KITCHEN');
        else if (u.role === 'EMPLEADO') setCurrentView('INVENTORY');
        else setCurrentView('WAITRESS');
      } else {
        setIsLoginOpen(true);
      }
    } catch {
      setIsLoginOpen(true);
    }
  }, []);

  // Cargar datos de inventario
  const fetchData = async () => {
    try {
      setLoading(true);
      setActionError(null);

      // Cargar productos siempre
      const prodsRes = await fetch('/api/products');
      const prodsData = await prodsRes.json();
      if (prodsData.success) setProducts(prodsData.products);

      // Solo si es ADMIN, cargar historial de movimientos de bodega
      if (currentUser?.role === 'ADMIN') {
        const movsRes = await fetch(`/api/movements?userRole=ADMIN`);
        const movsData = await movsRes.json();
        if (movsData.success) setMovements(movsData.movements);
      } else {
        setMovements([]);
      }
    } catch (err) {
      console.error('Error cargando inventario:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUser]);

  // Categorías únicas de bebidas
  const categories = useMemo(() => {
    const cats = Array.from(new Set(products.map(p => p.category)));
    return cats.filter(Boolean);
  }, [products]);

  // Métricas de inventario
  const totalBottles = useMemo(() => products.reduce((acc, p) => acc + p.stock, 0), [products]);
  const lowStockProducts = useMemo(() => products.filter(p => p.stock <= p.minStock), [products]);
  const totalValueCOP = useMemo(() => products.reduce((acc, p) => acc + (p.stock * p.costPrice), 0), [products]);

  // Productos filtrados
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (selectedCategory === 'BAJO_STOCK') {
        if (p.stock > p.minStock) return false;
      } else if (selectedCategory !== 'TODAS' && p.category !== selectedCategory) {
        return false;
      }

      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(query);
        const matchesCat = p.category.toLowerCase().includes(query);
        const matchesPres = p.presentation.toLowerCase().includes(query);
        const matchesBarcode = p.barcode?.includes(query);
        const matchesAlias = p.aliases?.some(a => a.toLowerCase().includes(query));
        return matchesName || matchesCat || matchesPres || matchesBarcode || matchesAlias;
      }

      return true;
    });
  }, [products, selectedCategory, searchTerm]);

  // Ajuste rápido (+1 / -1) -> Solo ADMIN
  const handleQuickAdjust = async (
    productId: string, 
    delta: number, 
    type: MovementType, 
    reason: string
  ) => {
    if (currentUser?.role !== 'ADMIN') {
      setActionError('Permiso denegado: Solo el Administrador puede modificar directamente el número de stock.');
      return;
    }

    setUpdatingId(productId);
    try {
      const res = await fetch('/api/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, delta, type, reason, user: currentUser })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setActionError(data.error || 'Error al actualizar stock');
      } else {
        setProducts(prev => prev.map(p => p.id === productId ? data.product : p));
        if (data.movement) {
          setMovements(prev => [data.movement, ...prev]);
        }
      }
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  // Ajuste manual completo -> Solo ADMIN
  const handleConfirmAdjust = async (
    productId: string,
    delta: number,
    type: MovementType,
    reason: string
  ) => {
    if (currentUser?.role !== 'ADMIN') {
      setActionError('Permiso denegado: Solo el Administrador puede modificar directamente el stock.');
      setProductToAdjust(null);
      return;
    }

    try {
      const res = await fetch('/api/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          delta,
          type,
          reason,
          user: currentUser
        })
      });
      const data = await res.json();
      if (data.success) {
        setProducts(prev => prev.map(p => p.id === productId ? data.product : p));
        if (data.movement) {
          setMovements(prev => [data.movement, ...prev]);
        }
        setProductToAdjust(null);
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Guardar nueva bebida o editar
  const handleSaveProduct = async (productData: any) => {
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...productData, user: currentUser })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al guardar bebida');
      }

      fetchData();
      setIsNewProductOpen(false);
      setProductToEdit(null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Eliminar bebida -> Solo ADMIN
  const handleDeleteProduct = async (id: string) => {
    if (currentUser?.role !== 'ADMIN') {
      alert('Solo el Administrador tiene permiso para eliminar productos del inventario.');
      return;
    }
    if (!confirm('¿Seguro que deseas eliminar esta bebida del inventario?')) return;
    try {
      const res = await fetch(`/api/products?id=${id}&userRole=${currentUser.role}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al eliminar');
      }
      setProducts(prev => prev.filter(p => p.id !== id));
      setIsNewProductOpen(false);
      setProductToEdit(null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col font-sans">
      {/* Barra de Navegación con Selector de Módulos */}
      <Navbar
        currentView={currentView}
        onSelectView={setCurrentView}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        categories={categories}
        lowStockCount={lowStockProducts.length}
        currentUser={currentUser}
        onOpenScanner={() => setIsScannerOpen(true)}
        onOpenNewProduct={() => {
          setProductToEdit(null);
          setIsNewProductOpen(true);
        }}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenLogin={() => setIsLoginOpen(true)}
        onOpenMenuManagement={() => setIsMenuManagementOpen(true)}
      />

      {/* Alerta de permisos o error si ocurre */}
      {actionError && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 w-full">
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between text-amber-900 text-xs font-bold animate-shake shadow-sm">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button onClick={() => setActionError(null)} className="text-amber-800 hover:underline">
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* CONTENIDO PRINCIPAL SEGÚN EL MÓDULO ACTIVO */}
      <div className="flex-1">
        {/* MÓDULO 1: COMANDAS / VENTAS (MESERAS) */}
        {currentView === 'WAITRESS' && (
          <WaitressOrderView
            currentUser={currentUser}
            products={products}
            onOrderCreated={fetchData}
            onRefreshData={fetchData}
          />
        )}

        {/* MÓDULO 2: COCINA (KDS EN VIVO) */}
        {currentView === 'KITCHEN' && (
          <KitchenOrdersView
            currentUser={currentUser}
            onRefreshData={fetchData}
          />
        )}

        {/* MÓDULO 3: HISTORIAL DIARIO DE VENTAS */}
        {currentView === 'HISTORY' && (
          <OrdersHistoryView
            currentUser={currentUser}
            onRefreshData={fetchData}
          />
        )}

        {/* MÓDULO 4: BODEGA & BEBIDAS (INVENTARIO) */}
        {currentView === 'INVENTORY' && (
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-fade-in">
            {/* Banner de bienvenida y métricas de bodega */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <Boxes className="w-6 h-6 stroke-[2.2]" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Botellas</span>
                  <div className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
                    {totalBottles} <span className="text-xs font-semibold text-slate-500">uds</span>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Package className="w-6 h-6 stroke-[2.2]" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Referencias</span>
                  <div className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
                    {products.length} <span className="text-xs font-semibold text-slate-500">productos</span>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  lowStockProducts.length > 0 ? 'bg-amber-50 text-amber-600 animate-pulse' : 'bg-slate-50 text-slate-400'
                }`}>
                  <AlertTriangle className="w-6 h-6 stroke-[2.2]" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Bajo Stock</span>
                  <div className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
                    {lowStockProducts.length} <span className="text-xs font-semibold text-slate-500">críticos</span>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-700 flex items-center justify-center shrink-0">
                  <DollarSign className="w-6 h-6 stroke-[2.2]" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Valor Costo</span>
                  <div className="text-lg sm:text-xl font-black text-slate-900 leading-tight truncate">
                    ${totalValueCOP.toLocaleString('es-CO')}
                  </div>
                </div>
              </div>
            </div>

            {/* Grid de Bebidas */}
            {loading ? (
              <div className="py-20 text-center">
                <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-xs font-bold text-slate-500">Cargando inventario...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-20 bg-white rounded-3xl border border-slate-200 text-center p-6 space-y-3">
                <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-3xl flex items-center justify-center mx-auto">
                  <Layers className="w-7 h-7" />
                </div>
                <h4 className="text-base font-bold text-slate-800">No se encontraron bebidas</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {searchTerm 
                    ? `No hay productos que coincidan con "${searchTerm}".`
                    : 'No hay productos en esta categoría.'}
                </p>
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="text-xs font-bold text-emerald-600 hover:underline"
                  >
                    Limpiar búsqueda
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredProducts.map((product) => (
                  <StockCard
                    key={product.id}
                    product={product}
                    currentUser={currentUser}
                    onQuickAdjust={handleQuickAdjust}
                    onOpenAdjust={(p) => setProductToAdjust(p)}
                    onEdit={(p) => {
                      setProductToEdit(p);
                      setIsNewProductOpen(true);
                    }}
                    isUpdating={updatingId === product.id}
                  />
                ))}
              </div>
            )}
          </main>
        )}
      </div>

      {/* MODALES DEL SISTEMA */}
      <InvoiceScannerModal
        products={products}
        currentUser={currentUser}
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onSuccess={() => fetchData()}
      />

      <AdjustStockModal
        product={productToAdjust}
        onClose={() => setProductToAdjust(null)}
        onConfirm={handleConfirmAdjust}
      />

      <NewProductModal
        productToEdit={productToEdit}
        currentUser={currentUser}
        isOpen={isNewProductOpen}
        onClose={() => {
          setIsNewProductOpen(false);
          setProductToEdit(null);
        }}
        onSave={handleSaveProduct}
        onDelete={handleDeleteProduct}
      />

      {currentUser?.role === 'ADMIN' && (
        <MovementsHistoryModal
          movements={movements}
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
        />
      )}

      {/* Modal de Gestión de Menú de Platos */}
      <MenuManagementModal
        isOpen={isMenuManagementOpen}
        onClose={() => setIsMenuManagementOpen(false)}
        onMenuUpdated={fetchData}
      />

      {/* Modal de Inicio de Sesión / Cambio de Usuario */}
      <LoginModal
        isOpen={isLoginOpen}
        currentUser={currentUser}
        onClose={currentUser ? () => setIsLoginOpen(false) : undefined}
        onLoginSuccess={(u) => {
          setCurrentUser(u);
          setIsLoginOpen(false);
          if (u.role === 'COCINA') setCurrentView('KITCHEN');
          else if (u.role === 'MESERA') setCurrentView('WAITRESS');
          else if (u.role === 'EMPLEADO') setCurrentView('INVENTORY');
        }}
      />
    </div>
  );
}
