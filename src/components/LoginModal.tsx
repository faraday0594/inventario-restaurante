'use client';

import React, { useState, useEffect } from 'react';
import { User, UserRole } from '@/lib/types';
import { Shield, User as UserIcon, Lock, KeyRound, Check, AlertCircle, X, ChevronRight } from 'lucide-react';

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

  // Cargar usuarios disponibles
  useEffect(() => {
    fetch('/api/auth')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.users) {
          setUsers(data.users);
          // Si no hay seleccionado, preseleccionar el primero o el actual
          if (!selectedUser && data.users.length > 0) {
            setSelectedUser(currentUser || data.users[0]);
          }
        }
      })
      .catch(err => console.error('Error cargando usuarios:', err));
  }, [currentUser]);

  const handleSelectUser = (u: Omit<User, 'pin'>) => {
    setSelectedUser(u);
    setPin('');
    setError(null);
  };

  const handleKeypadPress = (digit: string) => {
    if (pin.length < 6) {
      const newPin = pin + digit;
      setPin(newPin);
      setError(null);
      // Si llega a 4 dígitos, auto-enviar para mayor rapidez en POS
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

      // Guardar en sesión local
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Cabecera */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">Control de Acceso</h2>
              <p className="text-xs text-slate-500">Identifícate para operar en la bodega</p>
            </div>
          </div>
          {onClose && currentUser && (
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-200/50"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="p-5 space-y-4">
          {/* Mensaje de Error */}
          {error && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 flex items-center gap-2.5 text-rose-700 text-xs font-bold animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Selector de Usuario */}
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-2">
              Selecciona tu Usuario:
            </label>
            <div className="grid grid-cols-1 gap-2">
              {users.map(u => {
                const isSelected = selectedUser?.id === u.id;
                const isAdmin = u.role === 'ADMIN';

                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleSelectUser(u)}
                    className={`p-3 rounded-2xl border text-left flex items-center justify-between transition-all ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                        isAdmin ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {isAdmin ? <Shield className="w-4 h-4 text-amber-600" /> : <UserIcon className="w-4 h-4" />}
                      </div>
                      <div>
                        <span className="text-xs font-black text-slate-900 block">{u.name}</span>
                        <span className={`text-[10px] font-bold ${
                          isAdmin 
                            ? 'text-amber-700' 
                            : u.role === 'MESERA'
                            ? 'text-purple-600'
                            : u.role === 'COCINA'
                            ? 'text-orange-600'
                            : 'text-slate-500'
                        }`}>
                          {isAdmin 
                            ? '👑 Administrador (Acceso Total)' 
                            : u.role === 'MESERA'
                            ? '🍽️ Mesera (Tomar Comandas)'
                            : u.role === 'COCINA'
                            ? '🍳 Cocina (Pantalla de Pedidos)'
                            : '📦 Bodega & Facturas'}
                        </span>
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Entrada de PIN */}
          {selectedUser && (
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    PIN de Seguridad (4 dígitos)
                  </label>
                  <span className="text-[10px] text-slate-400">
                    {selectedUser.role === 'ADMIN' ? 'PIN por defecto: 9999' : selectedUser.name.includes('Carlos') ? 'PIN: 1234' : 'PIN: 5678'}
                  </span>
                </div>

                {/* Círculos visuales de PIN */}
                <div className="flex items-center justify-center gap-3 py-3 bg-slate-50 border border-slate-200 rounded-2xl">
                  {[0, 1, 2, 3].map(idx => (
                    <div
                      key={idx}
                      className={`w-4 h-4 rounded-full transition-all ${
                        pin.length > idx 
                          ? 'bg-slate-900 scale-110 shadow-sm' 
                          : 'border-2 border-slate-300 bg-white'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Teclado numérico táctil para celular / pantalla */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => handleKeypadPress(n)}
                    className="h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-base font-black text-slate-800 transition-all shadow-xs"
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleBackspace}
                  className="h-12 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 active:scale-95 text-xs font-bold transition-all"
                >
                  Borrar
                </button>
                <button
                  type="button"
                  onClick={() => handleKeypadPress('0')}
                  className="h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-base font-black text-slate-800 transition-all"
                >
                  0
                </button>
                <button
                  type="submit"
                  disabled={loading || pin.length < 4}
                  className="h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs transition-all flex items-center justify-center shadow-md shadow-emerald-600/25"
                >
                  {loading ? '...' : <ChevronRight className="w-5 h-5 stroke-[2.5]" />}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
