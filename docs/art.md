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

## コマ送りアニメ（M7-3）

バトルの場のキャラの待機の動きは、4コマのコマ送りアニメにした（仕様書 7 の M7-3）。上の「採用した絵」の元の絵を参考画像にして、GPT Image 2.5（Higgsfield。quality high、1k、正方形）で、4コマを2×2に並べた1枚を描いた。

- 48×48 の止まった絵（`src/assets/sprites/`）と32×32 の小さい絵（`src/assets/icons/`）も、このアニメの1コマ目から作り直した（絵柄をアニメとそろえるため）
- ベニギツネとヨモギガエルは、試作のときに描いたものをそのまま使った

| ID | 名前 | 動き | 生成のジョブID |
| --- | --- | --- | --- |
| crimson-trial | ベニギツネ | しっぽの炎がゆれる・耳が動く | 89615f59-e47d-4816-b505-37380b1f9c63 |
| crimson-guard | ベニコウラ | 首を出し入れ・しっぽが動く | 71d2f7f0-b23a-4d4b-80f8-90fb78bb2bef |
| orange-trial | ユウヒダヌキ | 体がふくらむ・しっぽがゆれる | c7565176-cdee-4ef5-9288-84d1f192b59b |
| orange-raider | カキザル | 身構えて弾む・しっぽがゆれる | 41e7a768-57e6-4e66-a264-aec7bf234ae4 |
| yellow-trial | イナホイタチ | 稲穂のしっぽがゆれる | ce3c561d-fa06-4018-a0b9-797e81d6664c |
| yellow-trickster | ナノハナバチ | 羽ばたく | 1ac0b93a-8599-4bfc-acad-67bce8c531d4 |
| green-trial | ヨモギガエル | のどがふくらむ・葉がゆれる | 378c2263-6804-4192-ad99-1f1fd76d984e |
| green-charger | タケジカ | 首と耳が動く・角の葉がゆれる | 1b367380-96f6-46cd-9bb5-623c5fe54c7d |
| blue-trial | シズクサギ | 首がゆれる・羽が動く | 5f1f0472-547e-4259-bf7e-a7c18ba34906 |
| blue-skirmisher | アオシャチ | 尾びれとひれが動く | 2316c075-89de-4e1b-bf17-f499df528ab3 |
| violet-trial | フジチョウ | 羽を開いて閉じる | 789dadf8-f95a-426e-91d6-93a08c29d962 |
| violet-warden | スミレヘビ | 首がゆれる・とぐろがふくらむ | 41632d00-a132-4d4f-9f85-9f234c5663da |
| crimson-boss | くすみ大猿 | 肩で息をする・もやが動く | b8cc3ad5-339d-4269-b55c-0bf03d37f0f2 |
| blue-boss | くすみ大鯉 | 体とひれがうねる・墨の水が動く | ceca4c37-026d-4f65-9728-c9b4d540ea5d |
| violet-boss | くすみの主 | 霧がうごめく・目が光る | 31e795cb-d250-4641-a2ba-249e759cfdb7 |

指示の文は次の形で、`{題材}` に上の「題材」とほぼ同じ文、`{足もと}` に「feet planted on the same spot in every frame」（飛ぶ・泳ぐキャラは「hovering at the same spot」など）、`{動き}` にキャラごとの動き、`{雰囲気}` にボスだけボスの雰囲気の文を入れた。

```
Pixel art idle animation sprite sheet of the exact creature shown in the reference image ({題材}). Draw 4 animation
frames arranged in a 2x2 grid on a square canvas: frame 1 top-left, frame 2 top-right, frame 3 bottom-left, frame 4
bottom-right. Every frame shows the same creature with the identical design, colors, outline, size, scale and position
inside its cell, facing right in the same three-quarter view, {足もと}. Only small idle changes between frames: {動き}.
Keep the same pixel art style as the reference: chunky pixels, limited palette, dark 1-pixel outline, flat cel
shading, no blur, no gradients. Bold silhouette that still reads when shrunk to 48x48 pixels; avoid tiny floating
particles. Plain solid white background in every cell, no grid lines, no borders, no numbers, no text, no ground
shadow. {雰囲気} Original design that does not resemble any existing game, anime, or mascot character.
```

