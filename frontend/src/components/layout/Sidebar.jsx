import { NavLink } from 'react-router-dom'
import {
  Users, Stethoscope, FileText, ShieldCheck,
  ClipboardList, HeartPulse, Baby, ChevronLeft, ChevronRight
} from 'lucide-react'
import { useState } from 'react'
import useAuthStore from '../../store/auth'
import clsx from 'clsx'

const navItems = [
  { to: '/pacientes', label: 'Pacientes', icon: Baby, module: 'pacientes' },
  { to: '/consultas', label: 'Consultas', icon: Stethoscope, module: 'consultas' },
  { to: '/antecedentes-patologicos', label: 'A. Patológicos', icon: ClipboardList, module: 'antecedentes_pp' },
  { to: '/antecedentes-no-patologicos', label: 'A. No Patológicos', icon: HeartPulse, module: 'antecedentes_pnp' },
  { to: '/antecedentes-heredo-familiares', label: 'A. Heredo Familiares', icon: FileText, module: 'antecedentes_hf' },
  { to: '/usuarios', label: 'Usuarios', icon: Users, module: 'usuarios' },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const permissions = useAuthStore((s) => s.permissions)

  const visibleItems = navItems.filter((item) => {
    const perm = permissions?.[item.module]
    return perm?.lectura
  })

  return (
    <aside
      className={clsx(
        'bg-slate-900 text-white flex flex-col transition-all duration-300 min-h-screen',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-white/10">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-primary-light" />
            <div>
              <h1 className="text-sm font-semibold leading-tight">Historia Clínica</h1>
              <p className="text-[10px] text-slate-400">Pediátrica</p>
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 space-y-1 px-2">
        {visibleItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-primary text-white shadow-lg shadow-primary/30'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              )
            }
            title={collapsed ? label : undefined}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-white/10">
          <p className="text-[10px] text-slate-500">v1.0.0</p>
        </div>
      )}
    </aside>
  )
}
