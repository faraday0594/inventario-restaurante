'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ProteinPortion, ProteinMovement, User } from '@/lib/types';
import {
  X,
  Plus,
  Minus,
  Trash2,
  Edit3,
  History,
  Scale,
  Calendar,
  AlertTriangle,
  Check,
  Loader2,
  PackagePlus,
  Utensils
} from 'lucide-react';

interface ProteinInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: Omit<User, 'pin'> | null;
}

const PROTEIN_CATEGORIES = ['Res', 'Pollo', 'Cerdo', 'Pescado y Mariscos', 'Embutidos', 'Otros'];

function todayDateStr() {
  return new Date().toISOString().split('T')[0];
}

export function ProteinInventoryModal({
  isOpen,
  onClose,
  currentUser
}: ProteinInventoryModalProps) {
  const [tab, setTab] = useState<'LIST' | 'FORM' | 'BATCH' | 'HISTORY'>('LIST');
  const [proteins, setProteins] = useState<ProteinPortion[]>([]);
  const [movements, setMovements] = useState<ProteinMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [filterCat, setFilterCat] = useState('TODAS');

  // Formulario Crear / Editar Proteína
  const [editingProtein, setEditingProtein] = useState<ProteinPortion | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Res');
  const [weightInput, setWeightInput] = useState('200');
  const [portionsInput, setPortionsInput] = useState('0');
  const [minPortionsInput, setMinPortionsInput] = useState('10');
  const [costInput, setCostInput] = useState('0');
  const [salePriceInput, setSalePriceInput] = useState('0');
  const [entryDate, setEntryDate] = useState(todayDateStr());
  const [notes, setNotes] = useState('');

  // Formulario Ingresar / Descontar Lote
  const [batchProtein, setBatchProtein] = useState<ProteinPortion | null>(null);
  const [batchMode, setBatchMode] = useState<'ENTRADA' | 'SALIDA' | 'MERMA'>('ENTRADA');
  const [batchQtyInput, setBatchQtyInput] = useState('10');
  const [batchWeightInput, setBatchWeightInput] = useState('200');
  const [batchCostInput, setBatchCostInput] = useState('0');
  const [batchSaleInput, setBatchSaleInput] = useState('0');
  const [batchDate, setBatchDate] = useState(todayDateStr());
  const [batchReason, setBatchReason] = useState('');

  const fetchProteins = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/proteins', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error cargando proteínas');
      }
      setProteins(data.proteins || []);
      setMovements(data.movements || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'No se pudo cargar el inventario de proteínas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setTab('LIST');
      fetchProteins();
    }
  }, [isOpen]);

  const totals = useMemo(() => {
    const totalPortions = proteins.reduce((acc, p) => acc + p.portionsStock, 0);
    const totalKg = proteins.reduce(
      (acc, p) => acc + (p.portionsStock * p.portionWeightGrams) / 1000,
      0
    );
    const totalCostValue = proteins.reduce(
      (acc, p) => acc + p.portionsStock * p.costPerPortion,
      0
    );
    const lowCount = proteins.filter(p => p.portionsStock <= p.minPortions).length;
    return { totalPortions, totalKg, totalCostValue, lowCount };
  }, [proteins]);

  const filteredProteins = useMemo(() => {
    if (filterCat === 'TODAS') return proteins;
    return proteins.filter(p => p.category === filterCat);
  }, [proteins, filterCat]);

  if (!isOpen) return null;

  const isAdmin = currentUser?.role === 'ADMIN';

  const handleNumericChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const raw = e.target.value;
    if (raw === '') {
      setter('');
      return;
    }
    const digitsOnly = raw.replace(/\D/g, '');
    if (digitsOnly === '') {
      setter('');
      return;
    }
    setter(digitsOnly.replace(/^0+(\d)/, '$1'));
  };

  const openNewForm = () => {
    setEditingProtein(null);
    setName('');
    setCategory('Res');
    setWeightInput('200');
    setPortionsInput('0');
    setMinPortionsInput('10');
    setCostInput('0');
    setSalePriceInput('0');
    setEntryDate(todayDateStr());
    setNotes('');
    setErrorMsg('');
    setTab('FORM');
  };

  const openEditForm = (p: ProteinPortion) => {
    setEditingProtein(p);
    setName(p.name);
    setCategory(p.category);
    setWeightInput(String(p.portionWeightGrams));
    setPortionsInput(String(p.portionsStock));
    setMinPortionsInput(String(p.minPortions));
    setCostInput(String(p.costPerPortion));
    setSalePriceInput(String(p.salePrice));
    setEntryDate(p.lastEntryAt || todayDateStr());
    setNotes(p.notes || '');
    setErrorMsg('');
    setTab('FORM');
  };

  const openBatchModal = (p: ProteinPortion, mode: 'ENTRADA' | 'SALIDA' | 'MERMA') => {
    setBatchProtein(p);
    setBatchMode(mode);
    setBatchQtyInput('10');
    setBatchWeightInput(String(p.portionWeightGrams));
    setBatchCostInput(String(p.costPerPortion));
    setBatchSaleInput(String(p.salePrice));
    setBatchDate(todayDateStr());
    setBatchReason(
      mode === 'ENTRADA' ? 'Porcionado de lote nuevo' : mode === 'MERMA' ? 'Merma / pérdida' : 'Consumo de cocina'
    );
    setErrorMsg('');
    setTab('BATCH');
  };

  const handleSaveProtein = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/proteins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingProtein?.id,
          name: name.trim(),
          category,
          portionWeightGrams: Math.max(1, parseInt(weightInput, 10) || 200),
          portionsStock: Math.max(0, parseInt(portionsInput, 10) || 0),
          minPortions: Math.max(0, parseInt(minPortionsInput, 10) || 0),
          costPerPortion: Math.max(0, parseInt(costInput, 10) || 0),
          salePrice: Math.max(0, parseInt(salePriceInput, 10) || 0),
          entryDate,
          notes: notes.trim(),
          user: currentUser
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error guardando proteína');
      }
      await fetchProteins();
      setTab('LIST');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar proteína');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchProtein) return;
    const qty = Math.max(1, parseInt(batchQtyInput, 10) || 0);
    const delta = batchMode === 'ENTRADA' ? qty : -qty;

    setSaving(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/proteins', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proteinId: batchProtein.id,
          delta,
          type: batchMode,
          reason: batchReason.trim(),
          entryDate: batchDate,
          portionWeightGrams: Math.max(1, parseInt(batchWeightInput, 10) || batchProtein.portionWeightGrams),
          costPerPortion: Math.max(0, parseInt(batchCostInput, 10) || 0),
          salePrice: Math.max(0, parseInt(batchSaleInput, 10) || 0),
          user: currentUser
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error registrando movimiento');
      }
      await fetchProteins();
      setTab('LIST');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al registrar porciones');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: ProteinPortion) => {
    if (!isAdmin) return;
    if (!confirm(`¿Eliminar "${p.name}" del inventario de proteínas?`)) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/proteins?id=${encodeURIComponent(p.id)}&userRole=${encodeURIComponent(currentUser?.role || '')}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'No se pudo eliminar');
      }
      await fetchProteins();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/65 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Cabecera */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-rose-50/80 to-amber-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-md shadow-rose-600/20">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">
                Inventario de Proteínas y Porciones
              </h2>
              <p className="text-xs text-slate-600">
                Control por porción, peso en gramos, costos, precios y fechas de ingreso
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

        {/* Pestañas */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTab('LIST')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                tab === 'LIST'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              Porciones ({proteins.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('HISTORY')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all ${
                tab === 'HISTORY'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Historial de Ingresos ({movements.length})
            </button>
          </div>

          <button
            type="button"
            onClick={openNewForm}
            className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Nueva Proteína
          </button>
        </div>

        {/* Cuerpo */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {errorMsg}
            </div>
          )}

          {tab === 'LIST' && (
            <>
              {/* Resumen */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <p className="text-[11px] font-bold uppercase text-slate-500">Porciones Totales</p>
                  <p className="text-xl font-black text-slate-900 mt-0.5">{totals.totalPortions}</p>
                </div>
                <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200">
                  <p className="text-[11px] font-bold uppercase text-amber-700">Peso Total</p>
                  <p className="text-xl font-black text-amber-900 mt-0.5">
                    {totals.totalKg.toFixed(2)} kg
                  </p>
                </div>
                <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200">
                  <p className="text-[11px] font-bold uppercase text-emerald-700">Valor al Costo</p>
                  <p className="text-xl font-black text-emerald-900 mt-0.5">
                    ${totals.totalCostValue.toLocaleString('es-CO')}
                  </p>
                </div>
                <div className="p-3 rounded-2xl bg-rose-50/70 border border-rose-200">
                  <p className="text-[11px] font-bold uppercase text-rose-700">Stock Bajo</p>
                  <p className="text-xl font-black text-rose-900 mt-0.5">{totals.lowCount}</p>
                </div>
              </div>

              {/* Filtro por categoría */}
              <div className="flex flex-wrap gap-1.5">
                {['TODAS', ...PROTEIN_CATEGORIES].map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFilterCat(cat)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                      filterCat === cat
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {loading ? (
                <div className="py-12 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
                  <Loader2 className="w-7 h-7 animate-spin text-rose-600" />
                  Cargando inventario de proteínas...
                </div>
              ) : filteredProteins.length === 0 ? (
                <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-2xl space-y-2">
                  <Scale className="w-8 h-8 mx-auto text-slate-400" />
                  <p className="text-sm font-bold text-slate-700">
                    No hay proteínas registradas en esta categoría
                  </p>
                  <p className="text-xs text-slate-500">
                    Crea cortes como Pechuga, Sobrebarriga o Carne de Res con su peso por porción y fecha de ingreso.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredProteins.map(p => {
                    const isLow = p.portionsStock <= p.minPortions;
                    const totalKg = ((p.portionsStock * p.portionWeightGrams) / 1000).toFixed(2);
                    return (
                      <div
                        key={p.id}
                        className={`p-4 rounded-2xl border space-y-3 ${
                          isLow
                            ? 'border-rose-300 bg-rose-50/40'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold uppercase">
                                {p.category}
                              </span>
                              {isLow && (
                                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold">
                                  Stock bajo
                                </span>
                              )}
                            </div>
                            <h3 className="text-base font-extrabold text-slate-900 mt-1">
                              {p.name}
                            </h3>
                            <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                              <span className="font-semibold text-slate-700">
                                {p.portionWeightGrams} g / porción
                              </span>
                              <span>·</span>
                              <span>Total: {totalKg} kg</span>
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="text-2xl font-black text-slate-900">
                              {p.portionsStock}
                            </p>
                            <p className="text-[10px] font-bold uppercase text-slate-500">
                              porciones
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <div>
                            <span className="block text-[10px] text-slate-400 font-bold uppercase">Costo/Porc.</span>
                            <span className="font-bold text-slate-800">
                              ${p.costPerPortion.toLocaleString('es-CO')}
                            </span>
                          </div>
                          <div>
                            <span className="block text-[10px] text-slate-400 font-bold uppercase">Precio Venta</span>
                            <span className="font-bold text-emerald-700">
                              ${p.salePrice.toLocaleString('es-CO')}
                            </span>
                          </div>
                          <div>
                            <span className="block text-[10px] text-slate-400 font-bold uppercase">Últ. Ingreso</span>
                            <span className="font-semibold text-slate-700">
                              {p.lastEntryAt || '—'}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openBatchModal(p, 'ENTRADA')}
                              className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" /> Agregar Porciones
                            </button>
                            <button
                              type="button"
                              onClick={() => openBatchModal(p, 'SALIDA')}
                              className="px-2.5 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold inline-flex items-center gap-1"
                            >
                              <Minus className="w-3.5 h-3.5" /> Descontar
                            </button>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditForm(p)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                              title="Editar"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleDelete(p)}
                                className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                                title="Eliminar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {tab === 'FORM' && (
            <form onSubmit={handleSaveProtein} className="space-y-4 max-w-2xl mx-auto">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <PackagePlus className="w-5 h-5 text-rose-600" />
                  {editingProtein ? `Editar: ${editingProtein.name}` : 'Registrar Nueva Proteína'}
                </h3>
                <button
                  type="button"
                  onClick={() => setTab('LIST')}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800"
                >
                  ← Volver al listado
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Nombre de la Proteína / Corte *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Pechuga de Pollo, Sobrebarriga, Churrasco"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Categoría
                  </label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  >
                    {PROTEIN_CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Peso por Porción (g)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="200"
                    value={weightInput}
                    onChange={handleNumericChange(setWeightInput)}
                    className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    {editingProtein ? 'Porciones Actuales' : 'Porciones Iniciales'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={portionsInput}
                    onChange={handleNumericChange(setPortionsInput)}
                    className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Alerta Mínima (porc.)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="10"
                    value={minPortionsInput}
                    onChange={handleNumericChange(setMinPortionsInput)}
                    className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-amber-700 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Costo por Porción ($ COP)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={costInput}
                    onChange={handleNumericChange(setCostInput)}
                    className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Precio de Venta ($ COP)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={salePriceInput}
                    onChange={handleNumericChange(setSalePriceInput)}
                    className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-emerald-800 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Fecha de Ingreso
                  </label>
                  <input
                    type="date"
                    value={entryDate}
                    onChange={e => setEntryDate(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Notas / Proveedor (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: Carnicería Central, lote empacado al vacío"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTab('LIST')}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || !name.trim()}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs inline-flex items-center gap-2 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  {saving ? 'Guardando...' : editingProtein ? 'Actualizar Proteína' : 'Guardar Proteína'}
                </button>
              </div>
            </form>
          )}

          {tab === 'BATCH' && batchProtein && (
            <form onSubmit={handleSaveBatch} className="space-y-4 max-w-xl mx-auto">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-extrabold text-slate-900">
                  {batchMode === 'ENTRADA' ? 'Agregar Lote de Porciones' : 'Descontar Porciones'}: {batchProtein.name}
                </h3>
                <button
                  type="button"
                  onClick={() => setTab('LIST')}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800"
                >
                  ← Volver
                </button>
              </div>

              <div className="flex gap-2">
                {(['ENTRADA', 'SALIDA', 'MERMA'] as const).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setBatchMode(m)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                      batchMode === m
                        ? m === 'ENTRADA'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-amber-600 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {m === 'ENTRADA' ? '+ Ingreso' : m === 'SALIDA' ? '- Salida Cocina' : '- Merma'}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Cantidad de Porciones
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="10"
                    value={batchQtyInput}
                    onChange={handleNumericChange(setBatchQtyInput)}
                    className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-base font-black text-slate-900 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Fecha del Registro
                  </label>
                  <input
                    type="date"
                    value={batchDate}
                    onChange={e => setBatchDate(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                    Peso/Porc. (g)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={batchWeightInput}
                    onChange={handleNumericChange(setBatchWeightInput)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                    Costo/Porc. ($ COP)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={batchCostInput}
                    onChange={handleNumericChange(setBatchCostInput)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                    Venta ($ COP)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={batchSaleInput}
                    onChange={handleNumericChange(setBatchSaleInput)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Motivo / Detalle del Lote
                </label>
                <input
                  type="text"
                  placeholder="Ej: Compra carnicería, porcionado turno mañana"
                  value={batchReason}
                  onChange={e => setBatchReason(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-center justify-between">
                <span>
                  Peso del movimiento:{' '}
                  <strong>
                    {(
                      ((parseInt(batchQtyInput, 10) || 0) *
                        (parseInt(batchWeightInput, 10) || batchProtein.portionWeightGrams)) /
                      1000
                    ).toFixed(2)}{' '}
                    kg
                  </strong>
                </span>
                <span>
                  Stock actual: <strong>{batchProtein.portionsStock} porc.</strong>
                </span>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTab('LIST')}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  {saving ? 'Guardando...' : 'Confirmar Registro'}
                </button>
              </div>
            </form>
          )}

          {tab === 'HISTORY' && (
            <div className="space-y-2.5">
              {movements.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  Aún no hay movimientos de porciones registrados.
                </div>
              ) : (
                movements.map(m => (
                  <div
                    key={m.id}
                    className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            m.type === 'ENTRADA'
                              ? 'bg-emerald-100 text-emerald-800'
                              : m.type === 'MERMA'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {m.type}
                        </span>
                        <span className="text-xs font-extrabold text-slate-900">
                          {m.proteinName}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          ({m.portionWeightGrams}g × {Math.abs(m.portionsDelta)} = {(m.totalWeightGrams / 1000).toFixed(2)} kg)
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600">
                        {m.reason} · Por: <strong>{m.userName || 'Sistema'}</strong>
                      </p>
                    </div>

                    <div className="text-right">
                      <p
                        className={`text-sm font-black ${
                          m.portionsDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {m.portionsDelta >= 0 ? `+${m.portionsDelta}` : m.portionsDelta} porc.
                      </p>
                      <p className="text-[10px] text-slate-500 flex items-center justify-end gap-1">
                        <Calendar className="w-3 h-3" />
                        Ingreso: {m.entryDate} · Stock: {m.previousStock} → {m.newStock}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
