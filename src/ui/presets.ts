export interface BodyColor {
  bg: string;
  border: string;
  bezel: string;
  bezelBorder: string;
  button: string;
  buttonBorder: string;
  buttonText: string;
  hingeFrom: string;
  hingeVia: string;
  hingeTo: string;
  hingeBorder: string;
}

export const PALETTE_PRESETS = [
  { name: "スタンダード", colors: ["#0b0b0b", "#ff3b30", "#34c759", "#007aff", "#fbbf24", "#9b51e0"] },
  { name: "ゲームボーイ", colors: ["#0f380f", "#306230", "#8bac0f", "#9bbc0f", "#cadc9f", "#e0f8d0"] },
  { name: "ノスタルジック", colors: ["#4a4a4a", "#8b4513", "#556b2f", "#4682b4", "#daa520", "#800080"] },
  { name: "パステル", colors: ["#555555", "#ffb7b2", "#baffc9", "#bae1ff", "#ffffba", "#e0bbe4"] },
  { name: "サイバー", colors: ["#000000", "#ff00ff", "#00ffff", "#ffff00", "#00ff00", "#ff0000"] },
  { name: "モノクロ", colors: ["#000000", "#333333", "#666666", "#999999", "#cccccc", "#ffffff"] },
  { name: "フォレスト", colors: ["#1b3022", "#395442", "#5a7250", "#889668", "#a2b48c", "#c2d1b0"] },
  { name: "デザート", colors: ["#4a3728", "#7b5e43", "#a68069", "#d4a373", "#e9c46a", "#f4a261"] },
  { name: "オーシャン", colors: ["#03045e", "#023e8a", "#0077b6", "#0096c7", "#00b4d8", "#48cae4"] },
  { name: "サクラ", colors: ["#594157", "#726a95", "#a0ced9", "#adeecf", "#e1ffbb", "#ffccf9"] },
  { name: "ベリー", colors: ["#4d081a", "#900c3f", "#c70039", "#ff1f5b", "#ff5e78", "#ff8fa3"] },
  { name: "トワイライト", colors: ["#1a1a2e", "#16213e", "#0f3460", "#533483", "#e94560", "#f9f1f0"] },
  { name: "ヴィンテージ", colors: ["#2c3e50", "#e74c3c", "#ecf0f1", "#3498db", "#f1c40f", "#8e44ad"] },
  { name: "アース", colors: ["#283618", "#606c38", "#fefae0", "#dda15e", "#bc6c25", "#4a2c2a"] },
  { name: "ネオン", colors: ["#000000", "#39ff14", "#ff073a", "#00d9ff", "#fff01f", "#bc13fe"] },
  { name: "レトロDS", colors: ["#080808", "#e60012", "#00a0e9", "#ffffff", "#848484", "#cccccc"] },
];

