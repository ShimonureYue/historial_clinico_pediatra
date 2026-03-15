import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Users, Stethoscope, Pill, CalendarDays, TrendingUp,
  Baby, UserPlus, Activity, BarChart3, Eye
} from 'lucide-react'
import api from '../lib/api'
import clsx from 'clsx'

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function mesLabel(ym) {
  if (!ym) return ''
  const [, m] = ym.split('-')
  return MESES[parseInt(m, 10) - 1] || ym
}

export default function DashboardPage() {
  const navigate = useNavigate()

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/dashboard/stats').then((r) => r.data),
    refetchInterval: 60000,
  })

  if (isLoading || !stats) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  const maxConsultas = Math.max(...stats.consultas_por_mes.map((r) => r.total), 1)
  const maxPacientes = Math.max(...stats.pacientes_por_mes.map((r) => r.total), 1)

  const totalSexo = stats.por_sexo.reduce((s, r) => s + r.total, 0) || 1
  const sexoM = stats.por_sexo.find((r) => r.sexo === 'M')?.total || 0
  const sexoF = stats.por_sexo.find((r) => r.sexo === 'F')?.total || 0

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard icon={Users} label="Pacientes" value={stats.total_pacientes} color="primary" />
        <KpiCard icon={Stethoscope} label="Consultas" value={stats.total_consultas} color="blue" />
        <KpiCard icon={Pill} label="Tratamientos" value={stats.total_tratamientos} color="green" />
        <KpiCard icon={CalendarDays} label="Consultas este mes" value={stats.consultas_mes} color="amber" />
        <KpiCard icon={UserPlus} label="Pacientes nuevos" value={stats.pacientes_mes} color="pink" />
        <KpiCard icon={Activity} label="Prom. consultas/pac" value={stats.avg_consultas_por_paciente} color="indigo" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Consultas por mes */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-blue-500" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Consultas por Mes</h3>
          </div>
          {stats.consultas_por_mes.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">Sin datos</p>
          ) : (
            <div className="flex items-end gap-3">
              {stats.consultas_por_mes.map((r) => {
                const barH = Math.max(4, Math.round((r.total / maxConsultas) * 128))
                return (
                  <div key={r.mes} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{r.total}</span>
                    <div
                      className="w-full bg-blue-500 rounded-t-lg transition-all"
                      style={{ height: `${barH}px` }}
                    />
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">{mesLabel(r.mes)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Pacientes nuevos por mes */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-pink-500" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Pacientes Nuevos por Mes</h3>
          </div>
          {stats.pacientes_por_mes.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">Sin datos</p>
          ) : (
            <div className="flex items-end gap-3">
              {stats.pacientes_por_mes.map((r) => {
                const barH = Math.max(4, Math.round((r.total / maxPacientes) * 128))
                return (
                  <div key={r.mes} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{r.total}</span>
                    <div
                      className="w-full bg-pink-500 rounded-t-lg transition-all"
                      style={{ height: `${barH}px` }}
                    />
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">{mesLabel(r.mes)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom row: demographics + top diagnostics + last activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sexo distribution */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
            <Baby className="w-5 h-5 text-primary" /> Distribución por Sexo
          </h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-blue-600 dark:text-blue-400 font-medium">Masculino</span>
                <span className="text-slate-500 dark:text-slate-400">{sexoM} ({Math.round((sexoM / totalSexo) * 100)}%)</span>
              </div>
              <div className="h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${(sexoM / totalSexo) * 100}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-pink-600 dark:text-pink-400 font-medium">Femenino</span>
                <span className="text-slate-500 dark:text-slate-400">{sexoF} ({Math.round((sexoF / totalSexo) * 100)}%)</span>
              </div>
              <div className="h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-pink-500 rounded-full transition-all" style={{ width: `${(sexoF / totalSexo) * 100}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Top diagnosticos */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-amber-500" /> Diagnósticos Frecuentes
          </h3>
          {stats.top_diagnosticos.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">Sin datos</p>
          ) : (
            <div className="space-y-2">
              {stats.top_diagnosticos.map((d, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2">
                  <p className="text-xs text-slate-700 dark:text-slate-200 truncate flex-1">{d.impresion_diagnostica}</p>
                  <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full flex-shrink-0">
                    {d.total}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ultima actividad */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-green-500" /> Última Actividad
          </h3>

          {/* Ultima consulta */}
          {stats.ultima_consulta && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
              <p className="text-[10px] uppercase font-semibold text-blue-500 dark:text-blue-400 mb-1">Última Consulta</p>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                {stats.ultima_consulta.nombre} {stats.ultima_consulta.apellido_paterno}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{stats.ultima_consulta.fecha_consulta}</p>
              {stats.ultima_consulta.impresion_diagnostica && (
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 truncate">{stats.ultima_consulta.impresion_diagnostica}</p>
              )}
              <button onClick={() => navigate(`/consultas/${stats.ultima_consulta.id}`)}
                className="inline-flex items-center gap-1 mt-2 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline">
                <Eye className="w-3 h-3" /> Ver consulta
              </button>
            </div>
          )}

          {/* Ultimo paciente */}
          {stats.ultimo_paciente && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-800">
              <p className="text-[10px] uppercase font-semibold text-green-500 dark:text-green-400 mb-1">Último Paciente Registrado</p>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                {stats.ultimo_paciente.nombre} {stats.ultimo_paciente.apellido_paterno} {stats.ultimo_paciente.apellido_materno}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {stats.ultimo_paciente.sexo === 'M' ? 'Masculino' : stats.ultimo_paciente.sexo === 'F' ? 'Femenino' : 'Otro'} — Nac. {stats.ultimo_paciente.fecha_nacimiento}
              </p>
              <button onClick={() => navigate(`/pacientes/${stats.ultimo_paciente.id}`)}
                className="inline-flex items-center gap-1 mt-2 text-[11px] font-medium text-green-600 dark:text-green-400 hover:underline">
                <Eye className="w-3 h-3" /> Ver paciente
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Recent tables row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Ultimas 5 consultas */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-blue-500" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Últimas 5 Consultas</h3>
          </div>
          {(stats.ultimas_consultas?.length || 0) === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-6">Sin consultas</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-700/50 text-left">
                  <th className="px-4 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Fecha</th>
                  <th className="px-4 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Paciente</th>
                  <th className="px-4 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase hidden sm:table-cell">Diagnóstico</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                {stats.ultimas_consultas.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-100 whitespace-nowrap">{c.fecha_consulta}</td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{c.nombre} {c.apellido_paterno}</td>
                    <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 truncate max-w-[200px] hidden sm:table-cell">{c.impresion_diagnostica || '-'}</td>
                    <td className="px-4 py-2.5">
                      <button onClick={() => navigate(`/consultas/${c.id}`)}
                        className="text-primary hover:underline text-[11px] font-medium inline-flex items-center gap-0.5">
                        <Eye className="w-3 h-3" /> Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Ultimos 5 pacientes */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
            <Users className="w-5 h-5 text-green-500" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Últimos 5 Pacientes</h3>
          </div>
          {(stats.ultimos_pacientes?.length || 0) === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-6">Sin pacientes</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-700/50 text-left">
                  <th className="px-4 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Nombre</th>
                  <th className="px-4 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase hidden sm:table-cell">Sexo</th>
                  <th className="px-4 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase hidden sm:table-cell">Nac.</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                {stats.ultimos_pacientes.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-100">{p.nombre} {p.apellido_paterno} {p.apellido_materno}</td>
                    <td className="px-4 py-2.5 hidden sm:table-cell">
                      <span className={clsx(
                        'inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium',
                        p.sexo === 'F' ? 'bg-pink-50 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400' : 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                      )}>
                        {p.sexo === 'F' ? 'F' : 'M'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 whitespace-nowrap hidden sm:table-cell">{p.fecha_nacimiento}</td>
                    <td className="px-4 py-2.5">
                      <button onClick={() => navigate(`/pacientes/${p.id}`)}
                        className="text-primary hover:underline text-[11px] font-medium inline-flex items-center gap-0.5">
                        <Eye className="w-3 h-3" /> Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

const COLOR_MAP = {
  primary: { bg: 'bg-primary/10', text: 'text-primary' },
  blue: { bg: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400' },
  green: { bg: 'bg-green-50 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400' },
  amber: { bg: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-600 dark:text-amber-400' },
  pink: { bg: 'bg-pink-50 dark:bg-pink-900/30', text: 'text-pink-600 dark:text-pink-400' },
  indigo: { bg: 'bg-indigo-50 dark:bg-indigo-900/30', text: 'text-indigo-600 dark:text-indigo-400' },
}

function KpiCard({ icon: Icon, label, value, color }) {
  const c = COLOR_MAP[color] || COLOR_MAP.primary
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-4 flex items-center gap-3">
      <div className={clsx('flex items-center justify-center w-10 h-10 rounded-xl', c.bg, c.text)}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{value}</p>
        <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-medium">{label}</p>
      </div>
    </div>
  )
}
