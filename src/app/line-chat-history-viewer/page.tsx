"use client";

import { FileInput, Group, Select, Stack, Switch } from "@mantine/core";
import React, { useState } from "react";
import PageBuilder from "@/components/layout/PageBuilder";
import { LineChatViewer } from "@/components/ui/line";
import { type LineMessage, parseLineChatHistory } from "@/services/line/parser";

export default function ChatPage() {
  const [partnerName, setPartnerName] = useState<string>("");
  const [showStamps, setShowStamps] = useState(true);
  const [showMedia, setShowMedia] = useState(true);
  const [history, setHistory] = useState<
    Array<{ year: number; month: number; messages: LineMessage[] }>
  >([]);
  const [selectedYearMonth, setSelectedYearMonth] = useState<string>("");

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
        // Select the first year-month by default
        if (parsedHistory.length > 0) {
          const { year, month } = parsedHistory[0];
          setSelectedYearMonth(`${year}-${String(month).padStart(2, "0")}`);
        }
      }
    };
    reader.readAsText(file, "utf-8");
  };

  const displayMessages =
    history.find(
      (h) => selectedYearMonth === `${h.year}-${String(h.month).padStart(2, "0")}`
    )?.messages || [];

  return (
    <PageBuilder title="LINE チャット履歴ビューア">
      <Stack gap="lg">
        <FileInput
          label="チャット履歴ファイル"
          placeholder="*.txt ファイルを選択"
          accept=".txt"
          onChange={onFileChange}
        />

        {history.length > 0 && (
          <>
            <Group>
              <Select
                data={history.map((h) => ({
                  value: `${h.year}-${String(h.month).padStart(2, "0")}`,
                  label: `${h.year}年${String(h.month).padStart(2, "0")}月`,
                }))}
                value={selectedYearMonth}
                onChange={(v) => v && setSelectedYearMonth(v)}
                searchable
                w={150}
              />
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

            {displayMessages.length > 0 && (
              <LineChatViewer
                messages={displayMessages}
                showStamps={showStamps}
                showMedia={showMedia}
                partnerName={partnerName}
              />
            )}
          </>
        )}
      </Stack>
    </PageBuilder>
  );
}
