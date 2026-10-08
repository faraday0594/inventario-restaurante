'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Product, Movement, MovementType, User } from '@/lib/types';
import { Navbar } from '@/components/Navbar';
import { StockCard } from '@/components/StockCard';
import { AdjustStockModal } from '@/components/AdjustStockModal';
import { InvoiceScannerModal } from '@/components/InvoiceScannerModal';
import { NewProductModal } from '@/components/NewProductModal';
import { MovementsHistoryModal } from '@/components/MovementsHistoryModal';
import { LoginModal } from '@/components/LoginModal';
import { 
  Package, AlertTriangle, DollarSign, Boxes, Sparkles, RefreshCw, Layers, ShieldAlert
} from 'lucide-react';

export default function HomePage() {
  // Usuario activo en sesión
  const [currentUser, setCurrentUser] = useState<Omit<User, 'pin'> | null>(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Estados de búsqueda y filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('TODAS');

  // Estados de Modales
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isNewProductOpen, setIsNewProductOpen] = useState(false);
  const [productToAdjust, setProductToAdjust] = useState<Product | null>(null);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);

  // Cargar usuario desde localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('inventario_user');
      if (saved) {
        setCurrentUser(JSON.parse(saved));
      } else {
        // Por defecto abrir modal para identificarse o iniciar como Admin
        setIsLoginOpen(true);
      }
    } catch {
      setIsLoginOpen(true);
    }
  }, []);

  // Cargar datos
  const fetchData = async () => {
    try {
      setLoading(true);
      setActionError(null);

      // Cargar productos siempre
      const prodsRes = await fetch('/api/products');
      const prodsData = await prodsRes.json();
      if (prodsData.success) setProducts(prodsData.products);

      // Solo si es ADMIN, cargar historial de movimientos
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

  // Categorías únicas
  const categories = useMemo(() => {
    const cats = Array.from(new Set(products.map(p => p.category)));
    return cats.filter(Boolean);
  }, [products]);

  // Métricas
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

  // Ajuste manual completo desde modal -> Solo ADMIN
  const handleConfirmAdjust = async (
    productId: string,
    delta: number,
    type: MovementType,
    reason: string
  ) => {
    if (currentUser?.role !== 'ADMIN') {
      setActionError('Permiso denegado: Solo el Administrador puede modificar directamente el número de stock.');
      return;
    }

    const res = await fetch('/api/products', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, delta, type, reason, user: currentUser })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      setActionError(data.error || 'Error al ajustar stock');
    } else {
      setProducts(prev => prev.map(p => p.id === productId ? data.product : p));
      if (data.movement) {
        setMovements(prev => [data.movement, ...prev]);
      }
    }
  };

  // Guardar / Actualizar producto (Admin o Empleado con registro de auditoría)
  const handleSaveProduct = async (productData: any) => {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...productData, user: currentUser })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      setActionError(data.error || 'Error al guardar producto');
    } else {
      fetchData();
    }
  };

  // Eliminar producto -> Solo ADMIN
  const handleDeleteProduct = async (id: string) => {
    if (currentUser?.role !== 'ADMIN') {
      setActionError('Permiso denegado: Solo el Administrador puede eliminar referencias.');
      return;
    }

    const res = await fetch(`/api/products?id=${id}&userRole=${currentUser.role}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      setProducts(prev => prev.filter(p => p.id !== id));
    } else {
      setActionError(data.error || 'No se pudo eliminar el producto');
    }
  };

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-20">
      {/* Barra de navegación con usuario activo */}
      <Navbar
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
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 w-full flex-1">
        {/* Banner de alerta si hubo error de permisos */}
        {actionError && (
          <div className="mb-4 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button
              onClick={() => setActionError(null)}
              className="text-rose-600 hover:text-rose-900 underline text-xs ml-3"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* Banner de Bienvenida y Atajo IA */}
        <div className="mb-6 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 p-5 sm:p-6 text-white shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-500/20 via-transparent to-transparent pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold mb-2">
                <Sparkles className="w-3.5 h-3.5" /> 
                Operando como: {currentUser ? `${currentUser.name} (${currentUser.role})` : 'Sin sesión'}
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                Control de Bodega en Tiempo Real
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 font-medium max-w-xl mt-1">
                {currentUser?.role === 'ADMIN'
                  ? 'Modo Administrador: Tienes control total de stock, precios, auditoría y eliminación de referencias.'
                  : 'Modo Empleado: Puedes escanear facturas para sumar stock entrante y agregar nuevos productos. El stock guardado está protegido.'}
              </p>
            </div>

            <button
              onClick={() => setIsScannerOpen(true)}
              className="w-full md:w-auto px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all active:scale-95"
            >
              <span>📷 Escanear Factura Hoy</span>
            </button>
          </div>
        </div>

        {/* Tarjetas de Métricas Resumen */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Boxes className="w-6 h-6 stroke-[1.8]" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-black block">Total Botellas</span>
              <span className="text-xl sm:text-2xl font-black text-slate-900">{totalBottles}</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
              lowStockProducts.length > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-400'
            }`}>
              <AlertTriangle className="w-6 h-6 stroke-[1.8]" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-black block">Stock Bajo / Pedir</span>
              <span className={`text-xl sm:text-2xl font-black ${
                lowStockProducts.length > 0 ? 'text-amber-600' : 'text-slate-900'
              }`}>
                {lowStockProducts.length} <span className="text-xs font-normal text-slate-400">referencias</span>
              </span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Package className="w-6 h-6 stroke-[1.8]" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-black block">Referencias</span>
              <span className="text-xl sm:text-2xl font-black text-slate-900">{products.length}</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
              <DollarSign className="w-6 h-6 stroke-[1.8]" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-black block">Valor Costo Bodega</span>
              <span className="text-base sm:text-lg font-black text-slate-900 line-clamp-1">{formatCOP(totalValueCOP)}</span>
            </div>
          </div>
        </div>

        {/* Encabezado de la lista con contador */}
        <div className="flex items-center justify-between mb-4 px-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-black text-slate-900">
              {selectedCategory === 'TODAS' ? 'Todas las Bebidas' : selectedCategory === 'BAJO_STOCK' ? 'Bebidas con Stock Bajo' : selectedCategory}
            </h3>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
              {filteredProducts.length}
            </span>
          </div>

          <button
            onClick={fetchData}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 p-1 rounded-lg hover:bg-slate-200/50 transition-colors"
            title="Recargar inventario"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>
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

      {/* Modales */}
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

      {/* Modal de Inicio de Sesión / Cambio de Usuario */}
      <LoginModal
        isOpen={isLoginOpen}
        currentUser={currentUser}
        onClose={currentUser ? () => setIsLoginOpen(false) : undefined}
        onLoginSuccess={(u) => {
          setCurrentUser(u);
          setIsLoginOpen(false);
        }}
      />
    </div>
  );
}
