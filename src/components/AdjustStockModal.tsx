'use client';

import React, { useState } from 'react';
import { Product, MovementType } from '@/lib/types';
import { X, ArrowDownRight, ArrowUpRight, AlertOctagon, Check } from 'lucide-react';

interface AdjustStockModalProps {
  product: Product | null;
  onClose: () => void;
  onConfirm: (productId: string, delta: number, type: MovementType, reason: string) => Promise<void>;
}

export function AdjustStockModal({ product, onClose, onConfirm }: AdjustStockModalProps) {
  if (!product) return null;

  const [mode, setMode] = useState<'ENTRADA' | 'SALIDA' | 'MERMA'>('SALIDA');
  const [amount, setAmount] = useState<number>(1);
  const [reason, setReason] = useState<string>('Traslado a Barra');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const presets = [1, 6, 12, 24];

  const defaultReasons = {
    ENTRADA: ['Compra de reposición', 'Devolución de cliente', 'Ajuste de inventario sobrante'],
    SALIDA: ['Traslado a Barra / Nevera', 'Venta directa en mesa', 'Consumo interno personal'],
    MERMA: ['Botella rota / averiada', 'Producto vencido', 'Fuga de gas / empaque dañado']
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) return;

    setIsSubmitting(true);
    try {
      const delta = mode === 'ENTRADA' ? amount : -amount;
      await onConfirm(product.id, delta, mode, reason);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const newStockPreview = mode === 'ENTRADA' ? product.stock + amount : Math.max(0, product.stock - amount);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Encabezado */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Ajustar Inventario
            </span>
            <h2 className="text-lg font-bold text-slate-900">{product.name}</h2>
            <p className="text-xs text-slate-500">{product.presentation} • Stock actual: <strong className="text-slate-900">{product.stock} unids</strong></p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-200/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Selector de Tipo de Movimiento */}
          <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-2xl">
            <button
              type="button"
              onClick={() => { setMode('SALIDA'); setReason(defaultReasons.SALIDA[0]); }}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                mode === 'SALIDA'
                  ? 'bg-white text-rose-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowDownRight className="w-4 h-4" />
              Salida
            </button>
            <button
              type="button"
              onClick={() => { setMode('ENTRADA'); setReason(defaultReasons.ENTRADA[0]); }}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                mode === 'ENTRADA'
                  ? 'bg-white text-emerald-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              Entrada
            </button>
            <button
              type="button"
              onClick={() => { setMode('MERMA'); setReason(defaultReasons.MERMA[0]); }}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                mode === 'MERMA'
                  ? 'bg-white text-amber-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <AlertOctagon className="w-4 h-4" />
              Merma / Daño
            </button>
          </div>

          {/* Cantidad Input + Presets */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Cantidad a {mode === 'ENTRADA' ? 'Ingresar' : 'Retirar'}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value) || 0))}
                className="w-full text-center text-3xl font-black py-3 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
              />
            </div>

            {/* Botones de acceso rápido (+6, +12, +24) */}
            <div className="flex gap-2 mt-2">
              {presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setAmount(p)}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                    amount === p
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {p} unids
                </button>
              ))}
            </div>
          </div>

          {/* Motivo */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Motivo o Destino
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              {defaultReasons[mode].map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
              <option value="Otro motivo">Otro motivo personalizado...</option>
            </select>
          </div>

          {/* Previsualización del nuevo stock */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 flex items-center justify-between text-xs font-medium">
            <span className="text-slate-500">Nuevo stock resultante:</span>
            <span className="text-base font-black text-slate-900">
              {product.stock} ➔ {newStockPreview} unidades
            </span>
          </div>

          {/* Botón de acción */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || amount <= 0}
              className={`flex-1 py-3 px-4 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${
                mode === 'ENTRADA'
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25'
                  : mode === 'SALIDA'
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/25'
                    : 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/25'
              } disabled:opacity-50`}
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              {isSubmitting ? 'Guardando...' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
