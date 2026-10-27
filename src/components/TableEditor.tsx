import { Plus, Trash2 } from "lucide-react";
import type { NoteTable } from "../data/model";
export default function TableEditor({ tables, onChange }: { tables: NoteTable[]; onChange: (tables: NoteTable[]) => void }) {
  const update = (id: string, patch: Partial<NoteTable>) => onChange(tables.map(t=>t.id===id?{...t,...patch}:t));
  return <section className="tables-editor"><div className="section-heading"><h3>表</h3><button type="button" className="text-button" disabled={tables.length>=50} onClick={()=>onChange([...tables,{id:crypto.randomUUID(),title:`表${tables.length+1}`,rows:Array.from({length:3},()=>["",""])}])}><Plus size={17}/>表を挿入</button></div>
    {tables.map(table=><div className="table-editor" key={table.id}>
      <div className="section-heading"><input aria-label="表の名前" maxLength={200} value={table.title} onChange={e=>update(table.id,{title:e.target.value})}/><button type="button" className="icon-button danger" aria-label={`${table.title}を削除`} onClick={()=>{if(confirm("この表を削除しますか？"))onChange(tables.filter(t=>t.id!==table.id));}}><Trash2 size={17}/></button></div>
      <div className="table-scroll" role="region" aria-label={`${table.title}の横スクロール`} tabIndex={0}><table><caption className="sr-only">{table.title}</caption><tbody>{table.rows.map((row,r)=><tr key={r}>{row.map((cell,c)=><td key={c}><input aria-label={`${table.title} 行${r+1} 列${c+1}`} maxLength={10000} value={cell} onChange={e=>update(table.id,{rows:table.rows.map((row,i)=>i===r?row.map((value,j)=>j===c?e.target.value:value):row)})}/></td>)}</tr>)}</tbody></table></div>
      <div className="table-actions"><button type="button" disabled={table.rows.length>=100} onClick={()=>update(table.id,{rows:[...table.rows,table.rows[0].map(()=>"")]})}>行を追加</button><button type="button" disabled={table.rows[0].length>=20} onClick={()=>update(table.id,{rows:table.rows.map(row=>[...row,""])})}>列を追加</button>
      <button type="button" disabled={table.rows.length<=1} onClick={()=>{if(confirm("最後の行を削除しますか？"))update(table.id,{rows:table.rows.slice(0,-1)});}}>最後の行を削除</button><button type="button" disabled={table.rows[0].length<=1} onClick={()=>{if(confirm("最後の列を削除しますか？"))update(table.id,{rows:table.rows.map(row=>row.slice(0,-1))});}}>最後の列を削除</button></div>
    </div>)}
  </section>;
}
