'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Product, Movement, MovementType, User } from '@/lib/types';
import { playReadyOrderChime, playKitchenChime, speakAlert, triggerVibration } from '@/lib/soundUtils';
import { sendNativeNotification, initNotificationService } from '@/lib/notificationService';
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
import { UsersManagementModal } from '@/components/UsersManagementModal';
import { 
  Package, AlertTriangle, DollarSign, Boxes, Sparkles, RefreshCw, Layers, ShieldAlert,
  Bell, X, Flame
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
  const [isUsersManagementOpen, setIsUsersManagementOpen] = useState(false);
  const [productToAdjust, setProductToAdjust] = useState<Product | null>(null);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);

  // Notificación en vivo para meseras cuando la cocina saca un pedido LISTO
  interface OrderAlertItem {
    id: string;
    type: 'READY' | 'NEW_ORDER';
    tableName: string;
    subAccount?: string;
    waiterName?: string;
    time: string;
  }
  const [activeAlert, setActiveAlert] = useState<OrderAlertItem | null>(null);
  const knownReadyOrderIdsRef = useRef<Set<string>>(new Set());
  const knownPendingOrderIdsRef = useRef<Set<string>>(new Set());
  const isFirstPollRef = useRef<boolean>(true);

  // Inicializar Service Worker de notificaciones al montar
  useEffect(() => {
    initNotificationService();
  }, []);

  // Auto-cerrar la notificación tras 12 segundos
  useEffect(() => {
    if (activeAlert) {
      const timer = setTimeout(() => {
        setActiveAlert(null);
      }, 12000);
      return () => clearTimeout(timer);
    }
  }, [activeAlert]);

  // Sondeo en segundo plano (cada 4 seg) para alertar pedidos LISTOS y NUEVOS PEDIDOS
  useEffect(() => {
    if (!currentUser) return;

    const checkOrders = async () => {
      try {
        const res = await fetch('/api/orders?active=true');
        const data = await res.json();
        if (data.success && Array.isArray(data.orders)) {
          const readyOrders = data.orders.filter((o: any) => o.status === 'LISTO');
          const pendingOrders = data.orders.filter((o: any) => o.status === 'PENDIENTE');

          if (isFirstPollRef.current) {
            readyOrders.forEach((o: any) => knownReadyOrderIdsRef.current.add(o.id));
            pendingOrders.forEach((o: any) => knownPendingOrderIdsRef.current.add(o.id));
            isFirstPollRef.current = false;
            return;
          }

          // 1. Alerta cuando Cocina saca un pedido LISTO -> para Meseras y Admin
          if (currentUser.role === 'MESERA' || currentUser.role === 'ADMIN') {
            for (const order of readyOrders) {
              if (!knownReadyOrderIdsRef.current.has(order.id)) {
                knownReadyOrderIdsRef.current.add(order.id);
                const tableStr = order.type === 'MESA' ? (order.tableNumber || 'Mesa') : '🥡 Para Llevar';
                
                // Alarma sonora potente + voz hablada + vibración
                playReadyOrderChime();
                speakAlert(`¡Atención! Pedido listo en cocina para ${tableStr}`);
                
                // Notificación nativa tipo celular (incluso con navegador en segundo plano)
                sendNativeNotification('🔔 ¡PLATO LISTO PARA SERVIR!', {
                  body: `${tableStr} (${order.subAccount || 'Cuenta'}) - Tomado por ${order.waiterName || 'Mesera'}. ¡Retirar de cocina!`,
                  tag: `ready-order-${order.id}`,
                  requireInteraction: true,
                  vibrate: [300, 150, 300, 150, 600]
                });

                setActiveAlert({
                  id: order.id,
                  type: 'READY',
                  tableName: tableStr,
                  subAccount: order.subAccount,
                  waiterName: order.waiterName,
                  time: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
                });
                break;
              }
            }
          }

          // 2. Alerta cuando una Mesera hace un NUEVO PEDIDO -> para Cocina y Admin
          if (currentUser.role === 'COCINA' || currentUser.role === 'ADMIN') {
            for (const order of pendingOrders) {
              if (!knownPendingOrderIdsRef.current.has(order.id)) {
                knownPendingOrderIdsRef.current.add(order.id);
                const tableStr = order.type === 'MESA' ? (order.tableNumber || 'Mesa') : '🥡 Para Llevar';

                // Alarma sonora penetrante de cocina + voz hablada + vibración
                playKitchenChime();
                speakAlert(`¡Nueva comanda para ${tableStr}!`);

                // Notificación nativa tipo celular
                sendNativeNotification('🚨 ¡NUEVA COMANDA ENTRADA!', {
                  body: `${tableStr} (${order.subAccount || 'Cuenta'}) - Tomado por ${order.waiterName || 'Mesera'}. ¡Empezar a cocinar!`,
                  tag: `pending-order-${order.id}`,
                  requireInteraction: true,
                  vibrate: [400, 200, 400, 200, 600]
                });

                setActiveAlert({
                  id: order.id,
                  type: 'NEW_ORDER',
                  tableName: tableStr,
                  subAccount: order.subAccount,
                  waiterName: order.waiterName,
                  time: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
                });
                break;
              }
            }
          }
        }
      } catch {
        // Ignorar errores puntuales de red en el sondeo de fondo
      }
    };

    checkOrders();
    const interval = setInterval(checkOrders, 3500);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Vista efectiva según el rol estricto del usuario
  const effectiveView: ActiveView = useMemo(() => {
    if (currentUser?.role === 'COCINA') return 'KITCHEN';
    if (currentUser?.role === 'MESERA') {
      if (currentView === 'KITCHEN' || currentView === 'HISTORY') return 'WAITRESS';
      return currentView;
    }
    if (currentUser?.role === 'EMPLEADO') return 'INVENTORY';
    return currentView;
  }, [currentUser, currentView]);

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
        currentView={effectiveView}
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
        onOpenUsersManagement={() => setIsUsersManagementOpen(true)}
      />

      {/* NOTIFICACIÓN FLOTANTE EN VIVO TIPO CELULAR / ALARMA (NUEVO PEDIDO O PLATO LISTO) */}
      {activeAlert && (
        <div className="fixed top-20 right-4 left-4 sm:left-auto sm:w-[420px] z-50 shadow-2xl">
          {activeAlert.type === 'READY' ? (
            <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-green-700 text-white p-4 rounded-3xl border-4 border-emerald-300 shadow-emerald-900/60 animate-alarm-green flex items-start justify-between gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
                <Bell className="w-7 h-7 text-amber-300 animate-bounce stroke-[2.5]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider bg-white text-emerald-800 px-2.5 py-0.5 rounded-full shadow-sm">
                    🔔 ¡PLATO LISTO PARA SERVIR!
                  </span>
                  <span className="text-[10px] font-bold text-emerald-200">{activeAlert.time}</span>
                </div>
                <h4 className="text-base font-black mt-1 leading-snug drop-shadow">
                  {activeAlert.tableName} {activeAlert.subAccount ? `(${activeAlert.subAccount})` : ''}
                </h4>
                <p className="text-xs text-emerald-100 font-medium">
                  Atiende: <span className="font-black text-white">{activeAlert.waiterName || 'Mesera'}</span> • ¡Retirar de cocina de inmediato!
                </p>
              </div>
              <button
                onClick={() => setActiveAlert(null)}
                className="text-white/80 hover:text-white p-1.5 rounded-xl hover:bg-white/20 transition-colors"
                title="Cerrar notificación"
              >
                <X className="w-5 h-5 stroke-[2.5]" />
              </button>
            </div>
          ) : (
            <div className="bg-gradient-to-r from-rose-600 via-red-600 to-amber-600 text-white p-4 rounded-3xl border-4 border-amber-300 shadow-rose-900/60 animate-alarm-pulse flex items-start justify-between gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
                <Flame className="w-7 h-7 text-amber-200 animate-bounce stroke-[2.5]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider bg-white text-rose-700 px-2.5 py-0.5 rounded-full shadow-sm">
                    🚨 ¡NUEVO PEDIDO DE MESERA!
                  </span>
                  <span className="text-[10px] font-bold text-rose-200">{activeAlert.time}</span>
                </div>
                <h4 className="text-base font-black mt-1 leading-snug drop-shadow">
                  {activeAlert.tableName} {activeAlert.subAccount ? `(${activeAlert.subAccount})` : ''}
                </h4>
                <p className="text-xs text-rose-100 font-medium">
                  Comanda enviada por: <span className="font-black text-white">{activeAlert.waiterName || 'Mesera'}</span> • ¡Preparar en cocina!
                </p>
              </div>
              <button
                onClick={() => setActiveAlert(null)}
                className="text-white/80 hover:text-white p-1.5 rounded-xl hover:bg-white/20 transition-colors"
                title="Cerrar notificación"
              >
                <X className="w-5 h-5 stroke-[2.5]" />
              </button>
            </div>
          )}
        </div>
      )}

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
        {effectiveView === 'WAITRESS' && (
          <WaitressOrderView
            currentUser={currentUser}
            products={products}
            onOrderCreated={fetchData}
            onRefreshData={fetchData}
            onOpenMenuManagement={() => setIsMenuManagementOpen(true)}
          />
        )}

        {/* MÓDULO 2: COCINA (KDS EN VIVO) */}
        {effectiveView === 'KITCHEN' && (
          <KitchenOrdersView
            currentUser={currentUser}
            onRefreshData={fetchData}
          />
        )}

        {/* MÓDULO 3: HISTORIAL DIARIO DE VENTAS */}
        {effectiveView === 'HISTORY' && (
          <OrdersHistoryView
            currentUser={currentUser}
            onRefreshData={fetchData}
          />
        )}

        {/* MÓDULO 4: BODEGA & BEBIDAS (INVENTARIO) */}
        {effectiveView === 'INVENTORY' && (
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

      {/* Modal de Gestión de Personal y PINs */}
      <UsersManagementModal
        isOpen={isUsersManagementOpen}
        onClose={() => setIsUsersManagementOpen(false)}
        currentUser={currentUser}
        onUsersUpdated={fetchData}
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
