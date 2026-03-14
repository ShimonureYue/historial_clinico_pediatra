import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, AlertCircle, Pill, Scissors, ClipboardList } from 'lucide-react'
import api from '../lib/api'
import useModulePermission from '../hooks/useModulePermission'
import PatientSearchSelect from '../components/PatientSearchSelect'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const EMPTY_FORM = {
  enfermedades_exantematicas: '',
  alergias: '',
  cirugias: '',
  otros: '',
}

const inputClass = "w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:bg-slate-700 dark:text-slate-100"

export default function AntecedentesPatologicosPage() {
  const { canWrite, canUpdate } = useModulePermission('antecedentes_pp')
  const queryClient = useQueryClient()
  const [selectedPaciente, setSelectedPaciente] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [existingId, setExistingId] = useState(null)

  const { data: antData, isLoading, isError } = useQuery({
    queryKey: ['antecedentes_pp', selectedPaciente],
    queryFn: () => api.get(`/antecedentes-patologicos/paciente/${selectedPaciente}`).then((r) => r.data),
    enabled: !!selectedPaciente,
  })

  useEffect(() => {
    if (isError || !selectedPaciente) {
      setForm(EMPTY_FORM)
      setExistingId(null)
      return
    }
    if (antData) {
      setForm({
        enfermedades_exantematicas: antData.enfermedades_exantematicas || '',
        alergias: antData.alergias || '',
        cirugias: antData.cirugias || '',
        otros: antData.otros || '',
      })
      setExistingId(antData.id)
    } else if (antData === null || antData === undefined) {
      setForm(EMPTY_FORM)
      setExistingId(null)
    }
  }, [antData, isError, selectedPaciente])

  const saveMutation = useMutation({
    mutationFn: (data) =>
      existingId
        ? api.put(`/antecedentes-patologicos/${existingId}`, data)
        : api.post('/antecedentes-patologicos', { ...data, paciente_id: selectedPaciente }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['antecedentes_pp', selectedPaciente] })
      toast.success('Antecedentes patológicos guardados')
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error al guardar'),
  })

  const handleSubmit = (e) => { e.preventDefault(); saveMutation.mutate(form) }
  const updateField = (f, v) => setForm((prev) => ({ ...prev, [f]: v }))
  const canEdit = existingId ? canUpdate : canWrite
  const dis = !canEdit

  const SECTIONS = [
    { key: 'enfermedades_exantematicas', label: 'Enf. exantemáticas', icon: AlertCircle, iconColor: 'text-orange-500', placeholder: 'Varicela, sarampión, rubéola...' },
    { key: 'alergias', label: 'Alergias', icon: Pill, iconColor: 'text-red-500', placeholder: 'Medicamentos, alimentos, ambientales...' },
    { key: 'cirugias', label: 'Cirugías', icon: Scissors, iconColor: 'text-blue-500', placeholder: 'Tipo de cirugía, fecha, hospital...' },
    { key: 'otros', label: 'Otros', icon: ClipboardList, iconColor: 'text-slate-400 dark:text-slate-500', placeholder: 'Otros antecedentes relevantes...' },
  ]

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Antecedentes Patológicos</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">Enfermedades previas, alergias y cirugías</p>
      </div>

      {/* Patient selector */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <PatientSearchSelect value={selectedPaciente} onChange={setSelectedPaciente} className="flex-1" />
          {selectedPaciente && (
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
              {existingId ? 'Registro existente' : 'Nuevo registro'}
            </span>
          )}
        </div>
      </div>

      {/* Form */}
      {selectedPaciente && (
        <form onSubmit={handleSubmit}>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-4 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SECTIONS.map(({ key, label, icon: Icon, iconColor, placeholder }) => (
                <div key={key}>
                  <label className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-0.5">
                    <Icon className={`w-3 h-3 ${iconColor}`} /> {label}
                  </label>
                  <textarea value={form[key]} onChange={(e) => updateField(key, e.target.value)}
                    rows={2} placeholder={placeholder} disabled={dis}
                    className={clsx(`${inputClass} py-1 resize-none`, dis && 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400')} />
                </div>
              ))}
            </div>

            {canEdit && (
              <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-700">
                <button type="submit" disabled={saveMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg shadow-lg shadow-primary/30 hover:bg-primary-dark disabled:opacity-50 transition-all">
                  <Save className="w-3.5 h-3.5" />
                  {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            )}
          </div>
        </form>
      )}
    </div>
  )
}
