# PHASE 3 外部リンク・共有の対応範囲

2026-10-31。既存の [MDN BCD確認結果](../releases/0.5.0-browser-compat.json) を基準にしています。実OSの共有先登録はこの環境で確認できていません。

| 機能 | 対応・制約 |
| --- | --- |
| URL・文章の貼り付け | Safariを含む通常の入力操作。＋→本文へのペーストでURLカードも保存。元のURLと文章は維持。 |
| Instagram / TikTok / X / YouTubeなど | ドメイン名でサービス表示。ログイン情報を求めず、元サイトへ移動。投稿内容を推測しない。 |
| プレビュー | YouTubeの公開動画のoEmbedに限定。利用者が「YouTubeに接続して取得」を押した時だけ動画IDを含む正規化URLを送る。任意のサイトをプロキシ取得しない。 |
| サムネイル | oEmbedが返したHTTPSのYouTube画像ホストのURLだけ保存。画像表示は別の明示操作。再起動後・バックアップ復元後も勝手に読み込まない。画像データ自体はバックアップしないため、オフラインでは保存済みタイトルとURLで利用。 |
| 取得失敗 | HTTPエラー・CORS制限・非公開・削除・通信切断・8秒タイムアウト時は理由を表示し、URLと前回取得済み情報を維持。 |
| 他サイトのメタデータ | API・認証・CORS条件を確保できないため未対応。URLと利用者の文章のみ。 |
| 他アプリからiPhone PWAへ | iOS SafariはWeb Share Target非対応。共有先にMy Memoを追加できると表示しない。元アプリでコピーしMy Memoへペースト。直接受け取りには将来iOS Share Extension等のネイティブ実装が必要（Capacitor導入だけでは完成しない）。 |
| 対応ブラウザからPWAへ | manifestのWeb Share Targetを追加。GET /share-targetでタイトル・文章・URLを受け取り、確認画面を開く。保存前に同じURLを検出。OSの共有先登録は未検証。 |
| My Memoから送信 | 既存のWeb Share APIとコピーを維持。利用者が送る文章を確認・編集してから操作。 |

## 外部通信・費用

YouTubeへの取得はAPIキー・追加の有料契約なしのoEmbedリクエストです。サービスの提供継続や無制限利用を保証しません。ユーザーのネットワーク通信料が発生する場合があります。資格情報・Cookie・Refererを送らず、動画ファイルや投稿全体は取得しません。画像表示時もRefererを送信しません。成人向けサイトのプレビューやサムネイルは取得しません。

Web Share TargetのGET方式はURLクエリに共有内容を含むため、端末の履歴やホスティングのアクセス記録に残る可能性があります。確認画面を保存・閉じた際には現在のURLから共有パラメータを除去しますが、外部ログの削除は保証しません。秘密情報は共有メニュー経由で送らず、アプリを開いて本文へ貼り付ける方法を使ってください。受信だけでメモを保存・プレビュー取得することはありません。

このクラウド環境からYouTube oEmbedと既存NetlifyサイトへのHTTP接続はプロキシの403で拒否されました。oEmbedの成功・失敗・不正応答、外部送信のタイミングはモックで検証し、実際の公開動画からの取得成功とは区別しています。実機で取得できなければURLのみで利用できます。

参照： [Web Share Target](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/share_target)、[Web Share API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Share_API)、[WebKit iOS 16.4 Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)。リンク先の最新変更は公開前に再確認してください。
