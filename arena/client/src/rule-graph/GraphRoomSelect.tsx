import { useArena } from "../ArenaWorkspace";
export function GraphRoomSelect({
  label,
  value,
  onChange,
  empty = "选择房间",
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  empty?: string;
}) {
  const { snapshot } = useArena();
  const rooms = snapshot?.rooms ?? [];
  return (
    <label>
      {label}
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{empty}</option>
        {value && !rooms.some((r) => r.id === value) && (
          <option value={value}>{value}</option>
        )}
        {rooms.map((room) => (
          <option key={room.id} value={room.id}>
            {room.name}
          </option>
        ))}
      </select>
    </label>
  );
}
