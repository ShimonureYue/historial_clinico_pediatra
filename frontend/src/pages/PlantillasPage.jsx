import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, Plus, Edit3, Trash2, Save, X } from 'lucide-react'
import api from '../lib/api'
import RichTextEditor from '../components/RichTextEditor'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const EMPTY_FORM = { nombre: '', notas_receta: '', notas_adicionales: '' }

const inputClass = "w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:bg-slate-700 dark:text-slate-100"

export default function PlantillasPage() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const { data: plantillas = [], isLoading } = useQuery({
    queryKey: ['plantillas'],
    queryFn: () => api.get('/plantillas').then((r) => r.data),
  })

  const saveMutation = useMutation({
    mutationFn: (data) =>
      editing
        ? api.put(`/plantillas/${editing.id}`, data)
        : api.post('/plantillas', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plantillas'] })
      toast.success(editing ? 'Plantilla actualizada' : 'Plantilla creada')
      setShowForm(false)
      setEditing(null)
      setForm(EMPTY_FORM)
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Error al guardar'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/plantillas/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plantillas'] })
      toast.success('Plantilla eliminada')
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Error al eliminar'),
  })

  const openNew = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  const openEdit = (p) => {
    setEditing(p)
    setForm({
      nombre: p.nombre || '',
      notas_receta: p.notas_receta || '',
      notas_adicionales: p.notas_adicionales || '',
    })
    setShowForm(true)
  }

  const handleDelete = (p) => {
    if (confirm(`Eliminar plantilla "${p.nombre}"?`)) deleteMutation.mutate(p.id)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.nombre.trim()) {
      toast.error('El nombre es requerido')
      return
    }
    saveMutation.mutate(form)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
          <FileText className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Plantillas de receta</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Recetas pre-llenado para indicaciones y notas</p>
        </div>
        <button onClick={openNew}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary text-white text-sm font-medium rounded-xl shadow-lg shadow-primary/30 hover:bg-primary-dark transition-all">
          <Plus className="w-4 h-4" /> Nueva plantilla
        </button>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-400">Cargando plantillas...</div>
      ) : plantillas.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-12 text-center">
          <FileText className="w-10 h-10 mx-auto text-slate-200 dark:text-slate-600 mb-2" />
          <p className="text-sm text-slate-500 dark:text-slate-400">No hay plantillas registradas</p>
          <button onClick={openNew} className="mt-2 text-sm text-primary hover:underline">
            Crear primera plantilla
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-700/50 text-left">
                <th className="px-4 py-2 text-[12px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Nombre</th>
                <th className="px-4 py-2 text-[12px] font-semibold text-slate-500 dark:text-slate-400 uppercase hidden sm:table-cell">Notas receta</th>
                <th className="px-4 py-2 text-[12px] font-semibold text-slate-500 dark:text-slate-400 uppercase hidden md:table-cell">Actualizada</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {plantillas.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-sm text-slate-800 dark:text-slate-100">{p.nombre}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400 hidden sm:table-cell truncate max-w-xs">{(p.notas_receta || '').replace(/<[^>]*>/g, ' ').trim() || '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-400 dark:text-slate-500 hidden md:table-cell">{p.updated_at}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(p)} title="Editar"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(p)} title="Eliminar"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setShowForm(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <form onSubmit={handleSubmit}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto pointer-events-auto">
              <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {editing ? 'Editar plantilla' : 'Nueva plantilla'}
                </h3>
                <button type="button" onClick={() => setShowForm(false)}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              <div className="p-4 space-y-3">
                <div>
                  <label className="block text-[12px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-1">Nombre</label>
                  <input type="text" value={form.nombre}
                    onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
                    className={inputClass}
                    placeholder="Ej: Primera consulta recién nacido"
                    required autoFocus />
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-1">Notas receta (aparecen antes de medicamentos, sin label)</label>
                  <RichTextEditor
                    value={form.notas_receta}
                    onChange={(v) => setForm((p) => ({ ...p, notas_receta: v }))}
                    disabled={false}
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-1">Indicaciones y comentarios</label>
                  <RichTextEditor
                    value={form.notas_adicionales}
                    onChange={(v) => setForm((p) => ({ ...p, notas_adicionales: v }))}
                    disabled={false}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-100 dark:border-slate-700">
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={saveMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-all">
                  <Save className="w-4 h-4" />
                  {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  )
}
