import {
  createHistory,
  pushHistory,
  redoHistory,
  undoHistory,
} from "./history";

const initial = { value: 0 };

describe("history", () => {
  test("createHistory initializes with empty past/future", () => {
    const history = createHistory(initial);
    expect(history.past).toEqual([]);
    expect(history.present).toEqual(initial);
    expect(history.future).toEqual([]);
  });

  test("pushHistory moves present to past and clears future", () => {
    const history = createHistory(initial);
    const next = { value: 1 };
    const pushed = pushHistory(history, next);

    expect(pushed.past).toEqual([initial]);
    expect(pushed.present).toEqual(next);
    expect(pushed.future).toEqual([]);
  });

  test("undoHistory moves present to future and restores previous past item", () => {
    const history = pushHistory(createHistory(initial), { value: 1 });
    const undone = undoHistory(history);

    expect(undone.present).toEqual(initial);
    expect(undone.future[0]).toEqual({ value: 1 });
  });

  test("redoHistory moves future head to present", () => {
    const history = pushHistory(createHistory(initial), { value: 1 });
    const undone = undoHistory(history);
    const redone = redoHistory(undone);

    expect(redone.present).toEqual({ value: 1 });
    expect(redone.past).toContainEqual(initial);
  });

  test("undo/redo with empty stacks are no-ops", () => {
    const history = createHistory(initial);
    expect(undoHistory(history)).toEqual(history);
    expect(redoHistory(history)).toEqual(history);
  });
});
