# Cambios pendientes de commit — prompt para aplicar en otro sistema

Tengo un sistema web de historial clínico (React + FastAPI + SQLite). Aplica los siguientes cambios:

---

## 1. CORS — permitir cualquier origen (backend)

En `backend/src/main.py`, cambia `allow_origins` a `["*"]`.

---

## 2. Puerto de API configurable (frontend)

En `frontend/src/lib/api.js`, cambia el `baseURL` para leer una variable de entorno:

```js
baseURL: import.meta.env.DEV
  ? `http://localhost:${import.meta.env.VITE_API_PORT || 8000}/api`
  : '/api',
```

Crea `frontend/.env` con `VITE_API_PORT=8001` (o el puerto que uses).

---

## 3. Dashboard — nueva página y ruta

- Registra el router en `backend/src/routers/__init__.py` y en `backend/src/main.py` con prefijo `/api/dashboard`.
- Crea `frontend/src/pages/DashboardPage.jsx` con KPIs (total pacientes, consultas, medicamentos, diagnósticos), gráficas de barras de consultas y pacientes por mes (últimos 6 meses), tabla de últimas 5 consultas y últimos 5 pacientes.
- En `frontend/src/App.jsx` agrega la ruta `/dashboard` y cambia el redirect de `/` a `/dashboard`.
- En `frontend/src/components/layout/Sidebar.jsx` agrega Dashboard como primer item con el icono `LayoutDashboard` de lucide-react y sin restricción de módulo (`module: null`).

---

## 4. Sidebar — persistir estado colapsado

En `Sidebar.jsx`, cambia el `useState` del collapsed a:

```js
const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === 'true')
```

Y en el botón de toggle:

```js
onClick={() => { const next = !collapsed; setCollapsed(next); localStorage.setItem('sidebar_collapsed', next) }}
```

---

## 5. Tabla de pacientes — nombre clickeable

En `PacientesPage.jsx`, en la celda del nombre del paciente agrega `onClick` para navegar al detalle:

```jsx
<p className="... cursor-pointer hover:text-primary transition-colors"
   onClick={() => navigate(`/pacientes/${pac.id}`)}>
  {pac.nombre} {pac.apellido_paterno} {pac.apellido_materno}
</p>
```

---

## 6. Crear paciente — redirigir al detalle

En `PacientesPage.jsx`, en el `onSuccess` del mutation de guardar paciente, si es creación nueva navegar al detalle:

```js
onSuccess: (res) => {
  queryClient.invalidateQueries({ queryKey: ['pacientes'] })
  if (editing) {
    toast.success('Paciente actualizado')
    closeForm()
  } else {
    toast.success('Paciente creado')
    closeForm()
    navigate(`/pacientes/${res.data.id}`)
  }
},
```

---

## 7. Detalle del paciente — página completa refactorizada (`PacienteDetallePage.jsx`)

### a) Orden de tabs

```js
const TABS = [
  { id: 'info', label: 'Datos del Paciente', icon: Baby },
  { id: 'heredo_familiares', label: 'Heredo Familiares', icon: Users },
  { id: 'no_patologicos', label: 'No Patológicos', icon: HeartPulse },
  { id: 'patologicos', label: 'Patológicos', icon: ClipboardList },
  { id: 'consultas', label: 'Historial', icon: Stethoscope },
]
```

### b) Estilo de tabs — icono arriba, texto abajo, borde superior en activo, scroll horizontal en móvil

```jsx
<div className="flex bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-xl overflow-x-auto scrollbar-none">
  {TABS.map(({ id: tabId, label, icon: Icon }, idx) => (
    <button key={tabId} onClick={() => setActiveTab(tabId)}
      className={clsx(
        'flex flex-col items-center justify-center gap-1 py-3 px-3 sm:flex-1 transition-all relative text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap shrink-0 min-w-[72px]',
        idx !== 0 && 'border-l border-slate-200 dark:border-slate-700',
        activeTab === tabId
          ? 'text-primary bg-white dark:bg-slate-800'
          : 'text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300'
      )}>
      {activeTab === tabId && <span className="absolute top-0 left-0 right-0 h-0.5 bg-primary rounded-b" />}
      <Icon className={clsx('w-5 h-5', activeTab === tabId ? 'text-primary' : 'text-slate-400 dark:text-slate-500')} />
      <span>{label}</span>
    </button>
  ))}
</div>
```

### c) Modo edición global

- Botón "Editar" en el header del paciente activa edición de todos los tabs simultáneamente.
- Botones "Cancelar" y "Guardar todo" en el header.
- Usar `forwardRef` + `useImperativeHandle` en cada tab para exponer `save()` y `cancel()`.
- En el componente principal usar `Promise.allSettled` para guardar todos en paralelo.

### d) Tabs siempre montados

Usar `className={activeTab === 'X' ? '' : 'hidden'}` en lugar de renderizado condicional, para preservar estado al cambiar de tab.

### e) ConsultaDetailContent — mostrar plan_tratamiento y notas_adicionales como HTML

```jsx
{c.plan_tratamiento && (
  <div>
    <h5 className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Plan de Tratamiento</h5>
    <p className="text-sm text-slate-700 dark:text-slate-200 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100 dark:border-blue-800 whitespace-pre-wrap">{c.plan_tratamiento}</p>
  </div>
)}
{c.notas_adicionales && (
  <div>
    <h5 className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Indicaciones y comentarios</h5>
    <div
      className="text-sm text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-700/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700 prose prose-xs dark:prose-invert max-w-none [&_p]:my-0.5 [&_ul]:my-0.5 [&_ol]:my-0.5 [&_ul]:pl-4 [&_ol]:pl-4 [&_li]:my-0"
      dangerouslySetInnerHTML={{ __html: c.notas_adicionales }}
    />
  </div>
)}
```

### f) Inmunizaciones — dos columnas en desktop, una en móvil

- Esquema nacional vigente (14 vacunas) y esquema anterior como tablas de checkboxes compactas (`py-1.5`, `w-4 h-4`).
- En desktop (`md:`) se dividen en dos mitades lado a lado con divisor vertical.
- En móvil una sola columna con borde inferior entre mitades.
- "Otras vacunas registradas" también en grid `grid-cols-1 md:grid-cols-2`.

```jsx
<div className="grid grid-cols-1 md:grid-cols-2 md:divide-x divide-slate-100 dark:divide-slate-700 overflow-x-auto">
  <div className="md:border-b-0 border-b border-slate-100 dark:border-slate-700">{renderSubTable(colA)}</div>
  <div>{renderSubTable(colB)}</div>
