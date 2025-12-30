export interface Tool {
  name: string;
  description: string;
  href: string;
}

export const tools: Tool[] = [
  {
    name: "今年の流行語大賞",
    description: "LINE のチャット履歴を解析して今年の流行語を決める",
    href: "/trend-analyzer",
  },
  {
    name: "LINE Chat History Viewer",
    description: "LINE のチャット履歴を表示・検索・管理",
    href: "/line-chat-history-viewer",
  },
  {
    name: "うまトマ語コンバーター",
    description: "うままううまママゔううう",
    href: "/umatoma",
  },
  {
    name: "レスバとジェネレータ",
    description: "AI に不毛なレスバトをしてもらう",
    href: "/ai-dystopia",
  },
];
