'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Product, MenuItem, Order, User } from '@/lib/types';
import { playTapSound } from '@/lib/soundUtils';
import { 
  UtensilsCrossed, Wine, Plus, Minus, Send, Trash2, Edit3, CheckCircle2, 
  Clock, AlertCircle, ShoppingBag, Search, Sparkles, ChefHat, RefreshCw, X
} from 'lucide-react';

interface WaitressOrderViewProps {
  currentUser: Omit<User, 'pin'> | null;
  products: Product[];
  onOrderCreated?: () => void;
  onRefreshData?: () => void;
}

const TABLES = Array.from({ length: 15 }, (_, i) => `Mesa ${i + 1}`);

export function WaitressOrderView({
  currentUser,
  products,
  onOrderCreated,
  onRefreshData
}: WaitressOrderViewProps) {
  // Pestaña principal: 'CREAR' (Tomar Comanda) o 'MIS_PEDIDOS' (Seguimiento de mesas)
  const [activeTab, setActiveTab] = useState<'CREAR' | 'MIS_PEDIDOS'>('CREAR');

  // Tipo de orden, mesa y subcuentas (cuentas separadas)
  const [orderType, setOrderType] = useState<'MESA' | 'PARA_LLEVAR'>('MESA');
  const [selectedTable, setSelectedTable] = useState<string>('Mesa 1');
  const [subAccount, setSubAccount] = useState<string>('Cuenta 1');
  const [customDinerName, setCustomDinerName] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [generalNotes, setGeneralNotes] = useState<string>('');

  // Menú de platillos
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(true);

  // Filtros del catálogo
  const [itemTypeTab, setItemTypeTab] = useState<'TODOS' | 'PLATILLOS' | 'BEBIDAS'>('TODOS');
  const [selectedCategory, setSelectedCategory] = useState<string>('TODAS');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Carrito / Comanda actual
  interface CartItem {
    tempId: string;
    itemType: 'DISH' | 'PRODUCT';
    itemId: string;
    name: string;
    category: string;
    quantity: number;
    unitPrice: number;
    notes: string;
  }
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal para editar nota de un ítem
  const [editingNoteItem, setEditingNoteItem] = useState<CartItem | null>(null);
  const [noteInput, setNoteInput] = useState<string>('');

  // Mis pedidos activos
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [loadingMyOrders, setLoadingMyOrders] = useState(false);

  // Cargar platillos de cocina
  const fetchMenu = async () => {
    try {
      setLoadingMenu(true);
      const res = await fetch('/api/menu');
      const data = await res.json();
      if (data.success) {
        setMenuItems(data.items);
      }
    } catch (err) {
      console.error('Error cargando menú:', err);
    } finally {
      setLoadingMenu(false);
    }
  };

  // Filtro para ver todos los pedidos de sala o solo los de la mesera en sesión
  const [onlyMine, setOnlyMine] = useState(false);

  // Cargar pedidos activos (de todas las meseras o solo los propios)
  const fetchMyOrders = async (showLoading = true) => {
    try {
      if (showLoading) setLoadingMyOrders(true);
      const url = onlyMine && currentUser?.id 
        ? `/api/orders?active=true&waiterId=${currentUser.id}` 
        : `/api/orders?active=true`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setMyOrders(data.orders);
      }
    } catch (err) {
      console.error('Error cargando pedidos activos:', err);
    } finally {
      if (showLoading) setLoadingMyOrders(false);
    }
  };

  useEffect(() => {
    fetchMenu();
  }, []);

  useEffect(() => {
    if (activeTab === 'MIS_PEDIDOS') {
      fetchMyOrders(true);
      // Auto-actualizar cada 5 segundos para que todas las meseras vean cambios en tiempo real
      const interval = setInterval(() => {
        fetchMyOrders(false);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab, onlyMine, currentUser]);

  // Lista unificada de categorías
  const categories = useMemo(() => {
    const cats = new Set<string>();
    if (itemTypeTab === 'TODOS' || itemTypeTab === 'PLATILLOS') {
      menuItems.forEach(m => cats.add(m.category));
    }
    if (itemTypeTab === 'TODOS' || itemTypeTab === 'BEBIDAS') {
      products.forEach(p => cats.add(p.category));
    }
    return Array.from(cats);
  }, [itemTypeTab, menuItems, products]);

  // Agregar platillo al carrito
  const handleAddDish = (dish: MenuItem) => {
    playTapSound();
    setCart(prev => {
      const existing = prev.find(i => i.itemId === dish.id && i.itemType === 'DISH' && !i.notes);
      if (existing) {
        return prev.map(i => i.tempId === existing.tempId ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [
        ...prev,
        {
          tempId: `cart-${Date.now()}-${Math.random()}`,
          itemType: 'DISH',
          itemId: dish.id,
          name: dish.name,
          category: dish.category,
          quantity: 1,
          unitPrice: dish.price,
          notes: ''
        }
      ];
    });
  };

  // Agregar bebida al carrito
  const handleAddProduct = (prod: Product) => {
    playTapSound();
    setCart(prev => {
      const existing = prev.find(i => i.itemId === prod.id && i.itemType === 'PRODUCT' && !i.notes);
      if (existing) {
        return prev.map(i => i.tempId === existing.tempId ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [
        ...prev,
        {
          tempId: `cart-${Date.now()}-${Math.random()}`,
          itemType: 'PRODUCT',
          itemId: prod.id,
          name: prod.name,
          category: prod.category,
          quantity: 1,
          unitPrice: prod.salePrice,
          notes: ''
        }
      ];
    });
  };

  const handleUpdateQty = (tempId: string, delta: number) => {
    playTapSound();
    setCart(prev => {
      return prev
        .map(i => {
          if (i.tempId === tempId) {
            const newQty = i.quantity + delta;
            return newQty > 0 ? { ...i, quantity: newQty } : null;
          }
          return i;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const handleRemoveItem = (tempId: string) => {
    setCart(prev => prev.filter(i => i.tempId !== tempId));
  };

  const openNoteModal = (item: CartItem) => {
    setEditingNoteItem(item);
    setNoteInput(item.notes);
  };

  const saveItemNote = () => {
    if (!editingNoteItem) return;
    setCart(prev => prev.map(i => i.tempId === editingNoteItem.tempId ? { ...i, notes: noteInput.trim() } : i));
    setEditingNoteItem(null);
    setNoteInput('');
  };

  // Totales
  const totalItemsCount = cart.reduce((acc, i) => acc + i.quantity, 0);
  const cartSubtotal = cart.reduce((acc, i) => acc + (i.quantity * i.unitPrice), 0);

  // Enviar pedido a Cocina
  const handleSendOrder = async () => {
    if (!currentUser) {
      setStatusMessage({ type: 'error', text: 'Debes iniciar sesión con tu usuario de mesera' });
      return;
    }
    if (cart.length === 0) {
      setStatusMessage({ type: 'error', text: 'Agrega al menos un plato o bebida a la comanda' });
      return;
    }

    setIsSending(true);
    setStatusMessage(null);

    try {
      const activeSubAccount = customDinerName.trim() || subAccount;
      const payload = {
        type: orderType,
        tableNumber: orderType === 'MESA' ? selectedTable : undefined,
        subAccount: orderType === 'MESA' ? activeSubAccount : undefined,
        customerName: orderType !== 'MESA' ? customerName : undefined,
        notes: generalNotes,
        user: currentUser,
        items: cart.map(i => ({
          itemType: i.itemType,
          itemId: i.itemId,
          name: i.name,
          category: i.category,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          notes: i.notes
        }))
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al enviar comanda');
      }

      // Éxito: Limpiar carrito y conservar o resetear subcuenta
      setCart([]);
      setGeneralNotes('');
      setCustomerName('');
      setCustomDinerName('');

      const tableInfo = orderType === 'MESA' 
        ? `${selectedTable} (${activeSubAccount})` 
        : 'Para llevar';

      setStatusMessage({ 
        type: 'success', 
        text: `¡Comanda #${data.order.orderNumber} enviada con éxito a Cocina! (${tableInfo})` 
      });

      if (onOrderCreated) onOrderCreated();
      if (onRefreshData) onRefreshData();

      // Recargar pedidos activos
      fetchMyOrders();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Error al conectar con cocina' });
    } finally {
      setIsSending(false);
    }
  };

  // Filtrado de ítems para mostrar
  const filteredDishes = useMemo(() => {
    if (itemTypeTab === 'BEBIDAS') return [];
    return menuItems.filter(dish => {
      if (!dish.available) return false;
      if (selectedCategory !== 'TODAS' && dish.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return dish.name.toLowerCase().includes(q) || dish.category.toLowerCase().includes(q);
      }
      return true;
    });
  }, [menuItems, itemTypeTab, selectedCategory, searchQuery]);

  const filteredProducts = useMemo(() => {
    if (itemTypeTab === 'PLATILLOS') return [];
    return products.filter(prod => {
      if (selectedCategory !== 'TODAS' && prod.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return prod.name.toLowerCase().includes(q) || prod.category.toLowerCase().includes(q);
      }
      return true;
    });
  }, [products, itemTypeTab, selectedCategory, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 animate-fade-in">
      {/* Barra de cabecera con selector de pestaña */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-200 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-purple-600/20 shrink-0">
            <UtensilsCrossed className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-slate-900">Comandera Móvil</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700">
                Atención en Sala
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Mesera: <strong className="text-purple-700">{currentUser?.name || 'Mesera'}</strong>
            </p>
          </div>
        </div>

        {/* Selector de modo: Nueva Comanda vs Mis Pedidos */}
        <div className="flex items-center bg-slate-100 p-1 rounded-2xl w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('CREAR')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-black transition-all ${
              activeTab === 'CREAR'
                ? 'bg-white text-purple-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ➕ Tomar Comanda
          </button>
          <button
            onClick={() => setActiveTab('MIS_PEDIDOS')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'MIS_PEDIDOS'
                ? 'bg-white text-purple-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            📋 Pedidos en Sala
            {myOrders.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-purple-600 text-white text-[10px] flex items-center justify-center font-bold">
                {myOrders.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Mensaje de estado (éxito o error) */}
      {statusMessage && (
        <div className={`p-4 rounded-2xl mb-6 flex items-center justify-between gap-3 text-xs font-bold animate-fade-in ${
          statusMessage.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
            : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="p-1 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* VISTA 1: TOMAR COMANDA */}
      {activeTab === 'CREAR' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LADO IZQUIERDO: SELECCIÓN DE MESA Y CATÁLOGO DE MENÚ (7 cols en desktop) */}
          <div className="lg:col-span-7 space-y-5">
            {/* 1. Selector de Tipo y Mesa */}
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  1. Destino del Pedido
                </span>
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl">
                  <button
                    onClick={() => setOrderType('MESA')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all ${
                      orderType === 'MESA' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    🪑 En Mesa
                  </button>
                  <button
                    onClick={() => setOrderType('PARA_LLEVAR')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all ${
                      orderType === 'PARA_LLEVAR' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    🥡 Para Llevar
                  </button>
                </div>
              </div>

              {orderType === 'MESA' ? (
                <div>
                  <div className="grid grid-cols-5 sm:grid-cols-8 gap-2 max-h-32 overflow-y-auto p-1">
                    {TABLES.map(table => {
                      const isSel = selectedTable === table;
                      return (
                        <button
                          key={table}
                          type="button"
                          onClick={() => {
                            playTapSound();
                            setSelectedTable(table);
                          }}
                          className={`py-2 px-1 rounded-xl text-xs font-black text-center transition-all ${
                            isSel
                              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 scale-105'
                              : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                          }`}
                        >
                          {table.replace('Mesa ', 'M-')}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-2 text-right">
                    <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg">
                      Seleccionada: {selectedTable}
                    </span>
                  </div>

                  {/* Selector de Subcuenta / Cuentas Separadas en la misma mesa */}
                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                        ¿Cuentas Separadas en esta mesa?
                      </span>
                      <span className="text-[11px] font-black text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-lg border border-purple-200/50">
                        {selectedTable} • {customDinerName.trim() || subAccount}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {['Cuenta 1', 'Cuenta 2', 'Cuenta 3', 'Cuenta 4'].map((cta) => {
                        const isSel = subAccount === cta && !customDinerName;
                        return (
                          <button
                            key={cta}
                            type="button"
                            onClick={() => {
                              playTapSound();
                              setSubAccount(cta);
                              setCustomDinerName('');
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                              isSel
                                ? 'bg-purple-600 text-white shadow-sm'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                          >
                            🧾 {cta}
                          </button>
                        );
                      })}

                      <div className="flex-1 min-w-[130px]">
                        <input
                          type="text"
                          value={customDinerName}
                          onChange={(e) => setCustomDinerName(e.target.value)}
                          placeholder="O persona (ej: Carlos, Pareja 1)..."
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <input
                    type="text"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    placeholder="Nombre del cliente o detalles del pedido para llevar (ej: Juan Pérez)..."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              )}
            </div>

            {/* 2. Filtros y Búsqueda del Menú */}
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
                {/* Tipo: Platillos vs Bebidas */}
                <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => { setItemTypeTab('TODOS'); setSelectedCategory('TODAS'); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                      itemTypeTab === 'TODOS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    Todo
                  </button>
                  <button
                    onClick={() => { setItemTypeTab('PLATILLOS'); setSelectedCategory('TODAS'); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1 ${
                      itemTypeTab === 'PLATILLOS' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    <UtensilsCrossed className="w-3.5 h-3.5" /> Platillos
                  </button>
                  <button
                    onClick={() => { setItemTypeTab('BEBIDAS'); setSelectedCategory('TODAS'); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1 ${
                      itemTypeTab === 'BEBIDAS' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    <Wine className="w-3.5 h-3.5" /> Bebidas
                  </button>
                </div>

                {/* Buscador rápido */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Buscar plato o bebida..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Categorías pill */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                <button
                  onClick={() => setSelectedCategory('TODAS')}
                  className={`px-3 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all ${
                    selectedCategory === 'TODAS'
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Todas las categorías
                </button>
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all ${
                      selectedCategory === cat
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Cuadrícula de Platillos y Bebidas */}
            <div className="space-y-4">
              {/* Sección PLATILLOS */}
              {filteredDishes.length > 0 && (
                <div>
                  <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-2 flex items-center gap-1.5">
                    <UtensilsCrossed className="w-3.5 h-3.5 text-purple-600" />
                    Platillos de Cocina ({filteredDishes.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {filteredDishes.map(dish => (
                      <div
                        key={dish.id}
                        onClick={() => handleAddDish(dish)}
                        className="bg-white p-3.5 rounded-2xl border border-slate-200 hover:border-purple-300 hover:shadow-md cursor-pointer transition-all active:scale-[0.98] flex items-center justify-between gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] font-black uppercase tracking-wider text-purple-600 block">
                            {dish.category}
                          </span>
                          <h4 className="text-sm font-bold text-slate-900 truncate">{dish.name}</h4>
                          {dish.description && (
                            <p className="text-[11px] text-slate-500 line-clamp-1">{dish.description}</p>
                          )}
                          <span className="text-xs font-black text-slate-900 mt-1 block">
                            ${dish.price.toLocaleString('es-CO')}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-600 hover:text-white flex items-center justify-center transition-all shrink-0 font-bold"
                        >
                          <Plus className="w-5 h-5 stroke-[2.5]" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sección BEBIDAS DE BODEGA */}
              {filteredProducts.length > 0 && (
                <div>
                  <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-2 flex items-center gap-1.5">
                    <Wine className="w-3.5 h-3.5 text-emerald-600" />
                    Bebidas de Bodega ({filteredProducts.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {filteredProducts.map(prod => (
                      <div
                        key={prod.id}
                        onClick={() => handleAddProduct(prod)}
                        className="bg-white p-3.5 rounded-2xl border border-slate-200 hover:border-emerald-300 hover:shadow-md cursor-pointer transition-all active:scale-[0.98] flex items-center justify-between gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 block">
                              {prod.category}
                            </span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md ${
                              prod.stock <= prod.minStock ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                            }`}>
                              Stock: {prod.stock}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 truncate">{prod.name}</h4>
                          <span className="text-xs font-black text-slate-900 mt-1 block">
                            ${prod.salePrice.toLocaleString('es-CO')}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white flex items-center justify-center transition-all shrink-0 font-bold"
                        >
                          <Plus className="w-5 h-5 stroke-[2.5]" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {filteredDishes.length === 0 && filteredProducts.length === 0 && (
                <div className="p-8 text-center bg-white rounded-3xl border border-slate-200">
                  <UtensilsCrossed className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-500">No hay productos que coincidan con la búsqueda</p>
                </div>
              )}
            </div>
          </div>

          {/* LADO DERECHO: RESUMEN DE LA COMANDA / CARRITO (5 cols en desktop) */}
          <div className="lg:col-span-5">
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-lg sticky top-24 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">
                      {orderType === 'MESA' 
                        ? `${selectedTable} • ${customDinerName.trim() || subAccount}` 
                        : orderType === 'PARA_LLEVAR' ? '🥡 Para Llevar' : '🛵 Domicilio'}
                    </h3>
                    <p className="text-[10px] text-slate-500 font-medium">
                      {totalItemsCount} {totalItemsCount === 1 ? 'producto' : 'productos'} en comanda
                    </p>
                  </div>
                </div>

                {cart.length > 0 && (
                  <button
                    onClick={() => setCart([])}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                    title="Vaciar comanda"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Lista de Ítems en Carrito */}
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {cart.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">
                    <ShoppingBag className="w-12 h-12 stroke-[1.5] mx-auto mb-2 opacity-50" />
                    <p className="text-xs font-bold text-slate-500">Comanda vacía</p>
                    <p className="text-[11px] text-slate-400">Toca los platillos o bebidas a la izquierda para agregarlos</p>
                  </div>
                ) : (
                  cart.map(item => (
                    <div
                      key={item.tempId}
                      className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-black text-slate-900 truncate">{item.name}</h4>
                          <span className="text-[11px] font-bold text-slate-500">
                            ${(item.quantity * item.unitPrice).toLocaleString('es-CO')}
                            <span className="text-[10px] text-slate-400 ml-1">
                              (${item.unitPrice.toLocaleString('es-CO')} c/u)
                            </span>
                          </span>
                        </div>

                        {/* Controles de cantidad */}
                        <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-xl border border-slate-200">
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(item.tempId, -1)}
                            className="w-6 h-6 rounded-lg text-slate-600 hover:bg-slate-100 flex items-center justify-center font-bold"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-6 text-center text-xs font-black text-slate-900">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(item.tempId, 1)}
                            className="w-6 h-6 rounded-lg text-purple-700 hover:bg-purple-50 flex items-center justify-center font-bold"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Nota u Observación específica (ej: Sin cebolla) */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/50">
                        {item.notes ? (
                          <div className="text-[11px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200 font-bold flex-1 truncate">
                            ✏️ Nota: {item.notes}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Sin observaciones</span>
                        )}
                        <button
                          type="button"
                          onClick={() => openNoteModal(item)}
                          className="text-[10px] font-bold text-purple-700 hover:underline flex items-center gap-1 shrink-0"
                        >
                          <Edit3 className="w-3 h-3" />
                          {item.notes ? 'Cambiar nota' : '+ Agregar nota'}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Notas generales de la comanda */}
              {cart.length > 0 && (
                <div className="pt-2">
                  <input
                    type="text"
                    value={generalNotes}
                    onChange={e => setGeneralNotes(e.target.value)}
                    placeholder="Nota general para cocina (ej: Entregar todo junto)..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              )}

              {/* Total y Botón de Enviar a Cocina */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-slate-400">Total a Pagar:</span>
                  <span className="text-lg font-black text-slate-900">
                    ${cartSubtotal.toLocaleString('es-CO')}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={cart.length === 0 || isSending}
                  onClick={handleSendOrder}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 active:scale-98 transition-all"
                >
                  {isSending ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Enviando a Cocina...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Enviar Pedido a Cocina ({totalItemsCount})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VISTA 2: MIS PEDIDOS ACTIVOS */}
      {activeTab === 'MIS_PEDIDOS' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-black text-slate-900">
                {onlyMine ? `Mis pedidos activos (${myOrders.length})` : `Todos los pedidos activos en sala (${myOrders.length})`}
              </h3>
              <div className="flex items-center bg-slate-100 p-0.5 rounded-xl">
                <button
                  type="button"
                  onClick={() => setOnlyMine(false)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${
                    !onlyMine ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600'
                  }`}
                >
                  🌐 Todas las Mesas
                </button>
                <button
                  type="button"
                  onClick={() => setOnlyMine(true)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${
                    onlyMine ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600'
                  }`}
                >
                  👤 Solo Mis Mesas
                </button>
              </div>
            </div>
            <button
              onClick={() => fetchMyOrders(true)}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors self-end sm:self-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingMyOrders ? 'animate-spin' : ''}`} />
              <span>Actualizar</span>
            </button>
          </div>

          {/* Resumen de mesas con cuentas múltiples activas para facilitar el cobro */}
          {(() => {
            const tableGroups = myOrders.reduce((acc, ord) => {
              if (ord.tableNumber) {
                if (!acc[ord.tableNumber]) acc[ord.tableNumber] = [];
                acc[ord.tableNumber].push(ord);
              }
              return acc;
            }, {} as Record<string, typeof myOrders>);

            const multiTables = Object.entries(tableGroups).filter(([_, list]) => list.length > 1);
            if (multiTables.length === 0) return null;

            return (
              <div className="p-4 rounded-3xl bg-purple-50 border border-purple-200/80 space-y-2 animate-fade-in shadow-xs">
                <span className="text-xs font-black text-purple-900 flex items-center gap-1.5">
                  💡 Mesas con Cuentas Separadas activas (Cobro de Sala):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {multiTables.map(([tbl, ords]) => {
                    const combinedTotal = ords.reduce((s, o) => s + o.total, 0);
                    return (
                      <div key={tbl} className="bg-white p-3 rounded-2xl border border-purple-200 text-xs shadow-xs">
                        <div className="flex justify-between items-center font-bold text-slate-900 pb-1 border-b border-slate-100">
                          <span className="font-black">🪑 {tbl}</span>
                          <span className="text-purple-700 font-black">${combinedTotal.toLocaleString('es-CO')} Total</span>
                        </div>
                        <div className="text-[11px] text-slate-600 mt-1.5 space-y-1">
                          {ords.map(o => (
                            <div key={o.id} className="flex justify-between items-center">
                              <span className="truncate pr-1">• {o.subAccount || `Comanda #${o.orderNumber}`}:</span>
                              <span className="font-black text-slate-800 shrink-0">${o.total.toLocaleString('es-CO')}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {myOrders.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
              <ChefHat className="w-12 h-12 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">No tienes pedidos pendientes en este momento</p>
              <p className="text-xs text-slate-400 mt-1">Los pedidos que envíes aparecerán aquí con su estado en vivo</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myOrders.map(order => {
                const isReady = order.status === 'LISTO';
                const isPrep = order.status === 'EN_PREPARACION';

                return (
                  <div
                    key={order.id}
                    className={`bg-white rounded-3xl p-5 border shadow-sm transition-all ${
                      isReady 
                        ? 'border-emerald-400 bg-emerald-50/20 ring-2 ring-emerald-500/30' 
                        : isPrep
                        ? 'border-blue-300'
                        : 'border-amber-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-base font-black text-slate-900 block">
                            {order.tableNumber || '🥡 Para Llevar'}
                          </span>
                          {order.subAccount && (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-200">
                              🧾 {order.subAccount}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-bold text-slate-400">
                          Comanda #{order.orderNumber} • {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <span className={`px-2.5 py-1 rounded-full text-xs font-black ${
                        isReady 
                          ? 'bg-emerald-500 text-white animate-pulse'
                          : isPrep
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {isReady ? '🔔 ¡LISTO PARA LLEVAR!' : isPrep ? '🔥 En Cocina' : '⏳ Esperando Cocina'}
                      </span>
                    </div>

                    {/* Ítems */}
                    <div className="space-y-1.5 py-2 border-y border-slate-100 max-h-40 overflow-y-auto">
                      {order.items.map((it, idx) => (
                        <div key={idx} className="text-xs flex items-center justify-between">
                          <span className="text-slate-800 font-medium">
                            <strong className="text-slate-900">{it.quantity}x</strong> {it.name}
                          </span>
                          {it.notes && (
                            <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                              {it.notes}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs font-bold text-slate-500">
                      <div>
                        <span>Total: </span>
                        <strong className="text-slate-900">${order.total.toLocaleString('es-CO')}</strong>
                      </div>
                      <div className="flex items-center gap-2">
                        {isReady && (
                          <span className="text-emerald-700 font-black animate-pulse">
                            ¡Listo!
                          </span>
                        )}
                        <span className="text-[11px] font-black text-purple-700 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-200/60">
                          👤 {order.waiterName}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL PARA AGREGAR NOTA AL PLATO */}
      {editingNoteItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl p-5 w-full max-w-md shadow-2xl border border-slate-200 space-y-4">
            <div>
              <h3 className="text-sm font-black text-slate-900">Nota especial para cocina</h3>
              <p className="text-xs text-slate-500 font-medium">
                Plato: <strong>{editingNoteItem.name}</strong>
              </p>
            </div>

            <textarea
              rows={3}
              value={noteInput}
              onChange={e => setNoteInput(e.target.value)}
              placeholder="Ej: Sin cebolla, carne bien asada, poca sal, bebida con hielo..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
              autoFocus
            />

            {/* Atajos de notas rápidas */}
            <div className="flex flex-wrap gap-1.5">
              {['Sin cebolla', 'Término medio', 'Bien asada', 'Sin azúcar', 'Con hielo', 'Poco picante', 'Empacar aparte'].map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setNoteInput(prev => prev ? `${prev}, ${tag}` : tag)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-colors"
                >
                  +{tag}
                </button>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingNoteItem(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveItemNote}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-xs font-black text-white shadow-md shadow-purple-600/20"
              >
                Guardar Nota
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