</div>
```

### g) Formulario no patológicos — grid compacto de 4 columnas

- Inputs `text-xs py-1.5 rounded-lg`, labels `text-[10px] uppercase`.
- Grid de 4 columnas: `grid-cols-2 sm:grid-cols-4`.
- Checkboxes (Seno Materno, Respiró, Lloró) inline en la misma fila que el campo Desarrollo Psicomotor.

---

## 8. Editor de texto enriquecido en consulta (`ConsultaDetallePage.jsx`)

### a) Instalar dependencias

```bash
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @tailwindcss/typography
```

### b) Activar plugin en `tailwind.config.js`

```js
plugins: [require('@tailwindcss/typography')],
```

### c) Componente `RichTextEditor`

Agregar al inicio del archivo (antes del componente de página). Toolbar con negrita, cursiva, lista de viñetas y lista numerada. Guarda HTML. Sincroniza editable/contenido cuando cambia `disabled` o `value`.

```jsx
function RichTextEditor({ value, onChange, disabled }) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value || '',
    editable: !disabled,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  useEffect(() => {
    if (editor) editor.setEditable(!disabled)
  }, [editor, disabled])

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '')
    }
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!editor) return null

  return (
    <div className={clsx(
      'rounded-lg border text-xs transition-colors',
      disabled
        ? 'border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800'
        : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary'
    )}>
      {!disabled && (
        <div className="flex items-center gap-0.5 px-2 py-1 border-b border-slate-100 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 rounded-t-lg">
          {[
            { action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold'), Icon: Bold, title: 'Negrita' },
            { action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic'), Icon: Italic, title: 'Cursiva' },
            { action: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive('bulletList'), Icon: List, title: 'Lista' },
            { action: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive('orderedList'), Icon: ListOrdered, title: 'Lista numerada' },
          ].map(({ action, active, Icon, title }) => (
            <button key={title} type="button" onClick={action} title={title}
              className={clsx('p-1 rounded transition-colors', active
                ? 'bg-primary text-white'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600')}>
              <Icon className="w-3 h-3" />
            </button>
          ))}
        </div>
      )}
      <EditorContent
        editor={editor}
        className={clsx(
          'prose prose-xs max-w-none px-2 py-1.5 min-h-[80px] dark:prose-invert focus:outline-none',
          '[&_.ProseMirror]:outline-none',
          '[&_.ProseMirror_p]:my-0.5 [&_.ProseMirror_ul]:my-0.5 [&_.ProseMirror_ol]:my-0.5',
          '[&_.ProseMirror_ul]:pl-4 [&_.ProseMirror_ol]:pl-4',
          '[&_.ProseMirror_li]:my-0',
          disabled && 'text-slate-500 dark:text-slate-400',
        )}
      />
    </div>
  )
}
```

### d) Función `htmlToLines` para PDF

```js
function htmlToLines(html) {
  if (!html) return []
  const text = html
    .replace(/<li[^>]*>/gi, '\x00• ')
    .replace(/<\/li>/gi, '\x00')
    .replace(/<br\s*\/?>/gi, '\x00')
    .replace(/<\/p>/gi, '\x00').replace(/<p[^>]*>/gi, '')
    .replace(/<\/?(strong|b|em|i|ul|ol)[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
  return text.split('\x00').map((l) => l.trim()).filter(Boolean)
}
```

### e) Quitar textarea "Notas adicionales"

Eliminar el bloque del textarea `notas_adicionales` del card "Diagnóstico y plan".

### f) Nuevo card "Indicaciones y comentarios" debajo de medicamentos

```jsx
<div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-4">
  <div className="flex items-center gap-2 mb-2">
    <NotebookPen className="w-4 h-4 text-slate-400 dark:text-slate-500" />
    <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200">Indicaciones y comentarios</h3>
    <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-1">— aparecen en la receta</span>
  </div>
  <RichTextEditor
    value={form.notas_adicionales}
    onChange={(v) => updateField('notas_adicionales', v)}
    disabled={disabled}
  />
</div>
```

### g) Formato de fecha en PDF

```js
const formatFechaReceta = (fecha) => {
  if (!fecha) return '—'
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const d = new Date(fecha + 'T00:00:00')
  return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`
}
```

### h) Indicaciones en `generateRecetaPDF` — sin título, espaciado compacto

Después del bloque de medicamentos y plan de tratamiento, agregar:

```js
const notasLines = htmlToLines(form.notas_adicionales)
if (notasLines.length > 0) {
  if (y > ph - mb - 10) { doc.addPage(); y = mt }
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  for (const line of notasLines) {
    if (y > ph - mb - 4) break
    const wrapped = doc.splitTextToSize(line, cw)
    doc.text(wrapped, ml, y)
    y += wrapped.length * 4.5
  }
}
```