組み込みの手順は、上の「組み込むときの処理」とほぼ同じ。コマのあいだで絵がずれたり色が変わったりしないように、次の2つを変えた。

- 2×2 を4つに分けて背景を抜いたあと、4コマすべてが入る範囲（4コマの範囲を合わせたもの）で、同じように切り抜く（コマごとに切り抜くと、コマごとに位置と大きさが変わってしまう）
- 16色に減らすときは、4コマを並べた1枚からパレットを作り、4コマとも同じパレットを使う
- 4コマを左から順に横に並べ、192×48 の PNG で `src/assets/anim/<キャラID>.png` に保存する

## カラスウサギ（M8）

ライバル・クロの相棒の2体（仕様書 7 の M8-2）。カラスとウサギを合わせたオリジナルキャラ「からすうさぎ」の絵（白いウサギの体に、カラスの黒い翼・くちばし・尾羽）をもとに描いた。もとの絵は生成サービスに送れなかったので、特徴を文で伝え、参考画像には採用済みの絵（ベニコウラとイナホイタチ）を渡して絵柄をそろえた。GPT Image 2.5（Higgsfield。quality high、1k、正方形）。

| ID | 名前 | 止まった絵の生成 | コマ送りアニメの生成 | 動き |
| --- | --- | --- | --- | --- |
| white-twin | シラハウサギ | 7a58ed2c-e65a-4ac8-91a0-04f464be5f35 | 50198a19-e4b5-41df-9fcd-51706d7b99f5 | 耳が動く・翼が小さく開く・胸の毛がふくらむ |
| black-twin | クロハウサギ | e22cae33-611e-49d1-8c50-cda759756512 | 9322d8bb-1986-4819-b401-de3362b52675 | 同じ |

- 黒は、白の色を反転した案（黒い体に白い翼・くちばし・尾羽）を採用した。全身を黒にしてつやを足した案（a9b175dc-209d-44e9-8f96-445acf8095f8）は、48×48 に縮めると暗い背景に沈み、紫属性にも見えたので使っていない
- 白は、白い体が白い背景と一緒に抜けないように、背景を緑（#00FF00）で塗ってもらい、画像の端につながる緑を抜いた。黒は、ほかのキャラと同じ白い背景
- 止まった絵の指示は「描き直し」の文に近い形で、`{題材}` に次の文を入れた（黒は色を反転した文。顔が黒に埋もれないよう、目に白い光を入れるよう足した）
  - `A 'crow-rabbit' (karasu-usagi): a small, round, chubby rabbit with a white body and head (soft white with light gray shading), two long upright rabbit ears with light gray insides, two small black dot eyes, a small black triangular crow beak in place of a rabbit nose, a fluffy white chest ruff, short white rabbit feet, small black crow wings on both sides of its body, and a short tuft of black crow tail feathers at the back.`
- コマ送りアニメは、上の「コマ送りアニメ」と同じ指示の形で、止まった絵の生成を参考画像にした。組み込みの手順もほかのキャラと同じ（48×48・32×32・192×48）

## 彩り手の相棒（M8）

彩り手の相棒の彩霊（仕様書 4.6・5.1）。GPT Image 2.5（Higgsfield。quality high、1k、正方形）で、参考画像には採用済みの絵（ベニコウラとイナホイタチ）を渡して絵柄をそろえた。止まった絵を描いてから、その絵を参考画像にしてコマ送りアニメを描き、48×48 の止まった絵と32×32 の小さい絵はアニメの1コマ目から作った（カラスウサギと同じ手順）。どれも1回目の生成を採用した。

