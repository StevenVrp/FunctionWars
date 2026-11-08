import type { Saved } from '../data/storage'
export function LoadSaved({
  items,
  load,
  disabled = false,
}: {
  items: Saved[]
  load: (item: Saved) => void
  disabled?: boolean
}) {
  return items.length ? (
    <select
      aria-label="Load saved weapon"
      value=""
      disabled={disabled}
      onChange={(e) => {
        const s = items.find((s) => s.id === e.target.value)
        if (s) load(s)
      }}
    >
      <option value="">Load saved weapon</option>
      {items.map((s) => (
        <option value={s.id} key={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  ) : null
}
