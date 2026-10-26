# My Memo 開発ルール

- ユーザー向けUIとドキュメントは日本語。対象はiPhone Safari、React + TypeScript + Vite + Tailwind CSS + Dexie、npm。
- 作業前にREADME.md、package.json、関連コードとgit statusを確認する。
- 各クラウドタスクは独立環境。既存チェックアウトを使い、明示的な依頼なしにGit worktreeを作成しない。
- データ操作はsrc/data/repository.tsへ集約。IndexedDBのスキーマ変更時はバージョンを追加し、既存データを壊さない移行テストを行う。
- カテゴリー名をIDとして使用しない。UUIDを保持し、将来の同期・Capacitor導入はUIと分離する。
- 保存エラーはユーザーへ表示し、編集内容を失わせない。削除は確認を必須にする。
- 外部URLはsrc/data/search.tsのsafeUrlを通す。HTTP/HTTPSのみ。リンクはnoopener noreferrer。動画の無断取得、サムネイル自動取得は行わない。
- モバイル優先。44px以上のタップ領域、セーフエリア、ダークモード、横スクロールなしを維持する。
- 機密値をソース・ログ・ドキュメントへ書かない。不要な依存追加を避け、npm lockfileを維持する。
- 機能変更後はnpm run buildとnpm test、UI変更はnpm run test:e2e。Safari環境がある場合npm run test:safariも実施する。未実行・失敗を隠さない。
- GitHubへのpush、外部公開はユーザーの明示的な許可を得る。

- 画像はJPEG/PNG/WebPのみ。デコード前にバイト数・形式・画素数を検証し、圧縮後のBlobを保存する。Object URLは不要時に解放する。
- 注釈は原画像と分離。座標は圧縮後画像のピクセル単位。外部データの文字をHTMLとして描画しない。
- バックアップは入力を信用せず形式・参照・画像を検証し、全体の置換を一つのDBトランザクションで行う。失敗時に既存データを保持するテストを維持する。
- PWA変更はnpm run build後にnpm run test:pwaで本番のオフライン再起動を検証する。未保存編集中に更新による再読み込みを行わない。
