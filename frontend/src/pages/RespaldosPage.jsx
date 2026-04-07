import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { HardDrive, CloudUpload, CloudDownload, Globe, AlertTriangle, Check, Loader2 } from 'lucide-react'
import api from '../lib/api'
import toast from 'react-hot-toast'
import clsx from 'clsx'

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

const STEPS = {
  backup: [
    'Creando snapshot de la base de datos...',
    'Comprimiendo y preparando archivo...',
    'Subiendo a Amazon S3...',
    'Registrando respaldo...',
  ],
  restore: [
    'Conectando con Amazon S3...',
    'Descargando respaldo...',
    'Validando integridad del archivo...',
    'Creando copia de seguridad local...',
    'Reemplazando base de datos...',
  ],
  install: [
    'Descargando archivo desde la URL...',
    'Validando que sea una base de datos válida...',
    'Creando copia de seguridad local...',
    'Instalando nueva base de datos...',
  ],
}

function ProgressOverlay({ type, onCancel }) {
  const steps = STEPS[type] || []
  const [currentStep, setCurrentStep] = useState(0)
  const intervalRef = useRef(null)

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setCurrentStep((prev) => (prev < steps.length - 1 ? prev + 1 : prev))
    }, 2500)
    return () => clearInterval(intervalRef.current)
  }, [steps.length])

  const progress = Math.min(((currentStep + 1) / steps.length) * 100, 95)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-center gap-3 mb-4">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {type === 'backup' ? 'Creando respaldo' : type === 'restore' ? 'Restaurando' : 'Instalando'}
          </h3>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-primary rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Steps */}
        <div className="space-y-1.5">
          {steps.map((step, idx) => (
            <div key={idx} className="flex items-center gap-2">
              {idx < currentStep ? (
                <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
              ) : idx === currentStep ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
              ) : (
                <div className="w-3.5 h-3.5 rounded-full border border-slate-200 dark:border-slate-600 shrink-0" />
              )}
              <span className={clsx(
                'text-xs',
                idx < currentStep ? 'text-green-600 dark:text-green-400' :
                idx === currentStep ? 'text-slate-800 dark:text-slate-100 font-medium' :
                'text-slate-400 dark:text-slate-500'
              )}>
                {step}
              </span>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-4 text-center">
          No cierres esta ventana ni el navegador
        </p>
      </div>
    </div>
  )
}

