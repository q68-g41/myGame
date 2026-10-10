# itch.io での公開（M6）

仕様書 7 の M6 の決まり（無料・限定公開から始める・zip は手作業でアップロード・生成AIを使ったことを申告する）に合わせて、itch.io のページを作るための素材と手順をまとめたものです。

itch.io の画面の項目名は、2026年10月時点の理解で書いています。画面の表示が違うときは、近い項目に読み替えてください。

## 用意したもの

| もの | 場所 | 使う項目 |
| --- | --- | --- |
| ゲーム本体（zip） | https://q68-g41.github.io/myGame/sairei-itch.zip | Uploads |
| カバー画像（630×500） | `docs/itch/cover.png` | Cover image |
| スクリーンショット4枚（780×1688） | `docs/itch/screenshot-1-draft.png` ほか | Screenshots |
| ページの文面 | このファイルの「ページの文面」 | Short description / Description |

- zip は main にマージするたびに作り直される（GitHub Actions の「Deploy to GitHub Pages」が終わったあと）
- どの版かは、ゲームのトップ画面の下に出る `build: 〇〇〇〇〇〇〇`（コミットの短いハッシュ）で確かめる

## 初めて公開するときの手順

1. itch.io にログインし、ダッシュボードから新しいプロジェクトを作る（Create new project）
2. 下の「設定する項目」を入れる
3. Uploads で `sairei-itch.zip` をアップロードし、「This file will be played in the browser（ブラウザで遊ぶファイル）」にチェックを入れる
4. 公開範囲（Visibility & access）を「限定公開」にして保存する
   - URL を知っている人だけが開ける設定にする。itch.io では、Draft のまま共有用の秘密のURL（secret URL）を出す方法と、Restricted にして見られる人を指定する方法がある。画面に合わせて選ぶ
   - Public（一般公開）は、タイトルを決めてから（仕様書 8）
5. 出てきたURLをスマホで開き、遊べることと、トップ画面の `build:` が最新の main と同じことを確かめる
6. そのURLを社内の Slack のスレッドで共有する

公開する前に、オーナーが次の2つを確かめる（仕様書 7）。

- 画像生成サービス（Higgsfield）の利用規約で、生成した絵をゲームに使って公開してよいか
- itch.io の生成AIの申告（下の「設定する項目」）

## 設定する項目

| 項目 | 入れるもの |
| --- | --- |
| Title | 彩霊のみち（仮題） |
| Project URL | `sairei-no-michi`（あとから変えるとURLが変わるので、最初に決める） |
| Short description or tagline | 下の「キャッチコピー」 |
| Classification | Games |
| Kind of project | HTML |
| Release status | In development |
| Pricing | No payments（無料） |
| Uploads | `sairei-itch.zip`（ブラウザで遊ぶファイルにする） |
| Embed options | 下の「埋め込みの設定」 |
| Description | 下の「説明文」 |
| Genre | Strategy |
| Tags | roguelite, turn-based-combat, pixel-art, japanese, mobile, singleplayer |
| AI generation disclosure | 使った、と申告する。絵（キャラ・マップのアイコン）は画像生成AIで描き、コードは AI（Claude Code）と一緒に書いた。効果音と BGM はコードでその場で作る音で、生成AIの音は使っていない |
| Cover image | `docs/itch/cover.png` |
| Screenshots | `docs/itch/screenshot-1-draft.png` から `screenshot-4-reward.png` の4枚 |
| Comments | 有効にする（一般公開のあとの感想の受け皿。仕様書 7） |

### 埋め込みの設定（Embed options）

ゲームは縦持ちで、基準の画面は 390×844 です。

| 項目 | 値 |
| --- | --- |
| Viewport dimensions | 390 × 844 |
| Mobile friendly | オン |
| Orientation | Portrait（縦） |
| Fullscreen button | オン |
| Automatically start on page load | オフ（「Run game」を押してから始まる） |

## ページの文面

### キャッチコピー（Short description or tagline）

```
相手の一手を読み、相性と交代で上を取る。縦持ち片手で遊ぶ、和風ローグライト・コマンドバトル
```

### 説明文（Description）

```
色がくすんでいく和風の国で、色の精「彩霊（さいれい）」を連れて旅をする、読み合いのコマンドバトルです。
スマホを縦に持って、片手で遊べます。1回のプレイは15〜20分ほどです。

■ 遊び方
・候補5体から3体を選んでチームを作り、分岐マップを下から上へ進みます
・バトルでは、技を選ぶか、控えと交代します。相手の次の一手を読み、属性の相性と交代で上を取りましょう
・勝つたびに「技・能力強化・お守り」から1つを選んで、チームを育てます
・3つのエリアの最後に待つ「くすみ」のボスを倒せばクリアです

■ 中身
・彩霊 12体（紅・橙・黄・翠・蒼・紫の6属性）
・技 36個、お守り 20個
・エリア 3つ、ボス 3体
・相手（CPU）は、先のエリアほど賢くなります

■ 遊ぶときの注意
・開発中です。数値のバランスを調整していて、いまはかなり難しめです
・文字は日本語だけです
・効果音と BGM が鳴ります。画面下の「音 オン」を押すと消せます
・途中経過は、遊んでいるブラウザに自動で保存されます。閉じても続きから遊べます（ブラウザのデータを消すと消えます）

■ 感想を教えてください
どこまで進めたか、1回にかかった時間、迷ったところ、難しすぎる・簡単すぎると感じたところを、コメント欄に書いてもらえるとうれしいです。

■ 制作について
Claude Code（AI）と一緒に作っています。キャラとマップのアイコンの絵は、画像生成AI（GPT Image 2.5）で描いたものを、ドット絵に整えて使っています。効果音と BGM は、プログラムでその場で作っています。
フォント：DotGothic16、Zen Kaku Gothic New（SIL Open Font License）
```

説明文の最後に、日本語が読めない人向けの一文を足す。

```
Japanese only. A portrait, one-handed roguelite command battle game: read your opponent's next move and win with type matchups and switching. Made with Claude Code; the character and icon art was generated with an AI image model (GPT Image 2.5) and converted to pixel art. Fonts: DotGothic16 and Zen Kaku Gothic New (SIL Open Font License).
```

## アップデートのしかた

1. main にマージし、GitHub Actions の「Deploy to GitHub Pages」が終わるのを待つ
2. https://q68-g41.github.io/myGame/sairei-itch.zip から、新しい zip をダウンロードする
3. itch.io の Edit game → Uploads で新しい zip を上げ、古い zip を消す。新しい zip も「ブラウザで遊ぶファイル」にする
4. ページを開き直し、トップ画面の `build:` が新しくなったことを確かめる

- セーブは遊んでいる人のブラウザに残るので、アップデートしても続きから遊べる
- ただし、保存の形を変えた版（`SAVE_VERSION` を上げた版）を上げると、遊んでいる途中のランは最初からになる（読めないセーブは捨てる作り）

## 素材の作り直し

- **カバー画像**：`docs/itch/cover.html` をブラウザで開き、`.cover` の部分（630×500）を画像にする（Chrome なら開発者ツールで要素を選び「ノードのスクリーンショットをキャプチャ」）。タイトルが決まったら `h1` を書き換えて作り直す
- **スクリーンショット**：ゲームを 390×844・2倍（デバイスピクセル比 2）で開き、チーム選択・マップ・バトル・報酬の画面を撮る
