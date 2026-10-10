/**
 * ゲームのフォント（仕様書 5 のフォント・B案）を作る：`npm run fonts`
 *
 * Google Fonts の元のフォント（SIL Open Font License）を取ってきて、ゲームで使う文字だけに絞った woff2 にする。
 * 使う文字は、src の中の文字（画面の文言・キャラや技の名前など）と、半角の英数字・記号。
 * 文言を足して、まだ入っていない文字を使ったら、もう一度このスクリプトを動かす（tests/ui/fonts.test.ts が知らせる）。
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'src/assets/fonts');
const CACHE_DIR = join(ROOT, 'node_modules/.cache/sairei-fonts');
const LICENSE_DIR = join(ROOT, 'public/licenses');

/** 元のフォントを取ってくる場所（google/fonts の決まったコミット。同じフォントから作り直せるように固定する） */
const SOURCE = 'https://raw.githubusercontent.com/google/fonts/bd8f81ddb5c74d5c8897b36ad88b440266245103/ofl';

const FONTS = [
  { file: 'dotgothic16/DotGothic16-Regular.ttf', out: 'dotgothic16-400.woff2' },
  { file: 'zenkakugothicnew/ZenKakuGothicNew-Regular.ttf', out: 'zen-kaku-gothic-new-400.woff2' },
  { file: 'zenkakugothicnew/ZenKakuGothicNew-Bold.ttf', out: 'zen-kaku-gothic-new-700.woff2' },
] as const;

const LICENSES = [
  { file: 'dotgothic16/OFL.txt', out: 'OFL-DotGothic16.txt' },
  { file: 'zenkakugothicnew/OFL.txt', out: 'OFL-ZenKakuGothicNew.txt' },
] as const;

/** 文字を集めるファイル */
const TEXT_SOURCES = ['src', 'index.html'];

async function download(path: string): Promise<Buffer> {
  const cached = join(CACHE_DIR, path);
  try {
    return await readFile(cached);
  } catch {
    const response = await fetch(`${SOURCE}/${path}`);
    if (!response.ok) {
      throw new Error(`取ってこられない：${path}（${response.status}）`);
    }
    const data = Buffer.from(await response.arrayBuffer());
    await mkdir(dirname(cached), { recursive: true });
    await writeFile(cached, data);
    return data;
  }
}

async function listFiles(path: string): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true }).catch(() => null);
  if (entries === null) {
    return [path];
  }
  const nested = await Promise.all(entries.map((entry) => listFiles(join(path, entry.name))));
  return nested.flat().filter((file) => /\.(ts|css|html)$/.test(file));
}

/** ゲームで使う文字（半角の英数字・記号と、src の中の文字）。並べ替えて重ねない */
async function collectCharacters(): Promise<string> {
  const chars = new Set<string>();
  for (let code = 0x20; code <= 0x7e; code += 1) {
    chars.add(String.fromCodePoint(code));
  }
  const files = (await Promise.all(TEXT_SOURCES.map((source) => listFiles(join(ROOT, source))))).flat();
  for (const file of files) {
    for (const char of await readFile(file, 'utf8')) {
      if (char.codePointAt(0)! > 0x7e) {
        chars.add(char);
      }
    }
  }
  return [...chars].sort((a, b) => a.codePointAt(0)! - b.codePointAt(0)!).join('');
}

async function main(): Promise<void> {
  const text = await collectCharacters();
  await mkdir(OUT_DIR, { recursive: true });
  for (const font of FONTS) {
    const subset = await subsetFont(await download(font.file), text, {
      targetFormat: 'woff2',
      // 著作権とライセンスの表記（name の 0・13・14）はフォントの中にも残す
      preserveNameIds: [0, 13, 14],
    });
    await writeFile(join(OUT_DIR, font.out), subset);
    console.log(`${relative(ROOT, join(OUT_DIR, font.out))}  ${(subset.length / 1024).toFixed(1)} KB`);
  }
  // 入れた文字の一覧（テストで、使っている文字が全部入っているかを確かめる）。改行は入れない
  await writeFile(join(OUT_DIR, 'charset.txt'), [...text].filter((char) => char !== '\n').join(''));
  // ライセンスの全文は、ゲームと一緒に配る（public に置くと dist にそのまま入る）
  await mkdir(LICENSE_DIR, { recursive: true });
  for (const license of LICENSES) {
    await writeFile(join(LICENSE_DIR, license.out), await download(license.file));
  }
  console.log(`文字 ${[...text].length} 字`);
}

await main();
