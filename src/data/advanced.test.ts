import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { characterCount, literalMatches, replaceLiteral } from "./text";
import { validateTables } from "./tables";
import { validateAudio, MAX_AUDIO_BYTES } from "./audio";
import { db, initialize, newNote, quickFolder, saveNote, saveRecording, removeNote, restoreNote, permanentlyDeleteNote, backupSnapshot, replaceAll } from "./repository";
import { readBackup, parseBackup } from "./backup";
import { writeDraft, recoverDraft, clearSavedDraft } from "./drafts";
beforeEach(async()=>{await db.delete();await db.open();await initialize();});
afterEach(()=>vi.unstubAllGlobals());
it("counts graphemes and replaces literal strings without regex or replacement expansion",()=>{
  expect(characterCount("家族👨‍👩‍👧‍👦e\u0301")).toBe(4);
  expect(literalMatches("a.a a.a","a.a")).toEqual([[0,3],[4,7]]);
  expect(replaceLiteral("a.a a.a","a.a","$&")).toBe("$& $&");
  expect(replaceLiteral("本文","","消す")).toBe("本文");
});
it("validates rectangular tables and preserves text as plain strings",()=>{
  expect(validateTables([{id:"t",title:"表",rows:[["<script>","値"]]}])[0].rows[0][0]).toBe("<script>");
  for(const rows of [[],[["a"],["b","c"]],Array.from({length:101},()=>[""])]) expect(()=>validateTables([{id:"t",title:"表",rows}])).toThrow();
});
const audioBlob=()=>new Blob([new Uint8Array([0x1a,0x45,0xdf,0xa3,1,2,3,4,5,6,7,8])],{type:"audio/webm"});
it("rejects mislabeled or oversized audio",async()=>{
  await expect(validateAudio(audioBlob(),"audio/webm")).resolves.toBeUndefined();
  await expect(validateAudio(new Blob(["<html>unsafe</html>"],{type:"audio/webm"}),"audio/webm")).rejects.toThrow();
  await expect(validateAudio(new Blob([new Uint8Array(MAX_AUDIO_BYTES+1)],{type:"audio/webm"}),"audio/webm")).rejects.toThrow();
});
it("restores recording bytes and tables from backup, retains them in trash, and rolls back invalid replacement",async()=>{
  const note={...newNote(await quickFolder()),tables:[{id:"t",title:"旅費",rows:[["交通費","1000"]]}]}; await saveNote(note);
  const audio={id:"r",noteId:note.id,blob:audioBlob(),mimeType:"audio/webm",durationSeconds:1,createdAt:note.createdAt,name:"テスト音声"};
  await saveRecording(audio);
  const original=await backupSnapshot();
  const bytes=btoa(String.fromCharCode(...new Uint8Array(await audio.blob.arrayBuffer())));
  const raw={format:"my-memo",version:3,exportedAt:note.createdAt,...original,recordings:[{...audio,blob:undefined,dataUrl:`data:audio/webm;base64,${bytes}`}]};
  const restored=await readBackup(new File([JSON.stringify(raw)],"backup.json"));
  await replaceAll(restored);
  expect((await db.notes.get(note.id))?.tables).toEqual(note.tables);
  expect(await (await db.recordings.get("r"))!.blob.arrayBuffer()).toEqual(await audio.blob.arrayBuffer());
  await expect(replaceAll({...restored,recordings:[audio,audio]})).rejects.toThrow(); expect(await db.recordings.count()).toBe(1);
  await removeNote(note.id); expect(await db.recordings.count()).toBe(1);
  await restoreNote(note.id); expect(await db.recordings.count()).toBe(1);
  await removeNote(note.id); await permanentlyDeleteNote(note.id); expect(await db.recordings.count()).toBe(0);
  expect(()=>parseBackup({...raw,recordings:[{...raw.recordings[0],noteId:"missing"}]})).toThrow();
});
it("recovers only matching-base drafts and never erases a newer in-flight draft",async()=>{
  const store=new Map<string,string>();
  vi.stubGlobal("localStorage",{getItem:(k:string)=>store.get(k)||null,setItem:(k:string,v:string)=>store.set(k,v),removeItem:(k:string)=>store.delete(k)});
  const folder=await quickFolder(), base=newNote(folder), draft={...base,body:"未保存の本文"};
  writeDraft(draft,base); expect(recoverDraft(base,[folder])?.body).toBe("未保存の本文");
  expect(recoverDraft({...base,body:"別の編集"},[folder])).toBeNull();
  clearSavedDraft(base); expect(store.size).toBe(1);
  clearSavedDraft(draft); expect(store.size).toBe(0);
});
