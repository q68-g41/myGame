/**
 * 画面の枠と足場のドット絵（仕様書 5 の「画面の見た目」）を作る：`npm run ui-art`
 *
 * 絵は、1文字＝1ドットの文字の表で描き、PNG に書き出す（画像生成AIは使わない）。
 * 画面では2倍（1ドット＝2px）にして、`image-rendering: pixelated` で出す。
 * 形や色を変えるときは、ここを直してもう一度動かす。
 */
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '../src/assets/ui');

type Rgba = readonly [number, number, number, number];

/** 文字と色の対応 */
const PALETTE: Readonly<Record<string, Rgba>> = {
  '.': [0, 0, 0, 0],
  K: [13, 10, 20, 255], // 縁の黒
  G: [212, 162, 74, 255], // 金
  L: [246, 217, 139, 255], // 金の明るいところ
  D: [141, 100, 36, 255], // 金の暗いところ
  e: [43, 33, 64, 240], // 窓の内側のふち
  f: [25, 19, 36, 236], // 漆の地
  p: [25, 19, 36, 214], // 札の地（少し透ける）
};

// ===== PNG に書き出す =====

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** 色の表（行ごと）を、RGBA の PNG にする */
function encodePng(pixels: readonly (readonly Rgba[])[]): Buffer {
  const height = pixels.length;
  const width = pixels[0]?.length ?? 0;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  pixels.forEach((row, y) => {
    // 各行の先頭は、フィルターなし（0）
    row.forEach((color, x) => raw.set(color, y * (width * 4 + 1) + 1 + x * 4));
  });
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8); // 8bit・RGBA・圧縮0・フィルター0・インターレースなし
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function fromText(rows: readonly string[]): Rgba[][] {
  return rows.map((row) =>
    [...row].map((char) => {
      const color = PALETTE[char];
      if (color === undefined) {
        throw new Error(`色が決まっていない文字です：${char}`);
      }
      return color;
    }),
  );
}

// ===== 枠（9分割で伸ばして使う） =====

/**
 * 左上の角（n×n）と、上の辺の断面（外から内へ n 文字）から、上下左右に反転した正方形の枠を作る。
 * 真ん中は地の色で埋める。CSS の border-image で、角を n ドットとして切り分けて使う
 */
function frame(corner: readonly string[], edge: string, fill: string, middle: number): string[] {
  const n = corner.length;
  const size = n * 2 + middle;
  const grid = Array.from({ length: size }, () => Array.from({ length: size }, () => fill));
  const set = (y: number, x: number, char: string) => {
    grid[y]![x] = char;
  };
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const char = corner[y]![x]!;
      set(y, x, char);
      set(y, size - 1 - x, char);
      set(size - 1 - y, x, char);
      set(size - 1 - y, size - 1 - x, char);
    }
    for (let x = n; x < size - n; x++) {
      const char = edge[y]!;
      set(y, x, char);
      set(size - 1 - y, x, char);
      set(x, y, char);
      set(x, size - 1 - y, char);
    }
  }
  return grid.map((row) => row.join(''));
}

/** 角の金具（4×4）に、どの角でも左上から光が当たるように陰を付け直す（反転で逆になった分を直す） */
function shadeFittings(rows: string[], n: number): string[] {
  const grid = rows.map((row) => [...row]);
  const size = grid.length;
  for (const [top, left] of [
    [true, true],
    [true, false],
    [false, true],
    [false, false],
  ] as const) {
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const y = top ? 1 + i : size - n + (n - 5) + i;
        const x = left ? 1 + j : size - n + (n - 5) + j;
        const char = grid[y]![x]!;
        if (!'LGD'.includes(char)) {
          continue;
        }
        grid[y]![x] = i === 0 || j === 0 ? 'L' : i === 3 || j === 3 ? 'D' : 'G';
      }
    }
  }
  return grid.map((row) => row.join(''));
}

/** メッセージの窓：角に金具の付いた漆の枠。断面は 黒・金・黒・内ふち・地・地 */
const WINDOW = shadeFittings(
  frame(['.KKKKK', 'KGGGGG', 'KGGGDK', 'KGGKDe', 'KGDDDf', 'KGKeff'], 'KGKeff', 'f', 4),
  6,
);

/** 名前とHPの札：角を1ドット欠いた、金の細い枠 */
const PLATE = frame(['.KKK', 'KGGG', 'KGKK', 'KGKp'], 'KGKp', 'p', 2);

// ===== 足場（石の台） =====

/** 横長のだ円の上面と、少しの厚みを持つ石の台（幅 width × 高さ16） */
function platform(width: number): Rgba[][] {
  const height = 16;
  const [cx, cy, rx, ry, depth] = [(width - 1) / 2, 6, (width - 2) / 2, 5.6, 4];
  const inTop = (x: number, y: number) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
  const inBody = (x: number, y: number) => Array.from({ length: depth + 1 }, (_, d) => inTop(x, y - d)).some(Boolean);
  const inCenter = (x: number, y: number) =>
    ((x + 0.5 - cx) / (rx * 0.62)) ** 2 + ((y + 0.5 - cy) / (ry * 0.55)) ** 2 <= 1;
  const colors = {
    edge: [13, 10, 20, 255],
    top: [58, 48, 82, 255],
    topLight: [92, 78, 122, 255],
    topCenter: [50, 41, 72, 255],
    side: [33, 26, 50, 255],
    sideDark: [24, 19, 37, 255],
    none: [0, 0, 0, 0],
  } as const satisfies Record<string, Rgba>;

  return Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x): Rgba => {
      if (!inBody(x, y)) {
        return colors.none;
      }
      const edge = !(inBody(x - 1, y) && inBody(x + 1, y) && inBody(x, y - 1) && inBody(x, y + 1));
      if (edge) {
        return colors.edge;
      }
      if (inTop(x, y)) {
        if (!inTop(x, y - 1) || !inTop(x, y - 2)) {
          return colors.topLight;
        }
        return inCenter(x, y) ? colors.topCenter : colors.top;
      }
      return inBody(x, y + 2) ? colors.side : colors.sideDark;
    }),
  );
}

const OUTPUTS = [
  { file: 'frame-window.png', pixels: fromText(WINDOW) },
  { file: 'frame-plate.png', pixels: fromText(PLATE) },
  // バトルのキャラ1体ぶん（56×16）と、トップ画面の彩り手と相棒の2人ぶん（120×16）
  { file: 'platform.png', pixels: platform(56) },
  { file: 'platform-wide.png', pixels: platform(120) },
];

for (const { file, pixels } of OUTPUTS) {
  await writeFile(join(OUT_DIR, file), encodePng(pixels));
  console.log(`src/assets/ui/${file}  ${pixels[0]?.length ?? 0}×${pixels.length}`);
}
