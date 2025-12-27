/** undo/redo対応の履歴構造 */
export type History<T> = {
  past: T[];
  present: T;
  future: T[];
};

/** 履歴を初期化する */
export function createHistory<T>(initial: T): History<T> {
  return {
    past: [],
    present: initial,
    future: [],
  };
}

/** 新しい状態を追加し、redo履歴を破棄する */
export function pushHistory<T>(history: History<T>, next: T): History<T> {
  return {
    past: [...history.past, history.present],
    present: next,
    future: [],
  };
}

/** undoを行い、直前の状態に戻す */
export function undoHistory<T>(history: History<T>): History<T> {
  if (history.past.length === 0) return history;
  const previous = history.past[history.past.length - 1];
  const newPast = history.past.slice(0, -1);
  return {
    past: newPast,
    present: previous,
    future: [history.present, ...history.future],
  };
}

/** redoを行い、次の状態に進める */
export function redoHistory<T>(history: History<T>): History<T> {
  if (history.future.length === 0) return history;
  const next = history.future[0];
  const newFuture = history.future.slice(1);
  return {
    past: [...history.past, history.present],
    present: next,
    future: newFuture,
  };
}
