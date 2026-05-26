/**
 * Undo/Redo manager for admin mode.
 *
 * Uses the Command pattern: each action records what collection was affected,
 * the before/after states, and a human-readable label. Firebase writes are
 * performed by the manager itself when undoing/redoing.
 */
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

export interface UndoAction {
  type: 'create' | 'update' | 'delete';
  collection: string;             // Firestore collection name
  id: string;                     // document id
  before: Record<string, any> | null;  // null for create
  after: Record<string, any> | null;   // null for delete
  label: string;                  // e.g. "Move wall", "Delete box"
  timestamp: number;              // Date.now()
}

class UndoManager {
  private undoStack: UndoAction[] = [];
  private redoStack: UndoAction[] = [];
  private maxSize = 50;
  private _onChange: (() => void) | null = null;

  /** Subscribe to stack changes (call from React to trigger re-renders) */
  subscribe(cb: () => void) { this._onChange = cb; }
  private notify() { this._onChange?.(); }

  // ---- Push actions ----

  /** Push a discrete action (add, delete, single transform end). Clears redo. */
  push(action: UndoAction) {
    this.undoStack.push(action);
    if (this.undoStack.length > this.maxSize) this.undoStack.shift();
    this.redoStack = [];
    this.notify();
  }

  /**
   * Push-or-merge for rapid continuous changes (gizmo scrubbers, editor saves).
   * If the top of the stack is an update to the same object within 2s, merge
   * by keeping the original `before` and updating `after`.
   */
  pushMerge(action: UndoAction) {
    const last = this.undoStack[this.undoStack.length - 1];
    if (
      last &&
      last.type === 'update' &&
      action.type === 'update' &&
      last.collection === action.collection &&
      last.id === action.id &&
      action.timestamp - last.timestamp < 2000
    ) {
      last.after = action.after;
      last.timestamp = action.timestamp;
      last.label = action.label;
    } else {
      this.undoStack.push(action);
      if (this.undoStack.length > this.maxSize) this.undoStack.shift();
    }
    this.redoStack = [];
    this.notify();
  }

  // ---- Queries ----

  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }
  get undoLabel() { return this.undoStack[this.undoStack.length - 1]?.label ?? null; }
  get redoLabel() { return this.redoStack[this.redoStack.length - 1]?.label ?? null; }
  get undoCount() { return this.undoStack.length; }
  get redoCount() { return this.redoStack.length; }

  // ---- Undo / Redo ----

  async undo(db: Firestore): Promise<UndoAction | null> {
    const action = this.undoStack.pop();
    if (!action) return null;

    switch (action.type) {
      case 'create':
        await deleteDoc(doc(db, action.collection, action.id));
        break;
      case 'update':
        if (action.before) await setDoc(doc(db, action.collection, action.id), action.before);
        break;
      case 'delete':
        if (action.before) await setDoc(doc(db, action.collection, action.id), action.before);
        break;
    }

    this.redoStack.push(action);
    this.notify();
    return action;
  }

  async redo(db: Firestore): Promise<UndoAction | null> {
    const action = this.redoStack.pop();
    if (!action) return null;

    switch (action.type) {
      case 'create':
        if (action.after) await setDoc(doc(db, action.collection, action.id), action.after);
        break;
      case 'update':
        if (action.after) await setDoc(doc(db, action.collection, action.id), action.after);
        break;
      case 'delete':
        await deleteDoc(doc(db, action.collection, action.id));
        break;
    }

    this.undoStack.push(action);
    this.notify();
    return action;
  }

  /** Clear all history */
  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }
}

/** Singleton instance shared across the app */
export const undoManager = new UndoManager();
