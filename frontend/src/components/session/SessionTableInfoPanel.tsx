import type { SessionTableMeta } from '../../types/chronicle'
import {
  resolveSessionTableMeta,
  SESSION_TABLE_ROWS,
  syncCampaignFields,
  type SessionTableMetaFormOptions,
} from '../../lib/sessionTableMeta'
import type { ScheduledSession } from '../../types/chronicle'

type Props = {
  session: ScheduledSession
  className?: string
}

export function SessionTableInfoPanel({ session, className = '' }: Props) {
  const meta = resolveSessionTableMeta(session)

  return (
    <div className={`overflow-hidden rounded-lg border border-outline-variant/40 bg-surface-container-low/40 ${className}`}>
      <div className="grid gap-0 sm:grid-cols-2">
        {SESSION_TABLE_ROWS.map((row) => {
          const value = meta[row.key] || '—'
          return (
            <div
              key={row.key}
              className="border-b border-outline-variant/30 px-4 py-3 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0"
            >
              <p className="text-[10px] font-semibold tracking-wider text-on-surface-variant uppercase">{row.label}</p>
              <p className="mt-1 text-sm text-on-surface">{value}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function SessionTableMetaForm({
  value,
  onChange,
  columns = 'paired',
  options,
}: {
  value: SessionTableMeta
  onChange: (v: SessionTableMeta) => void
  columns?: 'paired' | 'row'
  options?: SessionTableMetaFormOptions
}) {
  const campaignLocked = options?.campaignLocked ?? false
  const synced = syncCampaignFields(value)

  const fields: {
    key: keyof SessionTableMeta
    label: string
    placeholder: string
    readOnly?: boolean
  }[] = [
    {
      key: 'campaignName',
      label: 'Campanha / RPG',
      placeholder: 'Ex: Beladona Sangrenta',
      readOnly: campaignLocked,
    },
    {
      key: 'sessionLabel',
      label: 'Sessão',
      placeholder: 'Ex: Sessão 1',
      readOnly: options?.sessionLabelReadOnly ?? true,
    },
    { key: 'arcTitle', label: 'Missão (arco)', placeholder: 'Ex: As Cinzas de São Vítor' },
    { key: 'playerGroup', label: 'Grupo', placeholder: 'Ex: 3–5 jogadores' },
  ]

  const gridClass =
    columns === 'row' ? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-4' : 'grid gap-3 sm:grid-cols-2'
  const labelSpan = columns === 'row' ? '' : 'sm:col-span-2'

  function patchField(key: keyof SessionTableMeta, next: string) {
    if (key === 'campaignName') {
      onChange(syncCampaignFields({ ...value, campaignName: next, rpgTitle: next }))
      return
    }
    if (key === 'arcTitle') {
      onChange({ ...value, arcTitle: next, missionTitle: next })
      return
    }
    onChange({ ...value, [key]: next })
  }

  return (
    <div className={gridClass}>
      {fields.map((f) => (
        <label
          key={f.key}
          className={`block text-xs font-semibold tracking-wider text-on-surface-variant uppercase ${labelSpan}`}
        >
          {f.label}
          <input
            className="input-feudal mt-1 pl-4 normal-case disabled:cursor-not-allowed disabled:opacity-70"
            value={(f.key === 'campaignName' ? synced.campaignName : value[f.key]) ?? ''}
            readOnly={f.readOnly}
            onChange={(e) => patchField(f.key, e.target.value)}
            placeholder={f.placeholder}
          />
        </label>
      ))}
      {campaignLocked ? (
        <p className={`text-[11px] text-on-surface-variant ${labelSpan}`}>
          Campanha e RPG ficam fixos após o primeiro registro nesta mesa.
        </p>
      ) : null}
    </div>
  )
}
