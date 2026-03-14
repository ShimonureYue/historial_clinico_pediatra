import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Save, Baby, Calendar, Phone, MapPin, User, Stethoscope,
  ClipboardList, HeartPulse, Users, Plus, Eye, Edit3, Printer,
  Weight, Ruler, Thermometer, Wind, Activity, Syringe, Trash2,
  AlertCircle, Pill, Scissors, ChevronDown, ChevronUp, Search,
  CalendarDays, TrendingUp, FileText
} from 'lucide-react'
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

function AgeBadge({ fechaNac }) {
  const a = calcAgeObj(fechaNac)
  if (!a) return null
  return (
    <span className="inline-flex items-center gap-1.5 text-sm tabular-nums">
      {a.years > 0 && <span className="font-semibold text-slate-700 dark:text-slate-200">{a.years}<span className="font-normal text-slate-400 dark:text-slate-500">a</span></span>}
      <span className={clsx('font-semibold', a.months > 0 ? 'text-slate-700 dark:text-slate-200' : 'text-slate-300 dark:text-slate-600')}>{a.months}<span className="font-normal text-slate-400 dark:text-slate-500">m</span></span>
      <span className={clsx('font-semibold', a.days > 0 ? 'text-slate-700 dark:text-slate-200' : 'text-slate-300 dark:text-slate-600')}>{a.days}<span className="font-normal text-slate-400 dark:text-slate-500">d</span></span>
    </span>
  )
}

const TABS = [
  { id: 'info', label: 'Datos del Paciente', icon: Baby },
  { id: 'patologicos', label: 'A. Patológicos', icon: ClipboardList },
  { id: 'no_patologicos', label: 'A. No Patológicos', icon: HeartPulse },
  { id: 'heredo_familiares', label: 'A. Heredo Familiares', icon: Users },
  { id: 'consultas', label: 'Historial de Consultas', icon: Stethoscope },
]

const inputClass = "w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:bg-slate-700 dark:text-slate-100"