| ID | 名前 | 止まった絵の生成 | コマ送りアニメの生成 | 動き |
| --- | --- | --- | --- | --- |
| hina-partner | サクラシバ | e8baaf90-b84c-4202-b016-a1f0fbed86f8 | ca8f8dac-a637-460f-9fd7-faf5b120d88e | しっぽが左右にゆれる・耳が動く・しっぽの桜がゆれる |
| wata-partner | キビタキ | ea6bd441-8ade-441a-ab9d-326d1f49ff90 | 3832b815-0ece-4a72-b926-58ca5ad38a4c | 首をかしげる・尾羽が開いて閉じる・翼が動く |
| sou-partner | ヨイミミズク | 0c10b467-edfb-495d-80a9-96c498280fb4 | 1e6b695b-5141-4ffa-a34c-730186ad874c | 羽角が動く・1コマだけまばたき・胸の羽がふくらむ |
| morie-partner | コムギネコ | 1d1ee3a6-0334-4101-98cc-1c872a25e67e | c1a13659-e486-434d-956b-65c1028ad86a | 丸い体が息でふくらむ・耳が動く・1コマだけゆっくりまばたき・頭の麦の穂がゆれる |
| yuhi-partner | カラクサジシ | 5fadc1b7-8fca-4b4d-a024-d39214c97d1d | ce41c6d8-acb6-414e-85ce-31257391abdc | 胸が上下する（息）・たてがみがふくらむ・しっぽがゆれる |
| rin-partner | ミナモイヌ | 0e0599ef-74c2-4bad-9996-9ee32e1dba8f | a2386324-7f1b-4741-ae37-5633de178e18 | 水しぶきのしっぽがゆれる・耳がはねる・首をかしげる |

- 止まった絵の指示は、上の「生成の指示」の共通の文に、参考画像の絵柄に合わせる文（「Match the art style, outline weight, shading and palette feel of the reference images, which are finished sprites from the same game, but draw only the creature described here.」）と、「avoid tiny floating particles and thin wisps」を足した形。`{題材}` は次の文
  - サクラシバ：`A cheerful, energetic shiba inu (Japanese dog) spirit with crimson-red fur and a cream chest and muzzle, pointed ears, a tightly curled tail with a few cherry blossoms blooming at its tip, and a small cherry-blossom pink neckerchief. Main color: crimson red, with cherry-blossom pink accents.`
  - キビタキ：`A small, round songbird spirit modeled on a narcissus flycatcher (kibitaki): a bright golden-yellow throat, chest and eyebrow stripe, a dark charcoal back and wings with one white wing patch, and a slightly fanned tail whose tips glow golden yellow. It stands alert on short legs with its head tilted, as if listening. Main color: bright golden yellow.`
  - ヨイミミズク：`A round, plump horned owl spirit (mimizuku) in deep evening violet, with prominent feather ear tufts, a lighter lavender facial disc, large calm amber eyes, and a pattern of small pale star shapes on its folded wings like the early evening sky. It stands upright on short legs, calm and dependable. Main color: deep evening violet.`
  - コムギネコ（描き直し後）：`A round, plump, chubby cat spirit shaped like a freshly baked loaf of bread: a toasted orange-brown crust-colored back and head, a soft cream belly and paws like the inside of bread, short legs tucked in a loaf pose, a short stubby tail, half-closed content eyes, and one small wheat sprig sticking up from the top of its head. It must look round and soft, not slender, and must not look like a weasel. Main color: toasted bread orange-brown.`（この絵だけ、向きの文を「sitting in a loaf pose」、大きさを「filling about 80%」にした）
  - コムギネコ（はじめの絵。細身で麦の穂のしっぽが、イナホイタチと似ていたので描き直した）：`A nimble, slender cat spirit with warm wheat-orange fur and soft golden stripes, a long tail whose tip looks like a ripe ear of wheat, large bright eyes, and a playful, mischievous pose with one front paw raised. Main color: warm wheat orange.`（止まった絵 aab4e032-85c0-465b-afcd-a422b652d70e、アニメ 6fd4135f-69bb-4aa2-8193-d8a4fec7cdb2）
  - カラクサジシ：`A sturdy, proud young lion spirit in the style of a Japanese guardian lion (shishi), with a big curly mane patterned with green arabesque vine scrolls (karakusa), a deep green and jade body, a thick tufted tail, and a confident stance. Main color: deep jade green.`
  - ミナモイヌ：`A friendly medium-sized dog spirit with water-surface blue fur, a lighter blue chest, floppy ears, a ripple-like pattern of pale blue rings on its back like the surface of a pond, and a tail shaped like a curling water splash. Main color: clear water blue.`
  - 2回目の3体（コムギネコ・カラクサジシ・ミナモイヌ）も、どれも1回目の生成を採用した。ミナモイヌのアニメの指示には、離れた水しぶきが点にならないよう「avoid ... separate droplets」を足した