export default function RespaldosPage() {
  const queryClient = useQueryClient()
  const [installUrl, setInstallUrl] = useState('')
  const [confirmRestore, setConfirmRestore] = useState(false)
  const [confirmInstall, setConfirmInstall] = useState(false)

  // ── Queries ──
  const { data: status, isLoading: loadingStatus } = useQuery({
    queryKey: ['respaldos', 'status'],
    queryFn: () => api.get('/respaldos/status').then((r) => r.data),
  })

  const { data: ultimo } = useQuery({
    queryKey: ['respaldos', 'ultimo'],
    queryFn: () => api.get('/respaldos/ultimo').then((r) => r.data),
  })

  // ── Mutations ──
  const backupMutation = useMutation({
    mutationFn: () => api.post('/respaldos/backup'),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['respaldos'] })
      toast.success(`Respaldo creado: ${res.data.nombre_archivo}`)
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Error al crear respaldo'),
  })

  const restoreMutation = useMutation({
    mutationFn: () => api.post('/respaldos/restaurar'),
    onSuccess: (res) => {
      toast.success(res.data.message)
      setConfirmRestore(false)
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Error al restaurar'),
  })

  const installMutation = useMutation({
    mutationFn: (url) => api.post('/respaldos/instalar', { url }),
    onSuccess: (res) => {
      toast.success(res.data.message)
      setInstallUrl('')
      setConfirmInstall(false)
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Error al instalar'),
  })

  const anyPending = backupMutation.isPending || restoreMutation.isPending || installMutation.isPending
  const activeType = backupMutation.isPending ? 'backup' : restoreMutation.isPending ? 'restore' : installMutation.isPending ? 'install' : null

  if (loadingStatus) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    )
  }

  const s3Ready = status?.configured

  return (
    <>
      {/* Progress overlay */}
      {anyPending && <ProgressOverlay type={activeType} />}

      <div className={clsx('space-y-6', anyPending && 'pointer-events-none opacity-50')}>
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
            <HardDrive className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Respaldos</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Gestión de copias de seguridad de la base de datos</p>
          </div>
        </div>

        {/* S3 not configured warning */}
        {!s3Ready && (
          <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Respaldo a S3 no configurado</p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Agrega las siguientes variables al archivo <code className="bg-amber-100 dark:bg-amber-800/40 px-1 rounded">.env</code> y reinicia el servidor:
              </p>
              {status?.missing?.length > 0 && (
                <ul className="mt-1.5 space-y-0.5">
                  {status.missing.map((m) => (
                    <li key={m} className="text-xs text-amber-700 dark:text-amber-300 font-mono">• {m}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* ── Section 1: Backup ── */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <CloudUpload className="w-4 h-4 text-blue-500" />
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Respaldar a S3</h3>
            </div>

            {/* Last backup info */}
            {ultimo?.exists ? (
              <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <p className="text-[12px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Último respaldo</p>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{ultimo.nombre_archivo}</p>
                <div className="flex gap-4 mt-1">
                  <span className="text-xs text-slate-500 dark:text-slate-400">{ultimo.fecha_respaldo}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{formatBytes(ultimo.tamano_bytes)}</span>
                </div>
              </div>
            ) : (
              <p className="mb-4 text-xs text-slate-400 dark:text-slate-500">No hay respaldos registrados aún.</p>
            )}

            <button
              onClick={() => backupMutation.mutate()}
              disabled={!s3Ready || anyPending}
              className={clsx(
                'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors',
                s3Ready && !anyPending
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
              )}
            >
              <CloudUpload className="w-4 h-4" /> Respaldar ahora
            </button>

            {s3Ready && (
              <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500 text-center">
                Bucket: {status.bucket} / {status.prefix}
              </p>
            )}
          </div>

          {/* ── Section 2: Restore ── */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <CloudDownload className="w-4 h-4 text-green-500" />
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Restaurar último respaldo</h3>
            </div>

            {ultimo?.exists ? (
              <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{ultimo.nombre_archivo}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{ultimo.fecha_respaldo} — {formatBytes(ultimo.tamano_bytes)}</p>
              </div>
            ) : (
              <p className="mb-4 text-xs text-slate-400 dark:text-slate-500">No hay respaldos para restaurar.</p>
            )}

            {!confirmRestore ? (
              <button
                onClick={() => setConfirmRestore(true)}
                disabled={!s3Ready || !ultimo?.exists || anyPending}
                className={clsx(
                  'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors',
                  s3Ready && ultimo?.exists && !anyPending
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                )}
              >
                <CloudDownload className="w-4 h-4" /> Restaurar
              </button>
            ) : (
              <div className="space-y-2">
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <p className="text-xs font-semibold text-red-700 dark:text-red-400">
                    Esto reemplazará la base de datos actual con el último respaldo.
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    Se creará una copia de seguridad local antes de reemplazar. Deberás reiniciar el servidor después.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => restoreMutation.mutate()}
                    disabled={anyPending}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors"
                  >
                    <Check className="w-4 h-4" /> Confirmar restauración
                  </button>
                  <button
                    onClick={() => setConfirmRestore(false)}
                    className="px-4 py-2 rounded-lg text-sm font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Section 3: Install from URL ── */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-4 h-4 text-purple-500" />
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Instalar desde la nube</h3>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 ml-1">— para migrar a otra máquina</span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            Pega la URL que te proporcionó el administrador del sistema para instalar una copia de la base de datos.
          </p>

          <div className="flex gap-2">
            <input
              type="text"
              value={installUrl}
              onChange={(e) => setInstallUrl(e.target.value)}
              placeholder="https://...presigned-url..."
              disabled={anyPending}
              className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-slate-100 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
            />
            {!confirmInstall ? (
              <button
                onClick={() => {
                  if (!installUrl.trim().startsWith('https://')) {
                    toast.error('La URL debe empezar con https://')
                    return
                  }
                  setConfirmInstall(true)
                }}
                disabled={!installUrl.trim() || anyPending}
                className={clsx(
                  'px-4 py-2 rounded-lg text-sm font-semibold transition-colors shrink-0',
                  installUrl.trim() && !anyPending
                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                )}
              >
                Instalar
              </button>
            ) : null}
          </div>

          {confirmInstall && (
            <div className="mt-3 space-y-2">
              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-xs font-semibold text-red-700 dark:text-red-400">
                  Esto reemplazará TODA la base de datos actual con el archivo de la URL.
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  Se creará una copia de seguridad local antes. Deberás reiniciar el servidor después.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => installMutation.mutate(installUrl.trim())}
                  disabled={anyPending}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors"
                >
                  <Check className="w-4 h-4" /> Confirmar instalación
                </button>
                <button
                  onClick={() => setConfirmInstall(false)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
