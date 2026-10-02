"use client";

type Column = {
  key: string;
  label: string;
  type?: "text" | "number" | "select";
  options?: string[];
};

type Props = {
  columns: Column[];
  rows: Record<string, unknown>[];
  onChange: (rows: Record<string, unknown>[]) => void;
};

export function EditableTable({ columns, rows, onChange }: Props) {
  function update(i: number, key: string, value: string) {
    const next = rows.map((r, idx) => {
      if (idx !== i) return r;
      const col = columns.find((c) => c.key === key);
      let v: unknown = value;
      if (col?.type === "number") v = value === "" ? 0 : parseFloat(value);
      return { ...r, [key]: v };
    });
    onChange(next);
  }

  function addRow() {
    const blank: Record<string, unknown> = {};
    for (const c of columns) blank[c.key] = c.type === "number" ? 0 : "";
    onChange([...rows, blank]);
  }

  function removeRow(i: number) {
    onChange(rows.filter((_, idx) => idx !== i));
  }

  return (
    <div className="table-wrap">
      <table className="editable">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c.key}>
                  {c.type === "select" ? (
                    <select
                      value={String(row[c.key] ?? "")}
                      onChange={(e) => update(i, c.key, e.target.value)}
                    >
                      {(c.options ?? []).map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={c.type === "number" ? "number" : "text"}
                      step={c.type === "number" ? "0.5" : undefined}
                      value={String(row[c.key] ?? "")}
                      onChange={(e) => update(i, c.key, e.target.value)}
                    />
                  )}
                </td>
              ))}
              <td>
                <button type="button" className="btn secondary" onClick={() => removeRow(i)}>
                  삭제
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row-actions">
        <button type="button" className="btn secondary" onClick={addRow}>
          행 추가
        </button>
      </div>
    </div>
  );
}
