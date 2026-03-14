import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Users } from 'lucide-react'
import api from '../lib/api'
import useModulePermission from '../hooks/useModulePermission'
import PatientSearchSelect from '../components/PatientSearchSelect'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const EMPTY_FORM = {
  abuelo_paterno: '', abuela_paterna: '', abuelo_materno: '', abuela_materna: '',
  padre: '', madre: '', hermanos: '',
}

const FIELDS = [
  { key: 'abuelo_paterno', label: 'Abuelo Paterno' },
  { key: 'abuela_paterna', label: 'Abuela Paterna' },
  { key: 'abuelo_materno', label: 'Abuelo Materno' },
  { key: 'abuela_materna', label: 'Abuela Materna' },
  { key: 'padre', label: 'Padre' },
  { key: 'madre', label: 'Madre' },
  { key: 'hermanos', label: 'Hermanos' },
]

const inputClass = "w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:bg-slate-700 dark:text-slate-100"

export default function AntecedentesHeredoFamiliaresPage() {
  const { canWrite, canUpdate } = useModulePermission('antecedentes_hf')
  const queryClient = useQueryClient()
  const [selectedPaciente, setSelectedPaciente] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [existingId, setExistingId] = useState(null)

  const { data: antData, isError } = useQuery({
    queryKey: ['antecedentes_hf', selectedPaciente],
    queryFn: () => api.get(`/antecedentes-heredo-familiares/paciente/${selectedPaciente}`).then((r) => r.data),
    enabled: !!selectedPaciente,
  })

  useEffect(() => {
    if (isError || !selectedPaciente) {
      setForm(EMPTY_FORM)
      setExistingId(null)
      return
    }
    if (antData) {
      const newForm = {}
      FIELDS.forEach(({ key }) => { newForm[key] = antData[key] || '' })
      setForm(newForm)
      setExistingId(antData.id)
    } else if (antData === null || antData === undefined) {
      setForm(EMPTY_FORM)
      setExistingId(null)
    }
  }, [antData, isError, selectedPaciente])

  const saveMutation = useMutation({
    mutationFn: (data) =>
      existingId
        ? api.put(`/antecedentes-heredo-familiares/${existingId}`, data)
        : api.post('/antecedentes-heredo-familiares', { ...data, paciente_id: selectedPaciente }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['antecedentes_hf', selectedPaciente] })
      toast.success('Antecedentes heredo familiares guardados')
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error al guardar'),
  })

  const handleSubmit = (e) => { e.preventDefault(); saveMutation.mutate(form) }
  const updateField = (f, v) => setForm((prev) => ({ ...prev, [f]: v }))
  const canEdit = existingId ? canUpdate : canWrite
  const dis = !canEdit

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Antecedentes Heredo Familiares</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">Patologías relevantes en familiares del paciente</p>
      </div>

      {/* Patient selector */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-4">
        <PatientSearchSelect value={selectedPaciente} onChange={setSelectedPaciente} />
      </div>

      {selectedPaciente && (
        <form onSubmit={handleSubmit}>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-4 space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200">Antecedentes por familiar</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {FIELDS.map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-0.5">{label}</label>
                  <textarea value={form[key]} onChange={(e) => updateField(key, e.target.value)}
                    rows={2} disabled={dis}
                    placeholder={`Patologías de ${label.toLowerCase()}...`}
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
