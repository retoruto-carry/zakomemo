import { bresenhamLine, snapBrushWidth, snapToPixel } from "./pixelArt";

describe("pixelArt", () => {
  describe("snapToPixel", () => {
    test("整数座標はそのまま返す", () => {
      const result = snapToPixel(10, 20);
      expect(result).toEqual({ x: 10, y: 20 });
    });

    test("小数座標は最も近い整数に丸める", () => {
      const result = snapToPixel(10.4, 20.7);
      expect(result).toEqual({ x: 10, y: 21 });
    });

    test("負の座標も正しく処理", () => {
      const result = snapToPixel(-10.6, -20.3);
      expect(result).toEqual({ x: -11, y: -20 });
    });

    test("0.5は正の方向に丸める", () => {
      const result = snapToPixel(10.5, 20.5);
      expect(result).toEqual({ x: 11, y: 21 });
    });
  });

  describe("snapBrushWidth", () => {
    test("整数のブラシサイズはそのまま返す", () => {
      expect(snapBrushWidth(10)).toBe(10);
      expect(snapBrushWidth(1)).toBe(1);
      expect(snapBrushWidth(48)).toBe(48);
    });

    test("小数のブラシサイズは最も近い整数に丸める", () => {
      expect(snapBrushWidth(10.4)).toBe(10);
      expect(snapBrushWidth(10.6)).toBe(11);
      expect(snapBrushWidth(10.5)).toBe(11);
    });

    test("最小値は1", () => {
      expect(snapBrushWidth(0.4)).toBe(1);
      expect(snapBrushWidth(0.6)).toBe(1);
    });
  });

  describe("bresenhamLine", () => {
    test("水平線（右方向）", () => {
      const result = bresenhamLine(0, 0, 5, 0);
      expect(result).toEqual([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
        { x: 4, y: 0 },
        { x: 5, y: 0 },
      ]);
    });

    test("水平線（左方向）", () => {
      const result = bresenhamLine(5, 0, 0, 0);
      expect(result).toEqual([
        { x: 5, y: 0 },
        { x: 4, y: 0 },
        { x: 3, y: 0 },
        { x: 2, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 0 },
      ]);
    });

    test("垂直線（下方向）", () => {
      const result = bresenhamLine(0, 0, 0, 5);
      expect(result).toEqual([
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: 2 },
        { x: 0, y: 3 },
        { x: 0, y: 4 },
        { x: 0, y: 5 },
      ]);
    });

    test("垂直線（上方向）", () => {
      const result = bresenhamLine(0, 5, 0, 0);
      expect(result).toEqual([
        { x: 0, y: 5 },
        { x: 0, y: 4 },
        { x: 0, y: 3 },
        { x: 0, y: 2 },
        { x: 0, y: 1 },
        { x: 0, y: 0 },
      ]);
    });

    test("斜め線（右下方向、傾き1）", () => {
      const result = bresenhamLine(0, 0, 5, 5);
      expect(result).toEqual([
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 2 },
        { x: 3, y: 3 },
        { x: 4, y: 4 },
        { x: 5, y: 5 },
      ]);
    });

    test("斜め線（右上方向、傾き2）", () => {
      const result = bresenhamLine(0, 0, 5, 10);
      // Bresenhamアルゴリズムの結果を確認
      expect(result[0]).toEqual({ x: 0, y: 0 });
      expect(result[result.length - 1]).toEqual({ x: 5, y: 10 });
      // すべての点が整数座標であることを確認
      result.forEach((p) => {
        expect(Number.isInteger(p.x)).toBe(true);
        expect(Number.isInteger(p.y)).toBe(true);
      });
    });

    test("同じ点の場合は1点のみ返す", () => {
      const result = bresenhamLine(5, 5, 5, 5);
      expect(result).toEqual([{ x: 5, y: 5 }]);
    });

    test("1ピクセル離れた点", () => {
      const result = bresenhamLine(0, 0, 1, 0);
      expect(result).toEqual([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]);
    });

    test("すべての点が整数座標であることを確認", () => {
      const result = bresenhamLine(0, 0, 10, 7);
      result.forEach((p) => {
        expect(Number.isInteger(p.x)).toBe(true);
        expect(Number.isInteger(p.y)).toBe(true);
      });
    });
  });
});
