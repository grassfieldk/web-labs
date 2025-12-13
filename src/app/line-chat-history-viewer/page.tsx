"use client";

import { Box, FileInput, Group, Stack, Switch, Text, Title } from "@mantine/core";
import React, { useState } from "react";

type Message = {
  date?: string;
  time?: string;
  sender?: string;
  content: string;
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [partnerName, setPartnerName] = useState<string>("");
  const [showStamps, setShowStamps] = useState(true);
  const [showMedia, setShowMedia] = useState(true);

  React.useEffect(() => {
    console.log(`Partner name changed to: "${partnerName}"`);
  }, [partnerName]);

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

  const onFileChange = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") parseLineData(reader.result);
    };
    reader.readAsText(file, "utf-8");
  };

  return (
    <Stack gap="lg">
      <div>
        <Title order={1}>
          {partnerName ? `${partnerName} とのトーク履歴` : "LINE Chat History Viewer"}
        </Title>
      </div>

      <FileInput
        label="チャット履歴ファイル"
        placeholder="*.txt ファイルを選択"
        accept=".txt"
        onChange={onFileChange}
      />

      {messages.length > 0 && (
        <>
          <Group>
            <Switch
              label="スタンプを表示"
              checked={showStamps}
              onChange={(e) => setShowStamps(e.currentTarget.checked)}
            />
            <Switch
              label="メディアを表示"
              checked={showMedia}
              onChange={(e) => setShowMedia(e.currentTarget.checked)}
            />
          </Group>

          <Box
            style={{
              backgroundColor: "#a8c5dd",
              borderRadius: "8px",
              padding: "16px",
              maxHeight: "600px",
              overflowY: "auto",
            }}
          >
            <Stack gap="xs">
              {messages.map((msg, i) => {
                if (!msg.time) {
                  return (
                    <Box
                      key={i}
                      style={{
                        textAlign: "center",
                        backgroundColor: "rgba(100, 100, 100, 0.5)",
                        borderRadius: "20px",
                        padding: "8px 16px",
                        fontSize: "12px",
                        color: "#e0e0e0",
                        margin: "8px 0",
                      }}
                    >
                      {msg.date}
                    </Box>
                  );
                }

                const isMe = msg.sender !== partnerName;
                const isStamp = msg.content === "[スタンプ]";
                const isMedia = msg.content === "[写真]" || msg.content === "[動画]";

                if (isStamp && !showStamps) return null;
                if (isMedia && !showMedia) return null;

                return (
                  <Group key={i} justify={isMe ? "flex-end" : "flex-start"} gap="xs">
                    <Box
                      style={{
                        maxWidth: "75%",
                        backgroundColor: isMe ? "#a1e190" : "#e0e0e0",
                        borderRadius: "12px",
                        borderBottomRightRadius: isMe ? "0" : "12px",
                        borderBottomLeftRadius: isMe ? "12px" : "0",
                        padding: "8px 12px",
                        wordBreak: "break-word",
                      }}
                    >
                      <Text size="sm">{msg.content}</Text>
                    </Box>
                    <Text size="xs" c="dimmed">
                      {msg.time}
                    </Text>
                  </Group>
                );
              })}
            </Stack>
          </Box>
        </>
      )}
    </Stack>
  );
}
