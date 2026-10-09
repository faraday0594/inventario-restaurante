'use client';

import React from 'react';
import { 
  Wine, Camera, Plus, History, Search, Sparkles, User as UserIcon, 
  Shield, UtensilsCrossed, ChefHat, Calendar, Settings, DollarSign
} from 'lucide-react';
import { User } from '@/lib/types';

export type ActiveView = 'WAITRESS' | 'KITCHEN' | 'INVENTORY' | 'HISTORY';

interface NavbarProps {
  currentView: ActiveView;
  onSelectView: (view: ActiveView) => void;
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
  onOpenMenuManagement: () => void;
  onOpenUsersManagement: () => void;
}

export function Navbar({
  currentView,
  onSelectView,
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
  onOpenLogin,
  onOpenMenuManagement,
  onOpenUsersManagement
}: NavbarProps) {
  const isAdmin = currentUser?.role === 'ADMIN';
  const isCocina = currentUser?.role === 'COCINA';
  const isMesera = currentUser?.role === 'MESERA';
  const isEmpleado = currentUser?.role === 'EMPLEADO';

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Barra superior de marca y acciones */}
        <div className="py-2.5 flex items-center justify-between gap-3">
          {/* Logo y Nombre */}
          <div className="flex items-center gap-2.5">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md shrink-0 ${
              isCocina 
                ? 'bg-gradient-to-tr from-amber-500 to-orange-500 shadow-orange-500/20' 
                : 'bg-gradient-to-tr from-purple-600 via-indigo-600 to-emerald-500 shadow-purple-600/20'
            }`}>
              {isCocina ? <ChefHat className="w-5 h-5 stroke-[2.2]" /> : <UtensilsCrossed className="w-5 h-5 stroke-[2.2]" />}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                  {isCocina ? 'Cocina KDS' : 'Restaurante & Bodega'}
                </h1>
                <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-bold text-purple-800 bg-purple-100 px-2 py-0.5 rounded-full">
                  <Sparkles className="w-2.5 h-2.5 text-purple-600" /> Sistema Digital
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                {isCocina ? 'Pantalla de despacho de comandas' : isMesera ? 'Atención a mesas y consulta de bodega' : 'Comandas • Cocina KDS • Bodega'}
              </p>
            </div>
          </div>

          {/* Acciones principales y Usuario */}
          <div className="flex items-center gap-2">
            {/* Si es ADMIN: Gestionar Usuarios y Claves */}
            {isAdmin && (
              <button
                onClick={onOpenUsersManagement}
                className="p-2 sm:px-3 sm:py-2 rounded-xl text-indigo-700 bg-indigo-50 hover:bg-indigo-100 font-bold text-xs flex items-center gap-1.5 transition-colors border border-indigo-200/60"
                title="Administrar meseras, personal y claves PIN"
              >
                <UserIcon className="w-4 h-4 text-indigo-600" />
                <span className="hidden sm:inline">Personal & PINs</span>
              </button>
            )}

            {/* Si es ADMIN: Gestionar Menú de Platillos */}
            {isAdmin && (
              <button
                onClick={onOpenMenuManagement}
                className="p-2 sm:px-3 sm:py-2 rounded-xl text-purple-700 bg-purple-50 hover:bg-purple-100 font-bold text-xs flex items-center gap-1.5 transition-colors border border-purple-200/60"
                title="Configurar platillos del restaurante"
              >
                <UtensilsCrossed className="w-4 h-4 text-purple-600" />
                <span className="hidden lg:inline">Editar Menú Platos</span>
              </button>
            )}

            {/* BOTÓN HISTORIAL DE AUDITORÍA DE INVENTARIO: SOLO ADMIN */}
            {isAdmin && currentView === 'INVENTORY' && (
              <button
                onClick={onOpenHistory}
                className="p-2 sm:px-3 sm:py-2 rounded-xl text-slate-700 bg-slate-100 hover:bg-slate-200 font-bold text-xs flex items-center gap-1.5 transition-colors"
                title="Historial de movimientos de stock (Solo Admin)"
              >
                <History className="w-4 h-4 text-slate-700" />
                <span className="hidden md:inline">Auditoría Stock</span>
              </button>
            )}

            {/* BOTÓN NUEVA BEBIDA: SOLO ADMIN O EMPLEADO DE BODEGA */}
            {(isAdmin || isEmpleado) && currentView === 'INVENTORY' && (
              <button
                onClick={onOpenNewProduct}
                className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 transition-colors"
                title="Registrar nueva bebida al catálogo"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden md:inline">Nueva Bebida</span>
              </button>
            )}

            {/* BOTÓN ESCANEAR FACTURA CON IA: SOLO ADMIN O EMPLEADO DE BODEGA */}
            {(isAdmin || isEmpleado) && (
              <button
                onClick={onOpenScanner}
                className="px-3 py-2 sm:px-3.5 sm:py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm shadow-emerald-600/25 active:scale-95 transition-all"
                title="Cargar factura con foto de cámara o galería"
              >
                <Camera className="w-4 h-4" />
                <span className="hidden sm:inline">Escanear Factura</span>
                <span className="sm:hidden">Factura</span>
              </button>
            )}

            {/* Pastilla de Usuario Activo y Switch */}
            <button
              onClick={onOpenLogin}
              className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border flex items-center gap-2 transition-all ${
                isAdmin 
                  ? 'border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900' 
                  : isMesera
                  ? 'border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-900'
                  : isCocina
                  ? 'border-orange-300 bg-orange-50 hover:bg-orange-100 text-orange-900'
                  : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800'
              }`}
              title="Cambiar de usuario"
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                isAdmin 
                  ? 'bg-amber-200 text-amber-800' 
                  : isMesera
                  ? 'bg-purple-200 text-purple-800'
                  : isCocina
                  ? 'bg-orange-200 text-orange-800'
                  : 'bg-slate-200 text-slate-700'
              }`}>
                {isAdmin ? <Shield className="w-4 h-4 text-amber-700" /> : <UserIcon className="w-4 h-4" />}
              </div>
              <div className="text-left hidden sm:block">
                <span className="text-[11px] font-black block leading-none">
                  {currentUser?.name || 'Iniciar Sesión'}
                </span>
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                  {currentUser?.role || 'Ingresar'} (Cambiar)
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* NAVEGACIÓN PRINCIPAL DE MÓDULOS (SI ES COCINA, NO SE MUESTRAN PESTAÑAS AJENAS) */}
        {!isCocina && (
          <div className="py-2 flex items-center justify-start sm:justify-center gap-1.5 overflow-x-auto scrollbar-none border-t border-slate-100">
            {/* Módulo 1: Meseras / Comandas (Visible para Admin y Meseras) */}
            {(isAdmin || isMesera) && (
              <button
                onClick={() => onSelectView('WAITRESS')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  currentView === 'WAITRESS'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25 scale-[1.02]'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <UtensilsCrossed className="w-3.5 h-3.5" />
                <span>Mesas & Comandas</span>
              </button>
            )}

            {/* Módulo 2: Cocina KDS (Solo Admin, las cocineras están fijas aquí) */}
            {isAdmin && (
              <button
                onClick={() => onSelectView('KITCHEN')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  currentView === 'KITCHEN'
                    ? 'bg-orange-600 text-white shadow-md shadow-orange-600/25 scale-[1.02]'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <ChefHat className="w-3.5 h-3.5" />
                <span>Cocina (KDS)</span>
              </button>
            )}

            {/* Módulo 3: Historial de Ventas (Solo Admin) */}
            {isAdmin && (
              <button
                onClick={() => onSelectView('HISTORY')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  currentView === 'HISTORY'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 scale-[1.02]'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Historial Diario Ventas</span>
              </button>
            )}

            {/* Módulo 4: Bodega & Inventario (Visible para Admin, Meseras y Empleados) */}
            {(isAdmin || isMesera || isEmpleado) && (
              <button
                onClick={() => onSelectView('INVENTORY')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  currentView === 'INVENTORY'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25 scale-[1.02]'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Wine className="w-3.5 h-3.5" />
                <span>Bodega & Bebidas</span>
                {lowStockCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] flex items-center justify-center font-bold">
                    {lowStockCount}
                  </span>
                )}
              </button>
            )}
          </div>
        )}

        {/* Buscador y Filtros (SOLO VISIBLES CUANDO SE ESTÁ EN BODEGA & BEBIDAS) */}
        {currentView === 'INVENTORY' && (
          <div className="py-2.5 flex flex-col sm:flex-row gap-2.5 border-t border-slate-100 animate-fade-in">
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
                      ? 'bg-amber-500 text-white'
                      : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  Bajo Stock ({lowStockCount})
                </button>
              )}

              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => onSelectCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    selectedCategory === cat
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
