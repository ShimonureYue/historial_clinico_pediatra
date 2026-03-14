import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, Edit3, Trash2, Users, Shield, Check, X } from 'lucide-react'
import api from '../lib/api'
import useAuthStore from '../store/auth'
import useModulePermission from '../hooks/useModulePermission'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const EMPTY_FORM = {
  nombre: '', correo: '', rol: 'asistente', password: '', activo: true,
}

const MODULOS = [
  { id: 'pacientes', label: 'Pacientes' },
  { id: 'consultas', label: 'Consultas' },
  { id: 'antecedentes_pp', label: 'A. Patológicos' },
  { id: 'antecedentes_pnp', label: 'A. No Patológicos' },
  { id: 'antecedentes_hf', label: 'A. Heredo Familiares' },
  { id: 'usuarios', label: 'Usuarios' },
  { id: 'reportes', label: 'Reportes' },
]

export default function UsuariosPage() {
  const { canRead } = useModulePermission('usuarios')
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.rol === 'admin'
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [permisos, setPermisos] = useState({})

  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => api.get('/usuarios').then((r) => r.data),
  })

  const saveMutation = useMutation({
    mutationFn: (data) =>
      editing
        ? api.put(`/usuarios/${editing.id}`, { ...data, permisos })
        : api.post('/usuarios', { ...data, permisos }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      toast.success(editing ? 'Usuario actualizado' : 'Usuario creado')
      closeForm()
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error al guardar'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/usuarios/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      toast.success('Usuario eliminado')
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error al eliminar usuario'),
  })

  const filtered = usuarios.filter((u) => {
    const q = search.toLowerCase()
    return u.nombre?.toLowerCase().includes(q) || u.correo?.toLowerCase().includes(q)
  })

  const openNew = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setPermisos({})
    setShowForm(true)
  }

  const openEdit = (user) => {
    setEditing(user)
    setForm({ nombre: user.nombre, correo: user.correo, rol: user.rol, password: '', activo: user.activo })
    setPermisos(user.permisos || {})
    setShowForm(true)
  }

  const closeForm = () => { setShowForm(false); setEditing(null) }
  const handleSubmit = (e) => { e.preventDefault(); saveMutation.mutate(form) }
  const updateField = (f, v) => setForm((prev) => ({ ...prev, [f]: v }))

  const togglePermiso = (modulo, tipo) => {
    setPermisos((prev) => ({
      ...prev,
      [modulo]: { ...prev[modulo], [tipo]: !prev[modulo]?.[tipo] },
    }))
  }

  const inputClass = "w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:bg-slate-700 dark:text-slate-100"

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Usuarios</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Administración de usuarios y permisos</p>
        </div>
        {isAdmin && (
          <button onClick={openNew}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-xl shadow-lg shadow-primary/30 hover:bg-primary-dark transition-all">
            <Plus className="w-4 h-4" /> Nuevo Usuario
          </button>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o correo..."
          className={`pl-10 pr-4 py-2.5 ${inputClass}`} />
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                {editing ? 'Modificar Usuario' : 'Nuevo Usuario'}
              </h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Nombre</label>
                  <input value={form.nombre} onChange={(e) => updateField('nombre', e.target.value)} className={inputClass} required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Correo</label>
                  <input type="email" value={form.correo} onChange={(e) => updateField('correo', e.target.value)} className={inputClass} required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Rol</label>
                  <select value={form.rol} onChange={(e) => updateField('rol', e.target.value)} className={inputClass}>
                    <option value="admin">Administrador</option>
                    <option value="medico">Médico</option>
                    <option value="asistente">Asistente</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">
                    Contraseña {editing && '(dejar vacío para no cambiar)'}
                  </label>
                  <input type="password" value={form.password} onChange={(e) => updateField('password', e.target.value)}
                    className={inputClass} {...(!editing && { required: true })} />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input type="checkbox" checked={form.activo} onChange={(e) => updateField('activo', e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary" />
                Usuario activo
              </label>

              {/* Permissions table */}
              <div>
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4 text-primary" /> Permisos por Módulo
                </h4>
                <div className="border border-slate-200 dark:border-slate-600 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-700">
                        <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Módulo</th>
                        <th className="px-4 py-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Lectura</th>
                        <th className="px-4 py-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Escritura</th>
                        <th className="px-4 py-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Actualización</th>
                        <th className="px-4 py-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Eliminación</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {MODULOS.map(({ id, label }) => (
                        <tr key={id} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                          <td className="px-4 py-2 font-medium text-slate-700 dark:text-slate-200">{label}</td>
                          {['lectura', 'escritura', 'actualizacion', 'eliminacion'].map((tipo) => (
                            <td key={tipo} className="px-4 py-2 text-center">
                              <button type="button" onClick={() => togglePermiso(id, tipo)}
                                className={clsx(
                                  'w-7 h-7 rounded-lg flex items-center justify-center transition-colors',
                                  permisos[id]?.[tipo]
                                    ? 'bg-primary text-white'
                                    : 'bg-slate-100 dark:bg-slate-600 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600'
                                )}>
                                {permisos[id]?.[tipo] ? <Check className="w-4 h-4" /> : <X className="w-3 h-3" />}
                              </button>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
                <button type="button" onClick={closeForm}
                  className="px-5 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={saveMutation.isPending}
                  className="px-5 py-2 bg-primary text-white text-sm font-medium rounded-xl shadow-lg shadow-primary/30 hover:bg-primary-dark disabled:opacity-50 transition-all">
                  {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-400 dark:text-slate-500">Cargando usuarios...</div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-700 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Nombre</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Correo</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Rol</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
              {filtered.map((u) => (
                <tr key={u.id} className="group hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{u.nombre}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{u.correo}</td>
                  <td className="px-4 py-3">
                    <span className={clsx(
                      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize',
                      u.rol === 'admin' ? 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' :
                      u.rol === 'medico' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    )}>{u.rol}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx(
                      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                      u.activo ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-50 text-red-500 dark:bg-red-900/30 dark:text-red-400'
                    )}>{u.activo ? 'Activo' : 'Inactivo'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {isAdmin && (
                        <button onClick={() => openEdit(u)}
                          className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:bg-primary/10 hover:text-primary transition-colors">
                          <Edit3 className="w-4 h-4" />
                        </button>
                      )}
                      {isAdmin && (
                        <button onClick={() => { if (window.confirm('¿Eliminar usuario?')) deleteMutation.mutate(u.id) }}
                          className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
