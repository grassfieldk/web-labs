"use client";

import React, { useState, ChangeEvent } from "react";

type Message = {
  date?: string;
  time?: string;
  sender?: string;
  content: string;
};

export default function ChatPage() {
  // State to hold the parsed messages and partner name
  const [messages, setMessages] = useState<Message[]>([]);
  const [partnerName, setPartnerName] = useState<string>("");

  // State to control the visibility
  const [showStamps, setShowStamps] = useState(true);
  const [showMedia, setShowMedia] = useState(true);

  React.useEffect(() => {
    console.log(`Partner name changed to: "${partnerName}"`);
  }, [partnerName]);

  /**
   * Parse exported LINE chat data into Message objects and extract partner name.
   * @param text - Raw text content from the exported .txt file.
   */
  const parseLineData = (text: string) => {
    const lines = text.split("\n");
    const header = lines.find((l) => l.includes("とのトーク履歴")) || "";
    const m = header.match(/\[LINE\]?\s*(.+?)とのトーク履歴/);
    if (m) setPartnerName(m[1].trim());

    const result: Message[] = [];
    let currentDate = "";

    for (let raw of lines) {
      raw = raw.trim();
      if (!raw) continue;
      if (/^\d{4}\/\d{2}\/\d{2}/.test(raw)) {
        currentDate = raw;
        result.push({ date: currentDate, content: "" });
        continue;
      }
      const parts = raw.split("\t");
      if (parts.length >= 3) {
        const [time, sender, ...rest] = parts;
        result.push({ date: currentDate, time, sender, content: rest.join("\t") });
      }
    }

    setMessages(result);
  };

  /**
   * Handle file input change event, reading the selected file.
   * @param e - ChangeEvent from the file input.
   */
  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") parseLineData(reader.result);
    };
    reader.readAsText(file, "utf-8");
  };

  return (
    <div className="text-sm">
      <div className="mx-auto max-w-screen-xl bg-white px-4">
        <h2>{partnerName} とのトーク履歴</h2>
        <input type="file" accept=".txt" onChange={onFileChange} className="mb-4 w-full" />
      </div>
      <div className="space-y-2 bg-[#97a9d0] p-4">
        {messages.map((msg, i) => {
          if (!msg.time) {
            return (
              <div
                key={i}
                className="mt-4 rounded-full bg-gray-500/50 p-1 text-center text-xs text-neutral-200"
              >
                {msg.date}
              </div>
            );
          }

          const isMe = msg.sender !== partnerName;
          const isStamp = msg.content === "[スタンプ]";
          const isMedia = msg.content === "[写真]" || msg.content === "[動画]";

          if (isStamp && !showStamps) return null;
          if (isMedia && !showMedia) return null;

          return (
            <div key={i} className={`flex ${isMe ? "flex-row-reverse" : "flex-row"} items-end`}>
              <div
                className={`max-w-3/4 rounded-2xl px-4 py-2 break-words ${
                  isMe ? "rounded-br-none bg-[#a1e190]" : "rounded-bl-none bg-gray-200"
                }`}
              >
                <div>{msg.content}</div>
              </div>
              <div className="mx-1 mb-1 text-xs text-gray-500">{msg.time}</div>
            </div>
          );
        })}
      </div>
      <div className="fixed right-0 bottom-0 left-0 flex justify-center space-x-4 bg-white p-2">
        <button onClick={() => setShowStamps(!showStamps)}>
          スタンプ表示 {showStamps ? "あり" : "なし"}
        </button>
        <button onClick={() => setShowMedia(!showMedia)}>
          メディア表示 {showMedia ? "あり" : "なし"}
        </button>
      </div>
    </div>
  );
}
