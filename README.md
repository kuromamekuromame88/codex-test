# Gamepad FPS Arena (Three.js)

GitHub Pages でそのまま配信できる、Three.js 製の静的 FPS 風ゲームです。明るい屋外ステージに建物・遮蔽物を配置し、撃ち合いができる構成です。ジャンプで登れる段差足場を、プレイヤーのジャンプ到達高度に合わせて配置しています。

## 操作

- マウス + キーボード
  - クリック: ゲーム開始（Pointer Lock）
  - マウス移動: 照準
  - 左クリック: 射撃
  - `W/A/S/D`: 移動
  - `Space`: ジャンプ
- USB ゲームパッド
  - 左スティック: 移動
  - 右スティック: 視点移動（照準）
  - `R2/RT`（または `R1/RB`）: 射撃
  - `A` ボタン: ジャンプ

## GitHub Pages 公開

このリポジトリは `.github/workflows/deploy-pages.yml` で、**リポジトリ root の静的ファイル**を GitHub Pages にデプロイします。

1. GitHub の **Settings → Pages** で Source を **GitHub Actions** に設定
2. `main` ブランチへ push
3. Actions の `Deploy static site to GitHub Pages` が成功したら公開完了

## ローカル確認

```bash
python3 -m http.server 4173
```

ブラウザで `http://localhost:4173` を開いて動作確認できます。
