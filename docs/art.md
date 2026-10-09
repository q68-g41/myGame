# 絵の記録

キャラのドット絵（仕様書 5.1）を、どの生成結果から作ったかの記録です。絵を描き直したり差し替えたりするときに使います。

## 採用した絵

- 15枚ともA案（GPT Image 2.5、Higgsfield で生成。quality high、1k、正方形）
- ベニギツネ・ユウヒダヌキ・カキザル・くすみの主の4枚は、A案を描き直したもの（下の「描き直し」）
- B案（Nano Banana Pro）・C案（Seedream 5.0 Pro）は比較用に作ったもので、使っていない

| ID | 名前 | 生成のジョブID | 備考 |
| --- | --- | --- | --- |
| crimson-trial | ベニギツネ | b717af7a-7a7d-4ccc-bf55-aaaea7a3c62c | 描き直し |
| crimson-guard | ベニコウラ | b3e18aab-7a4e-48c3-b281-66a46973f1de | |
| orange-trial | ユウヒダヌキ | 34e1946b-4288-4447-8d4f-ea2d3f0ff84c | 描き直し |
| orange-raider | カキザル | be2c85bd-fcff-4e79-abb5-5767d431a540 | 描き直し |
| yellow-trial | イナホイタチ | 0f73ada2-2ae7-4d56-9888-7644b2d1b0cb | |
| yellow-trickster | ナノハナバチ | 916468ee-b98f-4b4b-8ffe-ab4d59a0cbac | |
| green-trial | ヨモギガエル | 970b6d41-53c4-4d1b-a9ee-a96570bdec8b | |
| green-charger | タケジカ | eb0471ab-0e48-4385-a506-53b267be70cf | |
| blue-trial | シズクサギ | c93a636b-bdb9-4d3b-8b3e-f7988b677988 | |
| blue-skirmisher | アオシャチ | 330a38eb-cdd2-4250-aeeb-6f2fb77827ba | |
| violet-trial | フジチョウ | 844516f4-403e-40db-9467-fdf69d2b19bf | |
| violet-warden | スミレヘビ | d6305a23-0f7a-47c5-b27d-6b08cf13a906 | |
| crimson-boss | くすみ大猿 | 60399bc9-737d-435f-93d2-10cc52b7ad43 | |
| blue-boss | くすみ大鯉 | 52bd14cb-d6d2-4be7-b113-618b8938d74e | |
| violet-boss | くすみの主 | a11de9b5-8e7a-45f3-a3e8-4d64088f32f5 | 描き直し |

## 生成の指示（プロンプト）

共通の文に、キャラごとの「題材」と「雰囲気」を入れて作った。

```
Pixel art game sprite, a single creature only. It is a 'Sairei', a spirit of color from a Japanese-style (wafu)
fantasy world where colors are slowly fading. {題材} Facing right in a three-quarter view, full body, centered,
filling about 80% of a square canvas. Bold, simple, clearly readable silhouette that still reads when shrunk to
48x48 pixels; chunky pixels, limited palette of about 16 colors, dark 1-pixel outline, flat cel shading, no blur,
no gradients. Plain solid white background, no ground shadow, no text, no border. {雰囲気} Original design that does
not resemble any existing game, anime, or mascot character.
```

- 雰囲気（キャラ）：`Cute but slightly mysterious mood.`
- 雰囲気（ボス）：`This is a boss, larger and more imposing than ordinary spirits. As a 'kusumi' (dulled) being, its colors are desaturated, grayish and dark. Menacing, gloomy mood.`

