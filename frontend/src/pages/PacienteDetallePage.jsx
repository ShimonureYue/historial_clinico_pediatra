import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Save, Baby, Calendar, Phone, User, Stethoscope,
  ClipboardList, HeartPulse, Users, Plus, Eye, Edit3,
  Weight, Ruler, Thermometer, Wind, Activity, Syringe,
  AlertCircle, Pill, Scissors, ChevronDown, ChevronUp, Search,
  CalendarDays, TrendingUp, FileText, Check, X,
} from 'lucide-react'
import api from '../lib/api'
import useModulePermission from '../hooks/useModulePermission'
import toast from 'react-hot-toast'
import clsx from 'clsx'

/* ─────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────────────────
   Constants
───────────────────────────────────────────────────────── */
const TABS = [
  { id: 'info', label: 'Datos del Paciente', icon: Baby },
  { id: 'heredo_familiares', label: 'Heredo Familiares', icon: Users },
  { id: 'no_patologicos', label: 'No Patológicos', icon: HeartPulse },
  { id: 'patologicos', label: 'Patológicos', icon: ClipboardList },
  { id: 'consultas', label: 'Historial', icon: Stethoscope },
]

const inputClass = "w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:bg-slate-700 dark:text-slate-100"

// Extract error message safely (Pydantic returns detail as array of objects)
const apiError = (e, fallback) => {
  const d = e.response?.data?.detail
  return typeof d === 'string' ? d : fallback
}

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const BIRTH_TYPES = ['Eutócico', 'Cesárea', 'Instrumental', 'Otro']

// Esquema Nacional de Vacunación vigente (México)
const ESQUEMA_VIGENTE = [
  { vacuna: 'BCG', dosis: ['Única'] },
  { vacuna: 'Hepatitis B', dosis: ['1a', '2a', '3a'] },
  { vacuna: 'Hexavalente acelular', dosis: ['1a', '2a', '3a', '4a'] },
  { vacuna: 'Rotavirus', dosis: ['1a', '2a', '3a'] },
  { vacuna: 'Neumocócica conjugada', dosis: ['1a', '2a', '3a'] },
  { vacuna: 'Influenza estacional', dosis: ['Única'] },
  { vacuna: 'SRP (Triple viral)', dosis: ['1a', '2a'] },
  { vacuna: 'DPT', dosis: ['Refuerzo'] },
  { vacuna: 'VPH', dosis: ['1a', '2a'] },
  { vacuna: 'Tdpa', dosis: ['Única'] },
  { vacuna: 'Td', dosis: ['1a', '2a', '3a', 'Refuerzo'] },
  { vacuna: 'SR (doble viral)', dosis: ['1a', '2a'] },
  { vacuna: 'Neumocócica adultos', dosis: ['Única'] },
  { vacuna: 'COVID-19', dosis: ['1a', '2a', 'Refuerzo'] },
]
// Mapeo de nombres legacy (DB) → nombre vigente (para poder mostrar datos viejos en esquema nuevo)
const LEGACY_MAP = {
  'Hepatitis': 'Hepatitis B',
  'HEPATITIS b': 'Hepatitis B',
  'HAPTITIS B': 'Hepatitis B',
  'Triple Viral': 'SRP (Triple viral)',
  'INFLUENZA': 'Influenza estacional',
  'INFLUENZAE': 'Influenza estacional',
  'influenzae': 'Influenza estacional',
  'influenza fluzone': 'Influenza estacional',
  'NEUMOCOCO': 'Neumocócica conjugada',
  'neumococo': 'Neumocócica conjugada',
  'Rotavirus': 'Rotavirus',
  'ROTAVIRUS': 'Rotavirus',
  'rotavirus': 'Rotavirus',
  'COVID': 'COVID-19',
}

// Esquema anterior: vacunas que están en la DB pero no en el vigente
const ESQUEMA_ANTERIOR = [
  { vacuna: 'Pentavalente', dosis: ['1a', '2a', '3a'] },
  { vacuna: 'Sabin', dosis: ['1a', '2a', '3a'] },
  { vacuna: 'Sabin Nacmiento', dosis: ['Única'] },
]

const HF_GROUPS = [
  {
    label: 'Línea Paterna',
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    members: [
      { key: 'abuelo_paterno', label: 'Abuelo Paterno' },
      { key: 'abuela_paterna', label: 'Abuela Paterna' },
    ],
  },
  {
    label: 'Línea Materna',
    color: 'text-pink-600 dark:text-pink-400',
    bg: 'bg-pink-50 dark:bg-pink-900/20',
    members: [
      { key: 'abuelo_materno', label: 'Abuelo Materno' },
      { key: 'abuela_materna', label: 'Abuela Materna' },
    ],
  },
  {
    label: 'Padres',
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    members: [
      { key: 'padre', label: 'Padre' },
      { key: 'madre', label: 'Madre' },
    ],
  },
  {
    label: 'Hermanos',
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    members: [
      { key: 'hermanos', label: 'Hermanos' },
    ],
  },
]

