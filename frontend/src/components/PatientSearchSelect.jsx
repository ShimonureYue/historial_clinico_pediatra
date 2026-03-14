import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, X } from 'lucide-react'
import api from '../lib/api'

export default function PatientSearchSelect({ value, onChange, className = '' }) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const wrapperRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 250)
    return () => clearTimeout(t)
  }, [query])

  // Fetch matching patients
  const { data: results = [], isFetching } = useQuery({
    queryKey: ['pacientes-search', debouncedQuery],
    queryFn: () =>
      api.get(`/pacientes?search=${encodeURIComponent(debouncedQuery)}&limit=15`).then((r) => r.data.data),
    enabled: debouncedQuery.length >= 1,
    staleTime: 30000,
  })

  // Load selected patient info when value is set externally
  const { data: selectedPatient } = useQuery({
    queryKey: ['paciente', value],
    queryFn: () => api.get(`/pacientes/${value}`).then((r) => r.data),
    enabled: !!value && !selected,
    staleTime: 60000,
  })

  useEffect(() => {
    if (selectedPatient && !selected) setSelected(selectedPatient)
  }, [selectedPatient, selected])

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (patient) => {
    setSelected(patient)
    setQuery('')
    setOpen(false)
    onChange(String(patient.id))
  }

  const handleClear = () => {
    setSelected(null)
    setQuery('')
    onChange('')
    inputRef.current?.focus()
  }

  const inputClass =
    'w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:bg-slate-700 dark:text-slate-100'

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">
        Paciente
      </label>

      {selected ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-primary/40 bg-primary/5 dark:bg-primary/10 dark:border-primary/30 text-sm">
          <Search className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="flex-1 font-medium text-slate-800 dark:text-slate-100 truncate">
            {selected.nombre} {selected.apellido_paterno} {selected.apellido_materno}
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0">ID: {selected.id}</span>
          <button
            type="button"
            onClick={handleClear}
            className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-400 dark:text-slate-500 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
            }}
            onFocus={() => query.length >= 1 && setOpen(true)}
            placeholder="Escriba nombre, apellido o ID..."
            className={inputClass}
          />
          {isFetching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}

      {/* Dropdown */}
      {open && !selected && debouncedQuery.length >= 1 && (
        <div className="absolute z-40 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-lg max-h-60 overflow-y-auto">
          {results.length === 0 && !isFetching ? (
            <div className="px-4 py-3 text-sm text-slate-400 dark:text-slate-500 text-center">
              No se encontraron pacientes
            </div>
          ) : (
            results.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelect(p)}
                className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-3 border-b border-slate-50 dark:border-slate-700 last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                    {p.nombre} {p.apellido_paterno} {p.apellido_materno}
                  </div>
                  {p.fecha_nacimiento && (
                    <div className="text-xs text-slate-400 dark:text-slate-500">
                      Nac: {p.fecha_nacimiento}
                    </div>
                  )}
                </div>
                <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0">
                  ID: {p.id}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
