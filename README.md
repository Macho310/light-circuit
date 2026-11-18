# 灯りの回路

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
- JavaScript: 既存の回路計算・問題データ・SVG描画・ドラッグ操作を維持
- CSS: 画面とピース置き場の表示
- Vite: 開発サーバーと静的ファイルのビルド
- GitHub Actions / GitHub Pages: mainへのpushで自動ビルド、公開は手動実行

`src/game.js` は動作維持を優先して既存JavaScriptを移植したものです。回路描画にはCanvasではなくSVGを使っています。

## 公開

リポジトリの Settings → Pages → Build and deployment の Source を **GitHub Actions** に設定し、Actions → Deploy GitHub Pages → Run workflow で publish を有効にして実行します。成功すると公開URLが表示されます。通常のmainへのpushではビルドのみ行います。専用のバックエンド・データベースは不要です。

## 現在の出題

6種類の用意済み問題からランダムに選び、盤面を回転して出題します。無制限に新しい回路を生成する方式や日替わり方式はまだ実装していません。

## 操作

- ドラッグで配置・移動、盤外へ戻して取り外し
- クリックで90度回転（盤面端では位置を自動調整）
- 答えを表示、新しい問題
- 一時的な部品の重なりは許可し、重なり解消後にクリア判定
