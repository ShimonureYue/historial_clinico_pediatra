import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Save, Stethoscope, Weight, Ruler, Thermometer,
  Wind, HeartPulse, Activity, Plus, Trash2, Pill, Calendar, User,
  ClipboardPlus, FileText, Accessibility, Printer, NotebookPen,
  Bold, Italic, List, ListOrdered, AlertTriangle, History, X,
  ClipboardList, Users2,
} from 'lucide-react'
import { jsPDF } from 'jspdf'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import api from '../lib/api'
import useModulePermission from '../hooks/useModulePermission'
import toast from 'react-hot-toast'
import clsx from 'clsx'

/* ─── Rich Text Editor ─── */
function RichTextEditor({ value, onChange, disabled }) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value || '',
    editable: !disabled,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  // Sync editable state when disabled changes
  useEffect(() => {
    if (editor) editor.setEditable(!disabled)
  }, [editor, disabled])

  // Sync content when value changes externally (e.g. cancel)
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '')
    }
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!editor) return null

  return (
    <div className={clsx(
      'rounded-lg border text-xs transition-colors',
      disabled
        ? 'border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800'
        : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary'
    )}>
      {!disabled && (
        <div className="flex items-center gap-0.5 px-2 py-1 border-b border-slate-100 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 rounded-t-lg">
          {[
            { action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold'), Icon: Bold, title: 'Negrita' },
            { action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic'), Icon: Italic, title: 'Cursiva' },
            { action: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive('bulletList'), Icon: List, title: 'Lista' },
            { action: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive('orderedList'), Icon: ListOrdered, title: 'Lista numerada' },
          ].map(({ action, active, Icon, title }) => (
            <button key={title} type="button" onClick={action} title={title}
              className={clsx('p-1 rounded transition-colors', active
                ? 'bg-primary text-white'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600')}>
              <Icon className="w-3 h-3" />
            </button>
          ))}
        </div>
      )}
      <EditorContent
        editor={editor}
        className={clsx(
          'px-2 py-1.5 min-h-[80px]',
          // Match textarea font/color style
          'text-xs text-slate-800 dark:text-slate-100',
          disabled && 'text-slate-500 dark:text-slate-400',
          // ProseMirror reset
          '[&_.ProseMirror]:outline-none',
          '[&_.ProseMirror]:text-xs [&_.ProseMirror]:leading-relaxed',
          '[&_.ProseMirror_p]:m-0 [&_.ProseMirror_p+p]:mt-1',
          '[&_.ProseMirror_ul]:my-0.5 [&_.ProseMirror_ul]:pl-4 [&_.ProseMirror_ul]:list-disc',
          '[&_.ProseMirror_ol]:my-0.5 [&_.ProseMirror_ol]:pl-4 [&_.ProseMirror_ol]:list-decimal',
          '[&_.ProseMirror_li]:my-0 [&_.ProseMirror_li]:leading-relaxed [&_.ProseMirror_li]:list-item',
          '[&_.ProseMirror_strong]:font-semibold',
          '[&_.ProseMirror_em]:italic',
        )}
      />
    </div>
  )
}

/* ─── HTML to plain text lines (for PDF) ─── */
function htmlToLines(html) {
  if (!html) return []
  // Convert list items to bullet lines first
  const text = html
    .replace(/<li[^>]*>/gi, '\x00• ')   // mark list item start
    .replace(/<\/li>/gi, '\x00')         // mark list item end
    .replace(/<br\s*\/?>/gi, '\x00')
    .replace(/<\/p>/gi, '\x00').replace(/<p[^>]*>/gi, '')
    .replace(/<\/?(strong|b|em|i|ul|ol)[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
  return text.split('\x00').map((l) => l.trim()).filter(Boolean)
}

const inputClass = "w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600"

const DEFAULT_EXPLORACION = {
  cabeza: 'Craneo normocefalo sin endostosis ni exostosis palpables, mucosas orales bien hidratadas',
  cuello: 'Cilindrico con traquea central sin alteraciones',
  torax: 'Area cardiaca ruidos cardiacos de adecuada intensidad y frecuencia campos pulmonares sin alteraciones',
  abdomen: 'Blando depresible con peristalsis presente y normal de frecuencia no se palpan visceromegalias',
  miembros_toracicos: 'Integros sin alteraciones, llenado capilar inmediato',
  miembros_pelvicos: 'Integros sin alteraciones, llenado capilar inmediato',
  otros: '',
}

const EMPTY_MED = {
  medicamento: '', indicaciones: '',
}

function isLegacyMed(t) {
  return !!(t.nombre_medicamento && !t.medicamento)
}

function legacyMedLine1(t) {
  return [t.nombre_medicamento, t.presentacion].filter(Boolean).join(' — ')
}

function legacyMedLine2(t) {
  return [t.dosificacion, t.duracion, t.via_administracion, t.cantidad_surtir].filter(Boolean).join('   ')
}

function MiniField({ label, value, onChange, type = 'text', step, disabled, rows }) {
  return (
    <div>
      <label className="block text-[12px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-0.5">{label}</label>
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

const ANTECEDENTE_CONFIG = {
  pp: {
    title: 'Antecedentes Patológicos',
    endpoint: '/antecedentes-patologicos/paciente/',
    fields: [
      { key: 'enfermedades_exantematicas', label: 'Enf. Exantemáticas' },
      { key: 'alergias', label: 'Alergias' },
      { key: 'cirugias', label: 'Cirugías' },
      { key: 'otros', label: 'Otros' },
    ],
  },
  pnp: {
    title: 'Antecedentes No Patológicos',
    endpoint: '/antecedentes-no-patologicos/paciente/',
    fields: [
      { key: 'producto_gesta', label: 'Producto Gesta' },
      { key: 'tipo_nacimiento', label: 'Tipo Nacimiento' },
      { key: 'peso_nacer_kg', label: 'Peso Nacer (kg)' },
      { key: 'talla_nacer_cm', label: 'Talla Nacer (cm)' },
      { key: 'tipo_sangre', label: 'Tipo Sangre' },
      { key: 'apgar', label: 'Apgar' },
      { key: 'alimentacion', label: 'Alimentación' },
      { key: 'lugar_nacimiento', label: 'Lugar Nacimiento' },
      { key: 'lugar_residencia', label: 'Lugar Residencia' },
      { key: 'zoonosis', label: 'Zoonosis' },
    ],
    checkboxes: [
      { key: 'seno_materno', label: 'Seno Materno' },
      { key: 'respiro_al_nacer', label: 'Respiró al Nacer' },
      { key: 'lloro_al_nacer', label: 'Lloró al Nacer' },
    ],
    desarrollo: [
      { key: 'sonrisa_social', label: 'Sonrisa Social' },
      { key: 'levantamiento_cabeza', label: 'Levanta Cabeza' },
      { key: 'sento_solo', label: 'Sentó Solo' },
      { key: 'paro_ayuda', label: 'Paró con Ayuda' },
      { key: 'gateo', label: 'Gateo' },
      { key: 'camino', label: 'Caminó' },
      { key: 'inicio_lenguaje', label: 'Inicio Lenguaje' },
      { key: 'control_esfinteres', label: 'Control Esfínteres' },
      { key: 'inicio_jardin_ninos', label: 'Jardín de Niños' },
      { key: 'primaria', label: 'Primaria' },
    ],
  },
  hf: {
    title: 'Antecedentes Heredo Familiares',
    endpoint: '/antecedentes-heredo-familiares/paciente/',
    fields: [
      { key: 'abuelo_paterno', label: 'Abuelo Paterno' },
      { key: 'abuela_paterna', label: 'Abuela Paterna' },
      { key: 'abuelo_materno', label: 'Abuelo Materno' },
      { key: 'abuela_materna', label: 'Abuela Materna' },
      { key: 'padre', label: 'Padre' },
      { key: 'madre', label: 'Madre' },
      { key: 'hermanos', label: 'Hermanos' },
    ],
  },
}

function AntecedentesPanel({ tipo, pacienteId, onClose }) {
  const config = ANTECEDENTE_CONFIG[tipo]
  const { data, isLoading } = useQuery({
    queryKey: ['antecedentes_panel', tipo, pacienteId],
    queryFn: () => api.get(`${config.endpoint}${pacienteId}`).then((r) => r.data),
  })

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed top-0 left-0 z-50 h-full w-[420px] bg-white dark:bg-slate-800 shadow-2xl border-r border-slate-200 dark:border-slate-700 overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{config.title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : !data ? (
          <div className="p-6 text-center">
            <p className="text-xs text-slate-400 dark:text-slate-500">Sin antecedentes registrados para este paciente.</p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {/* Campos texto */}
            {config.fields.map(({ key, label }) => {
              const val = data[key]
              if (!val && val !== 0) return null
              return (
                <div key={key}>
                  <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase">{label}</p>
                  <p className="text-sm text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-700/50 p-2 rounded-lg mt-0.5">{val}</p>
                </div>
              )
            })}

            {/* Checkboxes (solo PNP) */}
            {config.checkboxes && (
              <div className="flex flex-wrap gap-2">
                {config.checkboxes.map(({ key, label }) => (
                  <span key={key} className={clsx(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium',
                    data[key] ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
                  )}>
                    {data[key] ? '✓' : '✗'} {label}
                  </span>
                ))}
              </div>
            )}

            {/* Desarrollo psicomotor (solo PNP) */}
            {config.desarrollo && (
              <div>
                <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-1">Desarrollo Psicomotor (meses)</p>
                <div className="grid grid-cols-2 gap-1">
                  {config.desarrollo.map(({ key, label }) => {
                    const val = data[key]
                    if (!val) return null
                    return (
                      <div key={key} className="flex items-center justify-between bg-slate-50 dark:bg-slate-700/50 px-2 py-1 rounded">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">{label}</span>
                        <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">{val}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Inmunizaciones (solo PNP) */}
            {data.inmunizaciones?.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-1">Inmunizaciones ({data.inmunizaciones.length})</p>
                <div className="space-y-0.5">
                  {data.inmunizaciones.map((imm, i) => (
                    <div key={i} className="flex items-center justify-between bg-slate-50 dark:bg-slate-700/50 px-2 py-1 rounded text-[11px]">
                      <span className="text-slate-700 dark:text-slate-200">{imm.vacuna}</span>
                      <span className={clsx('font-medium', imm.aplicada ? 'text-green-600 dark:text-green-400' : 'text-slate-400 dark:text-slate-500')}>
                        {imm.dosis} {imm.fecha_aplicacion || ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

export default function ConsultaDetallePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { canUpdate } = useModulePermission('consultas')

  const [form, setForm] = useState({
    fecha_consulta: '', padecimiento_actual: '',
    impresion_diagnostica: '', plan_tratamiento: '', notas_adicionales: '', notas_receta: '',
    peso_kg: '', talla_cm: '', fc_bpm: '', fr_rpm: '', temperatura_c: '',
    ta_sistolica: '', ta_diastolica: '',
    cabeza: '', cuello: '', torax: '', abdomen: '',
    miembros_toracicos: '', miembros_pelvicos: '', otros: '',
  })
  const [tratamientos, setTratamientos] = useState([])
  const [editing, setEditing] = useState(false)
  const [showPrevMeds, setShowPrevMeds] = useState(false)
  const [showAntecedente, setShowAntecedente] = useState(null) // 'pp' | 'pnp' | 'hf' | null

  const { data: consulta, isLoading } = useQuery({
    queryKey: ['consulta', id],
    queryFn: () => api.get(`/consultas/${id}`).then((r) => r.data),
  })

  useEffect(() => {
    if (consulta) {
      const isNew = !consulta.mediciones?.cabeza && !consulta.mediciones?.peso_kg && !consulta.impresion_diagnostica
      setForm({
        fecha_consulta: consulta.fecha_consulta || '',
        padecimiento_actual: consulta.padecimiento_actual || '',
        impresion_diagnostica: consulta.impresion_diagnostica || '',
        plan_tratamiento: consulta.plan_tratamiento || '',
        notas_adicionales: consulta.notas_adicionales || '',
        notas_receta: consulta.notas_receta || '',
        peso_kg: consulta.mediciones?.peso_kg ?? '',
        talla_cm: consulta.mediciones?.talla_cm ?? '',
        fc_bpm: consulta.mediciones?.fc_bpm ?? '',
        fr_rpm: consulta.mediciones?.fr_rpm ?? '',
        temperatura_c: consulta.mediciones?.temperatura_c ?? '',
        ta_sistolica: consulta.mediciones?.ta_sistolica ?? '',
        ta_diastolica: consulta.mediciones?.ta_diastolica ?? '',
        cabeza: consulta.mediciones?.cabeza ?? (isNew ? DEFAULT_EXPLORACION.cabeza : ''),
        cuello: consulta.mediciones?.cuello ?? (isNew ? DEFAULT_EXPLORACION.cuello : ''),
        torax: consulta.mediciones?.torax ?? (isNew ? DEFAULT_EXPLORACION.torax : ''),
        abdomen: consulta.mediciones?.abdomen ?? (isNew ? DEFAULT_EXPLORACION.abdomen : ''),
        miembros_toracicos: consulta.mediciones?.miembros_toracicos ?? (isNew ? DEFAULT_EXPLORACION.miembros_toracicos : ''),
        miembros_pelvicos: consulta.mediciones?.miembros_pelvicos ?? (isNew ? DEFAULT_EXPLORACION.miembros_pelvicos : ''),
        otros: consulta.mediciones?.otros ?? '',
      })
      setTratamientos(consulta.tratamientos?.map((t) => ({ ...t })) || [])
      if (isNew) setEditing(true)
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
        notas_receta: strOrNull(data.notas_receta),
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
        .filter((t) => (t.medicamento || t.nombre_medicamento || '').trim())
        .map((t) => ({
          consulta_id: parseInt(id),
          nombre_medicamento: t.nombre_medicamento || null,
          presentacion: t.presentacion || null,
          dosificacion: t.dosificacion || null,
          duracion: t.duracion || null,
          via_administracion: t.via_administracion || null,
          cantidad_surtir: t.cantidad_surtir || null,
          medicamento: t.medicamento || null,
          indicaciones: t.indicaciones || null,
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
        notas_receta: consulta.notas_receta || '',
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

  const formatFechaReceta = (fecha) => {
    if (!fecha) return '—'
    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
    const d = new Date(fecha + 'T00:00:00')
    return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`
  }

  const generateRecetaPDF = () => {
    // Media carta horizontal: 215.9mm ancho x 139.7mm alto (hoja precortada)
    const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: [215.9, 139.7] })
    const ml = 10, mr = 10, mt = 40, mb = 10
    const pw = 215.9, ph = 139.7
    const cw = pw - ml - mr
    let y = mt

    const newPage = () => { doc.addPage(); y = mt }
    const checkPage = (needed) => { if (y + needed > ph - mb) newPage() }

    // Row 1: Nombre | Fecha
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    const pacLabel = 'Paciente: '
    doc.text(pacLabel, ml, y)
    doc.setFont('helvetica', 'normal')
    doc.text(consulta.paciente_nombre || '', ml + doc.getTextWidth(pacLabel), y)
    doc.setFont('helvetica', 'bold')
    doc.text('Fecha: ', pw / 2, y)
    doc.setFont('helvetica', 'normal')
    doc.text(formatFechaReceta(form.fecha_consulta), pw / 2 + doc.getTextWidth('Fecha: '), y)
    y += 4
    // Edad
    if (age) {
      const parts = []
      if (age.years > 0) parts.push(`${age.years} ${age.years === 1 ? 'año' : 'años'}`)
      if (age.months > 0) parts.push(`${age.months} ${age.months === 1 ? 'mes' : 'meses'}`)
      if (age.days > 0) parts.push(`${age.days} ${age.days === 1 ? 'día' : 'días'}`)
      if (parts.length) {
        doc.setFont('helvetica', 'bold')
        doc.text('Edad: ', ml, y)
        doc.setFont('helvetica', 'normal')
        doc.text(parts.join(' '), ml + doc.getTextWidth('Edad: '), y)
        y += 4
      }
    }
    y += 1

    // Row 2: Signos vitales
    doc.setFontSize(10)
    const vitals = [
      ['Peso:', form.peso_kg ? `${form.peso_kg} kg` : ''],
      ['Talla:', form.talla_cm ? `${form.talla_cm} cm` : ''],
      ['FC:', form.fc_bpm ? `${form.fc_bpm}/min` : ''],
      ['FR:', form.fr_rpm ? `${form.fr_rpm}/min` : ''],
      ['Temp:', form.temperatura_c ? `${form.temperatura_c} °C` : ''],
      ['TA:', (form.ta_sistolica || form.ta_diastolica) ? `${form.ta_sistolica || ''}/${form.ta_diastolica || ''}` : ''],
    ]
    let vx = ml
    for (const [label, val] of vitals) {
      if (!val) continue
      doc.setFont('helvetica', 'bold')
      doc.text(label, vx, y)
      vx += doc.getTextWidth(label) + 1
      doc.setFont('helvetica', 'normal')
      doc.text(val, vx, y)
      vx += doc.getTextWidth(val) + 5
    }
    y += 5

    // Notas receta (sin label, solo el texto)
    if (form.notas_receta) {
      checkPage(4)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      const notasRecetaLines = doc.splitTextToSize(form.notas_receta, cw)
      for (const line of notasRecetaLines) {
        checkPage(4)
        doc.text(line, ml, y)
        y += 4
      }
      y += 2
    }

    // Medicamentos
    const meds = tratamientos.filter((t) => (t.medicamento || t.nombre_medicamento || '').trim())
    if (meds.length > 0) {
      checkPage(10)
      doc.setFontSize(10)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      const lineH = 4
      const indent = ml + 4
      meds.forEach((t, idx) => {
        let line1, line2
        if (t.medicamento) {
          line1 = doc.splitTextToSize(`${idx + 1}. ${t.medicamento}`, cw)
          line2 = t.indicaciones ? doc.splitTextToSize(t.indicaciones, cw - 4) : []
        } else {
          const nombrePres = [
            `${idx + 1}. ${t.nombre_medicamento}`,
            t.presentacion ? `- ${t.presentacion}` : '',
          ].filter(Boolean).join('  ')
          line1 = doc.splitTextToSize(nombrePres, cw)
          const detalles = [
            t.dosificacion, t.duracion, t.via_administracion, t.cantidad_surtir,
          ].filter(Boolean).join('   ')
          line2 = detalles ? doc.splitTextToSize(detalles, cw - 4) : []
        }
        checkPage((line1.length + line2.length) * lineH + 2)
        doc.setFont('helvetica', 'bold')
        line1.forEach((l, i) => doc.text(l, ml, y + i * lineH))
        y += line1.length * lineH
        if (line2.length) {
          doc.setFont('helvetica', 'normal')
          line2.forEach((l, i) => doc.text(l, indent, y + i * lineH))
          y += line2.length * lineH
        }
        y += 1
      })
      y += 2
    }

    // Plan de tratamiento
    if (form.plan_tratamiento) {
      checkPage(10)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text('Plan de tratamiento:', ml, y)
      y += 4
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      const planLines = doc.splitTextToSize(form.plan_tratamiento, cw)
      for (const line of planLines) {
        checkPage(4)
        doc.text(line, ml, y)
        y += 4
      }
      y += 2
    }

    // Indicaciones / comentarios (rich text → líneas planas)
    const notasLines = htmlToLines(form.notas_adicionales)
    if (notasLines.length > 0) {
      checkPage(4)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      for (const line of notasLines) {
        const wrapped = doc.splitTextToSize(line, cw)
        for (const wline of wrapped) {
          checkPage(4)
          doc.text(wline, ml, y)
          y += 4
        }
      }
    }

    doc.autoPrint()
    window.open(doc.output('bloburl'), '_blank')
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
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-[12px] font-bold shrink-0">
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

        {/* Botones antecedentes */}
        <div className="flex items-center gap-1">
          {[
            { key: 'hf', icon: Users2, label: 'Heredo Fam.', color: 'text-purple-500' },
            { key: 'pp', icon: ClipboardList, label: 'Patológicos', color: 'text-orange-500' },
            { key: 'pnp', icon: HeartPulse, label: 'No Patológicos', color: 'text-pink-500' },
          ].map(({ key, icon: Icon, label, color }) => (
            <button key={key} type="button" onClick={() => setShowAntecedente(showAntecedente === key ? null : key)}
              className={clsx(
                'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium transition-colors',
                showAntecedente === key
                  ? 'bg-primary/10 text-primary'
                  : 'text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
              )}
              title={label}>
              <Icon className={clsx('w-3 h-3', showAntecedente === key ? 'text-primary' : color)} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Alergias + consulta anterior juntos */}
        {(consulta.alergias || consulta.consulta_anterior) && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {consulta.alergias && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[11px] font-medium">
                <AlertTriangle className="w-3 h-3" /> {consulta.alergias}
              </span>
            )}
            {consulta.consulta_anterior && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[11px] font-medium" title={`Consulta anterior: ${consulta.consulta_anterior.fecha}`}>
                <Activity className="w-3 h-3" /> {consulta.consulta_anterior.peso_kg != null ? `${consulta.consulta_anterior.peso_kg}kg` : ''}{consulta.consulta_anterior.peso_kg != null && consulta.consulta_anterior.talla_cm != null ? ' · ' : ''}{consulta.consulta_anterior.talla_cm != null ? `${consulta.consulta_anterior.talla_cm}cm` : ''}
              </span>
            )}
          </div>
        )}

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
        {!editing && (
          <button type="button" onClick={generateRecetaPDF}
            className="inline-flex items-center gap-1 px-3 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            title="Imprimir receta">
            <Printer className="w-3.5 h-3.5" /> Receta
          </button>
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
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-3 items-start">

          {/* ── LEFT COLUMN ── */}
          <div className="space-y-3">
            {/* Datos de la Consulta */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <ClipboardPlus className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200">Datos de la consulta</h3>
              </div>
              <div className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 items-start">
                <div>
                  <label className="block text-[12px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-0.5">Fecha</label>
                  <input type="date" value={form.fecha_consulta}
                    onChange={(e) => updateField('fecha_consulta', e.target.value)}
                    className={clsx(inputClass, disabled && 'bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400')} disabled={disabled} required />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-0.5">Motivo / Padecimiento actual</label>
                  <textarea value={form.padecimiento_actual}
                    onChange={(e) => updateField('padecimiento_actual', e.target.value)}
                    rows={6} className={clsx(`${inputClass} resize-none`, disabled && 'bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400')}
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
              <div className="grid grid-cols-4 gap-1.5">
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
                  <MiniField key={key} label={label} value={form[key]} rows={7}
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
                  <label className="block text-[12px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-0.5">Impresión diagnóstica</label>
                  <textarea value={form.impresion_diagnostica}
                    onChange={(e) => updateField('impresion_diagnostica', e.target.value)}
                    rows={2} className={clsx(`${inputClass} resize-none`, disabled && 'bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400')}
                    disabled={disabled} placeholder="CIE-10 o descripción clínica..." />
                </div>
              </div>
            </div>

            {/* Notas receta */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <NotebookPen className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200">Notas receta</h3>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 ml-1">— aparecen antes de los medicamentos</span>
              </div>
              <input value={form.notas_receta}
                onChange={(e) => updateField('notas_receta', e.target.value)}
                className={clsx(inputClass, disabled && 'bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400')}
                disabled={disabled} placeholder="Ej: Dieta blanda, reposo relativo..." />
            </div>

            {/* Medicamentos */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Pill className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200">Medicamentos</h3>
                  <span className="text-[12px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-full">{tratamientos.length}</span>
                </div>
                <div className="flex items-center gap-1">
                  {consulta.consulta_anterior?.tratamientos?.length > 0 && (
                    <button type="button" onClick={() => setShowPrevMeds(true)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors">
                      <History className="w-3 h-3" /> Anteriores
                    </button>
                  )}
                  {editing && (
                    <button type="button" onClick={addMed}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 rounded-md hover:bg-green-100 transition-colors">
                      <Plus className="w-3 h-3" /> Agregar
                    </button>
                  )}
                </div>
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
                    <div key={idx} className="bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-100 dark:border-slate-700 px-2 py-1.5 space-y-1">
                      {isLegacyMed(t) ? (
                        /* Campos viejos — siempre en modo texto */
                        <div className="flex items-start gap-1">
                          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0 pt-0.5">{idx + 1}.</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">{legacyMedLine1(t)}</p>
                            {legacyMedLine2(t) && <p className="text-[12px] text-slate-500 dark:text-slate-400">{legacyMedLine2(t)}</p>}
                          </div>
                        </div>
                      ) : (
                        /* Campos nuevos (2 inputs alineados) */
                        <div className="flex items-start gap-1">
                          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0 leading-[28px]">{idx + 1}.</span>
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-1">
                              <input value={t.medicamento || ''}
                                onChange={(e) => updateMed(idx, 'medicamento', e.target.value)}
                                className={clsx(inputClass, 'text-[12px] py-1 font-semibold flex-1 min-w-0', disabled && 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500')}
                                disabled={disabled} placeholder="Nombre del medicamento" />
                              {editing ? (
                                <button type="button" onClick={() => removeMed(idx)}
                                  className="p-0.5 rounded text-slate-300 dark:text-slate-500 hover:text-red-500 transition-colors shrink-0"
                                  title="Eliminar">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              ) : <div className="w-4 shrink-0" />}
                            </div>
                            <input value={t.indicaciones || ''}
                              onChange={(e) => updateMed(idx, 'indicaciones', e.target.value)}
                              className={clsx(inputClass, 'text-[12px] py-1', disabled && 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500')}
                              disabled={disabled} placeholder="Dosis, duración, vía, cantidad..." />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Indicaciones / Comentarios para receta */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <NotebookPen className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200">Indicaciones y comentarios</h3>
                <span className="text-[12px] text-slate-400 dark:text-slate-500 ml-1">— aparecen en la receta</span>
              </div>
              <RichTextEditor
                value={form.notas_adicionales}
                onChange={(v) => updateField('notas_adicionales', v)}
                disabled={disabled}
              />
            </div>

            {/* Plan de tratamiento */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200">Plan de tratamiento</h3>
              </div>
              <textarea value={form.plan_tratamiento}
                onChange={(e) => updateField('plan_tratamiento', e.target.value)}
                rows={5} className={clsx(`${inputClass} resize-none`, disabled && 'bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400')}
                disabled={disabled} placeholder="Indicaciones, estudios, referidos..." />
            </div>
          </div>

        </div>
      </form>

      {/* Panel lateral izquierdo: antecedentes */}
      {showAntecedente && <AntecedentesPanel tipo={showAntecedente} pacienteId={consulta.paciente_id} onClose={() => setShowAntecedente(null)} />}

      {/* Panel lateral derecho: medicamentos consulta anterior */}
      {showPrevMeds && consulta.consulta_anterior?.tratamientos && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setShowPrevMeds(false)} />
          <div className="fixed top-0 right-0 z-50 h-full w-[480px] bg-white dark:bg-slate-800 shadow-2xl border-l border-slate-200 dark:border-slate-700 overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700">
              <div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Medicamentos anteriores</h3>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">Consulta del {consulta.consulta_anterior.fecha}</p>
              </div>
              <button onClick={() => setShowPrevMeds(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <div className="p-4 space-y-2">
              {consulta.consulta_anterior.tratamientos.map((t, idx) => (
                <div key={idx} className="bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-100 dark:border-slate-700 p-2.5">
                  <div className="flex items-start gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 shrink-0">{idx + 1}.</span>
                    <div className="min-w-0">
                      {t.medicamento ? (
                        <>
                          <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">{t.medicamento}</p>
                          {t.indicaciones && <p className="text-[12px] text-slate-500 dark:text-slate-400">{t.indicaciones}</p>}
                        </>
                      ) : (
                        <>
                          <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">{legacyMedLine1(t)}</p>
                          {legacyMedLine2(t) && <p className="text-[12px] text-slate-500 dark:text-slate-400">{legacyMedLine2(t)}</p>}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {consulta.consulta_anterior.tratamientos.length === 0 && (
                <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">Sin medicamentos en la consulta anterior</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
