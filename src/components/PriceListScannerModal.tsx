'use client';

import React, { useState, useRef } from 'react';
import { Product, User, PriceListExtractedItem } from '@/lib/types';
import { compressAndResizeImage, compressAndResizeDataUrl } from '@/lib/imageUtils';
import { 
  X, Camera, ImageIcon, Sparkles, Check, AlertCircle, RefreshCw, 
  Trash2, CheckSquare, Square, DollarSign, Package, Tag, ArrowRight
} from 'lucide-react';
import { playTapSound } from '@/lib/soundUtils';

interface PriceListScannerModalProps {
  products: Product[];
  currentUser: Omit<User, 'pin'> | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CATEGORIES = [
  'Gaseosas', 'Aguas', 'Cervezas', 'Té y Jugos', 'Energizantes', 
  'Licores', 'Snacks y Golosinas', 'Comidas y Platos', 'Otros'
];

export function PriceListScannerModal({
  products,
  currentUser,
  isOpen,
  onClose,
  onSuccess
}: PriceListScannerModalProps) {
  if (!isOpen) return null;

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Datos extraídos
  const [listTitle, setListTitle] = useState<string>('');
  const [items, setItems] = useState<PriceListExtractedItem[]>([]);
  const [isConfirming, setIsConfirming] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Por favor selecciona una imagen válida (JPG, PNG, WebP)');
      return;
    }

    setIsCompressing(true);
    setError(null);

