export interface Tool {
  name: string;
  description: string;
  href: string;
}

export const tools: Tool[] = [
  {
    name: "Line Chat History Viewer",
    description: "LINEのチャット履歴を表示・検索・管理するツール",
    href: "/line-chat-history-viewer",
  },
  {
    name: "Video Downloader",
    description: "YouTubeなどの動画をダウンロードするツール",
    href: "/video-downloader",
  },
  {
    name: "かなカナ/うまトマ語コンバーター",
    description: "うままううまママゔううう",
    href: "/umatoma",
  },
];
