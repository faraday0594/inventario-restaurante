'use client';

import React, { useState, useEffect } from 'react';
import { Product, User } from '@/lib/types';
import { X, Check, Snowflake, Package, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react';
import { playTapSound } from '@/lib/soundUtils';

interface FridgeTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  currentUser: Omit<User, 'pin'> | null;
  onSuccess?: () => void;
}

export function FridgeTransferModal({
  isOpen,
  onClose,
  product,
  currentUser,
  onSuccess
}: FridgeTransferModalProps) {
  if (!isOpen || !product) return null;

  const [direction, setDirection] = useState<'TO_FRIDGE' | 'TO_BODEGA'>('TO_FRIDGE');
  const [quantity, setQuantity] = useState<number>(6);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bodegaStock = product.stock;
  const fridgeStock = product.fridgeStock || 0;

  useEffect(() => {
    setError(null);
    if (direction === 'TO_FRIDGE') {
      setQuantity(Math.min(6, Math.max(1, bodegaStock)));
    } else {
      setQuantity(Math.min(6, Math.max(1, fridgeStock)));
    }
  }, [product, direction]);

  const maxAvailable = direction === 'TO_FRIDGE' ? bodegaStock : fridgeStock;
  const presets = [1, 6, 12, 24];

  const resultingBodega = direction === 'TO_FRIDGE' 
    ? Math.max(0, bodegaStock - quantity)
    : bodegaStock + quantity;

  const resultingFridge = direction === 'TO_FRIDGE'
    ? fridgeStock + quantity
    : Math.max(0, fridgeStock - quantity);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quantity <= 0) {
      setError('La cantidad debe ser mayor a 0');
      return;
    }

    if (quantity > maxAvailable) {
      setError(
        direction === 'TO_FRIDGE'
          ? `Solo hay ${bodegaStock} unidades en bodega para trasladar.`
          : `Solo hay ${fridgeStock} unidades en la nevera para regresar.`
      );
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/products/fridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          quantity,
          direction,
          user: currentUser
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al procesar el traslado');
      }

      playTapSound();
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        
        {/* Encabezado */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-cyan-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-600 text-white flex items-center justify-center shadow-md shadow-cyan-600/20">
              <Snowflake className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                Salida a Nevera de Bodega
              </h2>
              <p className="text-xs text-slate-500 font-medium truncate max-w-[220px]">
                {product.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Tarjetas de Stock Actual */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center">
              <div className="text-[10px] font-black uppercase text-slate-400 flex items-center justify-center gap-1 mb-1">
                <Package className="w-3 h-3 text-slate-500" /> Bodega Principal
              </div>
              <div className="text-2xl font-black text-slate-800">
                {bodegaStock}
                <span className="text-xs font-medium text-slate-400 ml-1">unid</span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-cyan-50/60 border border-cyan-200 text-center">
              <div className="text-[10px] font-black uppercase text-cyan-700 flex items-center justify-center gap-1 mb-1">
                <Snowflake className="w-3 h-3 text-cyan-600" /> Nevera / Barra
              </div>
              <div className="text-2xl font-black text-cyan-900">
                {fridgeStock}
                <span className="text-xs font-medium text-cyan-600 ml-1">frías</span>
              </div>
            </div>
          </div>

          {/* Selector de Dirección del Traslado */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl">
            <button
              type="button"
              onClick={() => setDirection('TO_FRIDGE')}
              className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                direction === 'TO_FRIDGE'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Snowflake className="w-3.5 h-3.5" />
              Pasar a Nevera
            </button>

            <button
              type="button"
              onClick={() => setDirection('TO_BODEGA')}
              className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                direction === 'TO_BODEGA'
                  ? 'bg-slate-800 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              Regresar a Bodega
            </button>
          </div>

          {/* Cantidad Input + Presets */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-slate-600">
                Cantidad a {direction === 'TO_FRIDGE' ? 'pasar a enfriar' : 'devolver a bodega'}:
              </label>
              <span className="text-[11px] font-bold text-slate-400">
                Máximo: {maxAvailable} unids
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max={maxAvailable}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 0))}
                className="w-full text-center text-3xl font-black py-2.5 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-slate-50 text-slate-900"
              />
            </div>

            {/* Presets (+1, +6, +12, +24, Todo) */}
            <div className="grid grid-cols-5 gap-1.5 mt-2">
              {presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setQuantity(Math.min(p, maxAvailable || 1))}
                  disabled={maxAvailable < p}
                  className={`py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    quantity === p
                      ? 'bg-cyan-100 border-cyan-300 text-cyan-800'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30'
                  }`}
                >
                  +{p}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, maxAvailable))}
                disabled={maxAvailable <= 0}
                className="py-1.5 rounded-xl text-xs font-black border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all disabled:opacity-30"
              >
                Todo
              </button>
            </div>
          </div>

          {/* Vista previa resultante */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold space-y-1.5">
            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-slate-400" /> Stock resultante en Bodega:
              </span>
              <span className="font-black text-slate-900">
                {bodegaStock} ➔ <span className="text-slate-950 font-black">{resultingBodega}</span> unids
              </span>
            </div>
            <div className="flex items-center justify-between text-cyan-800">
              <span className="flex items-center gap-1.5">
                <Snowflake className="w-3.5 h-3.5 text-cyan-600" /> Stock resultante en Nevera:
              </span>
              <span className="font-black text-cyan-950">
                {fridgeStock} ➔ <span className="text-cyan-700 font-black">{resultingFridge}</span> frías
              </span>
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || quantity <= 0 || maxAvailable <= 0}
              className="flex-1 py-3 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/30 active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Guardando en Nube...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  Confirmar ({quantity} unids)
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
