# Light Circuit

ピースを配置・回転し、すべての電球の電流を目標値に合わせるブラウザパズル。

## 開発

Node.js 22以上を使用します。

```sh
npm ci
npm run dev
```

```sh
npm run build
npm run preview
```

## 構成

- React + TypeScript: 起動と画面のライフサイクル
- JavaScript: 分数による回路計算・シード付き問題生成・SVG描画・ドラッグ操作
- CSS: 画面とピース置き場の表示
- Vite: 開発サーバーと静的ファイルのビルド
- GitHub Actions / GitHub Pages: mainへのpushで自動ビルド、公開は手動実行

`src/game.js` がSVG描画と操作、`src/circuit.js` がUI・生成器共通の回路計算とクリア判定、`src/generator.js` が問題生成と全配置探索を担当します。生成は `src/generator.worker.js` のWeb Workerで実行します。

## 公開

リポジトリの Settings → Pages → Build and deployment の Source を **GitHub Actions** に設定し、Actions → Deploy GitHub Pages → Run workflow で publish を有効にして実行します。成功すると公開URLが表示されます。通常のmainへのpushではビルドのみ行います。専用のバックエンド・データベースは不要です。

## 現在の出題

4×4接続点・可動4ピース・固定素子2個・固定導線6本の問題を自動生成します。電池1個、電球5個、追加抵抗0〜4個（固定素子を含む）。追加抵抗数は最初に一様に選び、不採用候補の再生成中は維持します。

全電球が目標電流に一致し、固定・可動を問わず全電池・電球・抵抗に非ゼロ電流が流れる配置だけがクリアです。ショート・重なり・計算不成立はクリア不可。通常のクリア条件で解がちょうど1個であることを全配置探索で確認し、その唯一解では各行の横線・各列の縦線が必要であることも検証します。

ホームで日本時間の今日または過去の日付を選び、playでその日の問題を開始します。日付から一意にシードを決め、日付ごとの生成器バージョンも固定します。詳細は [docs/daily.md](docs/daily.md) を参照してください。

生成はWeb Workerで行い、生成中の二重開始を防止します。失敗時は未検証問題を出さず、ホームから同じ日付で再試行できます。

設計、上限、添付検証コードとの差分、測定結果は [docs/generation.md](docs/generation.md) を参照してください。

## 検証

```sh
npm test
npm run build
npm run benchmark:generation -- 20
```

最後のコマンドは抵抗数ごとに20要求を測り、再生成と探索を含む結果を `docs/generation-benchmark.json` に保存します。測定時間は問題データには含めません。

## 操作

- ドラッグで配置・移動、盤外へ戻して取り外し
- クリックで90度回転（盤面端では位置を自動調整）
- タイトルをクリックしてホームへ戻る
- タイマー横の記号で一時停止・再開（一時停止中は盤面とピースを隠す）
- クリア後はタイマーと操作を停止し、ホーム・結果コピーの記号ボタンを表示
- 一時的な部品の重なりは許可し、重なり解消後にクリア判定
