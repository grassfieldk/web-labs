"use client";

import { Box, Group, Stack, Text } from "@mantine/core";
import type { LineMessage } from "@/services/line/parser";

interface LineChatViewerProps {
  messages: LineMessage[];
  showStamps?: boolean;
  showMedia?: boolean;
  partnerName?: string;
}

export function LineChatViewer({
  partnerName,
  messages,
  showStamps = true,
  showMedia = true,
}: LineChatViewerProps) {
  return (
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
        {messages.map((msg, idx) => {
          const isStamp = msg.content === "[スタンプ]";
          const isMedia = msg.content === "[写真]" || msg.content === "[動画]";

          if (isStamp && !showStamps) return null;
          if (isMedia && !showMedia) return null;

          const isMe = partnerName ? msg.sender !== partnerName : false;

          // Check if date changed from previous message
          const prevMsg = idx > 0 ? messages[idx - 1] : null;
          const dateChanged = !prevMsg || prevMsg.date !== msg.date;

          return (
            <Stack key={msg.id} gap="xs">
              {dateChanged && msg.date && (
                <Box
                  m="auto"
                  p="4px"
                  w="8em"
                  ta="center"
                  bdrs="xl"
                  bg="rgba(100, 100, 100, 0.5)"
                  fz="xs"
                  c="gray.1"
                >
                  {msg.date}
                </Box>
              )}
              <Group justify={isMe ? "flex-end" : "flex-start"} gap="xs">
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
                  <Text size="sm" c="gray.9">
                    {msg.content}
                  </Text>
                </Box>
                <Text size="xs" c="dimmed">
                  {msg.time}
                </Text>
              </Group>
            </Stack>
          );
        })}
      </Stack>
    </Box>
  );
}
