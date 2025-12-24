import {
  bresenhamLine,
  calculateThickLinePixels,
  snapBrushWidth,
  snapToPixel,
} from "./rasterization";

describe("rasterization", () => {
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

    test("NaNの場合は0にフォールバック", () => {
      const result = snapToPixel(NaN, 20);
      expect(result).toEqual({ x: 0, y: 0 });
    });

    test("Infinityの場合は0にフォールバック", () => {
      const result = snapToPixel(Infinity, -Infinity);
      expect(result).toEqual({ x: 0, y: 0 });
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
      expect(snapBrushWidth(0)).toBe(1);
      expect(snapBrushWidth(-1)).toBe(1);
      expect(snapBrushWidth(-10)).toBe(1);
    });

    test("NaNの場合は1にフォールバック", () => {
      expect(snapBrushWidth(NaN)).toBe(1);
    });

    test("Infinityの場合は1にフォールバック", () => {
      expect(snapBrushWidth(Infinity)).toBe(1);
      expect(snapBrushWidth(-Infinity)).toBe(1);
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

    test("小数座標を渡した場合は整数に丸められる", () => {
      const result = bresenhamLine(0.4, 0.6, 5.3, 5.7);
      // すべての点が整数座標であることを確認
      result.forEach((p) => {
        expect(Number.isInteger(p.x)).toBe(true);
        expect(Number.isInteger(p.y)).toBe(true);
      });
      // 始点と終点が正しく丸められていることを確認
      expect(result[0]).toEqual({ x: 0, y: 1 });
      expect(result[result.length - 1]).toEqual({ x: 5, y: 6 });
    });

    test("負の座標でも正しく動作", () => {
      const result = bresenhamLine(-5, -3, 0, 0);
      result.forEach((p) => {
        expect(Number.isInteger(p.x)).toBe(true);
        expect(Number.isInteger(p.y)).toBe(true);
      });
      expect(result[0]).toEqual({ x: -5, y: -3 });
      expect(result[result.length - 1]).toEqual({ x: 0, y: 0 });
    });

    test("長い線でも正しく動作", () => {
      const result = bresenhamLine(0, 0, 100, 50);
      expect(result.length).toBeGreaterThan(1);
      result.forEach((p) => {
        expect(Number.isInteger(p.x)).toBe(true);
        expect(Number.isInteger(p.y)).toBe(true);
      });
      expect(result[0]).toEqual({ x: 0, y: 0 });
      expect(result[result.length - 1]).toEqual({ x: 100, y: 50 });
    });
  });

  describe("calculateThickLinePixels", () => {
    it("width=1の場合は中心線をそのまま返す", () => {
      const centerPixels = [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 2 },
      ];
      const result = calculateThickLinePixels(centerPixels, 1);
      expect(result).toEqual(centerPixels);
    });

    it("width=3の場合は中心線の周囲のピクセルを計算", () => {
      const centerPixels = [{ x: 5, y: 5 }];
      const result = calculateThickLinePixels(centerPixels, 3);
      // 半径1の円内のピクセルを計算（距離の2乗が1以下）
      // (5,5)を中心に、半径1の円内のピクセル: (4,5), (5,4), (5,5), (5,6), (6,5)
      // これは十字形の5ピクセル（斜めのピクセルは距離の2乗が2になるため除外）
      expect(result.length).toBe(5);
      expect(result).toContainEqual({ x: 4, y: 5 });
      expect(result).toContainEqual({ x: 5, y: 4 });
      expect(result).toContainEqual({ x: 5, y: 5 });
      expect(result).toContainEqual({ x: 5, y: 6 });
      expect(result).toContainEqual({ x: 6, y: 5 });
    });

    it("複数の中心線ピクセルで重複排除される", () => {
      const centerPixels = [
        { x: 5, y: 5 },
        { x: 6, y: 5 },
      ];
      const result = calculateThickLinePixels(centerPixels, 3);
      // 重複排除されるため、実際のピクセル数は少なくなる
      const uniquePixels = new Set(result.map((p) => `${p.x},${p.y}`));
      expect(uniquePixels.size).toBe(result.length);
    });

    it("width=5の場合は半径2の円内のピクセルを計算", () => {
      const centerPixels = [{ x: 10, y: 10 }];
      const result = calculateThickLinePixels(centerPixels, 5);
      // 半径2の円内のピクセル数: 距離の2乗が4以下のピクセル
      // これは13ピクセル（中心点から距離2以内のピクセル）
      expect(result.length).toBe(13);
      // 中心点は含まれる
      expect(result).toContainEqual({ x: 10, y: 10 });
      // 端の点も含まれる
      expect(result).toContainEqual({ x: 8, y: 10 });
      expect(result).toContainEqual({ x: 12, y: 10 });
      expect(result).toContainEqual({ x: 10, y: 8 });
      expect(result).toContainEqual({ x: 10, y: 12 });
    });

    it("空の配列を渡すと空の配列を返す", () => {
      const result = calculateThickLinePixels([], 5);
      expect(result).toEqual([]);
    });

    it("複数の中心線ピクセルが連続している場合の重複排除", () => {
      // 実際の線描画では、Bresenhamアルゴリズムで生成された複数の点が連続している
      const centerPixels = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
        { x: 4, y: 0 },
      ];
      const result = calculateThickLinePixels(centerPixels, 3);
      // 重複排除されるため、実際のピクセル数は理論値より少なくなる
      const uniquePixels = new Set(result.map((p) => `${p.x},${p.y}`));
      expect(uniquePixels.size).toBe(result.length);
      // 水平線なので、Y座標は0, 1, 2の3つになるはず
      const yCoords = new Set(result.map((p) => p.y));
      expect(yCoords.size).toBeLessThanOrEqual(3);
    });

    it("斜めの線での太い線の計算", () => {
      // 斜めの線（45度）での太い線の計算
      const centerPixels = [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 2 },
        { x: 3, y: 3 },
        { x: 4, y: 4 },
      ];
      const result = calculateThickLinePixels(centerPixels, 3);
      // 重複排除される
      const uniquePixels = new Set(result.map((p) => `${p.x},${p.y}`));
      expect(uniquePixels.size).toBe(result.length);
      // すべてのピクセルが整数座標であることを確認
      result.forEach((p) => {
        expect(Number.isInteger(p.x)).toBe(true);
        expect(Number.isInteger(p.y)).toBe(true);
      });
    });

    it("長い線での太い線の計算", () => {
      // 長い線（100ピクセル）での太い線の計算
      const centerPixels: Array<{ x: number; y: number }> = [];
      for (let i = 0; i < 100; i++) {
        centerPixels.push({ x: i, y: 0 });
      }
      const result = calculateThickLinePixels(centerPixels, 5);
      // 重複排除される
      const uniquePixels = new Set(result.map((p) => `${p.x},${p.y}`));
      expect(uniquePixels.size).toBe(result.length);
      // 理論的には100 * 13 = 1300ピクセルだが、重複排除により実際は少なくなる
      expect(result.length).toBeLessThan(1300);
      // しかし、中心線の長さ分のピクセルは含まれるはず
      expect(result.length).toBeGreaterThan(100);
    });

    it("width=2の場合は半径1の円内のピクセルを計算", () => {
      const centerPixels = [{ x: 5, y: 5 }];
      const result = calculateThickLinePixels(centerPixels, 2);
      // 半径1の円内のピクセル: 距離の2乗が1以下のピクセル
      // これは5ピクセル（十字形）
      expect(result.length).toBe(5);
      expect(result).toContainEqual({ x: 4, y: 5 });
      expect(result).toContainEqual({ x: 5, y: 4 });
      expect(result).toContainEqual({ x: 5, y: 5 });
      expect(result).toContainEqual({ x: 5, y: 6 });
      expect(result).toContainEqual({ x: 6, y: 5 });
    });

    it("width=4の場合は半径2の円内のピクセルを計算", () => {
      const centerPixels = [{ x: 10, y: 10 }];
      const result = calculateThickLinePixels(centerPixels, 4);
      // 半径2の円内のピクセル: 距離の2乗が4以下のピクセル
      // これは13ピクセル
      expect(result.length).toBe(13);
      expect(result).toContainEqual({ x: 10, y: 10 });
    });

    it("Bresenhamアルゴリズムと組み合わせた太い線の計算", () => {
      // 実際の使用ケース: Bresenhamアルゴリズムで生成された中心線を使って太い線を計算
      const centerLine = bresenhamLine(0, 0, 10, 5);
      const result = calculateThickLinePixels(centerLine, 3);
      // 重複排除される
      const uniquePixels = new Set(result.map((p) => `${p.x},${p.y}`));
      expect(uniquePixels.size).toBe(result.length);
      // すべてのピクセルが整数座標であることを確認
      result.forEach((p) => {
        expect(Number.isInteger(p.x)).toBe(true);
        expect(Number.isInteger(p.y)).toBe(true);
      });
      // 中心線の各点が含まれることを確認（太い線なので中心線の点も含まれる）
      centerLine.forEach((center) => {
        expect(result).toContainEqual(center);
      });
    });

    it("異なる太さでの一貫性チェック", () => {
      const centerPixels = [{ x: 10, y: 10 }];
      const width1 = calculateThickLinePixels(centerPixels, 1);
      const width2 = calculateThickLinePixels(centerPixels, 2);
      const width3 = calculateThickLinePixels(centerPixels, 3);
      const width4 = calculateThickLinePixels(centerPixels, 4);
      const width5 = calculateThickLinePixels(centerPixels, 5);

      // width=1: 1ピクセル
      expect(width1.length).toBe(1);
      // width=2: radius=1, 5ピクセル（十字形）
      expect(width2.length).toBe(5);
      // width=3: radius=1, 5ピクセル（十字形、width=2と同じ）
      expect(width3.length).toBe(5);
      // width=4: radius=2, 13ピクセル
      expect(width4.length).toBe(13);
      // width=5: radius=2, 13ピクセル（width=4と同じ）
      expect(width5.length).toBe(13);

      // 偶数と奇数の太さで、同じ半径になる場合がある
      // width=2とwidth=3は同じradius=1なので、同じピクセル数
      expect(width2.length).toBe(width3.length);
      // width=4とwidth=5は同じradius=2なので、同じピクセル数
      expect(width4.length).toBe(width5.length);
      // しかし、width=4/5はwidth=2/3より大きい
      expect(width4.length).toBeGreaterThan(width2.length);
    });
  });
});
