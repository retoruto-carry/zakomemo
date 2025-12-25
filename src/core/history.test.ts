import {
  createHistory,
  pushHistory,
  redoHistory,
  undoHistory,
} from "./history";

const initial = { value: 0 };

describe("history", () => {
  test("createHistoryはpast/futureを空で初期化する", () => {
    const history = createHistory(initial);
    expect(history.past).toEqual([]);
    expect(history.present).toEqual(initial);
    expect(history.future).toEqual([]);
  });

  test("pushHistoryはpresentをpastに移しfutureをクリアする", () => {
    const history = createHistory(initial);
    const next = { value: 1 };
    const pushed = pushHistory(history, next);

    expect(pushed.past).toEqual([initial]);
    expect(pushed.present).toEqual(next);
    expect(pushed.future).toEqual([]);
  });

  test("undoHistoryはpresentをfutureに移し直前のpastを復元する", () => {
    const history = pushHistory(createHistory(initial), { value: 1 });
    const undone = undoHistory(history);

    expect(undone.present).toEqual(initial);
    expect(undone.future[0]).toEqual({ value: 1 });
  });

  test("redoHistoryはfutureの先頭をpresentに戻す", () => {
    const history = pushHistory(createHistory(initial), { value: 1 });
    const undone = undoHistory(history);
    const redone = redoHistory(undone);

    expect(redone.present).toEqual({ value: 1 });
    expect(redone.past).toContainEqual(initial);
  });

  test("空のスタックではundo/redoは何もしない", () => {
    const history = createHistory(initial);
    expect(undoHistory(history)).toEqual(history);
    expect(redoHistory(history)).toEqual(history);
  });
});