    try {
      const optimizedBase64 = await compressAndResizeImage(file, 1600, 0.82);
      setImagePreview(optimizedBase64);
      setItems([]);
      setSuccessMessage(null);
    } catch (err: any) {
      console.error('Error optimizando foto:', err);
      setError('No se pudo procesar la foto. Por favor intenta de nuevo.');
    } finally {
      setIsCompressing(false);
      e.target.value = '';
    }
  };

  const handleAnalyze = async () => {
    if (!imagePreview) return;

    setIsScanning(true);
    setError(null);
    setScanStep('Leyendo productos y precios con MiniMax-M3 Vision...');

    try {
      let payloadImage = imagePreview;
      if (imagePreview.length > 2 * 1024 * 1024) {
        setScanStep('Optimizando foto para procesamiento rápido...');
        payloadImage = await compressAndResizeDataUrl(imagePreview, 1400, 0.75);
      }

      const res = await fetch('/api/scan-price-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: payloadImage })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error procesando la lista de precios');
      }

      setListTitle(data.title || 'Lista de Precios');
      setItems(data.items || []);

      if (!data.items || data.items.length === 0) {
        setError('No se identificaron productos con precios legibles en la foto. Intenta con una toma más cercana o mejor iluminada.');
      } else {
        playTapSound();
      }
    } catch (err: any) {
      console.error('Error al analizar foto:', err);
      setError(err.message || 'Error al conectar con la IA de reconocimiento');
    } finally {
      setIsScanning(false);
    }
  };

  // Modificar ítem en la tabla
  const handleItemChange = (index: number, field: keyof PriceListExtractedItem, value: any) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleToggleSelectAll = () => {
    const allSelected = items.every(i => i.selected !== false);
    setItems(prev => prev.map(i => ({ ...i, selected: !allSelected })));
  };

  const handleSaveToDatabase = async () => {
    const selectedItems = items.filter(i => i.selected !== false);
    if (selectedItems.length === 0) {
      setError('Selecciona al menos un producto para guardar.');
      return;
    }

    setIsConfirming(true);
    setError(null);

    try {
      const res = await fetch('/api/confirm-price-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: selectedItems,
          user: currentUser
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al guardar productos en la base de datos');
      }

      playTapSound();
      setSuccessMessage(`¡Listo! Se guardaron ${data.createdCount} productos nuevos y se actualizaron ${data.updatedCount} precios en la base de datos.`);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1600);
    } catch (err: any) {
      setError(err.message || 'Error al guardar en el servidor');
    } finally {
      setIsConfirming(false);
    }
  };

  const newItemsCount = items.filter(i => i.isNew && i.selected !== false).length;
  const updateItemsCount = items.filter(i => !i.isNew && i.selected !== false).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[94vh] flex flex-col">
        
        {/* Cabecera */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-emerald-50/80 via-teal-50/60 to-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
              <Sparkles className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                  Escanear Lista de Precios con Foto
                </h2>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  IA MiniMax
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Toma foto a una carta o lista con precios al frente para crear o actualizar productos masivamente
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

        {/* Mensaje de éxito */}
        {successMessage && (
          <div className="p-4 bg-emerald-600 text-white text-sm font-bold text-center flex items-center justify-center gap-2 animate-fade-in">
            <Check className="w-5 h-5" />
            {successMessage}
          </div>
        )}

        {/* Contenido */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* PASO 1: Captura o Carga de Foto */}
          {!items.length ? (
            <div className="space-y-4">
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
              />
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              {!imagePreview ? (
                <div className="border-2 border-dashed border-slate-200 rounded-3xl p-8 text-center bg-slate-50/50 flex flex-col items-center justify-center gap-4">
                  <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-inner">
                    <Camera className="w-8 h-8 stroke-[2]" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      Toma o sube una foto de la lista de precios
                    </h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 font-medium">
                      Puede ser una carta del restaurante, una pizarra, lista escrita a mano o folleto de proveedor con los nombres y sus precios.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm pt-2">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      disabled={isCompressing}
                      className="flex-1 py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 active:scale-95 transition-all"
                    >
                      <Camera className="w-4 h-4" />
                      Tomar Foto con Cámara
                    </button>
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      disabled={isCompressing}
                      className="flex-1 py-3.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-900 text-white font-black text-xs flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all"
                    >
                      <ImageIcon className="w-4 h-4" />
                      Galería / Archivos
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative rounded-3xl overflow-hidden border border-slate-200 bg-slate-900 flex items-center justify-center max-h-72">
                    <img
                      src={imagePreview}
                      alt="Previsualización de lista"
                      className="max-h-72 object-contain w-auto"
                    />
                    <div className="absolute top-3 right-3 flex gap-2">
                      <button
                        onClick={() => setImagePreview(null)}
                        className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-900 text-white text-xs font-bold flex items-center gap-1.5 backdrop-blur-md"
                      >
                        <Trash2 className="w-4 h-4 text-rose-400" /> Cambiar Foto
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-center pt-2">
                    <button
                      type="button"
                      disabled={isScanning}
                      onClick={handleAnalyze}
                      className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-emerald-600/30 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {isScanning ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>{scanStep || 'Procesando con IA...'}</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 stroke-[2.5]" />
                          <span>Escanear y Reconocer Productos con IA</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // PASO 2: Revisión y Confirmación de Productos Reconocidos
            <div className="space-y-4">
              {/* Barra superior de conteo y controles */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleToggleSelectAll}
                    className="p-1 rounded-lg text-slate-600 hover:bg-slate-200"
                    title="Seleccionar o deseleccionar todos"
                  >
                    {items.every(i => i.selected !== false) ? (
                      <CheckSquare className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-400" />
                    )}
                  </button>
                  <div>
                    <h3 className="text-xs font-black text-slate-900">
                      {items.length} productos detectados en la lista
                    </h3>
                    <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 mt-0.5">
                      <span className="text-emerald-700">✨ {newItemsCount} nuevos para crear</span>
                      <span>•</span>
                      <span className="text-indigo-700">🔄 {updateItemsCount} precios a actualizar</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => { setItems([]); setImagePreview(null); }}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 underline self-end sm:self-auto"
                >
                  Tomar otra foto
                </button>
              </div>

              {/* Lista editable de productos */}
              <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
                {items.map((item, idx) => {
                  const isSelected = item.selected !== false;
                  return (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        isSelected 
                          ? item.isNew 
                            ? 'bg-emerald-50/40 border-emerald-200' 
                            : 'bg-indigo-50/30 border-indigo-200'
                          : 'bg-slate-50/50 border-slate-200 opacity-60'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => handleItemChange(idx, 'selected', !isSelected)}
                          className="mt-1"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-emerald-600" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-400" />
                          )}
                        </button>

                        <div className="flex-1 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                item.isNew
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                              }`}>
                                {item.isNew ? '✨ Nuevo Producto' : '🔄 Actualizar Precio'}
                              </span>

                              {!item.isNew && item.currentPrice && (
                                <span className="text-[11px] font-semibold text-slate-500">
                                  Precio actual: ${item.currentPrice.toLocaleString('es-CO')}
                                </span>
                              )}
                            </div>

                            <div className="text-[11px] text-slate-400 font-mono italic">
                              Detectado: "{item.rawName}"
                            </div>
                          </div>

                          {/* Campos Editables */}
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                            {/* Nombre comercial */}
                            <div className="sm:col-span-5">
                              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                                Nombre del Producto
                              </label>
                              <input
                                type="text"
                                value={item.cleanName}
                                onChange={e => handleItemChange(idx, 'cleanName', e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-900 focus:ring-1 focus:ring-emerald-500"
                              />
                            </div>

                            {/* Categoría */}
                            <div className="sm:col-span-3">
                              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                                Categoría
                              </label>
                              <select
                                value={item.category}
                                onChange={e => handleItemChange(idx, 'category', e.target.value)}
                                className="w-full px-2 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-emerald-500"
                              >
                                {CATEGORIES.map(c => (
                                  <option key={c} value={c}>{c}</option>
                                ))}
                              </select>
                            </div>

                            {/* Precio de Venta */}
                            <div className="sm:col-span-2">
                              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                                Precio Venta ($)
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="100"
                                value={item.salePrice}
                                onChange={e => handleItemChange(idx, 'salePrice', Number(e.target.value) || 0)}
                                className="w-full px-2 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-black text-emerald-700 focus:ring-1 focus:ring-emerald-500 text-right"
                              />
                            </div>

                            {/* Stock Inicial (si es nuevo) */}
                            {item.isNew && (
                              <div className="sm:col-span-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                                  Stock Inicial
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  value={item.initialStock || 0}
                                  onChange={e => handleItemChange(idx, 'initialStock', Number(e.target.value) || 0)}
                                  className="w-full px-2 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-black text-slate-800 focus:ring-1 focus:ring-emerald-500 text-center"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={isConfirming || (newItemsCount === 0 && updateItemsCount === 0)}
              onClick={handleSaveToDatabase}
              className="py-3 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 active:scale-95 transition-all disabled:opacity-50"
            >
              {isConfirming ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Guardando en Base de Datos...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  Guardar en Catálogo y Nube ({newItemsCount + updateItemsCount} seleccionados)
                </>
              )}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
