'use client';

import React, { useState, useEffect } from 'react';
import { Product, User } from '@/lib/types';
import { X, Check, PackagePlus, Trash2, Lock } from 'lucide-react';

interface NewProductModalProps {
  productToEdit?: Product | null;
  currentUser: Omit<User, 'pin'> | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: any) => Promise<void>;
  onDelete?: (productId: string) => Promise<void>;
}

const CATEGORIES = ['Gaseosas', 'Aguas', 'Cervezas', 'Té y Jugos', 'Energizantes', 'Snacks y Golosinas', 'Licores', 'Otros'];

export function NewProductModal({
  productToEdit,
  currentUser,
  isOpen,
  onClose,
  onSave,
  onDelete
}: NewProductModalProps) {
  if (!isOpen) return null;

  const [name, setName] = useState('');
  const [category, setCategory] = useState('Gaseosas');
  const [presentation, setPresentation] = useState('Botella PET 400ml');
  const [stock, setStock] = useState<number>(0);
  const [minStock, setMinStock] = useState<number>(12);
  const [costPrice, setCostPrice] = useState<number>(2500);
  const [salePrice, setSalePrice] = useState<number>(5000);
  const [barcode, setBarcode] = useState('');
  const [aliases, setAliases] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (productToEdit) {
      setName(productToEdit.name);
      setCategory(productToEdit.category);
      setPresentation(productToEdit.presentation);
      setStock(productToEdit.stock);
      setMinStock(productToEdit.minStock);
      setCostPrice(productToEdit.costPrice);
      setSalePrice(productToEdit.salePrice);
      setBarcode(productToEdit.barcode || '');
      setAliases((productToEdit.aliases || []).join(', '));
    } else {
      setName('');
      setCategory('Gaseosas');
      setPresentation('Botella PET 400ml');
      setStock(0);
      setMinStock(12);
      setCostPrice(2500);
      setSalePrice(5000);
      setBarcode('');
      setAliases('');
    }
  }, [productToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const aliasArray = aliases
        .split(',')
        .map(a => a.trim())
        .filter(Boolean);

      await onSave({
        id: productToEdit?.id,
        name: name.trim(),
        category,
        presentation: presentation.trim(),
        stock: Number(stock) || 0,
        minStock: Number(minStock) || 0,
        costPrice: Number(costPrice) || 0,
        salePrice: Number(salePrice) || 0,
        barcode: barcode.trim() || undefined,
        aliases: aliasArray
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!productToEdit || !onDelete) return;
    if (confirm(`¿Estás seguro de eliminar "${productToEdit.name}" del catálogo?`)) {
      setIsSubmitting(true);
      try {
        await onDelete(productToEdit.id);
        onClose();
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Cabecera */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center">
              <PackagePlus className="w-5 h-5 text-slate-700" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {productToEdit ? 'Editar Bebida' : 'Nueva Bebida al Catálogo'}
              </h2>
              <p className="text-xs text-slate-500">Configura precios, presentación y niveles de stock</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-200/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Nombre Comercial *
            </label>
            <input
              type="text"
              required
              placeholder="Ej: Coca-Cola Sin Azúcar, Cerveza Águila Light"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Categoría
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Presentación
              </label>
              <input
                type="text"
                placeholder="Ej: Vidrio 350ml, PET 400ml, Lata"
                value={presentation}
                onChange={(e) => setPresentation(e.target.value)}
                className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Stock y Stock Mínimo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Stock Actual (unids)
                </label>
                {productToEdit && currentUser?.role !== 'ADMIN' && (
                  <span className="text-[10px] text-amber-700 font-bold flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Solo Admin
                  </span>
                )}
              </div>
              <input
                type="number"
                min="0"
                value={stock}
                disabled={Boolean(productToEdit && currentUser?.role !== 'ADMIN')}
                onChange={(e) => setStock(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Stock Mínimo (Alerta)
              </label>
              <input
                type="number"
                min="1"
                value={minStock}
                onChange={(e) => setMinStock(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-bold text-amber-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Precios de Costo y Venta */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Precio de Costo ($ COP)
              </label>
              <input
                type="number"
                min="0"
                step="50"
                value={costPrice}
                onChange={(e) => setCostPrice(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Precio de Venta ($ COP)
              </label>
              <input
                type="number"
                min="0"
                step="100"
                value={salePrice}
                onChange={(e) => setSalePrice(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-bold text-emerald-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Alias para la IA */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Nombres de Factura / Alias (separados por coma)
            </label>
            <input
              type="text"
              placeholder="Ej: CC PET 400, COCA COLA 400ML, CC RET"
              value={aliases}
              onChange={(e) => setAliases(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Ayuda a la IA a reconocer este producto automáticamente cuando escanees facturas de proveedores.
            </p>
          </div>

          {/* Botones */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
            {productToEdit && onDelete && currentUser?.role === 'ADMIN' ? (
              <button
                type="button"
                onClick={handleDelete}
                className="py-2.5 px-3 rounded-xl text-rose-600 hover:bg-rose-50 font-semibold text-xs flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-4 h-4" /> Eliminar Referencia
              </button>
            ) : <div />}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !name.trim()}
                className="py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/25 transition-all disabled:opacity-50"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                {isSubmitting ? 'Guardando...' : productToEdit ? 'Actualizar' : 'Guardar Producto'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