const EMPTY_PNP = {
  producto_gesta: '', tipo_nacimiento: '', peso_nacer_kg: '', talla_nacer_cm: '',
  seno_materno: false, inicio_formula_meses: '', tipo_sangre: '', apgar: '',
  ablactacion: '', alimentacion: '', zoonosis: '',
  lugar_nacimiento: '', lugar_residencia: '',
  respiro_al_nacer: null, lloro_al_nacer: null, desarrollo_psicomotor: '',
}

/* ─────────────────────────────────────────────────────────
   Main Page
───────────────────────────────────────────────────────── */
export default function PacienteDetallePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('info')
  const [editMode, setEditMode] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const infoRef = useRef()
  const ppRef = useRef()
  const pnpRef = useRef()
  const hfRef = useRef()

  const handleSaveAll = async () => {
    setIsSaving(true)
    const results = await Promise.allSettled([
      infoRef.current?.save(),
      ppRef.current?.save(),
      pnpRef.current?.save(),
      hfRef.current?.save(),
    ])
    setIsSaving(false)
    if (results.every((r) => r.status === 'fulfilled')) {
      setEditMode(false)
      toast.success('Cambios guardados')
    }
  }

  const handleCancel = () => {
    infoRef.current?.cancel()
    ppRef.current?.cancel()
    pnpRef.current?.cancel()
    hfRef.current?.cancel()
    setEditMode(false)
  }

  return (
    <div className="space-y-4">
      <PatientHeader
        pacienteId={id}
        onBack={() => navigate('/pacientes')}
        editMode={editMode}
        onEdit={() => setEditMode(true)}
        onSave={handleSaveAll}
        onCancel={handleCancel}
        isSaving={isSaving}
      />

      {/* Tab navigation */}
      <div className="flex bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-xl overflow-x-auto scrollbar-none">
        {TABS.map(({ id: tabId, label, icon: Icon }, idx) => (
          <button
            key={tabId}
            onClick={() => setActiveTab(tabId)}
            className={clsx(
              'flex flex-col items-center justify-center gap-1 py-3 px-3 sm:flex-1 transition-all relative text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap shrink-0 min-w-[72px]',
              idx !== 0 && 'border-l border-slate-200 dark:border-slate-700',
              activeTab === tabId
                ? 'text-primary bg-white dark:bg-slate-800'
                : 'text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300'
            )}
          >
            {activeTab === tabId && (
              <span className="absolute top-0 left-0 right-0 h-0.5 bg-primary rounded-b" />
            )}
            <Icon className={clsx('w-5 h-5', activeTab === tabId ? 'text-primary' : 'text-slate-400 dark:text-slate-500')} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* ── Datos del Paciente (split view) ── */}
      <div className={activeTab === 'info' ? '' : 'hidden'}>
        <div className="flex flex-col lg:flex-row gap-4 lg:items-start">
          <div className="w-full lg:w-[45%] xl:w-[42%] flex-shrink-0">
            <TabInfoPaciente ref={infoRef} pacienteId={id} editMode={editMode} />
          </div>
          <div className="w-full lg:flex-1 lg:sticky lg:top-4 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
            <ConsultasSidebar pacienteId={id} />
          </div>
        </div>
      </div>

      {/* ── Heredo Familiares ── */}
      <div className={activeTab === 'heredo_familiares' ? '' : 'hidden'}>
        <TabHeredoFamiliares ref={hfRef} pacienteId={id} editMode={editMode} />
      </div>

      {/* ── No Patológicos ── */}
      <div className={activeTab === 'no_patologicos' ? '' : 'hidden'}>
        <TabNoPatologicos ref={pnpRef} pacienteId={id} editMode={editMode} />
      </div>

      {/* ── Patológicos ── */}
      <div className={activeTab === 'patologicos' ? '' : 'hidden'}>
        <TabPatologicos ref={ppRef} pacienteId={id} editMode={editMode} />
      </div>

      {/* ── Historial (full-width, no editMode) ── */}
      <div className={activeTab === 'consultas' ? '' : 'hidden'}>
        <HistorialConsultas pacienteId={id} />
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   Patient Header
   ═══════════════════════════════════════════════════════ */
function PatientHeader({ pacienteId, onBack, editMode, onEdit, onSave, onCancel, isSaving }) {
  const { canUpdate } = useModulePermission('pacientes')
  const { data: pac } = useQuery({
    queryKey: ['paciente', pacienteId],
    queryFn: () => api.get(`/pacientes/${pacienteId}`).then((r) => r.data),
  })

  if (!pac) return null

  return (
    <div className={clsx(
      'bg-white dark:bg-slate-800 rounded-2xl border shadow-sm p-4 transition-colors',
      editMode ? 'border-primary/40 ring-1 ring-primary/20' : 'border-slate-100 dark:border-slate-700'
    )}>
      <div className="flex items-start gap-3">
        <button onClick={onBack}
          className="mt-0.5 p-2 rounded-xl text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-600 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 truncate">
              {pac.nombre} {pac.apellido_paterno} {pac.apellido_materno}
            </h1>
            {editMode && (
              <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                <Edit3 className="w-3 h-3" /> Editando
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <AgeBadge fechaNac={pac.fecha_nacimiento} />
              <span className="text-slate-400 dark:text-slate-500 text-xs">({pac.fecha_nacimiento})</span>
            </span>
            <span className={clsx(
              'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
              pac.sexo === 'F' ? 'bg-pink-50 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400'
                : pac.sexo === 'M' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            )}>
              {pac.sexo === 'F' ? 'Femenino' : pac.sexo === 'M' ? 'Masculino' : 'Otro'}
            </span>
            {pac.telefono_contacto && (
              <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {pac.telefono_contacto}</span>
            )}
            <span className="text-xs font-mono text-slate-400 dark:text-slate-500">ID: {pac.id}</span>
          </div>
        </div>

        {/* Edit / Save / Cancel */}
        <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
          {!editMode ? (
            canUpdate && (
              <button onClick={onEdit}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-primary border border-primary/30 rounded-xl hover:bg-primary/5 transition-colors">
                <Edit3 className="w-4 h-4" /> Editar
              </button>
            )
          ) : (
            <>
              <button onClick={onCancel}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                <X className="w-4 h-4" /> Cancelar
              </button>
              <button onClick={onSave} disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-medium rounded-xl shadow-lg shadow-primary/30 hover:bg-primary-dark disabled:opacity-50 transition-all">
                <Save className="w-4 h-4" /> {isSaving ? 'Guardando...' : 'Guardar todo'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   Tab: Datos del Paciente
   ═══════════════════════════════════════════════════════ */
const TabInfoPaciente = forwardRef(function TabInfoPaciente({ pacienteId, editMode }, ref) {
  const queryClient = useQueryClient()
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
    },
    onError: (e) => toast.error(apiError(e, 'Error al guardar datos del paciente')),
  })

  useImperativeHandle(ref, () => ({
    save: async () => {
      if (!form) return
      const { nombre, apellido_paterno, apellido_materno, fecha_nacimiento, sexo, direccion, telefono_contacto, responsable } = form
      await saveMutation.mutateAsync({ nombre, apellido_paterno, apellido_materno, fecha_nacimiento, sexo, direccion, telefono_contacto, responsable })
    },
    cancel: () => {
      if (pac) setForm({ ...pac })
    },
  }), [form, pac])

  if (isLoading || !form) return <div className="text-center py-8 text-slate-400 dark:text-slate-500">Cargando...</div>

  const disabled = !editMode
  const updateField = (f, v) => setForm((prev) => ({ ...prev, [f]: v }))

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
      <div className="flex items-center p-5 border-b border-slate-100 dark:border-slate-700">
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <User className="w-5 h-5 text-primary" /> Ficha de Identificación
        </h3>
      </div>
      <div className="p-5 space-y-4">
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
      </div>
    </div>
  )
})

/* ═══════════════════════════════════════════════════════
   Consultations Sidebar
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
    onError: (e) => toast.error(apiError(e, 'Error al crear consulta')),
  })

  const handleCreate = (e) => { e.preventDefault(); createMutation.mutate(newForm) }

  return (
    <div className="space-y-3">
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

      {isLoading ? (
        <div className="text-center py-8 text-slate-400 dark:text-slate-500">Cargando consultas...</div>
      ) : consultas.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-10 text-center">
          <Stethoscope className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-slate-500 dark:text-slate-400 text-sm">No hay consultas registradas</p>
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
                  <div className="flex justify-end">
                    <button onClick={() => navigate(`/consultas/${c.id}`)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors">
                      <Eye className="w-3.5 h-3.5" /> Ver / Editar
                    </button>
                  </div>
                  <ConsultaDetailContent c={c} />
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
   Historial de Consultas (full-width)
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
    onError: (e) => toast.error(apiError(e, 'Error al crear consulta')),
  })

  const handleCreate = (e) => { e.preventDefault(); createMutation.mutate(newForm) }

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
  const totalMeds = consultas.reduce((sum, c) => sum + (c.tratamientos?.length || 0), 0)
  const uniqueDx = [...new Set(consultas.map((c) => c.impresion_diagnostica).filter(Boolean))]
  const lastConsulta = consultas.length > 0 ? consultas[0] : null

  useEffect(() => {
    if (consultas.length > 0 && !selectedId) setSelectedId(consultas[0].id)
  }, [consultas, selectedId])

  if (isLoading) return <div className="text-center py-12 text-slate-400 dark:text-slate-500">Cargando historial...</div>

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-4 flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary"><FileText className="w-5 h-5" /></div>
          <div><p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{consultas.length}</p><p className="text-xs text-slate-500 dark:text-slate-400">Consultas</p></div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-4 flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400"><Pill className="w-5 h-5" /></div>
          <div><p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{totalMeds}</p><p className="text-xs text-slate-500 dark:text-slate-400">Medicamentos</p></div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-4 flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"><TrendingUp className="w-5 h-5" /></div>
          <div><p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{uniqueDx.length}</p><p className="text-xs text-slate-500 dark:text-slate-400">Diagnósticos</p></div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-4 flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"><CalendarDays className="w-5 h-5" /></div>
          <div><p className="text-sm font-bold text-slate-800 dark:text-slate-100">{lastConsulta?.fecha_consulta || '-'}</p><p className="text-xs text-slate-500 dark:text-slate-400">Última consulta</p></div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
          <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por fecha, padecimiento, diagnóstico, medicamento..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary bg-white dark:bg-slate-700 dark:text-slate-100" />
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
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-4 lg:items-start">
          <div className="w-full lg:w-[38%] xl:w-[35%] flex-shrink-0 space-y-1.5 lg:max-h-[calc(100vh-18rem)] lg:overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-8 text-center">
                <Search className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-sm text-slate-500 dark:text-slate-400">Sin resultados para "{searchTerm}"</p>
              </div>
            ) : (
              filtered.map((c, idx) => (
                <button key={c.id} onClick={() => setSelectedId(c.id)}
                  className={clsx('w-full text-left p-3.5 rounded-xl border transition-all',
                    selectedId === c.id ? 'bg-primary/5 border-primary/30 shadow-sm'
                      : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700')}>
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center flex-shrink-0 mt-1">
                      <div className={clsx('w-2.5 h-2.5 rounded-full', idx === 0 && !searchTerm ? 'bg-primary' : selectedId === c.id ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600')} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={clsx('text-sm font-semibold', selectedId === c.id ? 'text-primary' : 'text-slate-800 dark:text-slate-100')}>{c.fecha_consulta}</p>
                        {c.tratamientos?.length > 0 && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-medium">
                            <Pill className="w-2.5 h-2.5 mr-0.5" /> {c.tratamientos.length}
                          </span>
                        )}
                      </div>
                      {c.impresion_diagnostica && (
                        <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400 mt-0.5 truncate">{c.impresion_diagnostica}</p>
                      )}
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{c.padecimiento_actual}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
          <div className="w-full lg:flex-1 lg:sticky lg:top-4">
            {selected ? (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary"><Stethoscope className="w-5 h-5" /></div>
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
        </div>
      )}
      {c.impresion_diagnostica && (
        <div>
          <h5 className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Impresión Diagnóstica</h5>
          <p className="text-sm text-slate-700 dark:text-slate-200 bg-amber-50 dark:bg-amber-900/30 p-3 rounded-xl border border-amber-100 dark:border-amber-800">{c.impresion_diagnostica}</p>
        </div>
      )}
      {c.plan_tratamiento && (
        <div>
          <h5 className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Plan de Tratamiento</h5>
          <p className={clsx('text-sm text-slate-700 dark:text-slate-200 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100 dark:border-blue-800', expanded && 'whitespace-pre-wrap')}>{c.plan_tratamiento}</p>
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
      {c.notas_adicionales && (
        <div>
          <h5 className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Indicaciones y comentarios</h5>
          <div
            className="text-sm text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-700/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700 prose prose-xs dark:prose-invert max-w-none [&_p]:my-0.5 [&_ul]:my-0.5 [&_ol]:my-0.5 [&_ul]:pl-4 [&_ol]:pl-4 [&_li]:my-0"
            dangerouslySetInnerHTML={{ __html: c.notas_adicionales }}
          />
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
const TabPatologicos = forwardRef(function TabPatologicos({ pacienteId, editMode }, ref) {
  const { canWrite, canUpdate } = useModulePermission('antecedentes_pp')
  const queryClient = useQueryClient()
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
    },
    onError: (e) => toast.error(apiError(e, 'Error al guardar antecedentes patológicos')),
  })

  useImperativeHandle(ref, () => ({
    save: async () => {
      if (!existingId) {
        const hasContent = Object.values(form).some((v) => v !== '')
        if (!hasContent) return
      }
      await saveMutation.mutateAsync(form)
    },
    cancel: () => {
      if (data) {
        setForm({
          enfermedades_exantematicas: data.enfermedades_exantematicas || '',
          alergias: data.alergias || '',
          cirugias: data.cirugias || '',
          otros: data.otros || '',
        })
      } else {
        setForm({ enfermedades_exantematicas: '', alergias: '', cirugias: '', otros: '' })
      }
    },
  }), [form, data, existingId])

  const disabled = !editMode
  const updateField = (f, v) => setForm((prev) => ({ ...prev, [f]: v }))

  if (isLoading) return <div className="text-center py-8 text-slate-400 dark:text-slate-500">Cargando...</div>

  const canEdit = existingId ? canUpdate : canWrite
  if (!canEdit && !existingId) return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-10 text-center">
      <ClipboardList className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
      <p className="text-slate-500 dark:text-slate-400 text-sm">Sin antecedentes patológicos registrados</p>
    </div>
  )

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
      <div className="flex items-center p-5 border-b border-slate-100 dark:border-slate-700">
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-primary" /> Antecedentes Personales Patológicos
        </h3>
      </div>
      <div className="p-5 space-y-4">
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
      </div>
    </div>
  )
})

/* ═══════════════════════════════════════════════════════
   Tab: Antecedentes No Patológicos
   ═══════════════════════════════════════════════════════ */
const TabNoPatologicos = forwardRef(function TabNoPatologicos({ pacienteId, editMode }, ref) {
  const queryClient = useQueryClient()
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
        ? api.put(`/antecedentes-no-patologicos/${existingId}`, d)
        : api.post('/antecedentes-no-patologicos', { ...d, paciente_id: parseInt(pacienteId) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['antecedentes_pnp', pacienteId] })
    },
    onError: (e) => toast.error(apiError(e, 'Error al guardar antecedentes no patológicos')),
  })

  useImperativeHandle(ref, () => ({
    save: async () => {
      if (!existingId) {
        const hasContent =
          Object.entries(form).some(([k, v]) => k !== 'seno_materno' && v !== '' && v !== null) ||
          inmunizaciones.length > 0
        if (!hasContent) return
      }
      await saveMutation.mutateAsync({ ...form, inmunizaciones })
    },
    cancel: () => {
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
      } else {
        setForm(EMPTY_PNP)
        setInmunizaciones([])
      }
    },
  }), [form, inmunizaciones, data, existingId])

  const disabled = !editMode
  const updateField = (f, v) => setForm((prev) => ({ ...prev, [f]: v }))

  if (isLoading) return <div className="text-center py-8 text-slate-400 dark:text-slate-500">Cargando...</div>

  const sel = clsx('w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:bg-slate-700 dark:text-slate-100', disabled && 'bg-slate-50 dark:bg-slate-700')

  return (
    <div className="space-y-3">
      {/* Datos perinatales */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
        <div className="flex items-center px-4 py-2.5 border-b border-slate-100 dark:border-slate-700">
          <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
            <Baby className="w-3.5 h-3.5 text-primary" /> Datos Perinatales
          </h3>
        </div>
        <div className="p-4 space-y-3">
          {/* Row 1: gesta / tipo nac / sangre / apgar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-0.5">Producto Gesta</label>
              <input value={form.producto_gesta} onChange={(e) => updateField('producto_gesta', e.target.value)}
                className={sel} disabled={disabled} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-0.5">Tipo Nacimiento</label>
              <select value={form.tipo_nacimiento} onChange={(e) => updateField('tipo_nacimiento', e.target.value)} className={sel} disabled={disabled}>
                <option value="">—</option>
                {BIRTH_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-0.5">Tipo de Sangre</label>
              <select value={form.tipo_sangre} onChange={(e) => updateField('tipo_sangre', e.target.value)} className={sel} disabled={disabled}>
                <option value="">—</option>
                {BLOOD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-0.5">Apgar</label>
              <input value={form.apgar} onChange={(e) => updateField('apgar', e.target.value)}
                className={sel} disabled={disabled} placeholder="8/9" />
            </div>
          </div>

          {/* Row 2: peso / talla / formula / ablactacion */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-0.5">Peso Nacer (kg)</label>
              <input type="number" step="0.01" value={form.peso_nacer_kg} onChange={(e) => updateField('peso_nacer_kg', e.target.value)}
                className={sel} disabled={disabled} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-0.5">Talla Nacer (cm)</label>
              <input type="number" step="0.1" value={form.talla_nacer_cm} onChange={(e) => updateField('talla_nacer_cm', e.target.value)}
                className={sel} disabled={disabled} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-0.5">Fórmula (meses)</label>
              <input type="number" value={form.inicio_formula_meses} onChange={(e) => updateField('inicio_formula_meses', e.target.value)}
                className={sel} disabled={disabled} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-0.5">Ablactación</label>
              <input value={form.ablactacion} onChange={(e) => updateField('ablactacion', e.target.value)}
                className={sel} disabled={disabled} />
            </div>
          </div>

          {/* Row 3: alimentacion / zoonosis / nacimiento / residencia */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-0.5">Alimentación</label>
              <input value={form.alimentacion} onChange={(e) => updateField('alimentacion', e.target.value)}
                className={sel} disabled={disabled} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-0.5">Zoonosis</label>
              <input value={form.zoonosis} onChange={(e) => updateField('zoonosis', e.target.value)}
                className={sel} disabled={disabled} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-0.5">Lugar Nacimiento</label>
              <input value={form.lugar_nacimiento} onChange={(e) => updateField('lugar_nacimiento', e.target.value)}
                className={sel} disabled={disabled} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-0.5">Lugar Residencia</label>
              <input value={form.lugar_residencia} onChange={(e) => updateField('lugar_residencia', e.target.value)}
                className={sel} disabled={disabled} />
            </div>
          </div>

          {/* Row 4: checkboxes + psicomotor */}
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
            <label className={clsx('flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300', !disabled && 'cursor-pointer')}>
              <input type="checkbox" checked={form.seno_materno} onChange={(e) => updateField('seno_materno', e.target.checked)}
                disabled={disabled} className="w-3.5 h-3.5 rounded accent-primary" />
              Seno Materno
            </label>
            <label className={clsx('flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300', !disabled && 'cursor-pointer')}>
              <input type="checkbox" checked={form.respiro_al_nacer === 1} onChange={(e) => updateField('respiro_al_nacer', e.target.checked ? 1 : 0)}
                disabled={disabled} className="w-3.5 h-3.5 rounded accent-primary" />
              Respiró al Nacer
            </label>
            <label className={clsx('flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300', !disabled && 'cursor-pointer')}>
              <input type="checkbox" checked={form.lloro_al_nacer === 1} onChange={(e) => updateField('lloro_al_nacer', e.target.checked ? 1 : 0)}
                disabled={disabled} className="w-3.5 h-3.5 rounded accent-primary" />
              Lloró al Nacer
            </label>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-0.5">Desarrollo Psicomotor</label>
              <input value={form.desarrollo_psicomotor} onChange={(e) => updateField('desarrollo_psicomotor', e.target.value)}
                className={sel} disabled={disabled} />
            </div>
          </div>
        </div>
      </div>

      {/* Inmunizaciones */}
      <ImmunizationGrid
        inmunizaciones={inmunizaciones}
        setInmunizaciones={setInmunizaciones}
        disabled={disabled}
      />
    </div>
  )
})

/* ─────────────────────────────────────────────────────────
   Immunization Grid Component (checkbox table by dose)
───────────────────────────────────────────────────────── */
function ImmunizationGrid({ inmunizaciones, setInmunizaciones, disabled }) {
  // Normalize: map legacy names to current catalog names
  const normalize = (vacuna) => LEGACY_MAP[vacuna] || vacuna

  // Build a Set of "vacuna|dosis" keys from current inmunizaciones
  const appliedSet = new Set()
  inmunizaciones.forEach((inm) => {
    const v = normalize(inm.vacuna)
    const d = inm.dosis?.replace(/\./g, '') || '' // normalize "1a." → "1a"
    appliedSet.add(`${v}|${d}`)
  })

  // Check if a specific vaccine+dose is applied
  const isApplied = (vacuna, dosis) => {
    // For "Única" dosis, also match empty dosis (legacy data)
    if (dosis === 'Única') {
      return appliedSet.has(`${vacuna}|Única`) || appliedSet.has(`${vacuna}|`)
    }
    return appliedSet.has(`${vacuna}|${dosis}`)
  }

  // Toggle a specific vaccine+dose checkbox
  const toggleDose = (vacuna, dosis) => {
    if (disabled) return
    if (isApplied(vacuna, dosis)) {
      // Remove: find and remove the matching record (including legacy names)
      setInmunizaciones((prev) => {
        let removed = false
        return prev.filter((inm) => {
          if (removed) return true
          const v = normalize(inm.vacuna)
          const d = inm.dosis?.replace(/\./g, '') || ''
          const match = v === vacuna && (
            d === dosis ||
            (dosis === 'Única' && d === '') ||
            (dosis === '' && d === 'Única')
          )
          if (match) { removed = true; return false }
          return true
        })
      })
    } else {
      // Add new record with the current esquema name
      setInmunizaciones((prev) => [
        ...prev,
        { vacuna, dosis, fecha_aplicacion: '', lote: '', observaciones: '' },
      ])
    }
  }

  // Count how many doses are applied for a vaccine (for the badge)
  const countApplied = (esquema) => {
    return esquema.dosis.filter((d) => isApplied(esquema.vacuna, d)).length
  }

  // Find vaccines in DB that don't match any esquema
  const allEsquemaNames = new Set([
    ...ESQUEMA_VIGENTE.map((e) => e.vacuna),
    ...ESQUEMA_ANTERIOR.map((e) => e.vacuna),
  ])
  const legacyTargets = new Set(Object.values(LEGACY_MAP))
  const unmapped = inmunizaciones.filter((inm) => {
    const v = normalize(inm.vacuna)
    return !allEsquemaNames.has(v) && !allEsquemaNames.has(inm.vacuna) && !legacyTargets.has(v) && inm.vacuna
  })
  // Group unmapped by vacuna
  const unmappedByVacuna = {}
  unmapped.forEach((inm) => {
    if (!unmappedByVacuna[inm.vacuna]) unmappedByVacuna[inm.vacuna] = []
    unmappedByVacuna[inm.vacuna].push(inm)
  })
  const unmappedVacunas = Object.keys(unmappedByVacuna)

  const renderSubTable = (rows) => {
    const maxDosis = Math.max(...rows.map((e) => e.dosis.length))
    return (
      <table className="text-xs w-full">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-700/60">
            <th className="text-left pl-3 pr-2 py-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Vacuna</th>
            {Array.from({ length: maxDosis }, (_, i) => {
              const lbl = rows.map((e) => e.dosis[i]).find(Boolean) ?? `${i + 1}a`
              return (
                <th key={i} className="py-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase text-center" style={{ width: 48 }}>
                  {lbl}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
          {rows.map((row) => {
            const applied = countApplied(row)
            const total = row.dosis.length
            const allDone = applied === total && total > 0
            return (
              <tr key={row.vacuna} className={clsx('transition-colors', allDone ? 'bg-green-50/40 dark:bg-green-900/10' : 'hover:bg-slate-50/70 dark:hover:bg-slate-700/30')}>
                <td className="pl-3 pr-2 py-1.5">
                  <div className="flex items-center gap-1">
                    <span className={clsx('font-medium whitespace-nowrap', allDone ? 'text-green-700 dark:text-green-400' : 'text-slate-700 dark:text-slate-200')}>
                      {row.vacuna}
                    </span>
                    {allDone && (
                      <span className="inline-flex items-center gap-0.5 px-1 py-px rounded-full text-[9px] font-semibold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 leading-none shrink-0">
                        <Check className="w-2 h-2" strokeWidth={3} /> ok
                      </span>
                    )}
                    {!allDone && applied > 0 && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums shrink-0">{applied}/{total}</span>
                    )}
                  </div>
                </td>
                {row.dosis.map((dosis, di) => {
                  const checked = isApplied(row.vacuna, dosis)
                  return (
                    <td key={di} className="py-1.5 text-center" style={{ width: 48 }}>
                      <label className={clsx('inline-flex flex-col items-center gap-px', disabled ? 'cursor-default' : 'cursor-pointer')}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleDose(row.vacuna, dosis)}
                          disabled={disabled}
                          className={clsx(
                            'w-4 h-4 rounded border-2 transition-colors',
                            checked ? 'accent-green-500 border-green-400' : 'border-slate-300 dark:border-slate-500',
                            disabled ? 'cursor-default' : 'cursor-pointer'
                          )}
                        />
                        <span className="text-[9px] text-slate-400 dark:text-slate-500 leading-none">{dosis}</span>
                      </label>
                    </td>
                  )
                })}
                {Array.from({ length: maxDosis - row.dosis.length }, (_, i) => (
                  <td key={`empty-${i}`} style={{ width: 48 }} />
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    )
  }

  const renderTable = (esquema, label, colorClass, twoCol = false) => {
    const mid = Math.ceil(esquema.length / 2)
    const colA = twoCol ? esquema.slice(0, mid) : esquema
    const colB = twoCol ? esquema.slice(mid) : null
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className={clsx('px-4 py-2 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2', colorClass.bg)}>
          <Syringe className={clsx('w-3.5 h-3.5', colorClass.text)} />
          <h4 className={clsx('text-xs font-semibold uppercase tracking-wide', colorClass.text)}>{label}</h4>
        </div>
        {twoCol ? (
          <div className="grid grid-cols-1 md:grid-cols-2 md:divide-x divide-slate-100 dark:divide-slate-700 overflow-x-auto">
            <div className="md:border-b-0 border-b border-slate-100 dark:border-slate-700">{renderSubTable(colA)}</div>
            <div>{renderSubTable(colB)}</div>
          </div>
        ) : (
          <div className="overflow-x-auto">{renderSubTable(colA)}</div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {renderTable(ESQUEMA_VIGENTE, 'Esquema Vigente', {
        bg: 'bg-emerald-50 dark:bg-emerald-900/20',
        text: 'text-emerald-700 dark:text-emerald-400',
      }, true)}

      {renderTable(ESQUEMA_ANTERIOR, 'Esquema Anterior', {
        bg: 'bg-amber-50 dark:bg-amber-900/20',
        text: 'text-amber-700 dark:text-amber-400',
      }, true)}

      {/* Unmapped vaccines from DB */}
      {unmappedVacunas.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2 bg-slate-100 dark:bg-slate-700/60">
            <Syringe className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Otras vacunas registradas</h4>
          </div>
          <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-1.5">
            {unmappedVacunas.map((vacuna) => (
              <div key={vacuna} className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <div className="w-4 h-4 rounded flex items-center justify-center bg-blue-500 flex-shrink-0">
                  <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                </div>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-200 flex-1 truncate">{vacuna}</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">{unmappedByVacuna[vacuna].length}d</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   Tab: Antecedentes Heredo Familiares
   ═══════════════════════════════════════════════════════ */
const TabHeredoFamiliares = forwardRef(function TabHeredoFamiliares({ pacienteId, editMode }, ref) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({})
  const [existingId, setExistingId] = useState(null)

  const allKeys = HF_GROUPS.flatMap((g) => g.members.map((m) => m.key))

  const { data, isLoading } = useQuery({
    queryKey: ['antecedentes_hf', pacienteId],
    queryFn: () => api.get(`/antecedentes-heredo-familiares/paciente/${pacienteId}`).then((r) => r.data),
  })

  const buildForm = (src) => {
    const f = {}
    allKeys.forEach((key) => { f[key] = src?.[key] || '' })
    return f
  }

  useEffect(() => {
    if (data) {
      setForm(buildForm(data))
      setExistingId(data.id)
    } else {
      setForm(buildForm(null))
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
    },
    onError: (e) => toast.error(apiError(e, 'Error al guardar antecedentes heredo familiares')),
  })

  useImperativeHandle(ref, () => ({
    save: async () => {
      if (!existingId) {
        const hasContent = Object.values(form).some((v) => v !== '')
        if (!hasContent) return
      }
      await saveMutation.mutateAsync(form)
    },
    cancel: () => {
      setForm(buildForm(data))
    },
  }), [form, data, existingId])

  const disabled = !editMode
  const updateField = (f, v) => setForm((prev) => ({ ...prev, [f]: v }))

  if (isLoading) return <div className="text-center py-8 text-slate-400 dark:text-slate-500">Cargando...</div>

  return (
    <div className="space-y-4">
      {HF_GROUPS.map((group) => (
        <div key={group.label} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className={clsx('px-5 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2', group.bg)}>
            <Users className={clsx('w-4 h-4', group.color)} />
            <h4 className={clsx('text-sm font-semibold', group.color)}>{group.label}</h4>
          </div>
          <div className="p-5">
            <div className={clsx('grid gap-4', group.members.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2')}>
              {group.members.map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1.5 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" /> {label}
                  </label>
                  {disabled ? (
                    form[key] ? (
                      <div className="text-sm text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-700 rounded-xl p-3 border border-slate-100 dark:border-slate-600 min-h-[2.5rem]">
                        {form[key]}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-400 dark:text-slate-500 italic bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 border border-slate-100 dark:border-slate-700">
                        Sin antecedentes registrados
                      </div>
                    )
                  ) : (
                    <textarea
                      value={form[key] || ''}
                      onChange={(e) => updateField(key, e.target.value)}
                      rows={key === 'hermanos' ? 3 : 2}
                      className={clsx(inputClass, 'resize-none')}
                      placeholder={`Patologías de ${label.toLowerCase()}...`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
})

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


function FormTextarea({ icon: Icon, iconColor, label, value, onChange, placeholder, disabled }) {
  return (
    <div>
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
        <Icon className={`w-4 h-4 ${iconColor}`} /> {label}
      </label>
      {disabled ? (
        value ? (
          <div className="text-sm text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-700 rounded-xl p-3 border border-slate-100 dark:border-slate-600 min-h-[2.5rem]">
            {value}
          </div>
        ) : (
          <div className="text-sm text-slate-400 dark:text-slate-500 italic bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 border border-slate-100 dark:border-slate-700">
            Sin datos registrados
          </div>
        )
      ) : (
        <textarea value={value || ''} onChange={(e) => onChange(e.target.value)}
          rows={2} className={clsx(inputClass, 'resize-none')} placeholder={placeholder} />
      )}
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
