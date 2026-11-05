import type { Note } from "./model";
export type EditCursor = {
  field: "title" | "body";
  start: number;
  end: number;
  direction: "forward" | "backward" | "none";
  scroll: number;
};
export type EditState = Pick<Note, "title" | "body"> & {
  bodyColors: NonNullable<Note["bodyColors"]>;
  cursor: EditCursor;
};
type Step = { before: EditState; after: EditState; kind: string; at: number };
const sameText = (a: EditState, b: EditState) =>
  a.title === b.title &&
  a.body === b.body &&
  JSON.stringify(a.bodyColors) === JSON.stringify(b.bodyColors);
const sameCursor = (a: EditCursor, b: EditCursor) =>
  a.field === b.field && a.start === b.start && a.end === b.end;
// One history owns textarea text AND its external color ranges. Native history
// cannot restore those ranges, so native Undo/Redo events are routed here too.
export class EditHistory {
  private past: Step[] = [];
  private future: Step[] = [];
  private group = false;
  get canUndo() {
    return this.past.length > 0;
  }
  get canRedo() {
    return this.future.length > 0;
  }
  breakGroup() {
    this.group = false;
  }
  record(before: EditState, after: EditState, kind: string, at = Date.now()) {
    if (sameText(before, after)) return;
    const previous = this.past.at(-1);
    const mergeable =
      ["insertText", "deleteContentBackward", "deleteContentForward"].includes(
        kind,
      ) &&
      before.cursor.start === before.cursor.end &&
      after.cursor.start === after.cursor.end &&
      !before[before.cursor.field]
        .slice(
          Math.min(before.cursor.start, after.cursor.start),
          Math.max(before.cursor.start, after.cursor.start),
        )
        .includes("\n") &&
      !after[after.cursor.field]
        .slice(
          Math.min(before.cursor.start, after.cursor.start),
          Math.max(before.cursor.start, after.cursor.start),
        )
        .includes("\n");
    if (
      mergeable &&
      this.group &&
      previous &&
      previous.kind === kind &&
      at - previous.at <= 1000 &&
      at >= previous.at &&
      sameText(previous.after, before) &&
      sameCursor(previous.after.cursor, before.cursor)
    ) {
      previous.after = after;
      previous.at = at;
    } else {
      this.past.push({ before, after, kind, at });
      if (this.past.length > 50) this.past.shift();
    }
    this.future = [];
    this.group = mergeable;
  }
  undo() {
    this.breakGroup();
    const step = this.past.pop();
    if (!step) return;
    this.future.push(step);
    return step.before;
  }
  redo() {
    this.breakGroup();
    const step = this.future.pop();
    if (!step) return;
    this.past.push(step);
    return step.after;
  }
}
