'use client';

import React, { useState, useRef } from 'react';
import { Product, User } from '@/lib/types';
import { compressAndResizeImage, compressAndResizeDataUrl } from '@/lib/imageUtils';
import { 
  X, Camera, ImageIcon, Sparkles, Check, AlertCircle, RefreshCw, PlusCircle, ArrowRight, Trash2, Filter
} from 'lucide-react';

interface MatchedItemUI {
  rawName: string;
  cleanName?: string;
  presentation?: string;
  quantity: number;
  unitPrice?: number;
  totalPrice?: number;
  matchedProductId: string | null;
  matchedProductName: string | null;
  confidence: number;
  isNew: boolean;
  isBeverage?: boolean;
  suggestedCategory?: string;
  newProductDetails?: {
    name: string;
    category: string;
    presentation: string;
    salePrice: number;
    minStock: number;
  };
}

interface InvoiceScannerModalProps {
  products: Product[];
  currentUser: Omit<User, 'pin'> | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CATEGORIES = ['Gaseosas', 'Aguas', 'Cervezas', 'Té y Jugos', 'Energizantes', 'Snacks y Golosinas', 'Otros'];

export function InvoiceScannerModal({
  products,
  currentUser,
  isOpen,
  onClose,
  onSuccess
}: InvoiceScannerModalProps) {
  if (!isOpen) return null;

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Datos extraídos
  const [supplier, setSupplier] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [items, setItems] = useState<MatchedItemUI[]>([]);
  const [isConfirming, setIsConfirming] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Dos inputs independientes para cámara vs galería del celular
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Manejar carga de imagen con compresión automática para celular
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
      // Comprime fotos de celular de 10MB-20MB a ~350KB para evitar el límite 4.5MB de Vercel
      const optimizedBase64 = await compressAndResizeImage(file, 1600, 0.82);
      setImagePreview(optimizedBase64);
      setItems([]);
      setSuccessMessage(null);
    } catch (err: any) {
      console.error('Error optimizando foto:', err);
      setError('No se pudo procesar la foto del teléfono. Por favor intenta de nuevo.');
    } finally {
      setIsCompressing(false);
      e.target.value = '';
    }
  };

  // Enviar a la API de MiniMax Vision
  const handleAnalyze = async () => {
    if (!imagePreview) return;

    setIsScanning(true);
    setError(null);
    setScanStep('Analizando factura con MiniMax-M3 Vision...');

    try {
      let payloadImage = imagePreview;
      // Reducción preventiva si el base64 es grande para asegurar que no toque el límite 4.5MB
      if (imagePreview.length > 2 * 1024 * 1024) {
        setScanStep('Optimizando foto para transmisión ultrarrápida...');
        payloadImage = await compressAndResizeDataUrl(imagePreview, 1400, 0.75);
      }

      const res = await fetch('/api/scan-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: payloadImage })
      });

      const rawText = await res.text();
      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch {
        if (res.status === 413 || rawText.toLowerCase().includes('entity too large')) {
          throw new Error('La foto es demasiado pesada para el servidor (límite 4.5MB). Por favor selecciona la foto nuevamente para comprimirla automáticamente.');
        }
        throw new Error(`Error en servidor (${res.status}): ${rawText.slice(0, 120)}`);
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'No se pudo procesar la factura con la IA');
      }

      setSupplier(data.supplier || 'Coca-Cola FEMSA');
      setInvoiceNumber(data.invoiceNumber || 'REM-' + Math.floor(1000 + Math.random() * 9000));
      
      const mappedItems: MatchedItemUI[] = (data.items || []).map((it: any) => {
        const isNew = !it.matchedProductId;
        const cleanName = it.cleanName || it.rawName;
        const presentation = it.presentation || (cleanName.includes('PET') ? 'Botella PET' : cleanName.includes('VIR') ? 'Botella Vidrio' : 'Unidad');
        const isBev = it.isBeverage !== false;
        const cat = it.suggestedCategory || (isBev ? 'Gaseosas' : 'Snacks y Golosinas');
        const unitCost = it.unitPrice || 0;
        const salePrice = unitCost > 0 ? Math.round((unitCost * 1.6) / 100) * 100 : 5000;

        return {
          rawName: it.rawName,
          cleanName,
          presentation,
          quantity: it.quantity || 1,
          unitPrice: unitCost,
          totalPrice: it.totalPrice || 0,
          matchedProductId: it.matchedProductId || null,
          matchedProductName: it.matchedProductName || null,
          confidence: it.confidence || 0,
          isNew,
          isBeverage: isBev,
          suggestedCategory: cat,
          newProductDetails: isNew ? {
            name: cleanName,
            category: cat,
            presentation,
            salePrice,
            minStock: 12
          } : undefined
        };
      });

      setItems(mappedItems);
      if (mappedItems.length === 0) {
        setError('MiniMax no detectó productos en esta imagen. Asegúrate de que la foto esté bien iluminada y nítida.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error de comunicación con MiniMax');
    } finally {
      setIsScanning(false);
      setScanStep('');
    }
  };

  // Cargar una factura de prueba predeterminada
  const handleLoadSample = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 420;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 600, 420);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('COCA-COLA SOPORTE DE ENTREGA', 40, 45);
      ctx.font = '14px sans-serif';
      ctx.fillText('Cliente: RESTAURANTE DONDE ANA Y EL SASON', 40, 75);
      ctx.fillText('Consecutivo: 00001   Fecha: 05.10.2026', 40, 95);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(40, 110, 520, 2);
      ctx.fillStyle = '#0f172a';
      ctx.font = '13px monospace';
      ctx.fillText('POS  DESCRIPCION                    CANT  UNIDS   V.UNIT', 40, 135);
      ctx.fillText(' 1   QUATRO CHOICE 350ML VIR(30)    1 CJ     30   62.500', 40, 170);
      ctx.fillText(' 2   COCA COLA 1.5LT PET(12) Nvo    1 CJ     12   65.000', 40, 205);
      ctx.fillText(' 3   CHAO FRESA 350GR KIT24(1)      2 CJ      2    7.800', 40, 240);
      ctx.fillText(' 4   AGUA BRISA GAS PET 600ML (24)  2 CJ     48   34.000', 40, 275);
      ctx.fillText(' 5   COCA-COLA 350ML VIR(30)        1 CJ     30   62.500', 40, 310);
      ctx.fillText(' 6   COCA-COLA 400ML PET# (12)      1 CJ     12   30.000', 40, 345);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(40, 365, 520, 2);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('VALOR TOTAL: $273.200', 360, 395);
    }
    const sampleDataUrl = canvas.toDataURL('image/jpeg');
    setImagePreview(sampleDataUrl);
    setItems([]);
    setError(null);
  };

  // Descartar una sola línea (ej: si no vende dulces o no quiere esa línea)
  const handleDiscardItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  // Omitir todos los productos que no sean bebidas
  const handleDiscardNonBeverages = () => {
    setItems(prev => prev.filter(it => it.isBeverage !== false));
  };

  // Confirmar lote de productos e ingresar al inventario
  const handleConfirmBatch = async () => {
    if (items.length === 0) return;

    setIsConfirming(true);
    try {
      const payload = {
        supplier,
        invoiceNumber,
        user: currentUser,
        items: items.map(it => ({
          rawName: it.rawName,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          productId: it.matchedProductId,
          createNew: it.isNew,
          newProductDetails: it.newProductDetails
        }))
      };

      const res = await fetch('/api/confirm-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const rawText = await res.text();
      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(`Error inesperado del servidor (${res.status}): ${rawText.slice(0, 120)}`);
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al actualizar inventario');
      }

      setSuccessMessage(`¡Listo! Se ingresaron ${data.count} productos correctamente a la bodega.`);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Error al confirmar');
    } finally {
      setIsConfirming(false);
    }
  };

  const totalUnits = items.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
  const nonBeverageCount = items.filter(it => it.isBeverage === false).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Cabecera */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-emerald-50 via-teal-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/30">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900">Escanear Factura / Remisión</h2>
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                  <Sparkles className="w-3 h-3 text-emerald-600" /> MiniMax M3 Vision
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Reconoce marcas, cajas, unidades y calcula el stock</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-200/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido con scroll */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-700 text-xs font-medium">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Atención:</strong>
                {error}
              </div>
            </div>
          )}

          {successMessage && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-emerald-800 text-sm font-bold animate-fade-in">
              <Check className="w-5 h-5 text-emerald-600 shrink-0" />
              {successMessage}
            </div>
          )}

          {/* ÁREA DE SELECCIÓN DE FOTO: Dos botones claros (Cámara vs Galería) */}
          {!imagePreview && (
            <div className="border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-3xl p-8 text-center transition-colors bg-slate-50/50 hover:bg-emerald-50/20">
              {/* Input 1: Cámara en vivo */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
              />

              {/* Input 2: Galería / Almacenamiento del teléfono */}
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                <Camera className="w-8 h-8 stroke-[1.8]" />
              </div>

              <h3 className="text-base font-bold text-slate-800 mb-1">
                ¿Cómo quieres montar la factura?
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mb-5">
                Puedes tomar una foto ahora mismo o seleccionar una foto ya guardada en tu galería de WhatsApp, descargas o documentos.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                {/* Botón 1: Cámara en vivo */}
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all"
                >
                  <Camera className="w-4 h-4" /> Tomar Foto Ahora
                </button>

                {/* Botón 2: Galería del celular */}
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-slate-900/20 transition-all"
                >
                  <ImageIcon className="w-4 h-4" /> Elegir de Galería / Archivos
                </button>

                {/* Botón 3: Demo */}
                <button
                  type="button"
                  onClick={handleLoadSample}
                  className="w-full sm:w-auto px-4 py-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors"
                >
                  📄 Probar Factura Demo
                </button>
              </div>
            </div>
          )}

          {/* Previsualización de Imagen cargada */}
          {imagePreview && (
            <div className="space-y-4">
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 group max-h-56">
                <img
                  src={imagePreview}
                  alt="Factura subida"
                  className="w-full h-56 object-contain"
                />
                <button
                  onClick={() => {
                    setImagePreview(null);
                    setItems([]);
                    setError(null);
                  }}
                  className="absolute top-3 right-3 p-2 bg-slate-900/80 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold backdrop-blur-sm transition-all flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Cambiar foto
                </button>
              </div>

              {/* Botón de análisis si aún no se ha analizado */}
              {items.length === 0 && !isScanning && (
                <button
                  onClick={handleAnalyze}
                  className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-600/30 transition-all active:scale-[0.99]"
                >
                  <Sparkles className="w-5 h-5 text-emerald-200" />
                  Analizar Factura con MiniMax IA
                </button>
              )}

              {/* Indicador de progreso */}
              {isScanning && (
                <div className="p-6 rounded-2xl bg-emerald-50/60 border border-emerald-100 text-center space-y-3 animate-pulse">
                  <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-sm font-bold text-emerald-900">
                    {scanStep || 'Analizando factura con MiniMax-M3...'}
                  </p>
                  <p className="text-xs text-emerald-700">
                    Extrayendo referencias, calculando unidades por fardo y emparejando...
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Resultados extraídos y conciliación */}
          {items.length > 0 && (
            <div className="space-y-4 pt-2">
              {/* Información de cabecera de la factura */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex-1 min-w-[140px]">
                  <label className="text-[10px] text-slate-400 font-bold uppercase block">Proveedor</label>
                  <input
                    type="text"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    className="font-bold text-slate-800 bg-white px-2 py-1 border border-slate-200 rounded-lg w-full text-xs"
                  />
                </div>
                <div className="flex-1 min-w-[100px]">
                  <label className="text-[10px] text-slate-400 font-bold uppercase block">Factura / Soporte</label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="font-bold text-slate-800 bg-white px-2 py-1 border border-slate-200 rounded-lg w-full text-xs"
                  />
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Total a Ingresar</span>
                  <span className="text-base font-black text-emerald-700">+{totalUnits} unidades</span>
                </div>
              </div>

              {/* Alerta de productos no-bebida si existen */}
              {nonBeverageCount > 0 && (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-amber-900">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Se detectó <strong>{nonBeverageCount} producto que no es bebida</strong> (ej: dulces o comestibles).</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDiscardNonBeverages}
                    className="px-3 py-1 bg-amber-200 hover:bg-amber-300 text-amber-900 font-bold rounded-lg text-[11px] transition-colors"
                  >
                    Omitir no-bebidas
                  </button>
                </div>
              )}

              {/* Lista de productos para verificar */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-1">
                  <span>Productos detectados ({items.length})</span>
                  <span>Verifica o edita antes de guardar</span>
                </div>

                {items.map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-2xl border transition-all space-y-3 shadow-sm ${
                      item.isBeverage === false 
                        ? 'border-amber-200 bg-amber-50/20' 
                        : item.isNew 
                          ? 'border-indigo-200 bg-indigo-50/10' 
                          : 'border-slate-200 bg-white'
                    }`}
                  >
                    {/* Fila Superior: Nombre Factura + Cantidad + Botón Descartar */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                            En Factura:
                          </span>
                          {item.isBeverage === false ? (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                              🍬 No Bebida / Confitería
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                              🥤 Bebida
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-black text-slate-900">
                          {item.rawName}
                        </p>
                      </div>

                      {/* Cantidad editable + Botón Borrar */}
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">
                            Unidades
                          </span>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-xs font-bold text-emerald-700">+</span>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => {
                                const val = Math.max(1, parseInt(e.target.value) || 1);
                                const updated = [...items];
                                updated[idx].quantity = val;
                                setItems(updated);
                              }}
                              className="w-16 text-center text-sm font-black py-1 px-1 border border-slate-200 rounded-lg bg-emerald-50 text-emerald-900"
                            />
                          </div>
                        </div>

                        {/* Botón descartar esta línea */}
                        <button
                          type="button"
                          onClick={() => handleDiscardItem(idx)}
                          className="p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition-colors mt-2"
                          title="Descartar este producto de la factura"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Emparejamiento con producto existente o Crear nuevo */}
                    <div className="pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-2 mb-2 text-xs">
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-semibold text-slate-600 shrink-0">Destino en Bodega:</span>

                        <select
                          value={item.isNew ? 'CREATE_NEW' : (item.matchedProductId || '')}
                          onChange={(e) => {
                            const val = e.target.value;
                            const updated = [...items];
                            if (val === 'CREATE_NEW') {
                              updated[idx].isNew = true;
                              updated[idx].matchedProductId = null;
                              updated[idx].newProductDetails = {
                                name: item.cleanName || item.rawName,
                                category: item.suggestedCategory || (item.isBeverage ? 'Gaseosas' : 'Snacks y Golosinas'),
                                presentation: item.presentation || 'Unidad',
                                salePrice: item.unitPrice ? Math.round((item.unitPrice * 1.6) / 100) * 100 : 5000,
                                minStock: 12
                              };
                            } else {
                              updated[idx].isNew = false;
                              updated[idx].matchedProductId = val;
                              const prod = products.find(p => p.id === val);
                              updated[idx].matchedProductName = prod?.name || null;
                            }
                            setItems(updated);
                          }}
                          className="flex-1 font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500"
                        >
                          <option value="CREATE_NEW">➕ Crear como NUEVA Referencia en Catálogo</option>
                          <optgroup label="Emparejar con producto existente">
                            {products.map(p => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.presentation}) [Stock: {p.stock}]
                              </option>
                            ))}
                          </optgroup>
                        </select>
                      </div>

                      {/* Si es NUEVO producto, mostrar campos editables para que quede perfecto */}
                      {item.isNew && item.newProductDetails && (
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 mt-2">
                          <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">
                            Detalles de la nueva referencia:
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div>
                              <label className="text-[10px] text-slate-500 font-bold block">Nombre</label>
                              <input
                                type="text"
                                value={item.newProductDetails.name}
                                onChange={(e) => {
                                  const updated = [...items];
                                  if (updated[idx].newProductDetails) {
                                    updated[idx].newProductDetails!.name = e.target.value;
                                  }
                                  setItems(updated);
                                }}
                                className="w-full text-xs font-semibold p-1.5 border border-slate-200 rounded-lg bg-white"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-500 font-bold block">Categoría</label>
                              <select
                                value={item.newProductDetails.category}
                                onChange={(e) => {
                                  const updated = [...items];
                                  if (updated[idx].newProductDetails) {
                                    updated[idx].newProductDetails!.category = e.target.value;
                                  }
                                  setItems(updated);
                                }}
                                className="w-full text-xs font-semibold p-1.5 border border-slate-200 rounded-lg bg-white"
                              >
                                {CATEGORIES.map(c => (
                                  <option key={c} value={c}>{c}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-500 font-bold block">Presentación</label>
                              <input
                                type="text"
                                value={item.newProductDetails.presentation}
                                onChange={(e) => {
                                  const updated = [...items];
                                  if (updated[idx].newProductDetails) {
                                    updated[idx].newProductDetails!.presentation = e.target.value;
                                  }
                                  setItems(updated);
                                }}
                                className="w-full text-xs font-semibold p-1.5 border border-slate-200 rounded-lg bg-white"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer con botón de confirmación */}
        {items.length > 0 && (
          <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between gap-3">
            <button
              onClick={() => {
                setItems([]);
                setImagePreview(null);
              }}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-white transition-colors"
            >
              Descartar Todo
            </button>
            <button
              onClick={handleConfirmBatch}
              disabled={isConfirming}
              className="flex-1 py-3 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all disabled:opacity-50"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              {isConfirming ? 'Guardando en bodega...' : `Confirmar e Ingresar +${totalUnits} Unidades`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
