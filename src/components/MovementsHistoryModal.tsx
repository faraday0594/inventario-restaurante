'use client';

import React, { useState } from 'react';
import { Movement } from '@/lib/types';
import { X, History, ArrowDownRight, ArrowUpRight, AlertOctagon, User, Shield, Search } from 'lucide-react';

interface MovementsHistoryModalProps {
  movements: Movement[];
  isOpen: boolean;
  onClose: () => void;
}

export function MovementsHistoryModal({
  movements,
  isOpen,
  onClose
}: MovementsHistoryModalProps) {
  if (!isOpen) return null;

  const [filterUser, setFilterUser] = useState<string>('TODOS');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleString('es-CO', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  // Extraer lista única de operadores que han hecho movimientos
  const uniqueUsers = Array.from(new Set(movements.map(m => m.userName || 'Sistema'))).filter(Boolean);

  const filteredMovements = movements.filter(m => {
    const userName = m.userName || 'Sistema';
    if (filterUser !== 'TODOS' && userName !== filterUser) {
      return false;
    }
    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase();
      const matchProd = m.productName.toLowerCase().includes(query);
      const matchReason = m.reason.toLowerCase().includes(query);
      const matchUser = userName.toLowerCase().includes(query);
      return matchProd || matchReason || matchUser;
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Cabecera */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900">Auditoría de Movimientos</h2>
                <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                  Solo Administrador
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Supervisa qué empleado ingresó stock con facturas o creó productos
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

        {/* Filtros por usuario y buscador */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/40 flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filtrar por bebida, factura o motivo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setFilterUser('TODOS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                filterUser === 'TODOS'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Todos los usuarios
            </button>
            {uniqueUsers.map(u => (
              <button
                key={u}
                onClick={() => setFilterUser(u)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
                  filterUser === u
                    ? 'bg-amber-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <User className="w-3 h-3" />
                {u}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de Movimientos */}
        <div className="p-5 overflow-y-auto flex-1 space-y-3">
          {filteredMovements.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <History className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-semibold">No se encontraron movimientos registrados</p>
            </div>
          ) : (
            filteredMovements.map((mov) => {
              const isEntrada = mov.type === 'ENTRADA';
              const isMerma = mov.type === 'MERMA';
              const isAdmin = mov.userRole === 'ADMIN';

              return (
                <div
                  key={mov.id}
                  className="p-3.5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      isEntrada 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : isMerma 
                          ? 'bg-amber-100 text-amber-700' 
                          : 'bg-rose-100 text-rose-700'
                    }`}>
                      {isEntrada ? (
                        <ArrowUpRight className="w-5 h-5" />
                      ) : isMerma ? (
                        <AlertOctagon className="w-5 h-5" />
                      ) : (
                        <ArrowDownRight className="w-5 h-5" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-slate-900">{mov.productName}</h4>
                        
                        {/* PASTILLA DE QUIÉN LO HIZO */}
                        <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md ${
                          isAdmin 
                            ? 'bg-amber-100 text-amber-900' 
                            : 'bg-indigo-50 text-indigo-800 border border-indigo-100'
                        }`}>
                          {isAdmin ? <Shield className="w-3 h-3 text-amber-600" /> : <User className="w-3 h-3 text-indigo-600" />}
                          {mov.userName || 'Sistema'}
                        </span>

                        <span className="text-[10px] text-slate-400 font-medium">
                          {formatDate(mov.createdAt)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 font-medium mt-1">
                        {mov.reason}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 pl-12 sm:pl-0">
                    <span className={`text-sm font-black ${
                      isEntrada 
                        ? 'text-emerald-700' 
                        : isMerma 
                          ? 'text-amber-700' 
                          : 'text-rose-600'
                    }`}>
                      {isEntrada ? `+${mov.quantity}` : `-${mov.quantity}`} unids
                    </span>
                    <span className="text-[10px] text-slate-400 block font-medium">
                      {mov.previousStock} ➔ {mov.newStock} en stock
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between text-xs font-semibold text-slate-500">
          <span>Mostrando {filteredMovements.length} movimientos</span>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
