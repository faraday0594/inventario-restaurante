'use client';

import React, { useState, useEffect } from 'react';
import { Product, User } from '@/lib/types';
import {
  X,
  Sparkles,
  Check,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  Wand2,
  CheckSquare,
  Square
} from 'lucide-react';

interface BeverageAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  currentUser: Omit<User, 'pin'> | null;
  onSuccess: () => void;
}

interface AuditRow {
  productId: string;
  category: string;
  currentName: string;
  currentPresentation: string;
  currentCostPrice: number;
  stock: number;
  fridgeStock: number;
  salePrice: number;
  suggestedName: string;
  suggestedCategory: string;
  suggestedPresentation: string;
  costInput: string;
  suggestedAliases: string[];
  reason: string;
  selected: boolean;
}

const CATEGORIES = ['Gaseosas', 'Aguas', 'Cervezas', 'Té y Jugos', 'Energizantes', 'Licores', 'Otros'];
const NON_BEVERAGE_CATEGORIES = ['Snacks y Golosinas', 'Comidas y Platos'];

export function BeverageAuditModal({
  isOpen,
  onClose,
  products,
  currentUser,
  onSuccess
}: BeverageAuditModalProps) {
  const [step, setStep] = useState<'READY' | 'ANALYZING' | 'REVIEW' | 'SAVING'>('READY');
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setStep('READY');
      setRows([]);
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const beverageCount = products.filter(
    p => !NON_BEVERAGE_CATEGORIES.includes(p.category)
  ).length;

  const handleAnalyze = async () => {
    setStep('ANALYZING');
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/audit-beverages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ includeAll: false })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al analizar bebidas con MiniMax');
      }
      const mapped: AuditRow[] = (data.items || []).map((item: any) => ({
        productId: item.productId,
        category: item.category,
        currentName: item.currentName,
        currentPresentation: item.currentPresentation,
        currentCostPrice: item.currentCostPrice,
        stock: item.stock,
        fridgeStock: item.fridgeStock || 0,
        salePrice: item.salePrice,
        suggestedName: item.suggestedName,
        suggestedCategory: item.suggestedCategory || item.category,
        suggestedPresentation: item.suggestedPresentation,
        costInput: String(item.suggestedCostPrice ?? item.currentCostPrice ?? 0),
        suggestedAliases: item.suggestedAliases || [],
        reason: item.reason || '',
        selected: true
      }));
      setRows(mapped);
      setStep('REVIEW');
    } catch (err: any) {
      setErrorMsg(err.message || 'No se pudo completar el análisis con IA.');
      setStep('READY');
    }
  };

  const handleToggleAll = (selectAll: boolean) => {
    setRows(prev => prev.map(r => ({ ...r, selected: selectAll })));
  };

  const handleRowChange = (index: number, field: keyof AuditRow, value: any) => {
    setRows(prev =>
      prev.map((r, idx) => (idx === index ? { ...r, [field]: value } : r))
    );
  };

  const handleCostChange = (index: number, raw: string) => {
    if (raw === '') {
      handleRowChange(index, 'costInput', '');
      return;
    }
    const digitsOnly = raw.replace(/\D/g, '');
    if (digitsOnly === '') {
      handleRowChange(index, 'costInput', '');
      return;
    }
    handleRowChange(index, 'costInput', digitsOnly.replace(/^0+(\d)/, '$1'));
  };

  const selectedCount = rows.filter(r => r.selected).length;

  const handleConfirm = async () => {
    if (selectedCount === 0) return;
    setStep('SAVING');
    setErrorMsg('');
    try {
      const payloadItems = rows
        .filter(r => r.selected)
        .map(r => ({
          productId: r.productId,
          suggestedName: r.suggestedName.trim() || r.currentName,
          suggestedCategory: r.suggestedCategory || r.category,
          suggestedPresentation: r.suggestedPresentation.trim() || r.currentPresentation,
          suggestedCostPrice: Math.max(0, parseInt(r.costInput, 10) || 0),
          suggestedAliases: r.suggestedAliases,
          selected: true
        }));

      const res = await fetch('/api/confirm-beverage-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: payloadItems,
          user: currentUser
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al guardar cambios');
      }
      setSuccessMsg(
        `Se actualizaron ${data.updatedCount} bebidas (nombres técnicos y costos). Stock y precios de venta permanecen intactos.`
      );
      onSuccess();
      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar los cambios.');
      setStep('REVIEW');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/65 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Cabecera */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-indigo-50/80 to-emerald-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">
                Auditoría IA de Bebidas (MiniMax)
              </h2>
              <p className="text-xs text-slate-600">
                Estandariza nombres técnicos y estima costos de fábrica sin tocar stock ni precio de venta
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-200/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* Garantía de seguridad */}
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-900 space-y-1">
              <p className="font-bold">
                Protección estricta: Stock de Bodega, Stock de Nevera y Precio de Venta NO se modificarán.
              </p>
              <p className="text-emerald-800/90">
                MiniMax estimará costos mayoristas de referencia en Colombia y nombres técnicos estandarizados. Puedes editar cualquier campo antes de guardar.
              </p>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              {successMsg}
            </div>
          )}

          {step === 'READY' && (
            <div className="py-8 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Sparkles className="w-7 h-7" />
              </div>
              <div className="max-w-md mx-auto space-y-1.5">
                <h3 className="text-base font-bold text-slate-900">
                  {beverageCount} bebidas listas en bodega para analizar
                </h3>
                <p className="text-xs text-slate-500">
                  Se enviará el listado actual de bebidas a MiniMax para sugerir nombre técnico, presentación, alias de factura y costo mayorista estimado.
                </p>
              </div>
              <button
                type="button"
                disabled={beverageCount === 0}
                onClick={handleAnalyze}
                className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm inline-flex items-center gap-2 shadow-lg shadow-indigo-600/25 disabled:opacity-50 transition-all"
              >
                <Sparkles className="w-4 h-4" />
                Analizar {beverageCount} Bebidas con MiniMax
              </button>
            </div>
          )}

          {step === 'ANALYZING' && (
            <div className="py-12 text-center space-y-3">
              <Loader2 className="w-10 h-10 mx-auto text-indigo-600 animate-spin" />
              <p className="text-sm font-bold text-slate-800">
                Analizando {beverageCount} bebidas con MiniMax...
              </p>
              <p className="text-xs text-slate-500">
                Buscando nombres técnicos estandarizados y costos de referencia
              </p>
            </div>
          )}

          {(step === 'REVIEW' || step === 'SAVING') && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-700">
                  {selectedCount} de {rows.length} bebidas seleccionadas para actualizar
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleAll(true)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                  >
                    Seleccionar todas
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleAll(false)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                  >
                    Ninguna
                  </button>
                </div>
              </div>

              <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
                {rows.map((row, idx) => (
                  <div
                    key={row.productId}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      row.selected
                        ? 'border-indigo-200 bg-indigo-50/30'
                        : 'border-slate-200 bg-slate-50/50 opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => handleRowChange(idx, 'selected', !row.selected)}
                        className="mt-1 text-indigo-600 hover:text-indigo-800 shrink-0"
                        title={row.selected ? 'Deseleccionar' : 'Seleccionar'}
                      >
                        {row.selected ? (
                          <CheckSquare className="w-5 h-5" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-400" />
                        )}
                      </button>

                      <div className="flex-1 space-y-2.5">
                        {/* Datos actuales + garantías */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                              Actual ({row.category}):
                            </span>{' '}
                            <span className="text-xs font-bold text-slate-800">
                              {row.currentName}
                            </span>{' '}
                            <span className="text-xs text-slate-500">
                              ({row.currentPresentation})
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] font-bold">
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                              Stock: {row.stock} bod / {row.fridgeStock} nev (Intacto)
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                              Venta: ${row.salePrice.toLocaleString('es-CO')} (Intacto)
                            </span>
                          </div>
                        </div>

                        {/* Campos editables sugeridos */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-indigo-700 mb-1">
                              Nombre Técnico Sugerido
                            </label>
                            <input
                              type="text"
                              value={row.suggestedName}
                              disabled={!row.selected || step === 'SAVING'}
                              onChange={e =>
                                handleRowChange(idx, 'suggestedName', e.target.value)
                              }
                              className="w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold uppercase text-indigo-700 mb-1">
                              Categoría (Actual: {row.category})
                            </label>
                            <select
                              value={row.suggestedCategory}
                              disabled={!row.selected || step === 'SAVING'}
                              onChange={e =>
                                handleRowChange(idx, 'suggestedCategory', e.target.value)
                              }
                              className="w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            >
                              {Array.from(new Set([...CATEGORIES, row.suggestedCategory])).map(c => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold uppercase text-indigo-700 mb-1">
                              Presentación / Envase
                            </label>
                            <input
                              type="text"
                              value={row.suggestedPresentation}
                              disabled={!row.selected || step === 'SAVING'}
                              onChange={e =>
                                handleRowChange(idx, 'suggestedPresentation', e.target.value)
                              }
                              className="w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold uppercase text-indigo-700 mb-1">
                              Costo Fábrica Est. (Actual: ${row.currentCostPrice.toLocaleString('es-CO')})
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              placeholder="0"
                              value={row.costInput}
                              disabled={!row.selected || step === 'SAVING'}
                              onChange={e => handleCostChange(idx, e.target.value)}
                              className="w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            />
                          </div>
                        </div>

                        {row.reason && (
                          <p className="text-[11px] text-slate-500 italic">
                            IA: {row.reason}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Pie */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={step === 'SAVING'}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-white transition-colors"
          >
            Cerrar
          </button>
          {(step === 'REVIEW' || step === 'SAVING') && (
            <button
              type="button"
              disabled={selectedCount === 0 || step === 'SAVING'}
              onClick={handleConfirm}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center gap-2 shadow-lg shadow-emerald-600/25 disabled:opacity-50 transition-all"
            >
              {step === 'SAVING' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Aplicar {selectedCount} Cambios
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