- コマ送りアニメの指示は、上の「コマ送りアニメ」と同じ形（`{足もと}` は3体とも「feet planted on the same spot in every frame」。描き直したコムギネコは「sitting on the same spot in every frame」）

### 残りの12体（M8）

彩り手を18人そろえるときに、残りの12人の相棒を一度に描いた。手順と指示の形は上の6体と同じ。12体の止まった絵を並べて、今のキャラ（ふつうのキャラ・カラスウサギ・相棒）と色と形が似ていないかを見比べ、似ていた2体（ツキミギツネとウミウマ）は描き直した。

| ID | 名前 | 止まった絵の生成 | コマ送りアニメの生成 | 動き |
| --- | --- | --- | --- | --- |
| master-partner | イリマメヤギ | 2273ded3-41e3-4967-bdf6-850ebfb4cb83 | 51e5c6bc-6811-428d-84a9-23213cf19115 | 首を小さく振る・耳が動く・短いしっぽを振る |
| dai-partner | セトガニ | 27079913-9323-4ba6-9d7a-b3b9c6e5cbcc | 31d40914-e5b9-48c4-87fe-f2630386e445 | 大きなはさみが上下する・小さなはさみが開いて閉じる・目が動く |
| sunny-partner | アカネヅル | 7ebe95e6-a851-4e48-b54a-d8ee719ef830 | 0ca6c097-2c8a-4203-a7e6-8b6a8038fc93 | 紙の翼が少し開いて閉じる・長い首が上下する |
| taisho-partner | キナコグマ | f59370cf-5b02-4833-96bf-014bceecc3c2 | 2dc5ffef-554a-4e71-907a-c020b52b4937 | 体が息でふくらむ・首をかしげる・丸い耳が動く |
| miu-partner | ビワカワウソ | 98715da9-3abf-49f6-a7ca-dda275ff360a | a206a565-2f6d-4c4b-a337-57fa8e2bccb6 | 体が左右に少しゆれる・ひげと耳が動く・頭の葉がゆれる |
| shu-partner | イカヅチイヌ | 15713ab2-37af-4cd7-b401-d7ab61e2f49c | 01710749-ca12-450c-8858-82cc2faace16 | 体が身構えて上下する・稲妻のしっぽが動く・たてがみが逆立つ |
| maru-partner | ツキミギツネ | caa74c32-864a-4d3d-895a-db0ef6e55782 | 7f3f2643-1344-4e72-b52d-8b6d07279408 | 耳が動く・1コマだけ目を閉じる・胸が息で上下する・しっぽの先が動く |
| otakara-partner | マネキネコ | 482058ad-07a9-4cc0-a9b6-3c54129d5bf2 | e4f04612-48e4-41cc-a6fa-5a3b65681b92 | 上げた手で招く・鈴がゆれる・しっぽがゆれる |
| kasa-partner | ネジトンボ | badd35f7-d3f2-45ec-95ac-842f73ba3c70 | 4a5f7e9c-c660-45d1-a6f4-db264f1d3e27 | 4枚の羽が上下する・しっぽが少し上下する |
| taka-partner | ルリコウモリ | 94a748a8-1f7c-42a8-91d7-b73fe3475222 | 2a23c74e-3af0-4c36-bca0-238308e29473 | 翼が少し上下する・耳が動く |
| kai-partner | ウミウマ | 4f964400-00cd-4e4a-b039-2df176cd1f6f | 1a8b3d5e-f506-4a51-b046-46407cda90c1 | 首を小さく振る・波頭のたてがみとしっぽがゆれる・前足を少し上げて下ろす |
| tatsumichi-partner | コウロリュウ | 71bb7fe8-6843-42b8-b950-76821d02b84e | 185c72fa-2031-4eeb-91fb-2f3556ad9093 | 体が少しうねる・たてがみがゆれる・しっぽの先の煙の形が変わる |

