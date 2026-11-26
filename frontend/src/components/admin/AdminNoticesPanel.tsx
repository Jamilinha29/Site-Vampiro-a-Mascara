import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'
import { invalidatePlayerPublishedContent } from '../../lib/queryKeys'

export function AdminNoticesPanel() {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const qc = useQueryClient()
  const { data: notices = [] } = useQuery({
    queryKey: ['admin-notices'],
    queryFn: () => api.adminListNotices(),
  })
  const send = useMutation({
    mutationFn: () => api.adminSendNotice({ title: title.trim(), message: message.trim() }),
    onSuccess: () => {
      setTitle('')
      setMessage('')
      void qc.invalidateQueries({ queryKey: ['admin-notices'] })
      invalidatePlayerPublishedContent(qc)
    },
  })

  return (
    <section id="avisos" className="admin-form-panel flex h-full flex-col">
      <p className="font-label-sm text-xs text-secondary uppercase">Avisos aos jogadores</p>
      <p className="text-sm text-on-surface-variant">A mensagem aparece no sino de todos os jogadores.</p>
      <label className="mt-1 block text-xs uppercase text-on-surface-variant">
        Título
        <input className="input-feudal mt-1 pl-4" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="block text-xs uppercase text-on-surface-variant">
        Mensagem
        <textarea
          className="input-feudal textarea-compact mt-1 pl-4"
          value={message}
          maxLength={500}
          onChange={(e) => setMessage(e.target.value)}
        />
      </label>
      <button
        type="button"
        className="btn-primary text-xs"
        disabled={send.isPending || !title.trim() || !message.trim()}
        onClick={() => send.mutate()}
      >
        {send.isPending ? 'Enviando…' : 'Enviar aviso'}
      </button>
      {send.isError ? <p className="text-xs text-primary">{(send.error as Error).message}</p> : null}
      <ul className="mt-2 max-h-72 flex-1 space-y-2 overflow-y-auto">
        {notices.length === 0 ? <li className="text-sm text-on-surface-variant">Nenhum aviso enviado ainda.</li> : null}
        {notices.map((notice) => (
          <li key={notice.id} className="rounded border border-outline-variant/40 px-3 py-2">
            <p className="font-serif text-sm text-on-surface">{notice.title}</p>
            <p className="mt-1 text-xs text-on-surface-variant">{notice.message}</p>
            <p className="mt-1 text-[10px] text-outline">{new Date(notice.createdAt).toLocaleString('pt-BR')}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
