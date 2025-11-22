export type History<T> = {
  past: T[];
  present: T;
  future: T[];
};

export function createHistory<T>(initial: T): History<T> {
  return {
    past: [],
    present: initial,
    future: [],
  };
}

export function pushHistory<T>(history: History<T>, next: T): History<T> {
  return {
    past: [...history.past, history.present],
    present: next,
    future: [],
  };
}

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