- 止まった絵の `{題材}` は次の文
  - イリマメヤギ：`A calm, gentle young goat spirit with roasted-coffee-bean crimson and dark red-brown fur, small curled horns shaped like roasted beans, a fluffy cream beard, and a steaming-cup shaped marking on its side. Main color: deep roasted crimson red.`
  - セトガニ：`A sturdy crab spirit with a bright crimson-red shell, one oversized hammer-like claw raised proudly, a smaller second claw, and pale sea-foam wave markings on its shell like the calm waves of an inland sea. Main color: bright crimson red.`
  - アカネヅル：`A graceful crane spirit that looks like a large folded origami paper crane come to life, with crisp angular paper-fold wings in madder orange (akane) and warm sunset orange, a long folded neck, and a small crimson crest. Main color: madder orange.`
  - キナコグマ：`A big, round, cheerful bear cub spirit with warm orange-brown fur, a cream belly, a pattern of small bean-shaped spots on its back, round ears, and a happy, sturdy posture. Main color: warm orange.`
  - ビワカワウソ：`A chubby, round river otter spirit standing upright on its hind legs, hugging a big round loquat (biwa) fruit with both front paws, with loquat-orange fur, a round cream face with whiskers and a wide surprised mouth, small round ears, webbed feet, a thick tail curled on the ground, and a loquat leaf on its head. It must look plump and upright, not slender, and must not look like a weasel or cat. Main color: loquat orange.`
  - イカヅチイヌ：`A fierce, wiry thunder beast spirit (raijuu) with a lean wolf-like body, bright electric-yellow fur with dark charcoal stripes, a jagged lightning-bolt shaped tail and spiky mane tufts, and sharp golden eyes. Main color: electric yellow.`
  - ツキミギツネ：`A compact fox spirit sitting upright and perfectly still like a Japanese shrine guardian fox statue: pale golden moon-yellow fur with a cream chest, upright pointed ears, a bright red cloth bib tied around its neck, a small crescent-moon mark on its forehead, calm narrow eyes, and a short neat tail curled tightly around its front paws. It must NOT have a big fluffy or flowing tail, must not be slender or walking, and must not look like a weasel. Main color: pale moon yellow, with a bright red bib accent.`（向きの文は「sitting upright」）
  - マネキネコ：`A round lucky beckoning cat spirit in the traditional maneki-neko style, with golden-yellow and cream fur, one front paw raised in a beckoning gesture, a red collar with a small gold bell, and a small plain gold oval coin (koban, no letters or symbols) held against its chest with the other paw. Main color: golden yellow.`
  - ネジトンボ：`A mechanical clockwork dragonfly spirit (karakuri) with a bamboo-green body made of jointed wooden segments, four broad leaf-green wings drawn as solid shapes with brass screw joints at the base, and large round green eyes. Main color: bamboo green.`
  - ルリコウモリ：`A small round bat spirit with deep lapis-lazuli blue fur, large rounded ears, wide wings with lighter blue membranes spread out, tiny fangs, and wise, curious eyes. Main color: lapis blue.`
  - ウミウマ：`A sturdy, muscular, thick-necked horse spirit with a solid deep indigo-navy blue coat, a big white sea-foam mane and tail shaped like the crests of breaking waves, white lower legs like foam, and dark hooves, standing proud with its head held high. The body is plain dark navy with no swirl, spiral, ring or ripple patterns, and it is not light blue. Main color: deep indigo navy blue, with white foam accents.`
  - コウロリュウ：`A small eastern dragon spirit with a large, clearly drawn dragon head (taking up about a third of the figure) with two short antlers, a long snout, bright amber eyes and a lavender mane, and a solid violet scaled serpentine body coiled in a compact S-shape below it. Only the tail tip turns into a few thick, solid curls of incense smoke. A small incense-burner shaped ornament hangs at its chest. Main color: deep violet.`
