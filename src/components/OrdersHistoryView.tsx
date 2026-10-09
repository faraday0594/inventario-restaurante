'use client';

import React, { useState, useEffect } from 'react';
import { Order, User } from '@/lib/types';
import { 
  Calendar, DollarSign, CheckCircle2, Clock, User as UserIcon, 
  ShoppingBag, ChevronDown, ChevronUp, RefreshCw, XCircle, Search
} from 'lucide-react';

interface OrdersHistoryViewProps {
  currentUser: Omit<User, 'pin'> | null;
  onRefreshData?: () => void;
}

export function OrdersHistoryView({ currentUser, onRefreshData }: OrdersHistoryViewProps) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const fetchDayData = async () => {
    try {
      setLoading(true);

      // Cargar lista de órdenes del día
      const resOrders = await fetch(`/api/orders?date=${selectedDate}`);
      const dataOrders = await resOrders.json();
      if (dataOrders.success) {
        setOrders(dataOrders.orders);
      }

      // Cargar resumen y estadísticas
      const resSum = await fetch(`/api/orders?summary=true&date=${selectedDate}`);
      const dataSum = await resSum.json();
      if (dataSum.success) {
        setSummary(dataSum.summary);
      }
    } catch (err) {
      console.error('Error cargando historial de pedidos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDayData();
  }, [selectedDate]);

  // Cancelar orden (Solo Admin)
  const handleCancelOrder = async (orderId: string) => {
    if (!confirm('¿Seguro que deseas cancelar esta comanda? El stock de las bebidas se devolverá al inventario automáticamente.')) {
      return;
    }

    try {
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          status: 'CANCELADO',
          user: currentUser
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchDayData();
        if (onRefreshData) onRefreshData();
      }
    } catch (err) {
      alert('Error cancelando orden');
    }
  };

  const isAdmin = currentUser?.role === 'ADMIN';

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 animate-fade-in space-y-6">
      {/* Cabecera con selector de fecha */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900">Historial Diario de Ventas & Pedidos</h2>
          <p className="text-xs text-slate-500 font-medium">
            Registro de todas las comandas despachadas y facturación por día
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          {/* Selector de Fecha */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-2xl border border-slate-200">
            <Calendar className="w-4 h-4 text-slate-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-black text-slate-800 focus:outline-none"
            />
          </div>

          <button
            onClick={fetchDayData}
            className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            title="Refrescar datos"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tarjetas de Métricas del Día */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase text-slate-400">Total Vendido</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900">
              ${(summary.totalRevenue || 0).toLocaleString('es-CO')}
            </div>
            <p className="text-[11px] text-emerald-600 font-bold mt-1">Ingreso neto del día</p>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase text-slate-400">Comandas Salidas</span>
              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900">
              {summary.deliveredOrders || 0}
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-1">De {summary.totalOrders || 0} pedidos totales</p>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase text-slate-400">En Cocina / Activas</span>
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900">
              {(summary.pendingOrders || 0) + (summary.preparingOrders || 0) + (summary.readyOrders || 0)}
            </div>
            <p className="text-[11px] text-amber-600 font-bold mt-1">Pendientes por despachar</p>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase text-slate-400">Meseras en Turno</span>
              <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                <UserIcon className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900">
              {summary.waiterStats?.length || 0}
            </div>
            <p className="text-[11px] text-purple-600 font-bold mt-1">Con ventas registradas</p>
          </div>
        </div>
      )}

      {/* Desglose por Mesera */}
      {summary?.waiterStats && summary.waiterStats.length > 0 && (
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">
            Rendimiento de Ventas por Mesera ({selectedDate})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {summary.waiterStats.map((st: any) => (
              <div key={st.waiterName} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-black text-slate-900 block">{st.waiterName}</span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {st.orderCount} {st.orderCount === 1 ? 'comanda' : 'comandas'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-black text-purple-700">
                    ${st.totalSales.toLocaleString('es-CO')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista de Comandas del Día */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900">
            Detalle de Comandas ({orders.length})
          </h3>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-600" />
            <p className="text-xs font-bold">Cargando comandas...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <ShoppingBag className="w-12 h-12 stroke-[1.5] mx-auto mb-2 opacity-50" />
            <p className="text-xs font-bold text-slate-600">No se registraron ventas en esta fecha</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {orders.map(order => {
              const isExpanded = expandedOrderId === order.id;
              const isDelivered = order.status === 'ENTREGADO';
              const isCancelled = order.status === 'CANCELADO';

              return (
                <div key={order.id} className="p-4 sm:p-5 hover:bg-slate-50/50 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-800 font-black text-sm flex items-center justify-center shrink-0">
                        #{order.orderNumber}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-black text-slate-900">
                            {order.tableNumber || '🥡 Para Llevar'}
                          </h4>
                          {order.subAccount && (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-200">
                              🧾 {order.subAccount}
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            isDelivered
                              ? 'bg-emerald-100 text-emerald-800'
                              : isCancelled
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {order.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium">
                          Mesera: <strong className="text-slate-700">{order.waiterName}</strong> • {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {order.deliveredAt && (
                            <span> (Despachado: {new Date(order.deliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3">
                      <div className="text-right">
                        <span className="text-sm sm:text-base font-black text-slate-900 block">
                          ${order.total.toLocaleString('es-CO')}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {order.items.length} {order.items.length === 1 ? 'ítem' : 'ítems'}
                        </span>
                      </div>

                      <button
                        onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                        className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                        title="Ver detalle de platillos"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>

                      {isAdmin && !isCancelled && (
                        <button
                          onClick={() => handleCancelOrder(order.id)}
                          className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Cancelar comanda y devolver stock"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Detalle desplegable de platillos */}
                  {isExpanded && (
                    <div className="mt-4 pt-3 border-t border-slate-100 pl-4 sm:pl-12 space-y-2 animate-fade-in">
                      <div className="space-y-1.5">
                        {order.items.map((it, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs py-1">
                            <div>
                              <span className="font-bold text-slate-800">
                                {it.quantity}x {it.name}
                              </span>
                              {it.notes && (
                                <span className="text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded text-[10px] ml-2 font-bold">
                                  Nota: {it.notes}
                                </span>
                              )}
                            </div>
                            <span className="font-bold text-slate-600">
                              ${it.totalPrice.toLocaleString('es-CO')}
                            </span>
                          </div>
                        ))}
                      </div>

                      {order.notes && (
                        <p className="text-xs text-purple-700 bg-purple-50 p-2 rounded-xl font-medium mt-2">
                          Observación general: {order.notes}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
