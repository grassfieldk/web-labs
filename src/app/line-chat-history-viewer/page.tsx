"use client";

import React, { useState, ChangeEvent } from "react";

type Message = {
  date?: string;
  time?: string;
  sender?: string;
  content: string;
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [partnerName, setPartnerName] = useState<string>("");

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
    <div>
      <div className="px-4">
        <h2>{partnerName} とのトーク履歴</h2>
        <input type="file" accept=".txt" onChange={onFileChange} className="mb-6" />
      </div>
      <div className="mt-1 space-y-2 bg-[#97a9d0] p-4 text-sm">
        {messages.map((msg, i) => {
          if (!msg.time) {
            return (
              <div
                key={i}
                className="my-2 rounded-full bg-gray-500/50 p-1 text-center text-xs text-neutral-200"
              >
                {msg.date}
              </div>
            );
          }

          const isMe = msg.sender !== partnerName;

          return (
            <div key={i} className={`flex flex-row${isMe && "-reverse"} items-end`}>
              <div
                className={`max-w-3/4 rounded-2xl px-4 py-2 break-words ${
                  isMe ? "rounded-br-none bg-[#a1e190]" : "rounded-bl-none bg-gray-200"
                }`}
              >
                <div>{msg.content}</div>
              </div>
              <div className="mr-1 text-xs text-gray-500">{msg.time}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
