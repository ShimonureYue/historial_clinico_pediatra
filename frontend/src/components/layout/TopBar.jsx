import { LogOut, User, Sun, Moon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/auth'
import useThemeStore from '../../store/theme'

export default function TopBar({ title }) {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const dark = useThemeStore((s) => s.dark)
  const toggleTheme = useThemeStore((s) => s.toggle)
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between bg-white dark:bg-slate-800 px-4 py-1.5 border-b border-slate-100 dark:border-slate-700 shadow-sm">
      <h2 className="text-xs font-semibold text-slate-700 dark:text-slate-200">{title}</h2>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          title={dark ? 'Modo claro' : 'Modo oscuro'}
        >
          {dark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </button>

        <div className="flex items-center gap-1.5">
          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary">
            <User className="w-3 h-3" />
          </div>
          <span className="hidden sm:inline text-[11px] font-medium text-slate-600 dark:text-slate-300">{user?.nombre}</span>
          <span className="hidden sm:inline text-[10px] text-slate-400 dark:text-slate-500 capitalize">({user?.rol})</span>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-1 px-2 py-1 text-[11px] text-slate-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 transition-colors"
          title="Cerrar sesión"
        >
          <LogOut className="w-3 h-3" />
          <span className="hidden sm:inline">Salir</span>
        </button>
      </div>
    </header>
  )
}
