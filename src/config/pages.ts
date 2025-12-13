export interface Tool {
  name: string;
  description: string;
  href: string;
}

export const tools: Tool[] = [
  {
    name: "今年の流行語大賞",
    description: "LINE のチャット履歴を解析して今年の流行語を決めるツール",
    href: "/trend-analyzer",
  },
  {
    name: "LINE Chat History Viewer",
    description: "LINE のチャット履歴を表示・検索・管理するツール",
    href: "/line-chat-history-viewer",
  },
  {
    name: "Video Downloader",
    description: "YouTube などの動画をダウンロードするツール",
    href: "/video-downloader",
  },
  {
    name: "うまトマ語コンバーター",
    description: "うままううまママゔううう",
    href: "/umatoma",
  },
];
