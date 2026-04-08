import { useCallback, useRef, useState } from 'react';

interface UndoAction {
  tableName: string;
  type: 'update' | 'create' | 'delete';
  id: string;
  /** For update: previous cell values. For delete: entire row data. */
  prevData: Record<string, unknown>;
  /** For update: new cell values. For create: entire row data. */
  nextData: Record<string, unknown>;
}

const MAX_HISTORY = 50;

export function useUndoRedo() {
  const undoStack = useRef<UndoAction[]>([]);
  const redoStack = useRef<UndoAction[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const pushAction = useCallback((action: UndoAction) => {
    undoStack.current.push(action);
    if (undoStack.current.length > MAX_HISTORY) {
      undoStack.current.shift();
    }
    redoStack.current = []; // clear redo on new action
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const undo = useCallback(
    async (
      applyFn: (action: UndoAction, direction: 'undo') => Promise<void>,
    ) => {
      const action = undoStack.current.pop();
      if (!action) return;
      await applyFn(action, 'undo');
      redoStack.current.push(action);
      setCanUndo(undoStack.current.length > 0);
      setCanRedo(true);
    },
    [],
  );

  const redo = useCallback(
    async (
      applyFn: (action: UndoAction, direction: 'redo') => Promise<void>,
    ) => {
      const action = redoStack.current.pop();
      if (!action) return;
      await applyFn(action, 'redo');
      undoStack.current.push(action);
      setCanUndo(true);
      setCanRedo(redoStack.current.length > 0);
    },
    [],
  );

  const clear = useCallback(() => {
    undoStack.current = [];
    redoStack.current = [];
    setCanUndo(false);
    setCanRedo(false);
  }, []);

  return { pushAction, undo, redo, clear, canUndo, canRedo };
}

export type { UndoAction };