export const BODY_PRESETS = [
  { 
    name: "マットホワイト", 
    body: { bg: "#f2f2f2", border: "#d9d9d9", bezel: "#2a2a2a", bezelBorder: "#333", button: "#fdfdfd", buttonBorder: "#ccc", buttonText: "#888", hingeFrom: "#e8e8e8", hingeVia: "#f2f2f2", hingeTo: "#e0e0e0", hingeBorder: "#ccc" } 
  },
  { 
    name: "マットブラック", 
    body: { bg: "#1a1a1a", border: "#000", bezel: "#000", bezelBorder: "#222", button: "#333", buttonBorder: "#111", buttonText: "#eee", hingeFrom: "#000", hingeVia: "#111", hingeTo: "#000", hingeBorder: "#222" } 
  },
  { 
    name: "ライトブルー", 
    body: { bg: "#b3e5fc", border: "#81d4fa", bezel: "#2a2a2a", bezelBorder: "#333", button: "#e1f5fe", buttonBorder: "#b3e5fc", buttonText: "#0277bd", hingeFrom: "#81d4fa", hingeVia: "#b3e5fc", hingeTo: "#81d4fa", hingeBorder: "#4fc3f7" } 
  },
  { 
    name: "メタリックレッド", 
    body: { bg: "#c62828", border: "#b71c1c", bezel: "#1a1a1a", bezelBorder: "#000", button: "#e53935", buttonBorder: "#b71c1c", buttonText: "#fff", hingeFrom: "#b71c1c", hingeVia: "#c62828", hingeTo: "#b71c1c", hingeBorder: "#8e0000" } 
  },
  { 
    name: "ライムグリーン", 
    body: { bg: "#c6ff00", border: "#aeea00", bezel: "#2a2a2a", bezelBorder: "#333", button: "#f4ff81", buttonBorder: "#c6ff00", buttonText: "#33691e", hingeFrom: "#aeea00", hingeVia: "#c6ff00", hingeTo: "#aeea00", hingeBorder: "#827717" } 
  },
  { 
    name: "ミント", 
    body: { bg: "#b2dfdb", border: "#80cbc4", bezel: "#2a2a2a", bezelBorder: "#333", button: "#e0f2f1", buttonBorder: "#b2dfdb", buttonText: "#00695c", hingeFrom: "#80cbc4", hingeVia: "#b2dfdb", hingeTo: "#80cbc4", hingeBorder: "#4db6ac" } 
  },
  { 
    name: "バーガンディ", 
    body: { bg: "#880e4f", border: "#4a001f", bezel: "#1a1a1a", bezelBorder: "#000", button: "#ad1457", buttonBorder: "#880e4f", buttonText: "#fff", hingeFrom: "#4a001f", hingeVia: "#880e4f", hingeTo: "#4a001f", hingeBorder: "#2a0000" } 
  },
  { 
    name: "オレンジ", 
    body: { bg: "#ff9800", border: "#ef6c00", bezel: "#2a2a2a", bezelBorder: "#333", button: "#fff3e0", buttonBorder: "#ff9800", buttonText: "#e65100", hingeFrom: "#ef6c00", hingeVia: "#ff9800", hingeTo: "#ef6c00", hingeBorder: "#e65100" } 
  },
  { 
    name: "ターコイズ", 
    body: { bg: "#00bcd4", border: "#00838f", bezel: "#2a2a2a", bezelBorder: "#333", button: "#e0f7fa", buttonBorder: "#00bcd4", buttonText: "#006064", hingeFrom: "#00838f", hingeVia: "#00bcd4", hingeTo: "#00838f", hingeBorder: "#006064" } 
  },
  { 
    name: "パープル", 
    body: { bg: "#9c27b0", border: "#6a1b9a", bezel: "#2a2a2a", bezelBorder: "#333", button: "#f3e5f5", buttonBorder: "#9c27b0", buttonText: "#4a148c", hingeFrom: "#6a1b9a", hingeVia: "#9c27b0", hingeTo: "#6a1b9a", hingeBorder: "#4a148c" } 
  },
  { 
    name: "ゴールド", 
    body: { bg: "#ffd700", border: "#daa520", bezel: "#1a1a1a", bezelBorder: "#000", button: "#fff9c4", buttonBorder: "#ffd700", buttonText: "#5d4037", hingeFrom: "#daa520", hingeVia: "#ffd700", hingeTo: "#daa520", hingeBorder: "#5d4037" } 
  },
  { 
    name: "シルバー", 
    body: { bg: "#e0e0e0", border: "#bdbdbd", bezel: "#2a2a2a", bezelBorder: "#333", button: "#f5f5f5", buttonBorder: "#e0e0e0", buttonText: "#424242", hingeFrom: "#bdbdbd", hingeVia: "#e0e0e0", hingeTo: "#bdbdbd", hingeBorder: "#757575" } 
  },
  { 
    name: "ネイビー", 
    body: { bg: "#1a237e", border: "#0d47a1", bezel: "#1a1a1a", bezelBorder: "#000", button: "#283593", buttonBorder: "#1a237e", buttonText: "#fff", hingeFrom: "#0d47a1", hingeVia: "#1a237e", hingeTo: "#0d47a1", hingeBorder: "#002171" } 
  },
  { 
    name: "フォレストグリーン", 
    body: { bg: "#1b5e20", border: "#003308", bezel: "#1a1a1a", bezelBorder: "#000", button: "#2e7d32", buttonBorder: "#1b5e20", buttonText: "#fff", hingeFrom: "#003308", hingeVia: "#1b5e20", hingeTo: "#003308", hingeBorder: "#002300" } 
  },
  { 
    name: "チョコ", 
    body: { bg: "#3e2723", border: "#1b0000", bezel: "#1a1a1a", bezelBorder: "#000", button: "#4e342e", buttonBorder: "#3e2723", buttonText: "#fff", hingeFrom: "#1b0000", hingeVia: "#3e2723", hingeTo: "#1b0000", hingeBorder: "#000000" } 
  },
  { 
    name: "ホットピンク", 
    body: { bg: "#f50057", border: "#c51162", bezel: "#2a2a2a", bezelBorder: "#333", button: "#ff80ab", buttonBorder: "#f50057", buttonText: "#fff", hingeFrom: "#c51162", hingeVia: "#f50057", hingeTo: "#c51162", hingeBorder: "#880e4f" } 
  },
  { 
    name: "コーラルピンク", 
    body: { bg: "#ff8a80", border: "#ff5252", bezel: "#2a2a2a", bezelBorder: "#333", button: "#ffebee", buttonBorder: "#ff8a80", buttonText: "#b71c1c", hingeFrom: "#ff5252", hingeVia: "#ff8a80", hingeTo: "#ff5252", hingeBorder: "#ff1744" } 
  },
  { 
    name: "ティール", 
    body: { bg: "#009688", border: "#00695c", bezel: "#1a1a1a", bezelBorder: "#000", button: "#e0f2f1", buttonBorder: "#009688", buttonText: "#004d40", hingeFrom: "#00695c", hingeVia: "#009688", hingeTo: "#00695c", hingeBorder: "#004d40" } 
  },
  { 
    name: "ラベンダー", 
    body: { bg: "#d1c4e9", border: "#9575cd", bezel: "#2a2a2a", bezelBorder: "#333", button: "#f3e5f5", buttonBorder: "#d1c4e9", buttonText: "#4527a0", hingeFrom: "#9575cd", hingeVia: "#d1c4e9", hingeTo: "#9575cd", hingeBorder: "#673ab7" } 
  },
  { 
    name: "チャコール", 
    body: { bg: "#455a64", border: "#263238", bezel: "#1a1a1a", bezelBorder: "#000", button: "#cfd8dc", buttonBorder: "#455a64", buttonText: "#eceff1", hingeFrom: "#263238", hingeVia: "#455a64", hingeTo: "#263238", hingeBorder: "#212121" } 
  },
];

