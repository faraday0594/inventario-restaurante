'use client';

import React, { useState, useEffect } from 'react';
import { 
  Database, CheckCircle2, AlertTriangle, RefreshCw, X, 
  Server, HardDrive, ShieldCheck, ExternalLink, HelpCircle
} from 'lucide-react';
import { DbStatusInfo } from '@/lib/storage';

interface DbStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: (connected: boolean) => void;
}

export function DbStatusModal({ isOpen, onClose, onStatusChange }: DbStatusModalProps) {
  const [status, setStatus] = useState<DbStatusInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/db-status', { cache: 'no-store' });
      const data: DbStatusInfo = await res.json();
      setStatus(data);
      if (onStatusChange) {
        onStatusChange(Boolean(data.connected));
      }
    } catch (err: any) {
      setError(err.message || 'Error al conectar con la API de diagnóstico');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        
        {/* Cabecera */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-md ${
              status?.connected 
                ? 'bg-emerald-500 text-white shadow-emerald-500/20' 
                : 'bg-amber-500 text-white shadow-amber-500/20'
            }`}>
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                Estado de la Base de Datos
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Diagnóstico de persistencia y conexión en la nube
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
          
          {loading && !status ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
              <p className="text-sm font-semibold text-slate-600">Verificando conexión con PostgreSQL...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
              <div className="flex items-center gap-2 font-bold mb-1">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                Error de diagnóstico
              </div>
              <p>{error}</p>
            </div>
          ) : status ? (
            <>
              {/* Tarjeta de Estado Principal */}
              {status.connected ? (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950">
                  <div className="flex items-center gap-2.5 mb-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <span className="text-xs font-black tracking-wide uppercase px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-800 mr-2">
                        Conectada y Activa
                      </span>
                      <h3 className="text-sm font-bold inline">PostgreSQL en la Nube</h3>
                    </div>
                  </div>
                  <p className="text-xs text-emerald-800 leading-relaxed">
                    ✅ La base de datos está respondiendo correctamente. Todos los productos que crees, modifiques o elimines se guardan permanentemente en PostgreSQL y nunca se perderán entre reinicios.
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950">
                  <div className="flex items-center gap-2.5 mb-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                    <div>
                      <span className="text-xs font-black tracking-wide uppercase px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 mr-2">
                        {status.isServerless ? 'Sin Base de Datos en la Nube' : 'Modo Archivo Local'}
                      </span>
                      <h3 className="text-sm font-bold inline">Almacenamiento Temporal</h3>
                    </div>
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed font-medium">
                    {status.isServerless
                      ? '⚠️ Atención: El sistema está corriendo en Vercel sin una base de datos PostgreSQL conectada. Los cambios se guardan temporalmente en la memoria (/tmp) y se borrarán en el próximo reinicio o despliegue. Por eso los productos eliminados o creados parecen reaparecer.'
                      : 'El sistema está leyendo y guardando en el archivo local data/inventory.json. Para producción en la nube (Vercel), debes enlazar una base de datos PostgreSQL.'
                    }
                  </p>
                </div>
              )}

              {/* Detalles Técnicos */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-slate-400" /> Entorno de Ejecución:
                  </span>
                  <span className="font-bold text-slate-800">
                    {status.isServerless ? 'Vercel Serverless (Cloud)' : 'Localhost / Servidor Node'}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-slate-400" /> Tipo de Almacenamiento:
                  </span>
                  <span className={`font-bold px-2 py-0.5 rounded-md ${
                    status.connected ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {status.storageType === 'postgres' ? 'PostgreSQL (Persistente)' : status.storageType === 'ephemeral_tmp' ? '/tmp (Efímero Vercel)' : 'data/inventory.json (Local)'}
                  </span>
                </div>

                {status.envVarUsed && (
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                    <span className="text-slate-500 font-medium">Variable Detectada:</span>
                    <span className="font-mono text-[11px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                      {status.envVarUsed}
                    </span>
                  </div>
                )}

                {status.databaseName && (
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                    <span className="text-slate-500 font-medium">Nombre de Base de Datos:</span>
                    <span className="font-bold text-slate-800">{status.databaseName}</span>
                  </div>
                )}

                {status.maskedHost && (
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                    <span className="text-slate-500 font-medium">Host / Endpoint:</span>
                    <span className="font-mono text-[10px] text-slate-700 max-w-[220px] truncate" title={status.maskedHost}>
                      {status.maskedHost}
                    </span>
                  </div>
                )}

                {status.error && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
                    <div className="font-bold mb-0.5">Detalle del Error:</div>
                    <p className="font-mono text-[11px] break-all">{status.error}</p>
                  </div>
                )}
              </div>

              {/* Conteo de Datos en Vivo */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-base sm:text-lg font-black text-slate-900">
                    {status.recordCount?.products || 0}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-500 uppercase">Productos</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-base sm:text-lg font-black text-slate-900">
                    {status.recordCount?.menuItems || 0}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-500 uppercase">Platos Menú</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-base sm:text-lg font-black text-slate-900">
                    {status.recordCount?.users || 0}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-500 uppercase">Usuarios</div>
                </div>
              </div>

              {/* Guía si NO está conectada */}
              {!status.connected && (
                <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 text-indigo-950 space-y-2">
                  <div className="flex items-center gap-1.5 font-black text-xs text-indigo-900">
                    <HelpCircle className="w-4 h-4 text-indigo-600" />
                    ¿Cómo conectar la base de datos en Vercel gratis?
                  </div>
                  <ol className="text-xs space-y-1.5 text-indigo-800 list-decimal list-inside leading-relaxed pl-1">
                    <li>
                      Ingresa al panel de tu proyecto en <span className="font-bold">Vercel.com</span>.
                    </li>
                    <li>
                      Ve a la pestaña <span className="font-bold">Storage</span> y haz clic en <span className="font-bold">Create Database</span>.
                    </li>
                    <li>
                      Selecciona <span className="font-bold">Neon Postgres</span> (gratis) y dale a <span className="font-bold">Connect</span>.
                    </li>
                    <li>
                      Vercel creará automáticamente la variable <code className="bg-indigo-100 text-indigo-900 font-bold px-1 rounded">POSTGRES_URL</code>.
                    </li>
                    <li>
                      ¡Listo! Vuelve a hacer clic en <span className="font-bold">Volver a Probar</span> abajo y tus datos quedarán guardados para siempre.
                    </li>
                  </ol>
                </div>
              )}
            </>
          ) : null}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between gap-3">
          <button
            onClick={fetchStatus}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center gap-2 border border-indigo-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Verificando...' : 'Volver a Probar Conexión'}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}
