"use client";

import {
  Alert,
  Button,
  FileInput,
  Group,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Table,
} from "@mantine/core";
import kuromoji from "kuromoji";
import { useEffect, useMemo, useState } from "react";
import { MdError } from "react-icons/md";
import PageBuilder from "@/components/layout/PageBuilder";
import { Caption } from "@/components/ui/Basics";
import { LineChatViewer } from "@/components/ui/line";
import {
  type LineHistory,
  type LineMessage,
  parseLineChatHistory,
} from "@/services/line/parser";
import { analyzeBuzzwords, type TrendRow } from "@/services/line/trendAnalyzer";

function messageTimestamp(message: LineMessage) {
  if (!message.date || !message.time) return 0;
  const timestamp = new Date(`${message.date} ${message.time}`).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export default function TrendAnalyzerPage() {
  const [tokenizer, setTokenizer] = useState<kuromoji.Tokenizer | null>(null);
  const [tokenizerError, setTokenizerError] = useState<string>("");

  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [history, setHistory] = useState<LineHistory[]>([]);
  const [targetYear, setTargetYear] = useState<number>(() => new Date().getFullYear());
  const [error, setError] = useState<string>("");

  const [partnerName, setPartnerName] = useState<string>("");

  const [selectedRow, setSelectedRow] = useState<TrendRow | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [viewerMessages, setViewerMessages] = useState<LineMessage[]>([]);

  // Initialize kuromoji tokenizer on component mount
  useEffect(() => {
    const initTokenizer = async () => {
      try {
        const builder = kuromoji.builder({
          dicPath: "/kuromoji/dict/",
        });
        builder.build((err, tok) => {
          if (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            setTokenizerError(
              `形態素解析器の初期化に失敗: ${errorMsg || "不明なエラー"}`
            );
            console.error("kuromoji init error:", err);
          } else if (tok) {
            setTokenizer(tok);
          }
        });
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        setTokenizerError(`形態素解析器の初期化に失敗: ${errorMsg || "不明なエラー"}`);
        console.error("kuromoji init exception:", e);
      }
    };
    initTokenizer();
  }, []);

  const onFileChange = (file: File | null) => {
    setError("");
    setFile(file);
    setSelectedRow(null);
    setSelectedDate(null);
    setViewerMessages([]);
    setPartnerName("");
    setHistory([]);
  };

  const startAnalyze = async () => {
    if (!file) return;
    if (!tokenizer) {
      setError("形態素解析器が未初期化です。しばらく待ってからお試しください。");
      return;
    }

    setError("");
    setIsParsing(true);
    setHistory([]);

    try {
      const text = await file.text();
      const { partnerName, history: parsedHistory } = parseLineChatHistory(text);

      if (parsedHistory.length === 0) {
        throw new Error(
          "チャット履歴を解析できませんでした。LINEのトーク履歴（*.txt）を指定してください。"
        );
      }

      setPartnerName(partnerName);
      setHistory(parsedHistory);

      const currentYear = new Date().getFullYear();
      const hasCurrentYear = parsedHistory.some((h) => h.year === currentYear);

      if (hasCurrentYear) {
        setTargetYear(currentYear);
      } else {
        const latest = parsedHistory[0];
        setTargetYear(latest.year);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setError(message);
    } finally {
      setIsParsing(false);
    }
  };

  const allMessages = useMemo(() => history.flatMap((h) => h.messages), [history]);
  const yearMessages = useMemo(
    () => history.filter((h) => h.year === targetYear).flatMap((h) => h.messages),
    [history, targetYear]
  );
  const messagesById = useMemo(
    () => new Map(allMessages.map((message) => [message.id, message])),
    [allMessages]
  );
  const sortedMessages = useMemo(
    () =>
      allMessages
        .map((message, index) => ({
          message,
          index,
          timestamp: messageTimestamp(message),
        }))
        .sort((a, b) => a.timestamp - b.timestamp || a.index - b.index)
        .map(({ message }) => message),
    [allMessages]
  );

  const resultRows = useMemo(() => {
    if (yearMessages.length === 0) return [];
    if (!tokenizer) return [];
    return analyzeBuzzwords(yearMessages, targetYear, tokenizer);
  }, [targetYear, tokenizer, yearMessages]);

  const targetYearMessageCount = yearMessages.length;

  useEffect(() => {
    if (selectedDate && selectedRow) {
      // Find the first id of the phrase on the selected date
      const firstId = selectedRow.ids.find((id) => {
        const msg = messagesById.get(id);
        return msg?.date === selectedDate;
      });
      if (firstId) {
        const index = sortedMessages.findIndex((msg) => msg.id === firstId);
        if (index !== -1) {
          const start = Math.max(0, index - 2);
          const end = Math.min(sortedMessages.length, index + 3);
          setViewerMessages(sortedMessages.slice(start, end));
        }
      }
    }
  }, [selectedDate, selectedRow, messagesById, sortedMessages]);

  return (
    <PageBuilder title="LINE 流行語大賞" description="今年流行ったフレーズは？">
      <Stack gap="lg">
        <Stack gap="sm">
          <FileInput
            label="履歴ファイル"
            placeholder="*.txt ファイルを選択"
            description="※ ファイルはサーバへ送信されません"
            accept=".txt"
            onChange={onFileChange}
          />
          <Button
            onClick={startAnalyze}
            disabled={!file || !tokenizer}
            loading={isParsing}
          >
            解析開始
          </Button>
        </Stack>

        {tokenizerError && (
          <Alert icon={<MdError size={16} />} color="red" title="Tokenizer Error">
            {tokenizerError}
          </Alert>
        )}

        {error && (
          <Alert icon={<MdError size={16} />} color="red" title="Error">
            {error}
          </Alert>
        )}

        {history.length > 0 && (
          <Group align="center">
            <Select
              data={Array.from(new Set(history.map((h) => h.year)))
                .sort((a, b) => b - a)
                .map((y) => ({ value: String(y), label: `${String(y)}年` }))}
              value={String(targetYear)}
              onChange={(v) => {
                if (!v) return;
                const y = Number(v);
                if (!Number.isNaN(y)) {
                  setTargetYear(y);
                  setSelectedRow(null);
                  setSelectedDate(null);
                  setViewerMessages([]);
                }
              }}
              w={100}
            />
            {resultRows[0] && (
              <Caption>集計対象メッセージ: {targetYearMessageCount} 件</Caption>
            )}
          </Group>
        )}

        {resultRows.length > 0 && (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w="4em">#</Table.Th>
                <Table.Th>フレーズ</Table.Th>
                <Table.Th w="8em">出現回数</Table.Th>
                <Table.Th w="8em">登場日数</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {resultRows.map((row, idx) => (
                <Table.Tr
                  key={`${idx}:${row.phrase}`}
                  onClick={() => {
                    setSelectedRow(row);
                    setSelectedDate(null);
                    setViewerMessages([]);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <Table.Td>{idx + 1}</Table.Td>
                  <Table.Td>{row.phrase}</Table.Td>
                  <Table.Td>{row.count}</Table.Td>
                  <Table.Td>{row.dayCount}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Stack>

      <Modal
        opened={!!selectedRow}
        onClose={() => {
          setSelectedRow(null);
          setSelectedDate(null);
          setViewerMessages([]);
        }}
        title="メッセージ履歴"
        size="xl"
      >
        <Stack>
          {selectedRow && !selectedDate && (
            <SimpleGrid cols={2}>
              {[
                ...new Set(
                  selectedRow.ids
                    .map((id) => {
                      const msg = messagesById.get(id);
                      return msg?.date || "";
                    })
                    .filter((d) => d)
                ),
              ].map((date) => (
                <Button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  variant="default"
                >
                  {date}
                </Button>
              ))}
            </SimpleGrid>
          )}
          {selectedDate && viewerMessages.length > 0 && (
            <Stack>
              <Button onClick={() => setSelectedDate(null)} variant="default">
                戻る
              </Button>
              <LineChatViewer messages={viewerMessages} partnerName={partnerName} />
            </Stack>
          )}
        </Stack>
      </Modal>
    </PageBuilder>
  );
}
