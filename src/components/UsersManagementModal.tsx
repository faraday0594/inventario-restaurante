'use client';

import React, { useState, useEffect } from 'react';
import { User, UserRole } from '@/lib/types';
import { 
  Users, UserPlus, KeyRound, Shield, Trash2, Edit3, Check, X, 
  AlertCircle, RefreshCw, Lock, UtensilsCrossed, ChefHat, Boxes
} from 'lucide-react';

interface UsersManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: Omit<User, 'pin'> | null;
  onUsersUpdated?: () => void;
}

export function UsersManagementModal({
  isOpen,
  onClose,
  currentUser,
  onUsersUpdated
}: UsersManagementModalProps) {
  if (!isOpen) return null;

  const [users, setUsers] = useState<Omit<User, 'pin'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Formulario Crear / Editar
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('MESERA');
  const [pin, setPin] = useState('');

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/users');
      const data = await res.json();
      if (data.success) {
        setUsers(data.users);
      }
    } catch {
      setError('Error al cargar la lista de usuarios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleStartEdit = (user: Omit<User, 'pin'>) => {
    setEditingId(user.id);
    setName(user.name);
    setRole(user.role);
    setPin(''); // Vacío para indicar que no cambia a menos que se escriba uno nuevo
    setError(null);
    setSuccess(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setName('');
    setRole('MESERA');
    setPin('');
    setError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('El nombre del usuario es obligatorio');
      return;
    }

    if (!editingId && (!pin || pin.length < 4)) {
      setError('Debe asignar un PIN de al menos 4 dígitos para el nuevo usuario');
      return;
    }

    if (pin && pin.length < 4) {
      setError('El PIN debe tener al menos 4 dígitos');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userData: {
            id: editingId || undefined,
            name: name.trim(),
            role,
            pin: pin ? pin.trim() : undefined
          },
          requester: currentUser
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al guardar usuario');
      }

      setSuccess(editingId ? '¡Usuario y PIN actualizados con éxito!' : '¡Nuevo usuario creado con éxito!');
      handleCancelEdit();
      fetchUsers();
      if (onUsersUpdated) onUsersUpdated();
    } catch (err: any) {
      setError(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (userId: string, userName: string) => {
    if (!confirm(`¿Seguro que deseas eliminar al usuario "${userName}"?`)) return;

    try {
      const res = await fetch(`/api/users?id=${userId}&role=${currentUser?.role}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al eliminar');
      }

      setSuccess(`Usuario "${userName}" eliminado correctamente`);
      fetchUsers();
      if (onUsersUpdated) onUsersUpdated();
    } catch (err: any) {
      setError(err.message || 'Error al eliminar usuario');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Cabecera */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Gestión de Usuarios & Personal</h3>
              <p className="text-xs text-slate-500 font-medium">Crear meseras, cocineras, empleados y cambiar claves</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-6 overflow-y-auto flex-1">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Formulario Crear / Editar */}
          <form onSubmit={handleSave} className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
                {editingId ? <Edit3 className="w-3.5 h-3.5 text-purple-600" /> : <UserPlus className="w-3.5 h-3.5 text-indigo-600" />}
                {editingId ? 'Editar Usuario / Cambiar PIN' : '➕ Crear Nuevo Usuario'}
              </span>
              {editingId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-xs text-slate-500 hover:underline font-bold"
                >
                  Cancelar
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Nombre Completo</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ej: Sofia (Mesera)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Rol / Cargo</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-purple-500"
                >
                  <option value="MESERA">🍽️ Mesera (Tomar Comandas)</option>
                  <option value="COCINA">🍳 Cocina (Pantalla de Pedidos)</option>
                  <option value="EMPLEADO">📦 Bodega / Barra (Ingreso Facturas)</option>
                  <option value="ADMIN">👑 Administrador (Acceso Total)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                  {editingId ? 'Nuevo PIN (dejar vacío para no cambiar)' : 'PIN Numérico (4 dígitos)'}
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    maxLength={6}
                    value={pin}
                    onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                    placeholder={editingId ? '••••' : 'Ej: 1234'}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold tracking-widest focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/25 transition-all"
              >
                {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>{editingId ? 'Guardar Cambios' : 'Registrar Usuario'}</span>
              </button>
            </div>
          </form>

          {/* Lista de Usuarios Registrados */}
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2.5">
              Personal Registrado en el Sistema ({users.length})
            </h4>

            {loading ? (
              <div className="py-8 text-center text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
                <span className="text-xs">Cargando usuarios...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                {users.map(u => {
                  const isAdmin = u.role === 'ADMIN';
                  const isMesera = u.role === 'MESERA';
                  const isCocina = u.role === 'COCINA';

                  return (
                    <div
                      key={u.id}
                      className="p-3.5 rounded-2xl border border-slate-200 bg-white flex items-center justify-between gap-3 shadow-2xs hover:border-slate-300 transition-all"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                          isAdmin 
                            ? 'bg-amber-100 text-amber-800' 
                            : isMesera
                            ? 'bg-purple-100 text-purple-700'
                            : isCocina
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {isAdmin ? <Shield className="w-4 h-4" /> : isMesera ? <UtensilsCrossed className="w-4 h-4" /> : isCocina ? <ChefHat className="w-4 h-4" /> : <Boxes className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                          <h5 className="text-xs font-black text-slate-900 truncate">{u.name}</h5>
                          <span className={`text-[10px] font-bold ${
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
                              ? '🍳 Cocina' 
                              : '📦 Bodega'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleStartEdit(u)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Editar nombre o cambiar PIN"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {!isAdmin && (
                          <button
                            onClick={() => handleDelete(u.id, u.name)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Eliminar usuario"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 text-right">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
