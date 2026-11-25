export function GraphReference({
  label,
  value,
  items,
  onChange,
}: {
  label: string;
  value: string;
  items: { id: string; name?: string }[];
  onChange: (id: string) => void;
}) {
  return (
    <label>
      {label}
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">断开 · 待连接</option>
        {value && !items.some((item) => item.id === value) && (
          <option value={value}>{value} · 引用缺失</option>
        )}
        {items.map((item) => (
          <option value={item.id} key={item.id}>
            {item.name ?? item.id}
          </option>
        ))}
      </select>
    </label>
  );
}
