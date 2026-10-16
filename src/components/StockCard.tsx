'use client';

import React from 'react';
import { Product, User } from '@/lib/types';
import { Plus, Minus, AlertTriangle, CheckCircle2, XCircle, SlidersHorizontal, Lock, Snowflake, Package } from 'lucide-react';

interface StockCardProps {
  product: Product;
  currentUser: Omit<User, 'pin'> | null;
  onQuickAdjust: (productId: string, delta: number, type: 'ENTRADA' | 'SALIDA', reason: string) => void;
  onOpenAdjust: (product: Product) => void;
  onOpenFridgeTransfer?: (product: Product) => void;
  onEdit: (product: Product) => void;
  isUpdating: boolean;
}

export function StockCard({
  product,
  currentUser,
  onQuickAdjust,
  onOpenAdjust,
  onOpenFridgeTransfer,
  onEdit,
  isUpdating
}: StockCardProps) {
  const isAdmin = currentUser?.role === 'ADMIN';

  const isOutOfStock = product.stock === 0;
  const isLowStock = product.stock > 0 && product.stock <= product.minStock;
  const isOptimal = product.stock > product.minStock;

  // Formato de moneda COP
  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className={`relative bg-white rounded-2xl border transition-all duration-200 shadow-sm hover:shadow-md flex flex-col justify-between overflow-hidden ${
      isOutOfStock 
        ? 'border-red-300 ring-1 ring-red-200 bg-red-50/20' 
        : isLowStock 
          ? 'border-amber-300 ring-1 ring-amber-200 bg-amber-50/20' 
          : 'border-slate-200 hover:border-slate-300'
    }`}>
      {/* Indicador superior de estado */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            {product.category}
          </span>

          <div className="flex items-center gap-1.5">
            {isOutOfStock && (
              <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                <XCircle className="w-3.5 h-3.5" /> Agotado
              </span>
            )}
            {isLowStock && (
              <span className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                <AlertTriangle className="w-3.5 h-3.5" /> Bajo ({product.stock}/{product.minStock})
              </span>
            )}
            {isOptimal && (
              <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5" /> OK
              </span>
            )}

            {/* Botón de configuración/edición: Solo Admin puede editar/eliminar datos de stock */}
            {isAdmin && (
              <button
                onClick={() => onEdit(product)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors"
                title="Editar referencia (Solo Admin)"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <h3 className="text-base font-bold text-slate-900 leading-snug line-clamp-1" title={product.name}>
          {product.name}
        </h3>
        <p className="text-xs text-slate-500 font-medium mt-0.5">
          {product.presentation}
        </p>

        {/* Precios y Margen */}
        <div className="mt-3 flex items-center justify-between text-xs text-slate-600 bg-slate-50/80 px-2.5 py-1.5 rounded-xl border border-slate-100">
          <div>
            <span className="text-[10px] text-slate-400 block uppercase font-bold">Venta</span>
            <span className="font-semibold text-slate-800">{formatMoney(product.salePrice)}</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-400 block uppercase font-bold">Costo</span>
            <span className="font-medium text-slate-600">{formatMoney(product.costPrice)}</span>
          </div>
        </div>

        {/* Ubicaciones de Stock: Bodega y Nevera */}
        <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs">
          <div className="bg-slate-50/90 p-2 rounded-xl border border-slate-100 flex flex-col items-center">
            <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
              <Package className="w-3 h-3 text-slate-500" /> Bodega
            </span>
            <span className={`text-sm font-black ${product.stock <= 0 ? 'text-red-600' : 'text-slate-800'}`}>
              {product.stock} <span className="text-[10px] font-normal text-slate-400">unids</span>
            </span>
          </div>

          <div className="bg-cyan-50/60 p-2 rounded-xl border border-cyan-100 flex flex-col items-center">
            <span className="text-[10px] text-cyan-700 font-bold uppercase flex items-center gap-1">
              <Snowflake className="w-3 h-3 text-cyan-600" /> Nevera
            </span>
            <span className="text-sm font-black text-cyan-900">
              {product.fridgeStock || 0} <span className="text-[10px] font-normal text-cyan-600">frías</span>
            </span>
          </div>
        </div>
      </div>

      {/* Control de Stock táctil inferior y Botón Salida a Nevera */}
      <div className="p-4 pt-2 border-t border-slate-100 bg-slate-50/50 space-y-2">
        {isAdmin ? (
          // VISTA ADMIN: Control total (+, -, ajuste manual)
          <div className="flex items-center justify-between gap-3">
            {/* Botón Restar 1 */}
            <button
              onClick={() => onQuickAdjust(product.id, -1, 'SALIDA', 'Salida manual rápida')}
              disabled={isUpdating || product.stock <= 0}
              className="flex-1 h-11 flex items-center justify-center rounded-xl bg-red-100 text-red-700 hover:bg-red-200 active:scale-95 disabled:opacity-40 disabled:active:scale-100 transition-all font-bold text-base shadow-sm"
              title="Restar 1 unidad de bodega (Solo Admin)"
            >
              <Minus className="w-5 h-5 stroke-[2.5]" />
            </button>

            {/* Cantidad Actual en Grande (Click abre modal de ajuste) */}
            <button
              onClick={() => onOpenAdjust(product)}
              className="flex-1 flex flex-col items-center justify-center py-1 px-2 rounded-xl hover:bg-slate-200/60 active:scale-95 transition-all group"
              title="Ajustar cantidad manual de bodega"
            >
              <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 group-hover:text-slate-600">
                Bodega
              </span>
              <span className={`text-xl font-black ${
                isOutOfStock ? 'text-red-600' : isLowStock ? 'text-amber-600' : 'text-slate-900'
              }`}>
                {product.stock}
              </span>
              <span className="text-[9px] text-slate-400 font-medium">unid</span>
            </button>

            {/* Botón Sumar 1 */}
            <button
              onClick={() => onQuickAdjust(product.id, 1, 'ENTRADA', 'Entrada manual rápida')}
              disabled={isUpdating}
              className="flex-1 h-11 flex items-center justify-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 disabled:opacity-50 disabled:active:scale-100 transition-all font-bold text-base shadow-sm shadow-emerald-600/25"
              title="Sumar 1 unidad a bodega (Solo Admin)"
            >
              <Plus className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>
        ) : (
          // VISTA EMPLEADO: Modo informativo de Bodega
          <div className="flex items-center justify-between py-1.5 px-3 bg-white rounded-xl border border-slate-200">
            <div className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-semibold text-slate-500">Bodega:</span>
            </div>
            <div className="text-right">
              <span className={`text-lg font-black ${
                isOutOfStock ? 'text-red-600' : isLowStock ? 'text-amber-600' : 'text-slate-900'
              }`}>
                {product.stock}
              </span>
              <span className="text-[10px] text-slate-400 font-medium ml-1">unid</span>
            </div>
          </div>
        )}

        {/* BOTÓN RÁPIDO: TRASLADAR / SALIDA A NEVERA (Habilitado para Admin y Empleado) */}
        {onOpenFridgeTransfer && (
          <button
            onClick={() => onOpenFridgeTransfer(product)}
            className="w-full py-2 px-3 rounded-xl bg-cyan-50 hover:bg-cyan-100 active:bg-cyan-200 text-cyan-800 border border-cyan-200/80 font-black text-xs flex items-center justify-center gap-1.5 transition-all active:scale-98 shadow-xs"
            title="Registrar traslado de botellas de bodega a la nevera"
          >
            <Snowflake className="w-4 h-4 text-cyan-600" />
            <span>Mover a Nevera ❄️ ({product.fridgeStock || 0} frías)</span>
          </button>
        )}
      </div>
    </div>
  );
}