- 描き直した4体（使っていない絵）
  - ビワカワウソ：細身のカワウソ（8dc42da6-f94b-4c95-9862-b6f22b962be3）は、イタチに見えたので、立ってびわを抱える丸いカワウソに描き直した
  - コウロリュウ：煙でできた龍（5cc6d31d-754e-4732-aea3-f6eae694b0c1）は、48×48 に縮めると紫の煙のかたまりになり、何か分からなかったので、頭をはっきり描いた龍に描き直した
  - ツキミギツネ：大きなしっぽの狐（5a19d795-240f-4f51-bfc7-ee352781ebc3、アニメ 59720603-ba28-44ed-adcf-c41222bc85ab）は、黄色・細身・大きなしっぽがイナホイタチと似ていたので、社の狐の像のように座る姿（赤い前掛け・額に三日月・しっぽは足もとに巻く）に描き直した
  - ウミウマ：明るい青の馬（e4c1d8d2-3091-4715-95ac-8d6abc3fc005、アニメ 734256f4-8e02-4e1b-874d-7258a4fcc56b）は、明るい青と渦の模様がミナモイヌと似ていたので、藍色の体に白い波頭のたてがみの馬に描き直した
- コマ送りアニメの `{足もと}` は、ふつうは「feet planted on the same spot in every frame」。セトガニは「legs planted」、ウミウマは「hooves planted」、ツキミギツネとマネキネコは「sitting on the same spot」、ネジトンボとルリコウモリは「hovering at the same spot」、コウロリュウは「floating at the same spot」。避けるもの（avoid）には、イカヅチイヌは「sparks」、ウミウマは「separate droplets」、コウロリュウは「haze」を足した

## 彩り手（M8）

主人公の「彩り手」19人（クロを含む。仕様書 4.6・5.1）。64×64 の全身のドット絵。モチーフにした人の見た目には似せず、みんな同じ旅笠と羽織の旅装束にして、顔は笠の影に入れ、顔立ちや性別は描き込まない。だれか分かるのは、持ち物と羽織の色だけにした。GPT Image 2.5（Higgsfield。quality high、1k、正方形）で、参考画像には採用済みの絵（ベニコウラとイナホイタチ）を渡して絵柄をそろえた。

| ID | あだ名 | 生成のジョブID | 備考 |
| --- | --- | --- | --- |
| kuro | クロ | 971791f7-253e-4ab3-9a62-2b053d0f059e | 絵柄の試作 |
| hina | ヒナ | f84b345f-9c39-4a20-bc16-2edf06981f27 | 絵柄の試作。旗を短く描き直した（下） |
| master | マスター | 51a33a08-32de-44b1-8aed-cb24e3404b16 | 絵柄の試作 |
| dai | ダイ | afbd469b-342d-4775-b438-c7b915c90a68 | |
| sunny | サニー | 96e637b3-7028-452b-9701-15555f535349 | |
| morie | モリエ | f5d01c1a-94b2-4041-b09a-b521355ae13b | |
| taisho | 大将 | 47dcd1cf-64dc-478b-8e29-1123f5e9af7c | |
| miu | ミウ | 2428a2c7-c577-4e33-8ee2-662395fefe27 | |
| wata | ワタ | 1478384e-a5f0-46a6-9e65-50f6351a8fb2 | |
| shu | シュウ | 8c3d6b84-5cb6-4ff0-9c34-540e0dc7628c | |
| maru | マル | 25a71683-f779-4414-96f2-17d2ea6f4bb8 | |
| otakara | オタカラ | 1d5e823f-d3fb-426e-b9ac-ddab9e3a17d7 | |
| yuhi | ユヒ | eb766671-0b3a-4c9a-94f6-aa5f3b941af7 | |
| kasa | カサ | a456147c-c95c-4ed8-8106-7337ea8296c9 | |
| taka | タカ先生 | 79b2b6ca-28b0-4a3d-a2ba-3d530a44f1b7 | |
| kai | カイ | 1dcf93e1-f5c9-42ca-9052-c533c20ba9c3 | |
| rin | リン | 2c59bf7b-f9da-4373-b898-e5d96754c98d | |
| tatsumichi | タツミチ | 0b640d3c-90f3-4c12-b507-ed57a4265777 | |
| sou | ソウ | eb7c96aa-070a-461e-80c0-93fa3d3c4895 | |