export default function PacienteDetallePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('info')

  // "info" tab shows split layout (datos + consultas side by side)
  const isSplitView = activeTab === 'info'

  return (
    <div className="space-y-4">
      {/* Patient header */}
      <PatientHeader pacienteId={id} onBack={() => navigate('/pacientes')} />

      {/* Full-width tab navigation */}
      <div className="flex gap-1 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-1.5 overflow-x-auto">
        {TABS.map(({ id: tabId, label, icon: Icon }) => (
          <button
            key={tabId}
            onClick={() => setActiveTab(tabId)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex-1 justify-center',
              activeTab === tabId
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200'
            )}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {isSplitView ? (
        /* ── Split view: Datos del Paciente (left) + Consultas sidebar (right) ── */
        <div className="flex flex-col lg:flex-row gap-4 lg:items-start">
          <div className="w-full lg:w-[45%] xl:w-[42%] flex-shrink-0">
            <TabInfoPaciente pacienteId={id} />
          </div>
          <div className="w-full lg:flex-1 lg:sticky lg:top-4 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
            <ConsultasSidebar pacienteId={id} />
          </div>
        </div>
      ) : activeTab === 'consultas' ? (
        /* ── Full-width historial de consultas ── */
        <HistorialConsultas pacienteId={id} />
      ) : (
        /* ── Full-width antecedentes ── */
        <>
          {activeTab === 'patologicos' && <TabPatologicos pacienteId={id} />}
          {activeTab === 'no_patologicos' && <TabNoPatologicos pacienteId={id} />}
          {activeTab === 'heredo_familiares' && <TabHeredoFamiliares pacienteId={id} />}
        </>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   Patient Header
   ═══════════════════════════════════════════════════════ */
function PatientHeader({ pacienteId, onBack }) {
  const { data: pac } = useQuery({
    queryKey: ['paciente', pacienteId],
    queryFn: () => api.get(`/pacientes/${pacienteId}`).then((r) => r.data),
  })

  if (!pac) return null

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-4">
      <div className="flex items-start gap-3">
        <button onClick={onBack}
          className="mt-0.5 p-2 rounded-xl text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-600 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 truncate">
            {pac.nombre} {pac.apellido_paterno} {pac.apellido_materno}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <AgeBadge fechaNac={pac.fecha_nacimiento} />
              <span className="text-slate-400 dark:text-slate-500 text-xs">({pac.fecha_nacimiento})</span>
            </span>
            <span className={clsx(
              'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
              pac.sexo === 'F' ? 'bg-pink-50 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400' : pac.sexo === 'M' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            )}>
              {pac.sexo === 'F' ? 'Femenino' : pac.sexo === 'M' ? 'Masculino' : 'Otro'}
            </span>
            {pac.telefono_contacto && (
              <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {pac.telefono_contacto}</span>
            )}
            <span className="text-xs font-mono text-slate-400 dark:text-slate-500">ID: {pac.id}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   Tab: Datos del Paciente (editable)
   ═══════════════════════════════════════════════════════ */
function TabInfoPaciente({ pacienteId }) {
  const { canUpdate } = useModulePermission('pacientes')
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(null)

  const { data: pac, isLoading } = useQuery({
    queryKey: ['paciente', pacienteId],
    queryFn: () => api.get(`/pacientes/${pacienteId}`).then((r) => r.data),
  })

  useEffect(() => {
    if (pac) setForm({ ...pac })
  }, [pac])

  const saveMutation = useMutation({
    mutationFn: (data) => api.put(`/pacientes/${pacienteId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paciente', pacienteId] })
      queryClient.invalidateQueries({ queryKey: ['pacientes'] })
      toast.success('Paciente actualizado')
      setEditing(false)
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error al guardar'),
  })

  if (isLoading || !form) return <div className="text-center py-8 text-slate-400 dark:text-slate-500">Cargando...</div>

  const handleSubmit = (e) => { e.preventDefault(); saveMutation.mutate(form) }
  const updateField = (f, v) => setForm((prev) => ({ ...prev, [f]: v }))
  const disabled = !editing

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
      <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <User className="w-5 h-5 text-primary" /> Ficha de Identificación
        </h3>
        {canUpdate && !editing && (
          <button onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-primary border border-primary/30 rounded-xl hover:bg-primary/5 transition-colors">
            <Edit3 className="w-4 h-4" /> Editar
          </button>
        )}
      </div>
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Nombre(s)" value={form.nombre} onChange={(v) => updateField('nombre', v)} disabled={disabled} required />
          <Field label="Apellido Paterno" value={form.apellido_paterno} onChange={(v) => updateField('apellido_paterno', v)} disabled={disabled} required />
          <Field label="Apellido Materno" value={form.apellido_materno} onChange={(v) => updateField('apellido_materno', v)} disabled={disabled} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Fecha de Nacimiento</label>
            <input type="date" value={form.fecha_nacimiento || ''} onChange={(e) => updateField('fecha_nacimiento', e.target.value)}
              className={clsx(inputClass, disabled && 'bg-slate-50 dark:bg-slate-700')} disabled={disabled} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Sexo</label>
            <select value={form.sexo || 'M'} onChange={(e) => updateField('sexo', e.target.value)}
              className={clsx(inputClass, disabled && 'bg-slate-50 dark:bg-slate-700')} disabled={disabled}>
              <option value="M">Masculino</option>
              <option value="F">Femenino</option>
              <option value="X">Otro</option>
            </select>
          </div>
          <Field label="Teléfono" value={form.telefono_contacto} onChange={(v) => updateField('telefono_contacto', v)} disabled={disabled} />
        </div>
        <Field label="Responsable / Tutor" value={form.responsable} onChange={(v) => updateField('responsable', v)} disabled={disabled} />
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Dirección</label>
          <textarea value={form.direccion || ''} onChange={(e) => updateField('direccion', e.target.value)} rows={2}
            className={clsx(inputClass, 'resize-none', disabled && 'bg-slate-50 dark:bg-slate-700')} disabled={disabled} />
        </div>

        {editing && (
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
            <button type="button" onClick={() => { setEditing(false); setForm({ ...pac }) }}
              className="px-5 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saveMutation.isPending}
              className="inline-flex items-center gap-2 px-5 py-2 bg-primary text-white text-sm font-medium rounded-xl shadow-lg shadow-primary/30 hover:bg-primary-dark disabled:opacity-50 transition-all">
              <Save className="w-4 h-4" /> {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        )}
      </form>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   Consultations Sidebar (compact, for split view in "Datos")
   ═══════════════════════════════════════════════════════ */
function ConsultasSidebar({ pacienteId }) {
  const { canWrite } = useModulePermission('consultas')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [newForm, setNewForm] = useState({ fecha_consulta: new Date().toISOString().split('T')[0], padecimiento_actual: '' })

  const { data: consultas = [], isLoading } = useQuery({
    queryKey: ['consultas', 'paciente', pacienteId],
    queryFn: () => api.get(`/consultas/paciente/${pacienteId}`).then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/consultas', { ...data, paciente_id: parseInt(pacienteId) }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['consultas', 'paciente', pacienteId] })
      toast.success('Consulta creada')
      setShowForm(false)
      navigate(`/consultas/${res.data.id}`)
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error al crear consulta'),
  })

  const handleCreate = (e) => { e.preventDefault(); createMutation.mutate(newForm) }

  return (
    <div className="space-y-3">
      {/* Panel header */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary">
              <Stethoscope className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Consultas</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500">{consultas.length} registrada{consultas.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          {canWrite && (
            <button onClick={() => { setNewForm({ fecha_consulta: new Date().toISOString().split('T')[0], padecimiento_actual: '' }); setShowForm(true) }}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary text-white text-sm font-medium rounded-xl shadow-lg shadow-primary/30 hover:bg-primary-dark transition-all">
              <Plus className="w-4 h-4" /> Nueva
            </button>
          )}
        </div>
      </div>

      <CreateConsultaModal show={showForm} onClose={() => setShowForm(false)} onSubmit={handleCreate}
        form={newForm} setForm={setNewForm} isPending={createMutation.isPending} />

      {/* Compact timeline */}
      {isLoading ? (
        <div className="text-center py-8 text-slate-400 dark:text-slate-500">Cargando consultas...</div>
      ) : consultas.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-10 text-center">
          <Stethoscope className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-slate-500 dark:text-slate-400 text-sm">No hay consultas registradas</p>
          {canWrite && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Crea la primera consulta</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {consultas.map((c, idx) => (
            <div key={c.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
              <button
                onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                className="w-full flex items-center gap-3 p-3.5 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left"
              >
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className={clsx('w-2.5 h-2.5 rounded-full', idx === 0 ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600')} />
                  {idx < consultas.length - 1 && <div className="w-px h-4 bg-slate-200 dark:bg-slate-600 mt-1" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{c.fecha_consulta}</p>
                    {c.impresion_diagnostica && (
                      <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[11px] font-medium max-w-[calc(100%-40px)] truncate">
                        {c.impresion_diagnostica}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{c.padecimiento_actual}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {c.tratamientos?.length > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[11px] font-medium">
                      <Pill className="w-3 h-3 mr-0.5" /> {c.tratamientos.length}
                    </span>
                  )}
                  {expandedId === c.id ? <ChevronUp className="w-4 h-4 text-slate-400 dark:text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500" />}
                </div>
              </button>
              {expandedId === c.id && (
                <div className="border-t border-slate-100 dark:border-slate-700 p-4 space-y-3 bg-slate-50/50 dark:bg-slate-700/50">
                  <ConsultaDetailContent c={c} />
                  <div className="flex justify-end pt-1">
                    <button onClick={() => navigate(`/consultas/${c.id}`)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors">
                      <Eye className="w-3.5 h-3.5" /> Ver / Editar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   Historial de Consultas (full-width, enhanced view)
   ═══════════════════════════════════════════════════════ */
function HistorialConsultas({ pacienteId }) {
  const { canWrite } = useModulePermission('consultas')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [newForm, setNewForm] = useState({ fecha_consulta: new Date().toISOString().split('T')[0], padecimiento_actual: '' })

  const { data: consultas = [], isLoading } = useQuery({
    queryKey: ['consultas', 'paciente', pacienteId],
    queryFn: () => api.get(`/consultas/paciente/${pacienteId}`).then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/consultas', { ...data, paciente_id: parseInt(pacienteId) }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['consultas', 'paciente', pacienteId] })
      toast.success('Consulta creada')
      setShowForm(false)
      navigate(`/consultas/${res.data.id}`)
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error al crear consulta'),
  })

  const handleCreate = (e) => { e.preventDefault(); createMutation.mutate(newForm) }

  // Filter consultations by search
  const filtered = consultas.filter((c) => {
    if (!searchTerm) return true
    const q = searchTerm.toLowerCase()
    return (
      (c.fecha_consulta || '').toLowerCase().includes(q) ||
      (c.padecimiento_actual || '').toLowerCase().includes(q) ||
      (c.impresion_diagnostica || '').toLowerCase().includes(q) ||
      (c.tratamientos || []).some((t) => (t.nombre_medicamento || '').toLowerCase().includes(q))
    )
  })

  const selected = consultas.find((c) => c.id === selectedId) || null

  // Stats
  const totalMeds = consultas.reduce((sum, c) => sum + (c.tratamientos?.length || 0), 0)
  const uniqueDx = [...new Set(consultas.map((c) => c.impresion_diagnostica).filter(Boolean))]
  const lastConsulta = consultas.length > 0 ? consultas[0] : null

  // Auto-select first on load
  useEffect(() => {
    if (consultas.length > 0 && !selectedId) setSelectedId(consultas[0].id)
  }, [consultas, selectedId])

  if (isLoading) return <div className="text-center py-12 text-slate-400 dark:text-slate-500">Cargando historial...</div>

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-4 flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{consultas.length}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Consultas</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-4 flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400">
            <Pill className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{totalMeds}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Medicamentos</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-4 flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{uniqueDx.length}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Diagnósticos</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-4 flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{lastConsulta?.fecha_consulta || '-'}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Última consulta</p>
          </div>
        </div>
      </div>

      {/* Toolbar: search + new button */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por fecha, padecimiento, diagnóstico, medicamento..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary bg-white dark:bg-slate-700 dark:text-slate-100"
          />
        </div>
        {canWrite && (
          <button onClick={() => { setNewForm({ fecha_consulta: new Date().toISOString().split('T')[0], padecimiento_actual: '' }); setShowForm(true) }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-medium rounded-xl shadow-lg shadow-primary/30 hover:bg-primary-dark transition-all whitespace-nowrap">
            <Plus className="w-4 h-4" /> Nueva Consulta
          </button>
        )}
      </div>

      <CreateConsultaModal show={showForm} onClose={() => setShowForm(false)} onSubmit={handleCreate}
        form={newForm} setForm={setNewForm} isPending={createMutation.isPending} />

      {consultas.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-12 text-center">
          <Stethoscope className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-slate-500 dark:text-slate-400">No hay consultas registradas</p>
          {canWrite && <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Crea la primera consulta para este paciente</p>}
        </div>
      ) : (
        /* Master-detail: list (left) + detail (right) */
        <div className="flex flex-col lg:flex-row gap-4 lg:items-start">
          {/* ── List panel ── */}
          <div className="w-full lg:w-[38%] xl:w-[35%] flex-shrink-0 space-y-1.5 lg:max-h-[calc(100vh-18rem)] lg:overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-8 text-center">
                <Search className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-sm text-slate-500 dark:text-slate-400">Sin resultados para "{searchTerm}"</p>
              </div>
            ) : (
              filtered.map((c, idx) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={clsx(
                    'w-full text-left p-3.5 rounded-xl border transition-all',
                    selectedId === c.id
                      ? 'bg-primary/5 border-primary/30 shadow-sm'
                      : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center flex-shrink-0 mt-1">
                      <div className={clsx('w-2.5 h-2.5 rounded-full', idx === 0 && !searchTerm ? 'bg-primary' : selectedId === c.id ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600')} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={clsx('text-sm font-semibold', selectedId === c.id ? 'text-primary' : 'text-slate-800 dark:text-slate-100')}>
                          {c.fecha_consulta}
                        </p>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {c.tratamientos?.length > 0 && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-medium">
                              <Pill className="w-2.5 h-2.5 mr-0.5" /> {c.tratamientos.length}
                            </span>
                          )}
                        </div>
                      </div>
                      {c.impresion_diagnostica && (
                        <p className="text-[11px] font-medium text-amber-700 mt-0.5 truncate">{c.impresion_diagnostica}</p>
                      )}
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{c.padecimiento_actual}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* ── Detail panel ── */}
          <div className="w-full lg:flex-1 lg:sticky lg:top-4">
            {selected ? (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
                {/* Detail header */}
                <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary">
                      <Stethoscope className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Consulta del {selected.fecha_consulta}</h3>
                      <p className="text-xs text-slate-400 dark:text-slate-500">ID: {selected.id}</p>
                    </div>
                  </div>
                  <button onClick={() => navigate(`/consultas/${selected.id}`)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-primary border border-primary/30 rounded-xl hover:bg-primary/5 transition-colors">
                    <Edit3 className="w-4 h-4" /> Editar
                  </button>
                </div>

                {/* Detail body */}
                <div className="p-5 space-y-5">
                  <ConsultaDetailContent c={selected} expanded />
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-12 text-center">
                <Stethoscope className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-sm text-slate-500 dark:text-slate-400">Selecciona una consulta para ver el detalle</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   Shared: Consulta detail content
   ═══════════════════════════════════════════════════════ */
function ConsultaDetailContent({ c, expanded = false }) {
  return (
    <>
      <div>
        <h5 className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Padecimiento Actual</h5>
        <p className={clsx('text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700', expanded && 'whitespace-pre-wrap')}>{c.padecimiento_actual}</p>
      </div>

      {c.mediciones && (
        <div>
          <h5 className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">Exploración Física</h5>
          <div className={clsx('grid gap-1.5', expanded ? 'grid-cols-3 sm:grid-cols-6' : 'grid-cols-2 sm:grid-cols-3')}>
            {c.mediciones.peso_kg != null && <StatChip icon={Weight} label="Peso" value={`${c.mediciones.peso_kg} kg`} />}
            {c.mediciones.talla_cm != null && <StatChip icon={Ruler} label="Talla" value={`${c.mediciones.talla_cm} cm`} />}
            {c.mediciones.fc_bpm != null && <StatChip icon={HeartPulse} label="FC" value={`${c.mediciones.fc_bpm} bpm`} />}
            {c.mediciones.fr_rpm != null && <StatChip icon={Wind} label="FR" value={`${c.mediciones.fr_rpm} rpm`} />}
            {c.mediciones.temperatura_c != null && <StatChip icon={Thermometer} label="Temp" value={`${c.mediciones.temperatura_c} °C`} />}
            {(c.mediciones.ta_sistolica != null || c.mediciones.ta_diastolica != null) && (
              <StatChip icon={Activity} label="TA" value={`${c.mediciones.ta_sistolica ?? '-'}/${c.mediciones.ta_diastolica ?? '-'} mmHg`} />
            )}
          </div>
          <div className={clsx('grid gap-1.5 mt-1.5', expanded ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2')}>
            {['cabeza', 'cuello', 'torax', 'abdomen', 'miembros_toracicos', 'miembros_pelvicos', 'otros'].map((f) =>
              c.mediciones[f] ? (
                <div key={f} className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-700">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold">{f.replace(/_/g, ' ')}</span>
                  <p className="text-xs text-slate-700 dark:text-slate-200 mt-0.5">{c.mediciones[f]}</p>
                </div>
              ) : null
            )}
          </div>
        </div>
      )}

      {c.impresion_diagnostica && (
        <div>
          <h5 className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Impresión Diagnóstica</h5>
          <p className="text-sm text-slate-700 dark:text-slate-200 bg-amber-50 dark:bg-amber-900/30 p-3 rounded-xl border border-amber-100 dark:border-amber-800">{c.impresion_diagnostica}</p>
        </div>
      )}

      {c.tratamientos?.length > 0 && (
        <div>
          <h5 className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Tratamiento / Medicamentos</h5>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-700 text-left">
                  <th className="px-3 py-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Medicamento</th>
                  <th className="px-3 py-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase hidden sm:table-cell">Presentación</th>
                  <th className="px-3 py-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Dosis</th>
                  <th className="px-3 py-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase hidden sm:table-cell">Vía</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                {c.tratamientos.map((t) => (
                  <tr key={t.id}>
                    <td className="px-3 py-1.5 font-medium text-slate-800 dark:text-slate-100">{t.nombre_medicamento}</td>
                    <td className="px-3 py-1.5 text-slate-600 dark:text-slate-300 hidden sm:table-cell">{t.presentacion || '-'}</td>
                    <td className="px-3 py-1.5 text-slate-600 dark:text-slate-300">{t.dosificacion || '-'}</td>
                    <td className="px-3 py-1.5 text-slate-600 dark:text-slate-300 hidden sm:table-cell">{t.via_administracion || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}

/* ═══════════════════════════════════════════════════════
   Shared: Create consultation modal
   ═══════════════════════════════════════════════════════ */
function CreateConsultaModal({ show, onClose, onSubmit, form, setForm, isPending }) {
  if (!show) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Nueva Consulta</h3>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 text-2xl leading-none">&times;</button>
        </div>
        <form onSubmit={onSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Fecha de Consulta</label>
            <input type="date" value={form.fecha_consulta}
              onChange={(e) => setForm((p) => ({ ...p, fecha_consulta: e.target.value }))}
              className={inputClass} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Padecimiento Actual</label>
            <textarea value={form.padecimiento_actual}
              onChange={(e) => setForm((p) => ({ ...p, padecimiento_actual: e.target.value }))}
              rows={4} className={`${inputClass} resize-none`} required
              placeholder="Describe el motivo de consulta..." />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
            <button type="button" onClick={onClose}
              className="px-5 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={isPending}
              className="inline-flex items-center gap-2 px-5 py-2 bg-primary text-white text-sm font-medium rounded-xl shadow-lg shadow-primary/30 hover:bg-primary-dark disabled:opacity-50 transition-all">
              <Plus className="w-4 h-4" /> {isPending ? 'Creando...' : 'Crear y Continuar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   Tab: Antecedentes Patológicos
   ═══════════════════════════════════════════════════════ */
function TabPatologicos({ pacienteId }) {
  const { canWrite, canUpdate } = useModulePermission('antecedentes_pp')
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ enfermedades_exantematicas: '', alergias: '', cirugias: '', otros: '' })
  const [existingId, setExistingId] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['antecedentes_pp', pacienteId],
    queryFn: () => api.get(`/antecedentes-patologicos/paciente/${pacienteId}`).then((r) => r.data),
  })

  useEffect(() => {
    if (data) {
      setForm({
        enfermedades_exantematicas: data.enfermedades_exantematicas || '',
        alergias: data.alergias || '',
        cirugias: data.cirugias || '',
        otros: data.otros || '',
      })
      setExistingId(data.id)
    } else {
      setExistingId(null)
    }
  }, [data])

  const saveMutation = useMutation({
    mutationFn: (d) =>
      existingId
        ? api.put(`/antecedentes-patologicos/${existingId}`, d)
        : api.post('/antecedentes-patologicos', { ...d, paciente_id: parseInt(pacienteId) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['antecedentes_pp', pacienteId] })
      toast.success('Antecedentes patológicos guardados')
      setEditing(false)
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error al guardar'),
  })

  const canEdit = existingId ? canUpdate : canWrite
  const disabled = !editing

  if (isLoading) return <div className="text-center py-8 text-slate-400 dark:text-slate-500">Cargando...</div>

  const handleSubmit = (e) => { e.preventDefault(); saveMutation.mutate(form) }
  const updateField = (f, v) => setForm((prev) => ({ ...prev, [f]: v }))

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
      <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-primary" /> Antecedentes Personales Patológicos
        </h3>
        {canEdit && !editing && (
          <button onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-primary border border-primary/30 rounded-xl hover:bg-primary/5 transition-colors">
            <Edit3 className="w-4 h-4" /> Editar
          </button>
        )}
      </div>
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <FormTextarea icon={AlertCircle} iconColor="text-orange-500" label="Enfermedades Exantemáticas"
          value={form.enfermedades_exantematicas} onChange={(v) => updateField('enfermedades_exantematicas', v)}
          placeholder="Varicela, sarampión, rubéola..." disabled={disabled} />
        <FormTextarea icon={Pill} iconColor="text-red-500" label="Alergias"
          value={form.alergias} onChange={(v) => updateField('alergias', v)}
          placeholder="Medicamentos, alimentos, ambientales..." disabled={disabled} />
        <FormTextarea icon={Scissors} iconColor="text-blue-500" label="Cirugías"
          value={form.cirugias} onChange={(v) => updateField('cirugias', v)}
          placeholder="Tipo de cirugía, fecha..." disabled={disabled} />
        <FormTextarea icon={ClipboardList} iconColor="text-slate-500" label="Otros"
          value={form.otros} onChange={(v) => updateField('otros', v)}
          placeholder="Otros antecedentes relevantes..." disabled={disabled} />

        {editing && (
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
            <button type="button" onClick={() => setEditing(false)}
              className="px-5 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saveMutation.isPending}
              className="inline-flex items-center gap-2 px-5 py-2 bg-primary text-white text-sm font-medium rounded-xl shadow-lg shadow-primary/30 hover:bg-primary-dark disabled:opacity-50 transition-all">
              <Save className="w-4 h-4" /> {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        )}
      </form>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   Tab: Antecedentes No Patológicos
   ═══════════════════════════════════════════════════════ */
const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const BIRTH_TYPES = ['Eutócico', 'Cesárea', 'Instrumental', 'Otro']

const EMPTY_PNP = {
  producto_gesta: '', tipo_nacimiento: '', peso_nacer_kg: '', talla_nacer_cm: '',
  seno_materno: false, inicio_formula_meses: '', tipo_sangre: '', apgar: '',
  ablactacion: '', alimentacion: '', zoonosis: '',
  lugar_nacimiento: '', lugar_residencia: '',
  respiro_al_nacer: null, lloro_al_nacer: null, desarrollo_psicomotor: '',
}

function TabNoPatologicos({ pacienteId }) {
  const { canWrite, canUpdate } = useModulePermission('antecedentes_pnp')
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(EMPTY_PNP)
  const [inmunizaciones, setInmunizaciones] = useState([])
  const [existingId, setExistingId] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['antecedentes_pnp', pacienteId],
    queryFn: () => api.get(`/antecedentes-no-patologicos/paciente/${pacienteId}`).then((r) => r.data),
  })

  useEffect(() => {
    if (data) {
      setForm({
        producto_gesta: data.producto_gesta || '',
        tipo_nacimiento: data.tipo_nacimiento || '',
        peso_nacer_kg: data.peso_nacer_kg ?? '',
        talla_nacer_cm: data.talla_nacer_cm ?? '',
        seno_materno: !!data.seno_materno,
        inicio_formula_meses: data.inicio_formula_meses ?? '',
        tipo_sangre: data.tipo_sangre || '',
        apgar: data.apgar || '',
        ablactacion: data.ablactacion || '',
        alimentacion: data.alimentacion || '',
        zoonosis: data.zoonosis || '',
        lugar_nacimiento: data.lugar_nacimiento || '',
        lugar_residencia: data.lugar_residencia || '',
        respiro_al_nacer: data.respiro_al_nacer,
        lloro_al_nacer: data.lloro_al_nacer,
        desarrollo_psicomotor: data.desarrollo_psicomotor || '',
      })
      setInmunizaciones(data.inmunizaciones || [])
      setExistingId(data.id)
    } else {
      setExistingId(null)
    }
  }, [data])

  const saveMutation = useMutation({
    mutationFn: (d) =>
      existingId
        ? api.put(`/antecedentes-no-patologicos/${existingId}`, { ...d, inmunizaciones })
        : api.post('/antecedentes-no-patologicos', { ...d, paciente_id: parseInt(pacienteId), inmunizaciones }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['antecedentes_pnp', pacienteId] })
      toast.success('Antecedentes no patológicos guardados')
      setEditing(false)
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error al guardar'),
  })

  const canEdit = existingId ? canUpdate : canWrite
  const disabled = !editing

  if (isLoading) return <div className="text-center py-8 text-slate-400 dark:text-slate-500">Cargando...</div>

  const handleSubmit = (e) => { e.preventDefault(); saveMutation.mutate(form) }
  const updateField = (f, v) => setForm((prev) => ({ ...prev, [f]: v }))

  const addInm = () => setInmunizaciones([...inmunizaciones, { vacuna: '', dosis: '', fecha_aplicacion: '', lote: '', observaciones: '' }])
  const updateInm = (idx, field, value) => setInmunizaciones((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  const removeInm = (idx) => setInmunizaciones((prev) => prev.filter((_, i) => i !== idx))

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Datos perinatales */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Baby className="w-5 h-5 text-primary" /> Datos Perinatales
          </h3>
          {canEdit && !editing && (
            <button type="button" onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-primary border border-primary/30 rounded-xl hover:bg-primary/5 transition-colors">
              <Edit3 className="w-4 h-4" /> Editar
            </button>
          )}
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Producto de la Gesta" value={form.producto_gesta} onChange={(v) => updateField('producto_gesta', v)} disabled={disabled} />
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Tipo Nacimiento</label>
              <select value={form.tipo_nacimiento} onChange={(e) => updateField('tipo_nacimiento', e.target.value)}
                className={clsx(inputClass, disabled && 'bg-slate-50 dark:bg-slate-700')} disabled={disabled}>
                <option value="">Seleccionar...</option>
                {BIRTH_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Tipo de Sangre</label>
              <select value={form.tipo_sangre} onChange={(e) => updateField('tipo_sangre', e.target.value)}
                className={clsx(inputClass, disabled && 'bg-slate-50 dark:bg-slate-700')} disabled={disabled}>
                <option value="">Seleccionar...</option>
                {BLOOD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <MiniField label="Peso al Nacer (kg)" type="number" step="0.01" value={form.peso_nacer_kg} onChange={(v) => updateField('peso_nacer_kg', v)} disabled={disabled} />
            <MiniField label="Talla al Nacer (cm)" type="number" step="0.1" value={form.talla_nacer_cm} onChange={(v) => updateField('talla_nacer_cm', v)} disabled={disabled} />
            <Field label="Apgar" value={form.apgar} onChange={(v) => updateField('apgar', v)} disabled={disabled} placeholder="8/9" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <CheckboxField label="Seno Materno" checked={form.seno_materno} onChange={(v) => updateField('seno_materno', v)} disabled={disabled} />
            <CheckboxField label="Respiró al Nacer" checked={form.respiro_al_nacer === 1} onChange={(v) => updateField('respiro_al_nacer', v ? 1 : 0)} disabled={disabled} />
            <CheckboxField label="Lloró al Nacer" checked={form.lloro_al_nacer === 1} onChange={(v) => updateField('lloro_al_nacer', v ? 1 : 0)} disabled={disabled} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <MiniField label="Inicio de Fórmula (meses)" type="number" value={form.inicio_formula_meses} onChange={(v) => updateField('inicio_formula_meses', v)} disabled={disabled} />
            <Field label="Ablactación" value={form.ablactacion} onChange={(v) => updateField('ablactacion', v)} disabled={disabled} />
            <Field label="Alimentación" value={form.alimentacion} onChange={(v) => updateField('alimentacion', v)} disabled={disabled} />
            <Field label="Zoonosis" value={form.zoonosis} onChange={(v) => updateField('zoonosis', v)} disabled={disabled} />
            <Field label="Lugar de Nacimiento" value={form.lugar_nacimiento} onChange={(v) => updateField('lugar_nacimiento', v)} disabled={disabled} />
            <Field label="Lugar de Residencia" value={form.lugar_residencia} onChange={(v) => updateField('lugar_residencia', v)} disabled={disabled} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Desarrollo Psicomotor</label>
            <textarea value={form.desarrollo_psicomotor} onChange={(e) => updateField('desarrollo_psicomotor', e.target.value)}
              rows={2} className={clsx(inputClass, 'resize-none', disabled && 'bg-slate-50 dark:bg-slate-700')} disabled={disabled} />
          </div>
        </div>
      </div>

      {/* Inmunizaciones */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Syringe className="w-5 h-5 text-primary" /> Inmunizaciones ({inmunizaciones.length})
          </h3>
          {editing && (
            <button type="button" onClick={addInm}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors">
              <Plus className="w-3 h-3" /> Agregar
            </button>
          )}
        </div>
        <div className="p-5">
          {inmunizaciones.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">No hay inmunizaciones registradas</p>
          ) : (
            <div className="space-y-3">
              {inmunizaciones.map((inm, idx) => (
                <div key={idx} className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end p-3 bg-slate-50 dark:bg-slate-700 rounded-xl">
                  <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Vacuna</label>
                    <select value={inm.vacuna} onChange={(e) => updateInm(idx, 'vacuna', e.target.value)}
                      className={clsx(inputClass, disabled && 'bg-white dark:bg-slate-800')} disabled={disabled}>
                      <option value="">Seleccionar...</option>
                      {['BCG', 'Pentavalente', 'Sabin', 'Triple Viral', 'DPT', 'Hepatitis B', 'Otra'].map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Dosis</label>
                    <select value={inm.dosis || ''} onChange={(e) => updateInm(idx, 'dosis', e.target.value)}
                      className={clsx(inputClass, disabled && 'bg-white dark:bg-slate-800')} disabled={disabled}>
                      <option value="">-</option>
                      {['Única', '1a', '2a', '3a', 'Refuerzo'].map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Fecha</label>
                    <input type="date" value={inm.fecha_aplicacion || ''} onChange={(e) => updateInm(idx, 'fecha_aplicacion', e.target.value)}
                      className={clsx(inputClass, disabled && 'bg-white dark:bg-slate-800')} disabled={disabled} />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Observaciones</label>
                    <input value={inm.observaciones || ''} onChange={(e) => updateInm(idx, 'observaciones', e.target.value)}
                      className={clsx(inputClass, disabled && 'bg-white dark:bg-slate-800')} disabled={disabled} />
                  </div>
                  {editing && (
                    <button type="button" onClick={() => removeInm(idx)}
                      className="p-2 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-500 transition-colors self-end">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {editing && (
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => setEditing(false)}
            className="px-5 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={saveMutation.isPending}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-xl shadow-lg shadow-primary/30 hover:bg-primary-dark disabled:opacity-50 transition-all">
            <Save className="w-4 h-4" /> {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      )}
    </form>
  )
}

/* ═══════════════════════════════════════════════════════
   Tab: Antecedentes Heredo Familiares
   ═══════════════════════════════════════════════════════ */
const HF_FIELDS = [
  { key: 'abuelo_paterno', label: 'Abuelo Paterno' },
  { key: 'abuela_paterna', label: 'Abuela Paterna' },
  { key: 'abuelo_materno', label: 'Abuelo Materno' },
  { key: 'abuela_materna', label: 'Abuela Materna' },
  { key: 'padre', label: 'Padre' },
  { key: 'madre', label: 'Madre' },
  { key: 'hermanos', label: 'Hermanos' },
]

function TabHeredoFamiliares({ pacienteId }) {
  const { canWrite, canUpdate } = useModulePermission('antecedentes_hf')
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [existingId, setExistingId] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['antecedentes_hf', pacienteId],
    queryFn: () => api.get(`/antecedentes-heredo-familiares/paciente/${pacienteId}`).then((r) => r.data),
  })

  useEffect(() => {
    if (data) {
      const f = {}
      HF_FIELDS.forEach(({ key }) => { f[key] = data[key] || '' })
      setForm(f)
      setExistingId(data.id)
    } else {
      const f = {}
      HF_FIELDS.forEach(({ key }) => { f[key] = '' })
      setForm(f)
      setExistingId(null)
    }
  }, [data])

  const saveMutation = useMutation({
    mutationFn: (d) =>
      existingId
        ? api.put(`/antecedentes-heredo-familiares/${existingId}`, d)
        : api.post('/antecedentes-heredo-familiares', { ...d, paciente_id: parseInt(pacienteId) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['antecedentes_hf', pacienteId] })
      toast.success('Antecedentes heredo familiares guardados')
      setEditing(false)
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error al guardar'),
  })

  const canEdit = existingId ? canUpdate : canWrite
  const disabled = !editing

  if (isLoading) return <div className="text-center py-8 text-slate-400 dark:text-slate-500">Cargando...</div>

  const handleSubmit = (e) => { e.preventDefault(); saveMutation.mutate(form) }
  const updateField = (f, v) => setForm((prev) => ({ ...prev, [f]: v }))

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
      <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" /> Antecedentes Heredo Familiares
        </h3>
        {canEdit && !editing && (
          <button type="button" onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-primary border border-primary/30 rounded-xl hover:bg-primary/5 transition-colors">
            <Edit3 className="w-4 h-4" /> Editar
          </button>
        )}
      </div>
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {HF_FIELDS.map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">{label}</label>
              <textarea value={form[key] || ''} onChange={(e) => updateField(key, e.target.value)}
                rows={2} className={clsx(inputClass, 'resize-none', disabled && 'bg-slate-50 dark:bg-slate-700')}
                placeholder={disabled ? '' : `Patologías de ${label.toLowerCase()}...`} disabled={disabled} />
            </div>
          ))}
        </div>

        {editing && (
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
            <button type="button" onClick={() => setEditing(false)}
              className="px-5 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saveMutation.isPending}
              className="inline-flex items-center gap-2 px-5 py-2 bg-primary text-white text-sm font-medium rounded-xl shadow-lg shadow-primary/30 hover:bg-primary-dark disabled:opacity-50 transition-all">
              <Save className="w-4 h-4" /> {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        )}
      </form>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   Reusable components
   ═══════════════════════════════════════════════════════ */
function Field({ label, value, onChange, disabled, required, placeholder, type = 'text' }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">{label}</label>
      <input type={type} value={value || ''} onChange={(e) => onChange(e.target.value)}
        className={clsx(inputClass, disabled && 'bg-slate-50 dark:bg-slate-700')} disabled={disabled} required={required} placeholder={placeholder} />
    </div>
  )
}

function MiniField({ label, value, onChange, disabled, type = 'text', step }) {
  return (
    <div>
      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</label>
      <input type={type} step={step} value={value ?? ''} onChange={(e) => onChange(e.target.value)}
        className={clsx(inputClass, disabled && 'bg-slate-50 dark:bg-slate-700')} disabled={disabled} />
    </div>
  )
}

function CheckboxField({ label, checked, onChange, disabled }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)}
        className="rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary dark:bg-slate-700" disabled={disabled} />
      {label}
    </label>
  )
}

function FormTextarea({ icon: Icon, iconColor, label, value, onChange, placeholder, disabled }) {
  return (
    <div>
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
        <Icon className={`w-4 h-4 ${iconColor}`} /> {label}
      </label>
      <textarea value={value || ''} onChange={(e) => onChange(e.target.value)}
        rows={2} className={clsx(inputClass, 'resize-none', disabled && 'bg-slate-50 dark:bg-slate-700')} placeholder={disabled ? '' : placeholder} disabled={disabled} />
    </div>
  )
}

function StatChip({ icon: Icon, label, value }) {
  return (
    <div className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-700 flex items-center gap-2">
      <Icon className="w-3.5 h-3.5 text-primary flex-shrink-0" />
      <div>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold">{label}</p>
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{value}</p>
      </div>
    </div>
  )
}
