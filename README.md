# 空間IDを用いた標高・風速データの可視化デモ

空間IDをキーとして標高および風速の数値タイルから情報を取得・可視化するためのデモです。

<img width="1200" alt="スクリーンショット 2025-04-17 17 16 47" src="https://github.com/user-attachments/assets/e1583926-c560-401a-b9f5-cbc2b3865ca8" />

## 構成

```
├── docs/ # デモUI本体（MapLibre Embed APIを利用）
└── scripts
    └── apiRequests.sh # 他社APIへのリクエストスクリプト（データ取得処理）
```

# 使い方
- アプリをブラウザで開き任意の場所をクリック
- クリック位置に対応する空間IDを取得し、標高・風速情報をAPIから取得。
- 表示スタイルのラジオボタンを切り替えることで、情報の種別を変更

## 参照データ
- 風速データ：気象協会（JWA）（2024/1/1 10:00 標高150mデータを使用）
- 標高：[国土地理院 数値標高モデルDEM10Bを使用](https://service.gsi.go.jp/kiban/app/help/#digital_elevation_model)

## 注意事項
- 本リポジトリに含まれる scripts/apiRequests.sh は、外部APIを呼び出すためのスクリプトです。実行するには、APIキーやアクセストークンが必要です。
