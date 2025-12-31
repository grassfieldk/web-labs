export interface Tool {
  name: string;
  description: string;
  href: string;
}

export const tools: Tool[] = [
  {
    name: "レスバトジェネレーター",
    description: "AI に不毛なレスバトをしてもらう",
    href: "/ai-dystopia",
  },
  {
    name: "LINE 流行語大賞",
    description: "LINE のチャット履歴から流行語を選出",
    href: "/line-trend-analyzer",
  },
  {
    name: "LINE チャット履歴ビューア",
    description: "LINE のチャット履歴を表示・検索",
    href: "/line-chat-history-viewer",
  },
  {
    name: "うまトマ語翻訳機",
    description: "うままううまママゔううう",
    href: "/umatoma",
  },
];
