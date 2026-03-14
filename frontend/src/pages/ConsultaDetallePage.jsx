import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Save, Stethoscope, Weight, Ruler, Thermometer,
  Wind, HeartPulse, Activity, Plus, Trash2, Pill, Calendar, User,
  ClipboardPlus, FileText, Accessibility
} from 'lucide-react'
import api from '../lib/api'
import useModulePermission from '../hooks/useModulePermission'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const inputClass = "w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600"

const EMPTY_MED = {
  nombre_medicamento: '', presentacion: '', dosificacion: '',
  duracion: '', via_administracion: '', cantidad_surtir: '',
}

function MiniField({ label, value, onChange, type = 'text', step, disabled, rows }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-0.5">{label}</label>
      {rows ? (
        <textarea value={value ?? ''} rows={rows}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={clsx(inputClass, 'py-1 resize-none', disabled && 'bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400')} />
      ) : (
        <input type={type} step={step} value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={clsx(inputClass, 'py-1', disabled && 'bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400')} />
      )}
    </div>
  )
}

export default function ConsultaDetallePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { canUpdate } = useModulePermission('consultas')

  const [form, setForm] = useState({
    fecha_consulta: '', padecimiento_actual: '',
    impresion_diagnostica: '', plan_tratamiento: '', notas_adicionales: '',
    peso_kg: '', talla_cm: '', fc_bpm: '', fr_rpm: '', temperatura_c: '',
    ta_sistolica: '', ta_diastolica: '',
    cabeza: '', cuello: '', torax: '', abdomen: '',
    miembros_toracicos: '', miembros_pelvicos: '', otros: '',
  })
  const [tratamientos, setTratamientos] = useState([])
  const [editing, setEditing] = useState(false)

  const { data: consulta, isLoading } = useQuery({
    queryKey: ['consulta', id],
    queryFn: () => api.get(`/consultas/${id}`).then((r) => r.data),
  })

  useEffect(() => {
    if (consulta) {
      setForm({
        fecha_consulta: consulta.fecha_consulta || '',
        padecimiento_actual: consulta.padecimiento_actual || '',
        impresion_diagnostica: consulta.impresion_diagnostica || '',
        plan_tratamiento: consulta.plan_tratamiento || '',
        notas_adicionales: consulta.notas_adicionales || '',
        peso_kg: consulta.mediciones?.peso_kg ?? '',
        talla_cm: consulta.mediciones?.talla_cm ?? '',
        fc_bpm: consulta.mediciones?.fc_bpm ?? '',
        fr_rpm: consulta.mediciones?.fr_rpm ?? '',
        temperatura_c: consulta.mediciones?.temperatura_c ?? '',
        ta_sistolica: consulta.mediciones?.ta_sistolica ?? '',
        ta_diastolica: consulta.mediciones?.ta_diastolica ?? '',
        cabeza: consulta.mediciones?.cabeza ?? '',
        cuello: consulta.mediciones?.cuello ?? '',
        torax: consulta.mediciones?.torax ?? '',
        abdomen: consulta.mediciones?.abdomen ?? '',
        miembros_toracicos: consulta.mediciones?.miembros_toracicos ?? '',
        miembros_pelvicos: consulta.mediciones?.miembros_pelvicos ?? '',
        otros: consulta.mediciones?.otros ?? '',
      })
      setTratamientos(consulta.tratamientos?.map((t) => ({ ...t })) || [])
      // Auto-enable editing if consulta was just created (no mediciones yet)
      if (!consulta.mediciones?.peso_kg && !consulta.mediciones?.cabeza && !consulta.impresion_diagnostica) {
        setEditing(true)
      }
    }
  }, [consulta])

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const numOrNull = (v) => (v === '' || v == null) ? null : Number(v)
      const strOrNull = (v) => (v === '' || v == null) ? null : v
      const cleaned = {
        paciente_id: consulta.paciente_id,
        fecha_consulta: data.fecha_consulta,
        padecimiento_actual: data.padecimiento_actual,
        impresion_diagnostica: strOrNull(data.impresion_diagnostica),
        plan_tratamiento: strOrNull(data.plan_tratamiento),
        notas_adicionales: strOrNull(data.notas_adicionales),
        peso_kg: numOrNull(data.peso_kg),
        talla_cm: numOrNull(data.talla_cm),
        fc_bpm: numOrNull(data.fc_bpm),
        fr_rpm: numOrNull(data.fr_rpm),
        temperatura_c: numOrNull(data.temperatura_c),
        ta_sistolica: numOrNull(data.ta_sistolica),
        ta_diastolica: numOrNull(data.ta_diastolica),
        cabeza: strOrNull(data.cabeza),
        cuello: strOrNull(data.cuello),
        torax: strOrNull(data.torax),
        abdomen: strOrNull(data.abdomen),
        miembros_toracicos: strOrNull(data.miembros_toracicos),
        miembros_pelvicos: strOrNull(data.miembros_pelvicos),
        otros: strOrNull(data.otros),
      }
      await api.put(`/consultas/${id}`, cleaned)
      const tratData = tratamientos
        .filter((t) => t.nombre_medicamento.trim())
        .map((t) => ({
          consulta_id: parseInt(id),
          nombre_medicamento: t.nombre_medicamento,
          presentacion: t.presentacion || null,
          dosificacion: t.dosificacion || null,
          duracion: t.duracion || null,
          via_administracion: t.via_administracion || null,
          cantidad_surtir: t.cantidad_surtir || null,
        }))
      await api.put(`/tratamientos/bulk/${id}`, tratData)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consulta', id] })
      queryClient.invalidateQueries({ queryKey: ['consultas'] })
      toast.success('Consulta actualizada')
      setEditing(false)
    },
    onError: (e) => {
      const detail = e.response?.data?.detail
      const msg = typeof detail === 'string' ? detail : 'Error al guardar'
      toast.error(msg)
    },
  })

  const handleSubmit = (e) => { e.preventDefault(); saveMutation.mutate(form) }
  const updateField = (f, v) => setForm((prev) => ({ ...prev, [f]: v }))

  const addMed = () => setTratamientos((prev) => [...prev, { ...EMPTY_MED }])
  const removeMed = (idx) => setTratamientos((prev) => prev.filter((_, i) => i !== idx))
  const updateMed = (idx, field, value) => {
    setTratamientos((prev) => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!consulta) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500 dark:text-slate-400">Consulta no encontrada</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-primary hover:underline">Volver</button>
      </div>
    )
  }

  const disabled = !editing

  // Calculate age from fecha_nacimiento relative to consulta date
  const calcAge = () => {
    if (!consulta.paciente_fecha_nacimiento) return null
    const ref = consulta.fecha_consulta ? new Date(consulta.fecha_consulta + 'T00:00:00') : new Date()
    const birth = new Date(consulta.paciente_fecha_nacimiento + 'T00:00:00')
    let years = ref.getFullYear() - birth.getFullYear()
    let months = ref.getMonth() - birth.getMonth()
    let days = ref.getDate() - birth.getDate()
    if (days < 0) { months--; days += new Date(ref.getFullYear(), ref.getMonth(), 0).getDate() }
    if (months < 0) { years--; months += 12 }
    return { years, months, days }
  }
  const age = calcAge()

  const cancelEditing = () => {
    if (consulta) {
      setForm({
        fecha_consulta: consulta.fecha_consulta || '',
        padecimiento_actual: consulta.padecimiento_actual || '',
        impresion_diagnostica: consulta.impresion_diagnostica || '',
        plan_tratamiento: consulta.plan_tratamiento || '',
        notas_adicionales: consulta.notas_adicionales || '',
        peso_kg: consulta.mediciones?.peso_kg ?? '',
        talla_cm: consulta.mediciones?.talla_cm ?? '',
        fc_bpm: consulta.mediciones?.fc_bpm ?? '',
        fr_rpm: consulta.mediciones?.fr_rpm ?? '',
        temperatura_c: consulta.mediciones?.temperatura_c ?? '',
        ta_sistolica: consulta.mediciones?.ta_sistolica ?? '',
        ta_diastolica: consulta.mediciones?.ta_diastolica ?? '',
        cabeza: consulta.mediciones?.cabeza ?? '',
        cuello: consulta.mediciones?.cuello ?? '',
        torax: consulta.mediciones?.torax ?? '',
        abdomen: consulta.mediciones?.abdomen ?? '',
        miembros_toracicos: consulta.mediciones?.miembros_toracicos ?? '',
        miembros_pelvicos: consulta.mediciones?.miembros_pelvicos ?? '',
        otros: consulta.mediciones?.otros ?? '',
      })
      setTratamientos(consulta.tratamientos?.map((t) => ({ ...t })) || [])
    }
    setEditing(false)
  }

  const initials = consulta.paciente_nombre
    ? consulta.paciente_nombre.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : '?'

  return (
    <div className="space-y-2">
      {/* Header bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => navigate(`/pacientes/${consulta.paciente_id}`)}
          className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors shrink-0"
          title="Volver al paciente">
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>

        <button onClick={() => navigate(`/pacientes/${consulta.paciente_id}`)}
          className="flex items-center gap-1.5 hover:text-primary transition-colors">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-[10px] font-bold shrink-0">
            {initials}
          </span>
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{consulta.paciente_nombre}</span>
        </button>

        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold">
          #{id}
        </span>

        {age && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[11px] font-medium">
            {age.years}a {age.months}m {age.days}d &middot; {consulta.paciente_sexo === 'M' ? 'Masculino' : consulta.paciente_sexo === 'F' ? 'Femenino' : consulta.paciente_sexo}
          </span>
        )}

        {consulta.paciente_fecha_nacimiento && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-[11px]">
            Nac. {consulta.paciente_fecha_nacimiento}
          </span>
        )}

        <div className="flex-1" />

        <span className="text-[11px] text-slate-400 dark:text-slate-500">{consulta.fecha_consulta}</span>

        {editing && (
          <>
            <button type="button" onClick={cancelEditing}
              className="px-3 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
              Cancelar
            </button>
            <button type="submit" form="consulta-form" disabled={saveMutation.isPending}
              className="inline-flex items-center gap-1 px-4 py-1 bg-primary text-white text-[11px] font-semibold rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-all">
              {saveMutation.isPending ? 'Guardando...' : 'Guardar consulta'}
            </button>
          </>
        )}
        {canUpdate && !editing && (
          <button onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 px-3 py-1 bg-primary text-white text-[11px] font-medium rounded-lg hover:bg-primary-dark transition-all">
            Editar
          </button>
        )}
      </div>

      {/* Two-column layout */}
      <form id="consulta-form" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">

          {/* ── LEFT COLUMN ── */}
          <div className="space-y-3">
            {/* Datos de la Consulta */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <ClipboardPlus className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200">Datos de la consulta</h3>
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 items-start">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-0.5">Fecha</label>
                  <input type="date" value={form.fecha_consulta}
                    onChange={(e) => updateField('fecha_consulta', e.target.value)}
                    className={clsx(inputClass, disabled && 'bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400')} disabled={disabled} required />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-0.5">Motivo / Padecimiento actual</label>
                  <textarea value={form.padecimiento_actual}
                    onChange={(e) => updateField('padecimiento_actual', e.target.value)}
                    rows={4} className={clsx(`${inputClass} resize-none`, disabled && 'bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400')}
                    disabled={disabled} placeholder="Padecimiento actual..." />
                </div>
              </div>
            </div>

            {/* Signos Vitales */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <HeartPulse className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200">Signos vitales</h3>
              </div>
              <div className="grid grid-cols-4 lg:grid-cols-7 gap-1.5">
                <MiniField label="Peso (kg)" type="number" step="0.1" value={form.peso_kg} onChange={(v) => updateField('peso_kg', v)} disabled={disabled} />
                <MiniField label="Talla (cm)" type="number" step="0.1" value={form.talla_cm} onChange={(v) => updateField('talla_cm', v)} disabled={disabled} />
                <MiniField label="FC (x min)" type="number" value={form.fc_bpm} onChange={(v) => updateField('fc_bpm', v)} disabled={disabled} />
                <MiniField label="FR (x min)" type="number" value={form.fr_rpm} onChange={(v) => updateField('fr_rpm', v)} disabled={disabled} />
                <MiniField label="Temp (°C)" type="number" step="0.1" value={form.temperatura_c} onChange={(v) => updateField('temperatura_c', v)} disabled={disabled} />
                <MiniField label="TA Sist." type="number" value={form.ta_sistolica} onChange={(v) => updateField('ta_sistolica', v)} disabled={disabled} />
                <MiniField label="TA Diast." type="number" value={form.ta_diastolica} onChange={(v) => updateField('ta_diastolica', v)} disabled={disabled} />
              </div>
            </div>

            {/* Exploración por Regiones */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <Accessibility className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200">Exploración física por regiones</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { key: 'cabeza', label: 'Cabeza' }, { key: 'cuello', label: 'Cuello' },
                  { key: 'torax', label: 'Tórax' }, { key: 'abdomen', label: 'Abdomen' },
                  { key: 'miembros_toracicos', label: 'M. Torácicos' },
                  { key: 'miembros_pelvicos', label: 'M. Pélvicos' },
                  { key: 'otros', label: 'Otros' },
                ].map(({ key, label }) => (
                  <MiniField key={key} label={label} value={form[key]} rows={2}
                    onChange={(v) => updateField(key, v)} disabled={disabled} />
                ))}
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="space-y-3 lg:sticky">
            {/* Diagnóstico y Plan */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200">Diagnóstico y plan</h3>
              </div>
              <div className="space-y-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-0.5">Impresión diagnóstica</label>
                  <textarea value={form.impresion_diagnostica}
                    onChange={(e) => updateField('impresion_diagnostica', e.target.value)}
                    rows={2} className={clsx(`${inputClass} resize-none`, disabled && 'bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400')}
                    disabled={disabled} placeholder="CIE-10 o descripción clínica..." />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-0.5">Plan de tratamiento</label>
                  <textarea value={form.plan_tratamiento}
                    onChange={(e) => updateField('plan_tratamiento', e.target.value)}
                    rows={5} className={clsx(`${inputClass} resize-none`, disabled && 'bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400')}
                    disabled={disabled} placeholder="Indicaciones, estudios, referidos..." />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-0.5">Notas adicionales</label>
                  <textarea value={form.notas_adicionales}
                    onChange={(e) => updateField('notas_adicionales', e.target.value)}
                    rows={2} className={clsx(`${inputClass} resize-none`, disabled && 'bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400')}
                    disabled={disabled} placeholder="Observaciones, seguimiento..." />
                </div>
              </div>
            </div>

            {/* Medicamentos */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Pill className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200">Medicamentos</h3>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-full">{tratamientos.length}</span>
                </div>
                {editing && (
                  <button type="button" onClick={addMed}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 rounded-md hover:bg-green-100 transition-colors">
                    <Plus className="w-3 h-3" /> Agregar
                  </button>
                )}
              </div>

              {tratamientos.length === 0 ? (
                <div className="text-center py-6">
                  <Pill className="w-8 h-8 mx-auto text-slate-200 dark:text-slate-600 mb-1" />
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">Sin medicamentos registrados</p>
                  {editing && (
                    <button type="button" onClick={addMed}
                      className="mt-1 text-[11px] text-primary hover:underline">
                      + Agregar primer medicamento
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  {tratamientos.map((t, idx) => (
                    <div key={idx} className="bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-100 dark:border-slate-700 px-2 py-1.5">
                      <div className="grid grid-cols-[1.4fr_1fr_1fr_0.7fr_0.7fr_0.7fr_auto] gap-1 items-center">
                        <input value={t.nombre_medicamento}
                          onChange={(e) => updateMed(idx, 'nombre_medicamento', e.target.value)}
                          className={clsx(inputClass, 'text-[11px] py-1', disabled && 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500')}
                          disabled={disabled} placeholder="Medicamento" required />
                        <input value={t.presentacion || ''}
                          onChange={(e) => updateMed(idx, 'presentacion', e.target.value)}
                          className={clsx(inputClass, 'text-[11px] py-1', disabled && 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500')}
                          disabled={disabled} placeholder="Tabletas 500mg" />
                        <input value={t.dosificacion || ''}
                          onChange={(e) => updateMed(idx, 'dosificacion', e.target.value)}
                          className={clsx(inputClass, 'text-[11px] py-1', disabled && 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500')}
                          disabled={disabled} placeholder="1 c/8 hrs" />
                        <input value={t.duracion || ''}
                          onChange={(e) => updateMed(idx, 'duracion', e.target.value)}
                          className={clsx(inputClass, 'text-[11px] py-1', disabled && 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500')}
                          disabled={disabled} placeholder="7 días" />
                        <input value={t.via_administracion || ''}
                          onChange={(e) => updateMed(idx, 'via_administracion', e.target.value)}
                          className={clsx(inputClass, 'text-[11px] py-1', disabled && 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500')}
                          disabled={disabled} placeholder="Oral" />
                        <input value={t.cantidad_surtir || ''}
                          onChange={(e) => updateMed(idx, 'cantidad_surtir', e.target.value)}
                          className={clsx(inputClass, 'text-[11px] py-1', disabled && 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500')}
                          disabled={disabled} placeholder="21 tab" />
                        {editing ? (
                          <button type="button" onClick={() => removeMed(idx)}
                            className="p-0.5 rounded text-slate-300 dark:text-slate-500 hover:text-red-500 transition-colors"
                            title="Eliminar">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        ) : <div className="w-4" />}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </form>
    </div>
  )
}
