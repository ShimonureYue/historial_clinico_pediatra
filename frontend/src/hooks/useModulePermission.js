import useAuthStore from '../store/auth'

export default function useModulePermission(modulo) {
  const permissions = useAuthStore((s) => s.permissions)
  const perm = permissions?.[modulo] || {}

  return {
    canRead: !!perm.lectura,
    canWrite: !!perm.escritura,
    canUpdate: !!perm.actualizacion,
    canDelete: !!perm.eliminacion,
  }
}