| ID | 題材 |
| --- | --- |
| crimson-trial | A crimson-red fox spirit (kitsune) with a large flame-shaped tail and a small red shrine-rope tassel at its neck. Main color: crimson red. |
| crimson-guard | A sturdy crimson-red tortoise spirit whose shell looks like lacquered samurai armor plates. Slow and tough looking. Main color: crimson red. |
| orange-trial | A plump sunset-orange tanuki (Japanese raccoon dog) spirit carrying a small cloth bundle (furoshiki) on its back. Gentle and sturdy. Main color: warm sunset orange. |
| orange-raider | A nimble persimmon-orange monkey spirit holding a small persimmon, crouched and ready to pounce. Main color: persimmon orange. |
| yellow-trial | A slender, very fast weasel spirit the golden yellow of ripe rice ears, with a tail like a bundle of rice stalks. Main color: golden yellow. |
| yellow-trickster | A small bee spirit the bright yellow of rapeseed (nanohana) blossoms, with petal-shaped wings. Main color: bright rapeseed yellow. |
| green-trial | A round frog spirit in mugwort (yomogi) green with a sprig of mugwort leaves growing on its back. Main color: soft mugwort green. |
| green-charger | A young deer spirit whose antlers are green bamboo stalks with small bamboo leaves. Main color: fresh bamboo green. |
| blue-trial | An elegant heron spirit in deep blue with water-droplet patterns on its wings, standing on one leg. Main color: deep blue. |
| blue-skirmisher | A small orca spirit in blue with Japanese wave (seigaiha) patterns on its body, leaping. Main color: bright blue. |
| violet-trial | A butterfly spirit with wisteria-violet wings patterned like hanging wisteria flowers. Main color: wisteria violet. |
| violet-warden | A coiled snake spirit in violet with small violet (sumire) flower markings, calm and watchful. Main color: violet purple. |
| crimson-boss | A huge hulking ape in dull, grayish dark crimson, wrapped in a murky smoky aura. |
| blue-boss | A giant carp in dull, grayish dark blue, with murky ink-like water swirling around it. |
| violet-boss | A large indistinct shadowy entity in dull, grayish dark violet: a mass of dark mist with glowing eyes, its true form unclear. |

### 描き直し

4枚は、最初のA案の絵を1枚目の参考画像にして描き直した。2枚目と3枚目の参考画像には、採用済みの絵（キャラはベニコウラとイナホイタチ、くすみの主はくすみ大猿とくすみ大鯉）を渡して、絵柄をそろえた。指示は次の形にした。

```
Redraw the creature shown in the FIRST reference image as a finished pixel art game sprite. Keep that creature's
design, pose and colors. Match the art style, outline weight, shading and palette of the OTHER reference images,
which are finished sprites from the same game, so it fits the same set. {題材} Facing right in a three-quarter view,
full body, centered, filling about 80% of a square canvas. Bold, clearly readable silhouette that still reads when
shrunk to 48x48 pixels; avoid tiny floating particles and thin wisps. Plain solid white background, no ground shadow,
no text, no border. {雰囲気} Original design that does not resemble any existing game, anime, or mascot character.
```

- 「avoid tiny floating particles and thin wisps」は、48×48に縮めたときに散らばる点が出ないように足した
- キャラは、雰囲気のあとに `It is a 'Sairei', a spirit of color from a Japanese-style (wafu) fantasy world.` を入れた（ボスには入れていない）
- 題材は上の表とほぼ同じ。ベニギツネは「red shrine-rope」の red を、ユウヒダヌキは「on its back」を省いた

## 組み込むときの処理

生成した絵（1024×1024）を、次の順で 48×48 にした。

1. 背景を抜く：白に近い色（RGBがすべて235より大きい）のつながった領域のうち、画像の端につながるものを透明にする。キャラの内側に閉じた領域でも、1500ピクセル以上で、ほぼ真っ白（9割以上がRGBすべて248以上）なら抜く
2. キャラの範囲で切り抜き、透明で正方形に広げる
3. 46×46に縮小する（LANCZOS）。半透明のピクセルは、不透明度が半分以上なら不透明、それ未満なら透明にする
4. 16色以下に減色する（メディアンカット、ディザなし）
5. まわりとつながっていない2ピクセル以下の点を消す
6. 48×48の真ん中に置き（上下左右に1ピクセルの余白）、透明色つきのパレットPNGで `src/assets/sprites/<キャラID>.png` に保存する

### 小さい絵（32×32）

候補の一覧・選んだ順の枠・控えに出す小さい絵は、48×48 の絵を縮めずに、同じ元の絵から上と同じ手順で作った（キャラ12体ぶん。ボスは作らない）。

