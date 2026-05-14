sequenceDiagram
    participant User as ユーザー
    participant Client as MCPクライアント<br/>(Claude Desktop / Cursor等)
    participant LLM as LLM本体<br/>(Claude 3.5 / GPT-4o等)
    participant Server as MCPサーバー<br/>(fetch/brave-search等)
    participant Web as 阿部寛のホームページ

    User->>Client: 「阿部寛のHPを要約して」
    Client->>LLM: ユーザーの指示 + 利用可能なツールのリストを送る
    Note over LLM: 「HPを見る必要があるな。<br/>fetchツールのURL引数にURLを入れて実行しよう」
    LLM->>Client: 【ツール実行依頼】<br/>fetch(url="http://abehiroshi.la.coocan.jp/")
    
    Client->>Server: ツール実行命令を転送
    Server->>Web: HTTPリクエスト (HP取得)
    Web-->>Server: HTMLデータ（爆速で返却）
    Server-->>Client: 取得したテキストデータを返す
    
    Client->>LLM: 取得したテキストデータをコンテキストとして渡す
    Note over LLM: 「これがHPの内容か。よし、要約しよう」
    LLM->>Client: 要約テキストを生成
    Client->>User: 「阿部寛のホームページは非常にシンプルで…」と回答