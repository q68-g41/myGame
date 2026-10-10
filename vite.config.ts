import { defineConfig } from 'vitest/config';

// どのビルドが表示されているかを画面で確かめるための ID。
// GitHub Actions ではコミットの短いハッシュ、手元では "local" になる。
const buildId = process.env.GITHUB_SHA?.slice(0, 7) ?? 'local';

export default defineConfig({
  // 相対パスで出力し、GitHub Pages のサブパス（/myGame/）でも itch.io でも同じ成果物で動くようにする
  base: './',
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Vitest は CSS の中身を空にするので、?raw で文字列として読むときだけそのまま返す
    // （フォントのテストが style.css の文字を確かめるため）。画面に読み込む CSS は今までどおり処理しない
    css: { include: [/[?&]raw(?:&|$)/] },
  },
});
