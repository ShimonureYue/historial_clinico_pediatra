import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Save, Baby, Syringe, Plus, Trash2, HeartPulse, MapPin, Utensils, Activity
} from 'lucide-react'
import api from '../lib/api'
import useModulePermission from '../hooks/useModulePermission'
import PatientSearchSelect from '../components/PatientSearchSelect'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const EMPTY_FORM = {
  producto_gesta: '', tipo_nacimiento: '', peso_nacer_kg: '', talla_nacer_cm: '',
  seno_materno: false, inicio_formula_meses: '', tipo_sangre: '', apgar: '',
  ablactacion: '', alimentacion: '', zoonosis: '',
  lugar_nacimiento: '', lugar_residencia: '',
  respiro_al_nacer: null, lloro_al_nacer: null, desarrollo_psicomotor: '',
  sonrisa_social: '', levantamiento_cabeza: '', sento_solo: '', paro_ayuda: '',
  gateo: '', camino: '', inicio_lenguaje: '', control_esfinteres: '',
  inicio_jardin_ninos: '', primaria: '',
}

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const BIRTH_TYPES = ['Eutócico', 'Cesárea', 'Instrumental', 'Otro']

const inputClass = "w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:bg-slate-700 dark:text-slate-100"

function MiniField({ label, value, onChange, type = 'text', step, disabled, rows, placeholder }) {
  return (
    <div>
      <label className="block text-[12px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-0.5">{label}</label>
      {rows ? (
        <textarea value={value ?? ''} rows={rows}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled} placeholder={placeholder}
          className={clsx(inputClass, 'py-1 resize-none', disabled && 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400')} />
      ) : (
        <input type={type} step={step} value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled} placeholder={placeholder}
          className={clsx(inputClass, 'py-1', disabled && 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400')} />
      )}
    </div>
  )
}

function MiniSelect({ label, value, onChange, options, disabled }) {
  return (
    <div>
      <label className="block text-[12px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-0.5">{label}</label>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={clsx(inputClass, 'py-1', disabled && 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400')}>
        <option value="">—</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

function MiniCheckbox({ label, checked, onChange, disabled }) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200 cursor-pointer">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)}
        className="rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary w-3.5 h-3.5" disabled={disabled} />
      {label}
    </label>
  )
}

export default function AntecedentesNoPatologicosPage() {
  const { canWrite, canUpdate } = useModulePermission('antecedentes_pnp')
  const queryClient = useQueryClient()
  const [selectedPaciente, setSelectedPaciente] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [inmunizaciones, setInmunizaciones] = useState([])
  const [existingId, setExistingId] = useState(null)

  const { data: antData, isError } = useQuery({
    queryKey: ['antecedentes_pnp', selectedPaciente],
    queryFn: () => api.get(`/antecedentes-no-patologicos/paciente/${selectedPaciente}`).then((r) => r.data),
    enabled: !!selectedPaciente,
  })

  useEffect(() => {
    if (isError || !selectedPaciente) {
      setForm(EMPTY_FORM)
      setInmunizaciones([])
      setExistingId(null)
      return
    }
    if (antData) {
      setForm({
        producto_gesta: antData.producto_gesta || '',
        tipo_nacimiento: antData.tipo_nacimiento || '',
        peso_nacer_kg: antData.peso_nacer_kg ?? '',
        talla_nacer_cm: antData.talla_nacer_cm ?? '',
        seno_materno: !!antData.seno_materno,
        inicio_formula_meses: antData.inicio_formula_meses ?? '',
        tipo_sangre: antData.tipo_sangre || '',
        apgar: antData.apgar || '',
        ablactacion: antData.ablactacion || '',
        alimentacion: antData.alimentacion || '',
        zoonosis: antData.zoonosis || '',
        lugar_nacimiento: antData.lugar_nacimiento || '',
        lugar_residencia: antData.lugar_residencia || '',
        respiro_al_nacer: antData.respiro_al_nacer,
        lloro_al_nacer: antData.lloro_al_nacer,
        desarrollo_psicomotor: antData.desarrollo_psicomotor || '',
        sonrisa_social: antData.sonrisa_social || '',
        levantamiento_cabeza: antData.levantamiento_cabeza || '',
        sento_solo: antData.sento_solo || '',
        paro_ayuda: antData.paro_ayuda || '',
        gateo: antData.gateo || '',
        camino: antData.camino || '',
        inicio_lenguaje: antData.inicio_lenguaje || '',
        control_esfinteres: antData.control_esfinteres || '',
        inicio_jardin_ninos: antData.inicio_jardin_ninos || '',
        primaria: antData.primaria || '',
      })
      setInmunizaciones(antData.inmunizaciones || [])
      setExistingId(antData.id)
    } else if (antData === null || antData === undefined) {
      setForm(EMPTY_FORM)
      setInmunizaciones([])
      setExistingId(null)
    }
  }, [antData, isError, selectedPaciente])

  const saveMutation = useMutation({
    mutationFn: (data) => {
      const n = (v) => (v === '' || v == null) ? null : Number(v)
      const cleaned = {
        ...data,
        peso_nacer_kg: n(data.peso_nacer_kg),
        talla_nacer_cm: n(data.talla_nacer_cm),
        inicio_formula_meses: n(data.inicio_formula_meses),
        respiro_al_nacer: data.respiro_al_nacer == null ? null : Number(data.respiro_al_nacer),
        lloro_al_nacer: data.lloro_al_nacer == null ? null : Number(data.lloro_al_nacer),
      }
      return existingId
        ? api.put(`/antecedentes-no-patologicos/${existingId}`, { ...cleaned, inmunizaciones })
        : api.post('/antecedentes-no-patologicos', { ...cleaned, paciente_id: selectedPaciente, inmunizaciones })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['antecedentes_pnp', selectedPaciente] })
      toast.success('Antecedentes no patológicos guardados')
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error al guardar'),
  })

  const handleSubmit = (e) => { e.preventDefault(); saveMutation.mutate(form) }
  const updateField = (f, v) => setForm((prev) => ({ ...prev, [f]: v }))
  const canEdit = existingId ? canUpdate : canWrite

  const addInmunizacion = () => {
    setInmunizaciones([...inmunizaciones, { vacuna: '', dosis: '', fecha_aplicacion: '', lote: '', observaciones: '' }])
  }
  const updateInm = (idx, field, value) => {
    setInmunizaciones((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }
  const removeInm = (idx) => {
    setInmunizaciones((prev) => prev.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Antecedentes No Patológicos</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">Datos perinatales, inmunizaciones y hábitos</p>
      </div>

      {/* Patient selector */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-4">
        <PatientSearchSelect value={selectedPaciente} onChange={setSelectedPaciente} />
      </div>

      {selectedPaciente && (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">

            {/* ── LEFT COLUMN ── */}
            <div className="space-y-3">
              {/* Datos Perinatales */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Baby className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200">Datos perinatales</h3>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  <MiniField label="Prod. gesta" value={form.producto_gesta} onChange={(v) => updateField('producto_gesta', v)} disabled={!canEdit} />
                  <MiniSelect label="Tipo nac." value={form.tipo_nacimiento} onChange={(v) => updateField('tipo_nacimiento', v)} options={BIRTH_TYPES} disabled={!canEdit} />
                  <MiniSelect label="Tipo sangre" value={form.tipo_sangre} onChange={(v) => updateField('tipo_sangre', v)} options={BLOOD_TYPES} disabled={!canEdit} />
                  <MiniField label="Peso (kg)" type="number" step="0.01" value={form.peso_nacer_kg} onChange={(v) => updateField('peso_nacer_kg', v)} disabled={!canEdit} />
                  <MiniField label="Talla (cm)" type="number" step="0.1" value={form.talla_nacer_cm} onChange={(v) => updateField('talla_nacer_cm', v)} disabled={!canEdit} />
                  <MiniField label="Apgar" value={form.apgar} onChange={(v) => updateField('apgar', v)} disabled={!canEdit} placeholder="8/9" />
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                  <MiniCheckbox label="Seno materno" checked={form.seno_materno} onChange={(v) => updateField('seno_materno', v)} disabled={!canEdit} />
                  <MiniCheckbox label="Respiró al nacer" checked={form.respiro_al_nacer === 1} onChange={(v) => updateField('respiro_al_nacer', v ? 1 : 0)} disabled={!canEdit} />
                  <MiniCheckbox label="Lloró al nacer" checked={form.lloro_al_nacer === 1} onChange={(v) => updateField('lloro_al_nacer', v ? 1 : 0)} disabled={!canEdit} />
                </div>
              </div>

              {/* Alimentación y Hábitos */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Utensils className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200">Alimentación y hábitos</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  <MiniField label="Inicio fórmula (meses)" type="number" value={form.inicio_formula_meses} onChange={(v) => updateField('inicio_formula_meses', v)} disabled={!canEdit} />
                  <MiniField label="Ablactación" value={form.ablactacion} onChange={(v) => updateField('ablactacion', v)} disabled={!canEdit} />
                  <MiniField label="Alimentación" value={form.alimentacion} onChange={(v) => updateField('alimentacion', v)} disabled={!canEdit} />
                  <MiniField label="Zoonosis" value={form.zoonosis} onChange={(v) => updateField('zoonosis', v)} disabled={!canEdit} />
                  <MiniField label="Lugar nacimiento" value={form.lugar_nacimiento} onChange={(v) => updateField('lugar_nacimiento', v)} disabled={!canEdit} />
                  <MiniField label="Lugar residencia" value={form.lugar_residencia} onChange={(v) => updateField('lugar_residencia', v)} disabled={!canEdit} />
                </div>
                <div className="mt-1.5">
                  <MiniField label="Notas adicionales" value={form.desarrollo_psicomotor} onChange={(v) => updateField('desarrollo_psicomotor', v)} disabled={!canEdit} rows={2} />
                </div>
              </div>

              {/* Desarrollo Psicomotor */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200">Desarrollo psicomotor</h3>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 ml-1">— edad en meses</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  {[
                    { key: 'sonrisa_social',       label: 'Sonrisa social' },
                    { key: 'levantamiento_cabeza',  label: 'Levanta cabeza' },
                    { key: 'sento_solo',            label: 'Sentó solo' },
                    { key: 'paro_ayuda',            label: 'Paró con ayuda' },
                    { key: 'gateo',                 label: 'Gateo' },
                    { key: 'camino',                label: 'Caminó' },
                    { key: 'inicio_lenguaje',       label: 'Inicio lenguaje' },
                    { key: 'control_esfinteres',    label: 'Control esfínteres' },
                    { key: 'inicio_jardin_ninos',   label: 'Jardín de niños' },
                    { key: 'primaria',              label: 'Primaria' },
                  ].map(({ key, label }) => (
                    <MiniField key={key} label={label} value={form[key]}
                      onChange={(v) => updateField(key, v)}
                      disabled={!canEdit} placeholder="meses" />
                  ))}
                </div>
              </div>
            </div>

            {/* ── RIGHT COLUMN ── */}
            <div className="space-y-3">
              {/* Inmunizaciones */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Syringe className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                    <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200">Inmunizaciones</h3>
                    <span className="text-[12px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-full">{inmunizaciones.length}</span>
                  </div>
                  {canEdit && (
                    <button type="button" onClick={addInmunizacion}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 rounded-md hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors">
                      <Plus className="w-3 h-3" /> Agregar
                    </button>
                  )}
                </div>

                {inmunizaciones.length === 0 ? (
                  <div className="text-center py-6">
                    <Syringe className="w-8 h-8 mx-auto text-slate-200 dark:text-slate-600 mb-1" />
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">Sin inmunizaciones registradas</p>
                    {canEdit && (
                      <button type="button" onClick={addInmunizacion}
                        className="mt-1 text-[11px] text-primary hover:underline">
                        + Agregar primera inmunización
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {inmunizaciones.map((inm, idx) => (
                      <div key={idx} className="bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-100 dark:border-slate-700 px-2 py-1.5">
                        <div className="grid grid-cols-[1.2fr_0.8fr_1fr_1.2fr_auto] gap-1 items-center">
                          <select value={inm.vacuna} onChange={(e) => updateInm(idx, 'vacuna', e.target.value)}
                            className={clsx(inputClass, 'text-[11px] py-1', !canEdit && 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500')}
                            disabled={!canEdit}>
                            <option value="">Vacuna...</option>
                            {['BCG', 'Pentavalente', 'Sabin', 'Triple Viral', 'DPT', 'Hepatitis B', 'Otra'].map((v) => (
                              <option key={v} value={v}>{v}</option>
                            ))}
                          </select>
                          <select value={inm.dosis} onChange={(e) => updateInm(idx, 'dosis', e.target.value)}
                            className={clsx(inputClass, 'text-[11px] py-1', !canEdit && 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500')}
                            disabled={!canEdit}>
                            <option value="">Dosis...</option>
                            {['Única', '1a', '2a', '3a', 'Refuerzo'].map((d) => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                          <input type="date" value={inm.fecha_aplicacion || ''} onChange={(e) => updateInm(idx, 'fecha_aplicacion', e.target.value)}
                            className={clsx(inputClass, 'text-[11px] py-1', !canEdit && 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500')}
                            disabled={!canEdit} />
                          <input value={inm.observaciones || ''} onChange={(e) => updateInm(idx, 'observaciones', e.target.value)}
                            className={clsx(inputClass, 'text-[11px] py-1', !canEdit && 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500')}
                            disabled={!canEdit} placeholder="Observaciones" />
                          {canEdit ? (
                            <button type="button" onClick={() => removeInm(idx)}
                              className="p-0.5 rounded text-slate-300 dark:text-slate-500 hover:text-red-500 transition-colors">
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

          {canEdit && (
            <div className="flex justify-end">
              <button type="submit" disabled={saveMutation.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg shadow-lg shadow-primary/30 hover:bg-primary-dark disabled:opacity-50 transition-all">
                <Save className="w-3.5 h-3.5" />
                {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  )
}
