import { create } from 'zustand'
import api from '../lib/api'

const useAuthStore = create((set, get) => ({
  token: localStorage.getItem('pediatrico_token') || null,
  user: JSON.parse(localStorage.getItem('pediatrico_user') || 'null'),
  permissions: JSON.parse(localStorage.getItem('pediatrico_permissions') || '{}'),

  login: async (correo, password) => {
    const { data } = await api.post('/auth/login', { correo, password })
    localStorage.setItem('pediatrico_token', data.access_token)
    localStorage.setItem('pediatrico_user', JSON.stringify(data.user))
    localStorage.setItem('pediatrico_permissions', JSON.stringify(data.permissions))
    set({ token: data.access_token, user: data.user, permissions: data.permissions })
    return data
  },

  logout: () => {
    localStorage.removeItem('pediatrico_token')
    localStorage.removeItem('pediatrico_user')
    localStorage.removeItem('pediatrico_permissions')
    set({ token: null, user: null, permissions: {} })
  },

  isAuthenticated: () => !!get().token,

  hasPermission: (modulo, tipo = 'lectura') => {
    const perms = get().permissions
    if (!perms || !perms[modulo]) return false
    return !!perms[modulo][tipo]
  },
}))

export default useAuthStore
