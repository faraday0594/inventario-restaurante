'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Order, OrderStatus, User } from '@/lib/types';
import { playKitchenChime, playTapSound } from '@/lib/soundUtils';
import { 
  ChefHat, Volume2, VolumeX, Clock, Flame, CheckCircle2, 
  AlertTriangle, RefreshCw, Check, ArrowRight, User as UserIcon, Calendar
} from 'lucide-react';

interface KitchenOrdersViewProps {
  currentUser: Omit<User, 'pin'> | null;
  onRefreshData?: () => void;
}

export function KitchenOrdersView({ currentUser, onRefreshData }: KitchenOrdersViewProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [now, setNow] = useState<number>(Date.now());

  // Ref para guardar los IDs de órdenes ya conocidas y hacer sonar campana solo con las nuevas
  const knownOrderIdsRef = useRef<Set<string>>(new Set());

  // Actualizar el reloj cada 10 segundos para los cronómetros
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  // Cargar pedidos activos (PENDIENTE, EN_PREPARACION, LISTO)
  const fetchOrders = async (isFirstLoad = false) => {
    try {
      if (isFirstLoad) setLoading(true);
      const res = await fetch('/api/orders?active=true');
      const data = await res.json();

      if (data.success && Array.isArray(data.orders)) {
        const incomingOrders: Order[] = data.orders;

        // Comprobar si hay alguna orden nueva que no estuviera antes
        if (!isFirstLoad && soundEnabled && audioUnlocked) {
          const hasNew = incomingOrders.some(
            o => !knownOrderIdsRef.current.has(o.id) && o.status === 'PENDIENTE'
          );
          if (hasNew) {
            playKitchenChime();
          }
        }

        // Actualizar el set de IDs conocidos
        const newSet = new Set<string>();
        incomingOrders.forEach(o => newSet.add(o.id));
        knownOrderIdsRef.current = newSet;

        // Ordenar: PENDIENTES y EN_PREPARACION primero, más antiguos primero (FIFO para cocina)
        const sorted = [...incomingOrders].sort((a, b) => {
          const timeA = new Date(a.createdAt).getTime();
          const timeB = new Date(b.createdAt).getTime();
          return timeA - timeB;
        });

        setOrders(sorted);
      }
    } catch (err) {
      console.error('Error cargando pedidos en cocina:', err);
    } finally {
      if (isFirstLoad) setLoading(false);
    }
  };

  // Carga inicial y sondeo en segundo plano cada 5 segundos
  useEffect(() => {
    fetchOrders(true);
    const interval = setInterval(() => {
      fetchOrders(false);
    }, 5000);
    return () => clearInterval(interval);
  }, [soundEnabled, audioUnlocked]);

  // Cambiar estado de una orden
  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
    playTapSound();
    setUpdatingOrderId(orderId);
    try {
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          status: newStatus,
          user: currentUser
        })
      });

      const data = await res.json();
      if (data.success) {
        if (newStatus === 'ENTREGADO') {
          // Desaparece de pantalla activa
          setOrders(prev => prev.filter(o => o.id !== orderId));
        } else {
          setOrders(prev => prev.map(o => o.id === orderId ? data.order : o));
        }
        if (onRefreshData) onRefreshData();
      }
    } catch (err) {
      console.error('Error actualizando pedido:', err);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Habilitar audio con interacción
  const handleUnlockAudio = () => {
    playKitchenChime();
    setAudioUnlocked(true);
    setSoundEnabled(true);
  };

  // Calcular minutos transcurridos
  const getElapsedMinutes = (createdAt: string) => {
    const diffMs = now - new Date(createdAt).getTime();
    return Math.max(0, Math.floor(diffMs / 60000));
  };

  // Agrupar pedidos por estado para contadores
  const pendingCount = orders.filter(o => o.status === 'PENDIENTE').length;
  const preparingCount = orders.filter(o => o.status === 'EN_PREPARACION').length;
  const readyCount = orders.filter(o => o.status === 'LISTO').length;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 animate-fade-in">
      {/* Cabecera de Cocina */}
      <div className="bg-slate-900 text-white rounded-3xl p-4 sm:p-6 shadow-xl mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-orange-500/20 shrink-0">
            <ChefHat className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white tracking-tight">Pantalla de Cocina (KDS)</h2>
              <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" /> En Vivo
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Pedidos pendientes por despachar en cocina
            </p>
          </div>
        </div>

        {/* Resumen de contadores y botón de sonido */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Contadores */}
          <div className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1.5 rounded-2xl border border-slate-700 text-xs font-bold">
            <span className="text-amber-400">⏳ {pendingCount} Nuevos</span>
            <span className="text-slate-500">•</span>
            <span className="text-blue-400">🔥 {preparingCount} En Fuego</span>
            <span className="text-slate-500">•</span>
            <span className="text-emerald-400">🔔 {readyCount} Listos</span>
          </div>

          {/* Activar / Silenciar Sonido */}
          {!audioUnlocked ? (
            <button
              onClick={handleUnlockAudio}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20"
              title="Activar sonido de campana para nuevos pedidos"
            >
              <Volume2 className="w-4 h-4 animate-bounce" />
              <span>Activar Timbre Cocina</span>
            </button>
          ) : (
            <button
              onClick={() => setSoundEnabled(prev => !prev)}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border ${
                soundEnabled
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4" />}
              <span>{soundEnabled ? 'Campana ON' : 'Silenciado'}</span>
            </button>
          )}

          {/* Refrescar manual */}
          <button
            onClick={() => fetchOrders(false)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            title="Actualizar ahora"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid de Pedidos Activos */}
      {loading ? (
        <div className="p-16 text-center bg-white rounded-3xl border border-slate-200">
          <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-700">Cargando pedidos de cocina...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-3xl border border-slate-200 shadow-sm">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-3 opacity-80" />
          <h3 className="text-lg font-black text-slate-900">¡Cocina al día!</h3>
          <p className="text-xs font-medium text-slate-500 max-w-sm mx-auto mt-1">
            No hay comandas pendientes en este momento. Apenas una mesera ingrese una venta desde su celular, aparecerá aquí con aviso sonoro.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {orders.map(order => {
            const minutes = getElapsedMinutes(order.createdAt);
            const isDelayed = minutes >= 18;
            const isWarning = minutes >= 10 && minutes < 18;
            const isUpdating = updatingOrderId === order.id;

            const isPending = order.status === 'PENDIENTE';
            const isPreparing = order.status === 'EN_PREPARACION';
            const isReady = order.status === 'LISTO';

            return (
              <div
                key={order.id}
                className={`bg-white rounded-3xl border-2 shadow-lg flex flex-col justify-between overflow-hidden transition-all duration-300 ${
                  isDelayed
                    ? 'border-rose-500 ring-2 ring-rose-500/20'
                    : isWarning
                    ? 'border-amber-400'
                    : isReady
                    ? 'border-emerald-500 bg-emerald-50/10'
                    : isPreparing
                    ? 'border-blue-400'
                    : 'border-slate-300'
                }`}
              >
                {/* Cabecera de la Tarjeta de Pedido */}
                <div className={`p-4 border-b ${
                  isReady 
                    ? 'bg-emerald-500 text-white border-emerald-600'
                    : isDelayed
                    ? 'bg-rose-50 border-rose-200'
                    : isPreparing
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      {/* Mesa o Para Llevar en grande */}
                      <span className={`text-2xl font-black block leading-tight ${
                        isReady ? 'text-white' : 'text-slate-950'
                      }`}>
                        {order.tableNumber || (order.type === 'PARA_LLEVAR' ? '🥡 PARA LLEVAR' : '🛵 DOMICILIO')}
                      </span>
                      {order.subAccount && (
                        <span className={`text-xs font-black px-2 py-0.5 rounded-md inline-block mt-1 ${
                          isReady ? 'bg-emerald-700 text-white' : 'bg-purple-100 text-purple-900 border border-purple-200'
                        }`}>
                          🧾 {order.subAccount}
                        </span>
                      )}
                      {order.customerName && (
                        <span className={`text-xs font-bold block mt-0.5 ${isReady ? 'text-emerald-100' : 'text-slate-600'}`}>
                          Cliente: {order.customerName}
                        </span>
                      )}
                    </div>

                    <div className="text-right">
                      <span className={`text-xs font-black px-2 py-0.5 rounded-lg inline-block ${
                        isReady ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-800'
                      }`}>
                        #{order.orderNumber}
                      </span>
                      {/* Cronómetro de espera */}
                      <div className={`flex items-center gap-1 text-xs font-black mt-1 ${
                        isReady
                          ? 'text-white'
                          : isDelayed
                          ? 'text-rose-600 animate-pulse'
                          : isWarning
                          ? 'text-amber-600'
                          : 'text-slate-500'
                      }`}>
                        <Clock className="w-3.5 h-3.5" />
                        <span>{minutes} min</span>
                      </div>
                    </div>
                  </div>

                  {/* Mesera y hora */}
                  <div className="mt-2.5 flex items-center justify-between text-[11px] font-bold">
                    <span className={`flex items-center gap-1 ${isReady ? 'text-emerald-100' : 'text-slate-600'}`}>
                      <UserIcon className="w-3 h-3" />
                      Mesera: <strong className={isReady ? 'text-white' : 'text-purple-700'}>{order.waiterName}</strong>
                    </span>
                    <span className={isReady ? 'text-emerald-100' : 'text-slate-400'}>
                      {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                {/* Lista de Platillos y Bebidas */}
                <div className="p-4 space-y-3 flex-1 overflow-y-auto max-h-72">
                  {order.items.map((it, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5"
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="w-7 h-7 rounded-xl bg-slate-900 text-white font-black text-sm flex items-center justify-center shrink-0">
                          {it.quantity}
                        </span>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-black text-slate-900 leading-snug">
                            {it.name}
                          </h4>
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">
                            {it.category}
                          </span>
                        </div>
                      </div>

                      {/* NOTAS ESPECIALES RESALTADAS EN AMARILLO DE ALTA VISIBILIDAD */}
                      {it.notes && (
                        <div className="p-2 rounded-xl bg-amber-100 border border-amber-300 text-amber-950 font-black text-xs flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                          <span>NOTA: {it.notes}</span>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Nota general de la mesa */}
                  {order.notes && (
                    <div className="p-2.5 rounded-2xl bg-purple-50 border border-purple-200 text-purple-900 text-xs font-bold">
                      💬 Observación general: {order.notes}
                    </div>
                  )}
                </div>

                {/* Botones de Acción de Cocina */}
                <div className="p-3 bg-slate-50 border-t border-slate-200 space-y-2">
                  {isPending && (
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => handleUpdateStatus(order.id, 'EN_PREPARACION')}
                      className="w-full py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-600/25 transition-all"
                    >
                      <Flame className="w-4 h-4" />
                      <span>Empezar a Preparar</span>
                    </button>
                  )}

                  {isPreparing && (
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => handleUpdateStatus(order.id, 'LISTO')}
                      className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all"
                    >
                      <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                      <span>¡LISTO PARA SERVIR!</span>
                    </button>
                  )}

                  {isReady && (
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => handleUpdateStatus(order.id, 'ENTREGADO')}
                      className="w-full py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 active:scale-98 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all"
                    >
                      <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />
                      <span>Marcar Despachado / Entregado</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
