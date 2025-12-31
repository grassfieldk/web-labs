"use client";

import { Box, FileInput, Group, Stack, Switch, Text } from "@mantine/core";
import React, { useState } from "react";
import PageBuilder from "@/components/layout/PageBuilder";
import { type LineMessage, parseLineChatHistory } from "@/services/line/parser";

export default function ChatPage() {
  const [history, setHistory] = useState<
    Array<{ year: number; month: number; messages: LineMessage[] }>
  >([]);
  const [partnerName, setPartnerName] = useState<string>("");
  const [showStamps, setShowStamps] = useState(true);
  const [showMedia, setShowMedia] = useState(true);
  const [allMessages, setAllMessages] = useState<LineMessage[]>([]);

  React.useEffect(() => {
    console.log(`Partner name changed to: "${partnerName}"`);
  }, [partnerName]);

  const onFileChange = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        const { partnerName, history: parsedHistory } = parseLineChatHistory(
          reader.result
        );
        setPartnerName(partnerName);
        setHistory(parsedHistory);
        // Flatten all messages from history for display
        const messages = parsedHistory.flatMap((h) => h.messages);
        setAllMessages(messages);
      }
    };
    reader.readAsText(file, "utf-8");
  };

  return (
    <PageBuilder title="LINE チャット履歴ビューア">
      <Stack gap="lg">
        <FileInput
          label="チャット履歴ファイル"
          placeholder="*.txt ファイルを選択"
          accept=".txt"
          onChange={onFileChange}
        />

        {allMessages.length > 0 && (
          <>
            <Group>
              <Switch
                label="スタンプ表示"
                checked={showStamps}
                onChange={(e) => setShowStamps(e.currentTarget.checked)}
              />
              <Switch
                label="メディア表示"
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
                {allMessages.map((msg) => {
                  if (!msg.time) {
                    return (
                      <Box
                        key={msg.id}
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
                    <Group
                      key={msg.id}
                      justify={isMe ? "flex-end" : "flex-start"}
                      gap="xs"
                    >
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
    </PageBuilder>
  );
}