export function generateBodyColorFromBase(hex: string): BodyColor {
  // Simple logic to derive shades from a base color
  // Note: These helper functions expect 6-character hex codes (e.g., #ff0000).
  // Shorthand codes like #fff will produce incorrect results.
  const isDark = (color: string) => {
    const c = color.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness < 128;
  };

  const darken = (color: string, percent: number) => {
    const c = color.replace('#', '');
    const num = parseInt(c, 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) - amt;
    const G = (num >> 8 & 0x00FF) - amt;
    const B = (num & 0x0000FF) - amt;
    return "#" + (0x1000000 + (R < 255 ? R < 0 ? 0 : R : 255) * 0x10000 + (G < 255 ? G < 0 ? 0 : G : 255) * 0x100 + (B < 255 ? B < 0 ? 0 : B : 255)).toString(16).slice(1);
  };

  const lighten = (color: string, percent: number) => {
    const c = color.replace('#', '');
    const num = parseInt(c, 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return "#" + (0x1000000 + (R < 255 ? R < 0 ? 0 : R : 255) * 0x10000 + (G < 255 ? G < 0 ? 0 : G : 255) * 0x100 + (B < 255 ? B < 0 ? 0 : B : 255)).toString(16).slice(1);
  };

  const dark = isDark(hex);
  
  return {
    bg: hex,
    border: darken(hex, 10),
    bezel: dark ? darken(hex, 20) : "#2a2a2a",
    bezelBorder: dark ? darken(hex, 30) : "#333",
    button: lighten(hex, 15),
    buttonBorder: hex,
    buttonText: dark ? "#fff" : darken(hex, 40),
    hingeFrom: darken(hex, 5),
    hingeVia: hex,
    hingeTo: darken(hex, 10),
    hingeBorder: darken(hex, 15),
  };
}