- 3. の縮小を 30×30 にし、6. で 32×32 の真ん中に置く（上下左右に1ピクセルの余白）
- 保存先は `src/assets/icons/<キャラID>.png`

## マップのアイコン（24×24）

マップのマスのアイコンも A案（GPT Image 2.5、quality high、1k、正方形）で描いた。絵柄をそろえるため、参考画像に採用済みの絵（ベニコウラとイナホイタチ）を渡した。

| マス | ファイル | 題材 | 生成のジョブID |
| --- | --- | --- | --- |
| 戦闘 | `src/assets/map/battle.png` | 交差した刀 | ca546689-9b7e-4814-914f-a830670c028b |
| 強敵 | `src/assets/map/elite.png` | 鬼の面 | 941120af-9e6e-4a8a-bce4-dab767b2dc49 |
| 休憩 | `src/assets/map/rest.png` | 焚き火 | 7b6c4754-c016-47b7-b6a1-90a69ef35d57 |
| スカウト | `src/assets/map/scout.png` | 色が移り変わる人魂（新しい彩霊） | 2f4287e8-0989-4a14-bf34-ffec30d8d3d7 |
| イベント | `src/assets/map/event.png` | 道ばたの祠 | 1c1afbf4-38a7-4e96-830d-a94eb2a3fb3e |

- ボスのマスは、アイコンを作らずにボスのドット絵（48×48）を使う。ボス用に「目の光る黒い霧」も描いた（10cd4095-2ba9-4d7d-bf56-712520b335a0）が、24×24 に縮めると暗い背景の上でつぶれて見えなかったので使っていない
- 組み込みの手順はキャラと同じ。3. の縮小を 22×22 にし、減色は12色以下、6. で 24×24 の真ん中に置いた

指示の文は次の形で、`{題材}` にマスごとの文を入れた（スカウトとボスは「no glow halo」なども足した）。

```
Pixel art game map icon, a single object only, for a Japanese-style (wafu) fantasy roguelite map. {題材}
Centered, filling about 85% of a square canvas. Bold, very simple, clearly readable silhouette that still reads
when shrunk to 24x24 pixels; chunky pixels, limited palette of about 8 colors, dark 1-pixel outline, flat cel
shading, no blur, no gradients, no glow, no tiny details. Match the outline weight, shading and palette feel of
the reference images (finished sprites from the same game), but draw only the object described, not a creature.
Plain solid white background, no ground shadow, no text, no letters, no border. Original design.
```

| マス | 題材の文 |
| --- | --- |
| 戦闘 | Two crossed katana swords with dark red wrapped hilts and round guards, blades pointing up. |
| 強敵 | A fierce red oni demon mask with two short horns and small fangs, seen from the front. |
| 休憩 | A small cozy campfire: orange and yellow flames on a few crossed logs, with a ring of grey stones around it. |
| スカウト | A floating spirit wisp (hitodama): a round soft flame with a short curling tail, its colors shifting through red, orange, yellow, green, blue and violet like a rainbow. |
| イベント | A small old wooden roadside shrine (hokora) on a stone base, with a little gabled roof and a red cloth hanging in front. |

## 差し替えるとき

- `src/assets/sprites/<キャラID>.png` を、48×48・右向きの PNG で上書きすれば、コードを変えずに差し替わる
- 小さい絵は `src/assets/icons/<キャラID>.png`（32×32・右向き）。大きい絵を差し替えたら、小さい絵も同じ元の絵から作り直す
- マップのアイコンは `src/assets/map/<マスの種類>.png`（24×24）。ファイルがないマスは、これまでの1文字で出る（テスト `tests/ui/sprites.test.ts` は、5種類そろっていることを確かめる）
- 新しいキャラを足したときは、同じ名前で絵を置く。絵がなくても属性の色の四角で動く（テスト `tests/ui/sprites.test.ts` は、全キャラに絵があることを確かめるので、絵を足すまで失敗する）
- 差し替えたら、この表のジョブIDも書き換える
