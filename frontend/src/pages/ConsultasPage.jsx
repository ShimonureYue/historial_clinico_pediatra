import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, Stethoscope, Eye, Pill, ChevronLeft, ChevronRight } from 'lucide-react'
import api from '../lib/api'

const PAGE_SIZE = 50

export default function ConsultasPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const { data, isLoading } = useQuery({
    queryKey: ['consultas', debouncedSearch, page],
    queryFn: () => api.get('/consultas', { params: { search: debouncedSearch, page, limit: PAGE_SIZE } }).then((r) => r.data),
  })

  const consultas = data?.data ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const inputClass = "w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:bg-slate-700 dark:text-slate-100"

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Consultas</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Registro de consultas médicas
          {total > 0 && <span className="ml-2 text-slate-400 dark:text-slate-500">({total.toLocaleString()} registros)</span>}
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por paciente, padecimiento o fecha..."
          className={`pl-10 pr-4 py-2.5 ${inputClass}`} />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-400 dark:text-slate-500">Cargando consultas...</div>
      ) : consultas.length === 0 ? (
        <div className="text-center py-12">
          <Stethoscope className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-slate-500 dark:text-slate-400">No se encontraron consultas</p>
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-700 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Fecha</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Paciente</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase hidden md:table-cell">Padecimiento</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase hidden lg:table-cell">Diagnóstico</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase hidden lg:table-cell">Medicamentos</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                {consultas.map((c) => (
                  <tr key={c.id} className="group hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                    onClick={() => navigate(`/consultas/${c.id}`)}>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">{c.fecha_consulta}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{c.paciente_nombre}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 hidden md:table-cell max-w-xs truncate">{c.padecimiento_actual}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 hidden lg:table-cell max-w-xs truncate">{c.impresion_diagnostica || '-'}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {c.tratamientos?.length > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                          <Pill className="w-3 h-3 mr-1" /> {c.tratamientos.length}
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/consultas/${c.id}`) }}
                          className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:bg-primary/10 hover:text-primary transition-colors" title="Ver detalle">
                          <Eye className="w-4 h-4" />
                        </button>
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
