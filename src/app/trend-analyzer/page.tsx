"use client";

import {
  Alert,
  FileInput,
  Group,
  Select,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { useMemo, useState } from "react";
import { MdError } from "react-icons/md";
import TinySegmenter from "tiny-segmenter";

type ParsedMessage = {
  date: string; // YYYY/MM/DD
  time?: string;
  sender?: string;
  content: string;
};

type TrendRow = {
  phrase: string;
  count: number;
};

const STOP_WORDS = new Set([
  "だ",
  "です",
  "ます",
  "から",
  "まで",
  "より",
  "けど",
  "けれど",
  "でも",
  "そして",
  "それ",
  "これ",
  "あれ",
  "ここ",
  "そこ",
  "あそこ",
  "いる",
  "ある",
  "する",
  "なる",
]);

const PARTICLES = new Set([
  "の",
  "に",
  "は",
  "を",
  "が",
  "と",
  "て",
  "で",
  "も",
  "へ",
  "や",
  "か",
  "な",
  "から",
  "まで",
  "より",
]);

function normalizeNewlines(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function yearFromDate(date: string): number | null {
  const m = date.match(/^(\d{4})\/(\d{2})\/(\d{2})/);
  if (!m) return null;
  return Number(m[1]);
}

function isOnlyPunctuationOrSymbols(token: string) {
  // Unicode property escapes (Node 20+)
  return /^[\p{P}\p{S}]+$/u.test(token);
}

function cleanMessageContent(content: string) {
  return (
    content
      // LINE export placeholders
      .replace(/\[(スタンプ|写真|動画)\]/g, " ")
      // URLs
      .replace(/https?:\/\/\S+/g, " ")
      // Mentions like @xxx (rough)
      .replace(/@[\w\-_.]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function shouldExcludeMessage(content: string) {
  // User-specified exclusions
  if (content.includes("がメッセージの送信を取り消しました")) return true;
  if (content.includes("[ノート]")) return true;
  if (content.includes("[アルバム]")) return true;
  if (content.includes("[写真]")) return true;
  if (content.includes("[スタンプ]")) return true;
  return false;
}

function normalizeToken(token: string) {
  const t = token.trim();
  if (!t) return "";
  // normalize ascii case
  if (/^[A-Za-z0-9_]+$/.test(t)) return t.toLowerCase();
  return t;
}

function joinTokensForPhrase(tokens: string[]) {
  // For Japanese tokens, concatenation reads naturally.
  // For alnum-alnum transitions, insert a space.
  let out = "";
  for (let i = 0; i < tokens.length; i++) {
    const cur = tokens[i];
    const prev = tokens[i - 1];
    if (i > 0 && /^[A-Za-z0-9_]+$/.test(prev) && /^[A-Za-z0-9_]+$/.test(cur)) {
      out += " ";
    }
    out += cur;
  }
  return out;
}

function shouldSkipPhrase(phrase: string) {
  const compact = phrase.replace(/\s+/g, "");

  // Too short phrases tend to be meaningless (e.g. "た", "てる").
  if (compact.length < 3) return true;

  // Require at least one "content-ish" character: Kanji/Katakana/alnum.
  // This removes mostly-hiragana fragments.
  if (!/[\p{Script=Han}\p{Script=Katakana}A-Za-z0-9]/u.test(compact)) return true;

  // Avoid punctuation/symbol-only.
  if (isOnlyPunctuationOrSymbols(compact)) return true;

  return false;
}

function shouldSkipPhraseTokens(tokens: string[]) {
  if (tokens.length < 2) return true;
  if (tokens.every((t) => PARTICLES.has(t))) return true;
  if (PARTICLES.has(tokens[0]) || PARTICLES.has(tokens[tokens.length - 1])) return true;

  const phrase = joinTokensForPhrase(tokens);
  return shouldSkipPhrase(phrase);
}

function shouldSkipToken(token: string) {
  if (!token) return true;
  if (token.length === 1 && /[\s]/.test(token)) return true;
  if (token.length === 1 && isOnlyPunctuationOrSymbols(token)) return true;
  if (isOnlyPunctuationOrSymbols(token)) return true;
  if (/^\d+$/.test(token)) return true;
  // Keep particles for phrase building (e.g., "メッセージの送信")
  if (PARTICLES.has(token)) return false;
  if (STOP_WORDS.has(token)) return true;
  return false;
}

function parseLineChatExport(text: string) {
  const normalized = normalizeNewlines(text);
  const lines = normalized.split("\n");

  const header = lines.find((l) => l.includes("とのトーク履歴")) || "";
  const headerMatch = header.match(/\[LINE\]?\s*(.+?)とのトーク履歴/);
  const partnerName = headerMatch?.[1]?.trim() || "";

  const messages: ParsedMessage[] = [];
  const years = new Set<number>();

  let currentDate = "";
  let lastMessage: ParsedMessage | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) continue;

    if (/^\d{4}\/\d{2}\/\d{2}/.test(line.trim())) {
      currentDate = line.trim().slice(0, 10);
      const year = yearFromDate(currentDate);
      if (year != null) years.add(year);
      lastMessage = null;
      continue;
    }

    const parts = line.split("\t");
    if (parts.length >= 3 && currentDate) {
      const [time, sender, ...rest] = parts;
      const content = rest.join("\t");
      const msg: ParsedMessage = {
        date: currentDate,
        time,
        sender,
        content,
      };
      messages.push(msg);
      lastMessage = msg;
      continue;
    }

    // Multi-line message continuation
    if (lastMessage) {
      lastMessage.content = `${lastMessage.content}\n${line.trim()}`;
    }
  }

  return {
    partnerName,
    messages,
    years: Array.from(years).sort((a, b) => b - a),
  };
}

function analyzeBuzzwords(
  messages: ParsedMessage[],
  targetYear: number,
  segmenter: TinySegmenter
) {
  const counts = new Map<string, number>();

  for (const msg of messages) {
    const year = yearFromDate(msg.date);
    if (year !== targetYear) continue;

    if (shouldExcludeMessage(msg.content)) continue;

    const cleaned = cleanMessageContent(msg.content);
    if (!cleaned) continue;

    const tokens = segmenter
      .segment(cleaned)
      .map(normalizeToken)
      .filter((t) => t && !shouldSkipToken(t));

    // Count 2-grams and 3-grams
    for (let i = 0; i < tokens.length; i++) {
      if (i + 1 < tokens.length) {
        const phraseTokens2 = [tokens[i], tokens[i + 1]];
        if (!shouldSkipPhraseTokens(phraseTokens2)) {
          const phrase2 = joinTokensForPhrase(phraseTokens2);
          counts.set(phrase2, (counts.get(phrase2) ?? 0) + 1);
        }
      }
      if (i + 2 < tokens.length) {
        const phraseTokens3 = [tokens[i], tokens[i + 1], tokens[i + 2]];
        if (!shouldSkipPhraseTokens(phraseTokens3)) {
          const phrase3 = joinTokensForPhrase(phraseTokens3);
          counts.set(phrase3, (counts.get(phrase3) ?? 0) + 1);
        }
      }
    }
  }

  const rows: TrendRow[] = Array.from(counts.entries())
    .map(([phrase, count]) => ({ phrase, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 50);

  return rows;
}

export default function TrendAnalyzerPage() {
  const segmenter = useMemo(() => new TinySegmenter(), []);

  const [parsedMessages, setParsedMessages] = useState<ParsedMessage[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [targetYear, setTargetYear] = useState<number>(() => new Date().getFullYear());
  const [error, setError] = useState<string>("");

  const onFileChange = (file: File | null) => {
    setError("");
    setParsedMessages([]);
    setYears([]);

    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        if (typeof reader.result !== "string") throw new Error("Invalid file");
        const { messages, years: parsedYears } = parseLineChatExport(reader.result);

        if (messages.length === 0) {
          throw new Error(
            "チャット履歴を解析できませんでした。LINEのトーク履歴（*.txt）を指定してください。"
          );
        }

        setParsedMessages(messages);
        setYears(parsedYears);

        const currentYear = new Date().getFullYear();
        const nextTarget = parsedYears.includes(currentYear)
          ? currentYear
          : (parsedYears[0] ?? currentYear);
        setTargetYear(nextTarget);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error";
        setError(message);
      }
    };

    reader.readAsText(file, "utf-8");
  };

  const resultRows = useMemo(() => {
    if (parsedMessages.length === 0) return [];
    return analyzeBuzzwords(parsedMessages, targetYear, segmenter);
  }, [parsedMessages, targetYear, segmenter]);

  const targetYearMessageCount = useMemo(() => {
    const count = parsedMessages.filter(
      (m) => yearFromDate(m.date) === targetYear
    ).length;
    return count;
  }, [parsedMessages, targetYear]);

  return (
    <Stack gap="lg">
      <div>
        <Title order={1}>LINE 今年の流行語メーカー</Title>
        <Text c="dimmed" size="sm" mt="xs">
          トーク履歴（*.txt）をアップロードして、今年よく使われた言葉を集計します（処理はブラウザ内で完結します）。
        </Text>
      </div>

      <FileInput
        label="LINE トーク履歴ファイル"
        placeholder="*.txt ファイルを選択"
        accept=".txt"
        onChange={onFileChange}
      />

      {error && (
        <Alert icon={<MdError size={16} />} color="red" title="Error">
          {error}
        </Alert>
      )}

      {parsedMessages.length > 0 && (
        <Group align="end">
          <Select
            label="対象年"
            data={years.map((y) => ({ value: String(y), label: String(y) }))}
            value={String(targetYear)}
            onChange={(v) => {
              if (!v) return;
              const y = Number(v);
              if (!Number.isNaN(y)) setTargetYear(y);
            }}
            w={180}
          />
          <Text c="dimmed" size="sm">
            対象メッセージ数: {targetYearMessageCount}
          </Text>
        </Group>
      )}

      {resultRows.length > 0 && (
        <div>
          <Title order={2} size="h3" mb="md">
            {targetYear} 年の流行語（フレーズ集計・暫定）
          </Title>

          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>#</Table.Th>
                <Table.Th>ワード</Table.Th>
                <Table.Th>フレーズ</Table.Th>
                <Table.Th>出現回数</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {resultRows.map((row, idx) => (
                <Table.Tr key={row.phrase}>
                  <Table.Td>{idx + 1}</Table.Td>
                  <Table.Td>{row.phrase}</Table.Td>
                  <Table.Td>{row.count}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>

          {resultRows[0] && (
            <Text mt="sm" size="sm">
              今年の流行語（1位）: <b>{resultRows[0].phrase}</b>
            </Text>
          )}
        </div>
      )}
    </Stack>
  );
}
