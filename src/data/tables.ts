import type { NoteTable } from "./model";
export function validateTables(value: unknown): NoteTable[] {
  const bad = (): never => { throw Error("表の形式が不正です。1つの表は100行・20列までです。"); };
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 50) return bad();
  const tables = value.map(t => {
    if (!t || typeof t.id !== "string" || !t.id || t.id.length > 200 || typeof t.title !== "string" || t.title.length > 200 || !Array.isArray(t.rows) || !t.rows.length || t.rows.length > 100) return bad();
    const cols = t.rows[0]?.length;
    if (!cols || cols > 20) return bad();
    if (!t.rows.every((r: unknown) => Array.isArray(r) && r.length === cols && r.every(c => typeof c === "string" && c.length <= 10000))) return bad();
    return { id: t.id, title: t.title, rows: t.rows } as NoteTable;
  });
  if (new Set(tables.map(t=>t.id)).size !== tables.length) return bad();
  return tables;
}
