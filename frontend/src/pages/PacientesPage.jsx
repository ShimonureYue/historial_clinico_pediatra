import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, Edit3, Trash2, Baby, Calendar, Phone, MapPin, Eye, ChevronLeft, ChevronRight } from 'lucide-react'
import api from '../lib/api'
import useModulePermission from '../hooks/useModulePermission'
import toast from 'react-hot-toast'
import clsx from 'clsx'

function calcAgeObj(fechaNac) {
  if (!fechaNac) return null
  const birth = new Date(fechaNac + 'T00:00:00')
  const now = new Date()
  let years = now.getFullYear() - birth.getFullYear()
  let months = now.getMonth() - birth.getMonth()
  let days = now.getDate() - birth.getDate()
  if (days < 0) {
    months--
    const prev = new Date(now.getFullYear(), now.getMonth(), 0)
    days += prev.getDate()
  }
  if (months < 0) { years--; months += 12 }
  return { years, months, days }
}

function calcAgeText(fechaNac) {
  const a = calcAgeObj(fechaNac)
  if (!a) return '-'
  if (a.years > 0) return `${a.years}a ${a.months}m ${a.days}d`
  if (a.months > 0) return `${a.months}m ${a.days}d`
  return `${a.days}d`
}

function AgeCells({ fechaNac }) {
  const a = calcAgeObj(fechaNac)
  if (!a) return <span className="text-slate-400 dark:text-slate-500">-</span>
  return (
    <div className="inline-grid text-xs tabular-nums" style={{ gridTemplateColumns: 'auto auto 4px auto auto 4px auto auto' }}>
      <span className={clsx('text-right font-semibold min-w-[1.1em]', a.years > 0 ? 'text-slate-800 dark:text-slate-100' : 'text-slate-300 dark:text-slate-600')}>{a.years}</span>
      <span className="font-normal text-slate-400 dark:text-slate-500">a</span>
      <span />
      <span className={clsx('text-right font-semibold min-w-[1.1em]', a.months > 0 ? 'text-slate-800 dark:text-slate-100' : 'text-slate-300 dark:text-slate-600')}>{a.months}</span>
      <span className="font-normal text-slate-400 dark:text-slate-500">m</span>
      <span />
      <span className={clsx('text-right font-semibold min-w-[1.1em]', a.days > 0 ? 'text-slate-800 dark:text-slate-100' : 'text-slate-300 dark:text-slate-600')}>{a.days}</span>
      <span className="font-normal text-slate-400 dark:text-slate-500">d</span>
    </div>
  )
}

const EMPTY_FORM = {
  nombre: '', apellido_paterno: '', apellido_materno: '',
  fecha_nacimiento: '', sexo: 'M', direccion: '',
  telefono_contacto: '', responsable: '',
}

const PAGE_SIZE = 50