- まず3人（クロ・ヒナ・マスター）で絵柄を決め、残りの16人を同じ指示の形で描いた。どれも1回目の生成を採用した
- ヒナは、はじめの絵（ce2fb3c5-7484-4c33-a7ce-b5795b2f39d8）ののぼり旗が笠より高く伸びていて、長い辺を62ピクセルに縮めると、人物がほかの彩り手より一回り小さくなった。はじめの絵を参考画像にして、旗だけを「短い竿で胸の高さに持ち、旗の上端が笠より下にくる」形に描き直した（指示の `{持ち物}` の代わりに「change only the banner: the nobori banner flag is now SHORT and held in one hand at chest height, on a short bamboo pole, and the top of the flag stays clearly BELOW the top of the hat」と書いた）。旗を肩にかついで後ろに倒した案（a18caf41-8f97-489c-b420-1523ca98ac5a）は使っていない
- 指示は次の文で、`{羽織}` に羽織の色と柄、`{持ち物}` に4.6 の表の持ち物、`{色}` にいちばん多く使う色を入れた。残りの16人では、64×64 でも持ち物が読めるように「The held items are drawn large and clear so they read at small size.」を足し、避けるものに「sparkles and thin wisps」を足した
  - `Pixel art game sprite of a single small chibi human traveler, an 'Irodorite' (a person who travels with color spirits) from a Japanese-style (wafu) fantasy world where colors are slowly fading. Match the art style, outline weight, shading and palette feel of the reference images, which are finished sprites from the same game, but draw only the person described here. The traveler wears a wide conical straw travel hat (kasa) pulled low so the face is mostly shaded and simple (no detailed facial features, gender-neutral), and a short {羽織} haori jacket over plain travel clothes and straw sandals. Held items: {持ち物}. Main accent color: {色}. Facing right in a three-quarter view, full body, standing, centered, filling about 85% of a square canvas, chibi proportions (big hat, small body). Bold, clearly readable silhouette that still reads when shrunk to 64x64 pixels; chunky pixels, limited palette of about 16 colors, dark 1-pixel outline, flat cel shading, no blur, no gradients; avoid tiny floating particles. Plain solid white background, no ground shadow, no text, no letters, no border. Original design that does not resemble any existing game, anime, or mascot character.`
- 組み込みの手順はキャラと同じ（白い背景を抜き、16色に減らす）で、大きさだけ変えた。長い辺を62ピクセルに縮めて、64×64 の真ん中に置き、`src/assets/irodorite/<彩り手のID>.png` に保存する
- 止まった絵だけで、コマ送りアニメと小さい絵はまだない
- クロの絵は、マップの「ライバル」のマスのアイコンにも使う。同じ元の絵から、長い辺を46ピクセルにして 48×48 の真ん中に置き、16色に減らした（`src/assets/map/rival.png`。ボスのマスと同じ大きさ）

## 差し替えるとき

- `src/assets/sprites/<キャラID>.png` を、48×48・右向きの PNG で上書きすれば、コードを変えずに差し替わる。バトルの場では `src/assets/anim/<キャラID>.png`（192×48・4コマ）を使うので、止まった絵を変えたらアニメも作り直す（アニメの1コマ目と止まった絵はそろえる）
- 小さい絵は `src/assets/icons/<キャラID>.png`（32×32・右向き）。大きい絵を差し替えたら、小さい絵も同じ元の絵から作り直す
- マップのアイコンは `src/assets/map/<マスの種類>.png`（24×24）。ファイルがないマスは、これまでの1文字で出る（テスト `tests/ui/sprites.test.ts` は、5種類そろっていることを確かめる）
- 新しいキャラを足したときは、同じ名前で絵を置く。絵がなくても属性の色の四角で動く（テスト `tests/ui/sprites.test.ts` は、全キャラに絵があることを確かめるので、絵を足すまで失敗する）
- 彩り手の絵は `src/assets/irodorite/<彩り手のID>.png`（64×64・右向き）。テスト `tests/ui/sprites.test.ts` は、19人そろっていることを確かめる
- 差し替えたら、この表のジョブIDも書き換える
