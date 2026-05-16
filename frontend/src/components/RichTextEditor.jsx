import { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Bold, Italic, List, ListOrdered } from 'lucide-react'
import clsx from 'clsx'

export default function RichTextEditor({ value, onChange, disabled }) {
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
          'px-2 py-1.5 min-h-[80px]',
          'text-xs text-slate-800 dark:text-slate-100',
          disabled && 'text-slate-500 dark:text-slate-400',
          '[&_.ProseMirror]:outline-none',
          '[&_.ProseMirror]:text-xs [&_.ProseMirror]:leading-relaxed',
          '[&_.ProseMirror_p]:m-0 [&_.ProseMirror_p+p]:mt-1',
          '[&_.ProseMirror_ul]:my-0.5 [&_.ProseMirror_ul]:pl-4 [&_.ProseMirror_ul]:list-disc',
          '[&_.ProseMirror_ol]:my-0.5 [&_.ProseMirror_ol]:pl-4 [&_.ProseMirror_ol]:list-decimal',
          '[&_.ProseMirror_li]:my-0 [&_.ProseMirror_li]:leading-relaxed [&_.ProseMirror_li]:list-item',
          '[&_.ProseMirror_strong]:font-semibold',
          '[&_.ProseMirror_em]:italic',
        )}
      />
    </div>
  )
}
