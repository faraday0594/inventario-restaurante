'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { User, UserRole } from '@/lib/types';
import { 
  Shield, User as UserIcon, Lock, Check, AlertCircle, X, 
  ChevronRight, ArrowLeft, Delete, UtensilsCrossed, ChefHat 
} from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onLoginSuccess: (user: Omit<User, 'pin'>) => void;
  currentUser?: Omit<User, 'pin'> | null;
}

export function LoginModal({
  isOpen,
  onClose,
  onLoginSuccess,
  currentUser
}: LoginModalProps) {
  if (!isOpen) return null;

  const [users, setUsers] = useState<Omit<User, 'pin'>[]>([]);
  const [selectedUser, setSelectedUser] = useState<Omit<User, 'pin'> | null>(null);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'MESERA' | 'COCINA' | 'ADMIN'>('ALL');
  // En móviles: paso 'USER' (seleccionar empleado) o 'PIN' (teclado)
  const [mobileStep, setMobileStep] = useState<'USER' | 'PIN'>('USER');

  // Cargar usuarios disponibles
  useEffect(() => {
    fetch('/api/auth')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.users) {
          setUsers(data.users);
          if (currentUser) {
            setSelectedUser(currentUser);
          } else if (data.users.length > 0) {
            setSelectedUser(data.users[0]);
          }
        }
      })
      .catch(err => console.error('Error cargando usuarios:', err));
  }, [currentUser]);

  // Soporte para teclado físico (escritorio / laptop)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedUser) return;
      if (e.key >= '0' && e.key <= '9') {
        handleKeypadPress(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Enter') {
        if (pin.length >= 4) {
          attemptLogin(selectedUser.id, pin);
        }
      } else if (e.key === 'Escape' && onClose && currentUser) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedUser, pin, currentUser]);

  const handleSelectUser = (u: Omit<User, 'pin'>) => {
    setSelectedUser(u);
    setPin('');
    setError(null);
    setMobileStep('PIN'); // en móvil pasa directo a ingresar el PIN
  };

  const handleKeypadPress = (digit: string) => {
    if (pin.length < 6) {
      const newPin = pin + digit;
      setPin(newPin);
      setError(null);
      // Auto-enviar al completar 4 dígitos
      if (newPin.length === 4 && selectedUser) {
        attemptLogin(selectedUser.id, newPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
    setError(null);
  };

  const attemptLogin = async (userId: string, inputPin: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, pin: inputPin })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'PIN incorrecto');
      }

      localStorage.setItem('inventario_user', JSON.stringify(data.user));
      onLoginSuccess(data.user);
    } catch (err: any) {
      setError(err.message || 'PIN incorrecto');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !pin) return;
    attemptLogin(selectedUser.id, pin);
  };

  // Filtrado de usuarios por rol
  const filteredUsers = useMemo(() => {
    if (roleFilter === 'ALL') return users;
    return users.filter(u => u.role === roleFilter);
  }, [users, roleFilter]);

  // Contadores para pestañas
  const counts = useMemo(() => {
    return {
      all: users.length,
      mesera: users.filter(u => u.role === 'MESERA').length,
      cocina: users.filter(u => u.role === 'COCINA').length,
      admin: users.filter(u => u.role === 'ADMIN').length
    };
  }, [users]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="bg-white w-full max-w-md sm:max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Cabecera */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-900 leading-tight">Control de Acceso</h2>
              <p className="text-[11px] text-slate-500 font-medium">Restaurante & Bodega</p>
            </div>
          </div>
          {onClose && currentUser && (
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200/50 transition-colors"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Mensaje de Error si ocurre */}
        {error && (
          <div className="mx-4 mt-3 sm:mx-6 p-2.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-rose-700 text-xs font-bold animate-shake shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        {/* CUERPO PRINCIPAL: 2 Columnas en Escritorio / Tablet, Pasos en Móvil */}
        <div className="flex-1 overflow-hidden sm:grid sm:grid-cols-2 sm:divide-x sm:divide-slate-100 min-h-0">
          
          {/* COLUMNA 1: SELECCIÓN DE USUARIO (visible siempre en escritorio; en móvil solo en paso 'USER') */}
          <div className={`p-3.5 sm:p-5 flex flex-col min-h-0 overflow-hidden ${
            mobileStep === 'PIN' ? 'hidden sm:flex' : 'flex'
          }`}>
            <div className="flex items-center justify-between mb-2 shrink-0">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                1. Selecciona tu Usuario:
              </label>
              <span className="text-[10px] font-bold text-slate-400">
                {filteredUsers.length} disponibles
              </span>
            </div>

            {/* Pestañas de filtro por rol */}
            <div className="flex items-center gap-1 mb-2.5 overflow-x-auto scrollbar-none pb-0.5 shrink-0">
              <button
                type="button"
                onClick={() => setRoleFilter('ALL')}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all ${
                  roleFilter === 'ALL'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Todos ({counts.all})
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter('MESERA')}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all ${
                  roleFilter === 'MESERA'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                }`}
              >
                🍽️ Meseras ({counts.mesera})
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter('COCINA')}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all ${
                  roleFilter === 'COCINA'
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'bg-orange-50 text-orange-700 hover:bg-orange-100'
                }`}
              >
                🍳 Cocina ({counts.cocina})
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter('ADMIN')}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all ${
                  roleFilter === 'ADMIN'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                }`}
              >
                👑 Admin ({counts.admin})
              </button>
            </div>

            {/* Lista deslizable de usuarios */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-[180px] max-h-[50vh] sm:max-h-[380px]">
              {filteredUsers.map(u => {
                const isSelected = selectedUser?.id === u.id;
                const isAdmin = u.role === 'ADMIN';
                const isMesera = u.role === 'MESERA';
                const isCocina = u.role === 'COCINA';

                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleSelectUser(u)}
                    className={`w-full p-2.5 rounded-2xl border text-left flex items-center justify-between transition-all touch-manipulation ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/70 shadow-xs ring-1 ring-emerald-500'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                        isAdmin 
                          ? 'bg-amber-100 text-amber-800' 
                          : isMesera
                          ? 'bg-purple-100 text-purple-700'
                          : isCocina
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {isAdmin ? (
                          <Shield className="w-4 h-4 text-amber-600" />
                        ) : isCocina ? (
                          <ChefHat className="w-4 h-4 text-orange-600" />
                        ) : isMesera ? (
                          <UtensilsCrossed className="w-4 h-4 text-purple-600" />
                        ) : (
                          <UserIcon className="w-4 h-4" />
                        )}
                      </div>
                      <div className="truncate">
                        <span className="text-xs font-black text-slate-900 block truncate leading-tight">
                          {u.name}
                        </span>
                        <span className={`text-[10px] font-bold block ${
                          isAdmin 
                            ? 'text-amber-700' 
                            : isMesera
                            ? 'text-purple-600'
                            : isCocina
                            ? 'text-orange-600'
                            : 'text-slate-500'
                        }`}>
                          {isAdmin 
                            ? '👑 Administrador' 
                            : isMesera
                            ? '🍽️ Mesera'
                            : isCocina
                            ? '🍳 Cocinera'
                            : '📦 Bodega'}
                        </span>
                      </div>
                    </div>
                    {isSelected ? (
                      <Check className="w-4 h-4 text-emerald-600 stroke-[3] shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-300 sm:hidden shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* COLUMNA 2: ENTRADA DE PIN (visible siempre en escritorio; en móvil solo en paso 'PIN') */}
          <div className={`p-3.5 sm:p-5 flex flex-col justify-between overflow-y-auto ${
            mobileStep === 'USER' ? 'hidden sm:flex' : 'flex'
          }`}>
            {selectedUser ? (
              <form onSubmit={handleSubmit} className="space-y-3 flex flex-col h-full justify-between">
                <div>
                  {/* Tarjeta de usuario seleccionado con botón de cambiar en móvil */}
                  <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                        selectedUser.role === 'ADMIN' 
                          ? 'bg-amber-100 text-amber-800' 
                          : selectedUser.role === 'MESERA'
                          ? 'bg-purple-100 text-purple-700'
                          : selectedUser.role === 'COCINA'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {selectedUser.role === 'ADMIN' ? (
                          <Shield className="w-4 h-4 text-amber-600" />
                        ) : selectedUser.role === 'COCINA' ? (
                          <ChefHat className="w-4 h-4 text-orange-600" />
                        ) : selectedUser.role === 'MESERA' ? (
                          <UtensilsCrossed className="w-4 h-4 text-purple-600" />
                        ) : (
                          <UserIcon className="w-4 h-4" />
                        )}
                      </div>
                      <div className="truncate">
                        <span className="text-xs font-black text-slate-900 block truncate leading-tight">
                          {selectedUser.name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {selectedUser.role === 'ADMIN' 
                            ? 'PIN: 9999' 
                            : selectedUser.role === 'MESERA' 
                            ? 'PIN: 1001-1004' 
                            : selectedUser.role === 'COCINA'
                            ? 'PIN: 2001-2005'
                            : 'PIN de 4 dígitos'}
                        </span>
                      </div>
                    </div>

                    {/* Botón Volver / Cambiar usuario en móvil */}
                    <button
                      type="button"
                      onClick={() => setMobileStep('USER')}
                      className="px-2 py-1 rounded-lg text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 sm:hidden flex items-center gap-1 shrink-0"
                    >
                      <ArrowLeft className="w-3 h-3" />
                      <span>Cambiar</span>
                    </button>
                  </div>

                  {/* Círculos visuales de PIN */}
                  <div className="flex items-center justify-center gap-3 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl mb-1">
                    {[0, 1, 2, 3].map(idx => (
                      <div
                        key={idx}
                        className={`w-3.5 h-3.5 rounded-full transition-all ${
                          pin.length > idx 
                            ? 'bg-slate-900 scale-110 shadow-xs' 
                            : 'border-2 border-slate-300 bg-white'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Teclado numérico táctil optimizado */}
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => handleKeypadPress(n)}
                      className="h-11 sm:h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-base sm:text-lg font-black text-slate-800 transition-all shadow-xs touch-manipulation"
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleBackspace}
                    className="h-11 sm:h-12 rounded-2xl bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 font-bold text-xs transition-all flex items-center justify-center touch-manipulation"
                    title="Borrar dígito"
                  >
                    <Delete className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeypadPress('0')}
                    className="h-11 sm:h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-base sm:text-lg font-black text-slate-800 transition-all touch-manipulation"
                  >
                    0
                  </button>
                  <button
                    type="submit"
                    disabled={loading || pin.length < 4}
                    className="h-11 sm:h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs transition-all flex items-center justify-center shadow-md shadow-emerald-600/25 active:scale-95 touch-manipulation"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <ChevronRight className="w-5 h-5 stroke-[2.5]" />
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div className="py-12 text-center text-slate-400">
                <UserIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs font-semibold">Selecciona un usuario a la izquierda</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
