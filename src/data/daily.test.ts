import "fake-indexeddb/auto";
import {beforeEach,it,expect} from 'vitest';
import {db,initialize,quickFolder,newNote,saveNote,claimDueReminders,removeNote,restoreNote,replaceAll} from './repository';
import {createSearchIndex,searchNotes} from './search';
import {exportBackup,readBackup} from './backup';
import {validateNoteReminder} from './noteReminders';
beforeEach(async()=>{await db.delete();await db.open();await initialize();});
it('notifies a note once, persists status and reschedules independently of checklist data',async()=>{
 const n={...newNote(await quickFolder()),title:'見返す',noteReminder:{id:'r1',at:'2030-01-01T09:00:00Z'},todos:[{id:'t',text:'保持する',done:false}]};await saveNote(n);
 const at=Date.parse(n.noteReminder.at);expect(await claimDueReminders(at-1)).toHaveLength(0);const due=await claimDueReminders(at);expect(due[0].kind).toBe('note');expect(await claimDueReminders(at)).toHaveLength(0);
 const saved=(await db.notes.get(n.id))!;expect(saved.noteReminder?.notifiedAt).toBeTruthy();expect(saved.todos).toEqual(n.todos);
 await saveNote({...n,body:'通知前に開いた古いスナップショットの編集'});expect((await db.notes.get(n.id))?.noteReminder?.notifiedAt).toBeTruthy();
 await saveNote({...saved,noteReminder:{id:'r2',at:'2030-01-02T09:00:00Z'}});await removeNote(n.id);expect(await claimDueReminders(at+86400000)).toHaveLength(0);await restoreNote(n.id);expect(await claimDueReminders(at+86400000)).toHaveLength(1);
 await saveNote({...saved,noteReminder:undefined});expect(await claimDueReminders(at+86400000)).toHaveLength(0);
});
it('backs up note reminder schedules and delivered state; rejects malformed schedules',async()=>{
 const n={...newNote(await quickFolder()),noteReminder:{id:'r',at:'2030-01-01T09:00:00Z'}};await saveNote(n);await claimDueReminders(Date.parse(n.noteReminder.at));
 const backup=await readBackup(new File([await(await exportBackup()).text()],'backup.json'));await replaceAll(backup);expect((await db.notes.get(n.id))?.noteReminder?.notifiedAt).toBeTruthy();expect(await claimDueReminders(Date.parse(n.noteReminder.at))).toHaveLength(0);
 for(const bad of [null,{id:'',at:n.noteReminder.at},{id:'r',at:'wrong'},{id:'r',at:n.noteReminder.at,notifiedAt:'bad'}])expect(()=>validateNoteReminder(bad)).toThrow();
});
it('reuses a normalized search index with the same results for 5000 notes and rebuilds after edits',async()=>{
 const base=newNote(await quickFolder());const notes=Array.from({length:5000},(_,i)=>({...base,id:String(i),title:`計画 ${i}`,body:`旅行 ＡＢＣ ${i%2?'京都':'東京'}`,links:[{id:'l',url:`https://example.com/${i}`,title:'記事',tags:[]}]}));const index=createSearchIndex(notes);
 for(const q of ['abc 京都','https://example.com/3456','計画 123','ない言葉',''])expect(index(q).map(n=>n.id)).toEqual(searchNotes(notes,q).map(n=>n.id));
 const changed=notes.map(n=>n.id==='1'?{...n,title:'更新したメモ'}:n);expect(createSearchIndex(changed)('更新したメモ')[0].id).toBe('1');
});
it('upgrades v7 without modifying existing notes, colors, folders or attachments',async()=>{
 const Dexie=(await import('dexie')).default;const {MemoDatabase}=await import('./repository');const name='daily-upgrade-v8',old=new Dexie(name);
 old.version(7).stores({categories:'id',folders:'id, categoryId, order, deletedAt',notes:'id, categoryId, folderId, updatedAt, deletedAt, lastOpenedAt, backgroundColor',attachments:'id, noteId, createdAt',recordings:'id, noteId, createdAt',reminderReceipts:'id, noteId'});
 const n={id:'n',title:'既存',body:'そのまま',backgroundColor:'yellow',folderId:'f',categoryId:'money'};await old.table('notes').put(n);await old.table('folders').put({id:'f',name:'元の分類'});await old.table('attachments').put({id:'a',noteId:'n',blob:new Blob(['original'])});old.close();const next=new MemoDatabase(name);await next.open();expect(await next.notes.get('n')).toEqual(n);expect((await next.folders.get('f'))?.name).toBe('元の分類');expect(await (await next.attachments.get('a'))?.blob.text()).toBe('original');await next.delete();
});
