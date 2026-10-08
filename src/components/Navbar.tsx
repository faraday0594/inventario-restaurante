'use client';

import React from 'react';
import { Wine, Camera, Plus, History, Search, Sparkles, User as UserIcon, Shield, LogOut } from 'lucide-react';
import { User } from '@/lib/types';

interface NavbarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  categories: string[];
  lowStockCount: number;
  currentUser: Omit<User, 'pin'> | null;
  onOpenScanner: () => void;
  onOpenNewProduct: () => void;
  onOpenHistory: () => void;
  onOpenLogin: () => void;
}

export function Navbar({
  searchTerm,
  onSearchChange,
  selectedCategory,
  onSelectCategory,
  categories,
  lowStockCount,
  currentUser,
  onOpenScanner,
  onOpenNewProduct,
  onOpenHistory,
  onOpenLogin
}: NavbarProps) {
  const isAdmin = currentUser?.role === 'ADMIN';

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Barra superior de marca y acciones */}
        <div className="py-3 flex items-center justify-between gap-3">
          {/* Logo y Nombre */}
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
              <Wine className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                  Bodega & Bebidas
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                  <Sparkles className="w-2.5 h-2.5 text-emerald-600" /> MiniMax Vision
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Control de stock de restaurante</p>
            </div>
          </div>

          {/* Acciones principales y Usuario */}
          <div className="flex items-center gap-2">
            {/* BOTÓN HISTORIAL: SOLO VISIBLE PARA ADMIN */}
            {isAdmin && (
              <button
                onClick={onOpenHistory}
                className="p-2 sm:px-3 sm:py-2 rounded-xl text-slate-700 bg-slate-100 hover:bg-slate-200 font-bold text-xs flex items-center gap-1.5 transition-colors"
                title="Historial de auditoría (Solo Admin)"
              >
                <History className="w-4 h-4 text-slate-700" />
                <span className="hidden md:inline">Auditoría / Historial</span>
              </button>
            )}

            {/* BOTÓN NUEVA BEBIDA */}
            <button
              onClick={onOpenNewProduct}
              className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 transition-colors"
              title="Registrar nueva bebida al catálogo"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden md:inline">Nueva Bebida</span>
            </button>

            {/* BOTÓN ESTRELLA: Escanear Factura (Disponible para todos) */}
            <button
              onClick={onOpenScanner}
              className="px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-emerald-600/25 active:scale-95 transition-all"
            >
              <Camera className="w-4 h-4" />
              <span>Escanear Factura</span>
            </button>

            {/* Pastilla de Usuario Activo y Switch */}
            <button
              onClick={onOpenLogin}
              className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border flex items-center gap-2 transition-all ${
                isAdmin 
                  ? 'border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900' 
                  : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800'
              }`}
              title="Cambiar de usuario"
            >
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs ${
                isAdmin ? 'bg-amber-200 text-amber-800' : 'bg-slate-200 text-slate-700'
              }`}>
                {isAdmin ? <Shield className="w-3.5 h-3.5 text-amber-700" /> : <UserIcon className="w-3.5 h-3.5" />}
              </div>
              <div className="text-left hidden sm:block">
                <span className="text-[11px] font-black block leading-none">
                  {currentUser?.name || 'Iniciar Sesión'}
                </span>
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                  {isAdmin ? 'Admin' : 'Empleado'} (Cambiar)
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Buscador y Filtros */}
        <div className="py-2.5 flex flex-col sm:flex-row gap-2.5 border-t border-slate-100">
          {/* Buscador */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar gaseosa, cerveza, agua o código..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-100 focus:bg-white text-xs sm:text-sm font-semibold rounded-xl border border-transparent focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all"
            />
          </div>

          {/* Chips de Categorías */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <button
              onClick={() => onSelectCategory('TODAS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategory === 'TODAS'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todas
            </button>

            {lowStockCount > 0 && (
              <button
                onClick={() => onSelectCategory('BAJO_STOCK')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  selectedCategory === 'BAJO_STOCK'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                }`}
              >
                ⚠️ Stock Bajo ({lowStockCount})
              </button>
            )}

            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => onSelectCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