export default function PacientesPage() {
  const { canWrite, canUpdate, canDelete } = useModulePermission('pacientes')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const { data, isLoading } = useQuery({
    queryKey: ['pacientes', debouncedSearch, page],
    queryFn: () => api.get('/pacientes', { params: { search: debouncedSearch, page, limit: PAGE_SIZE } }).then((r) => r.data),
  })

  const pacientes = data?.data ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const saveMutation = useMutation({
    mutationFn: (data) =>
      editing
        ? api.put(`/pacientes/${editing.id}`, data)
        : api.post('/pacientes', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pacientes'] })
      toast.success(editing ? 'Paciente actualizado' : 'Paciente creado')
      closeForm()
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error al guardar'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/pacientes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pacientes'] })
      toast.success('Paciente eliminado')
    },
    onError: () => toast.error('Error al eliminar'),
  })

  const openNew = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  const openEdit = (pac) => {
    setEditing(pac)
    setForm({
      nombre: pac.nombre || '',
      apellido_paterno: pac.apellido_paterno || '',
      apellido_materno: pac.apellido_materno || '',
      fecha_nacimiento: pac.fecha_nacimiento || '',
      sexo: pac.sexo || 'M',
      direccion: pac.direccion || '',
      telefono_contacto: pac.telefono_contacto || '',
      responsable: pac.responsable || '',
    })
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditing(null)
    setForm(EMPTY_FORM)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    saveMutation.mutate(form)
  }

  const handleDelete = (pac) => {
    if (window.confirm(`¿Eliminar a ${pac.nombre} ${pac.apellido_paterno}?`)) {
      deleteMutation.mutate(pac.id)
    }
  }

  const updateField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Pacientes</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Gestión de fichas de identificación
            {total > 0 && <span className="ml-2 text-slate-400 dark:text-slate-500">({total.toLocaleString()} registros)</span>}
          </p>
        </div>
        {canWrite && (
          <button
            onClick={openNew}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-xl shadow-lg shadow-primary/30 hover:bg-primary-dark transition-all"
          >
            <Plus className="w-4 h-4" /> Nuevo Paciente
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, apellido o ID..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:bg-slate-700 dark:text-slate-100"
        />
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                {editing ? 'Modificar Paciente' : 'Nuevo Paciente'}
              </h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Nombre(s)</label>
                  <input value={form.nombre} onChange={(e) => updateField('nombre', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:bg-slate-700 dark:text-slate-100" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Apellido Paterno</label>
                  <input value={form.apellido_paterno} onChange={(e) => updateField('apellido_paterno', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:bg-slate-700 dark:text-slate-100" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Apellido Materno</label>
                  <input value={form.apellido_materno} onChange={(e) => updateField('apellido_materno', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:bg-slate-700 dark:text-slate-100" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Fecha de Nacimiento</label>
                  <input type="date" value={form.fecha_nacimiento} onChange={(e) => updateField('fecha_nacimiento', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:bg-slate-700 dark:text-slate-100" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Sexo</label>
                  <select value={form.sexo} onChange={(e) => updateField('sexo', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:bg-slate-700 dark:text-slate-100">
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                    <option value="X">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Teléfono</label>
                  <input value={form.telefono_contacto} onChange={(e) => updateField('telefono_contacto', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:bg-slate-700 dark:text-slate-100" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Responsable / Tutor</label>
                <input value={form.responsable} onChange={(e) => updateField('responsable', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:bg-slate-700 dark:text-slate-100" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Dirección</label>
                <textarea value={form.direccion} onChange={(e) => updateField('direccion', e.target.value)} rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:bg-slate-700 dark:text-slate-100 resize-none" />
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
        <div className="text-center py-12 text-slate-400 dark:text-slate-500">Cargando pacientes...</div>
      ) : pacientes.length === 0 ? (
        <div className="text-center py-12">
          <Baby className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-slate-500 dark:text-slate-400">No se encontraron pacientes</p>
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-700 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">ID</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Paciente</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase hidden md:table-cell">Edad</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase hidden md:table-cell">Sexo</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase hidden lg:table-cell">Teléfono</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase hidden lg:table-cell">Responsable</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                {pacientes.map((pac) => (
                  <tr key={pac.id} className="group hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                    <td className="px-4 py-3 font-mono text-slate-400 dark:text-slate-500">{pac.id}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800 dark:text-slate-100">{pac.nombre} {pac.apellido_paterno} {pac.apellido_materno}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-0.5 md:hidden">
                        <Calendar className="w-3 h-3" /> {calcAgeText(pac.fecha_nacimiento)}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 hidden md:table-cell"><AgeCells fechaNac={pac.fecha_nacimiento} /></td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={clsx(
                        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                        pac.sexo === 'F' ? 'bg-pink-50 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400' : pac.sexo === 'M' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                      )}>
                        {pac.sexo === 'F' ? 'Femenino' : pac.sexo === 'M' ? 'Masculino' : 'Otro'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 hidden lg:table-cell">
                      {pac.telefono_contacto && (
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {pac.telefono_contacto}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 hidden lg:table-cell">{pac.responsable}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => navigate(`/pacientes/${pac.id}`)}
                          className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:bg-primary/10 hover:text-primary transition-colors" title="Ver detalle">
                          <Eye className="w-4 h-4" />
                        </button>
                        {canUpdate && (
                          <button onClick={() => openEdit(pac)}
                            className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:bg-primary/10 hover:text-primary transition-colors" title="Editar">
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => handleDelete(pac)}
                            className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:bg-red-50 hover:text-red-500 transition-colors" title="Eliminar">
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Mostrando {((page - 1) * PAGE_SIZE) + 1}-{Math.min(page * PAGE_SIZE, total)} de {total.toLocaleString()}
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-slate-600 dark:text-slate-300 px-2">
                  Página {page} de {totalPages}
                </span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
