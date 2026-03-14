import { create } from 'zustand'

const useThemeStore = create((set) => ({
  dark: localStorage.getItem('pediatrico_dark') === 'true',

  toggle: () =>
    set((state) => {
      const next = !state.dark
      localStorage.setItem('pediatrico_dark', String(next))
      document.documentElement.classList.toggle('dark', next)
      return { dark: next }
    }),
}))

// Apply saved preference on load
if (localStorage.getItem('pediatrico_dark') === 'true') {
  document.documentElement.classList.add('dark')
}

export default useThemeStore
