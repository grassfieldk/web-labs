"use client";

import {
  Alert,
  Button,
  FileInput,
  Group,
  Select,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import kuromoji from "kuromoji";
import { useEffect, useMemo, useState } from "react";
import { MdError } from "react-icons/md";

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

const SHORT_MESSAGE_MAX_LEN = 10;
const MIN_PHRASE_LEN = 5;
const MAX_NGRAM = 8;
const TOP_N = 30;
const CANDIDATE_LIMIT = 600;

const EMOJI_OR_SYMBOL_MIN_COUNT = 3;
const FULL_COUNT_MAX_LEN_NO_CONJUNCTION = 30;

function normalizeKeyText(text: string) {
  // Drop Unicode "format" chars (variation selectors, ZWJ/ZWNJ, etc)
  // so visually identical emojis don't appear as separate phrases.
  // Avoid NFKC here to keep non-emoji phrases' counts/rankings stable.
  return text.replace(/\p{Cf}/gu, "");
}

function countEmojiOrSymbolChars(text: string) {
  // Heuristic: count emoji/symbols + punctuation.
  // This makes strings like "！！！！" or "wwww"-style symbol spam trigger whole-message counting.
  return (text.match(/[\p{S}\p{P}]/gu) ?? []).length;
}

function hasConjunction(tokens: kuromoji.Token[]) {
  return tokens.some((t) => t.pos.startsWith("接続詞"));
}

// POS (Part of Speech) categories for meaningful phrase extraction
function isContentWord(pos: string): boolean {
  // 名詞 = noun, 動詞 = verb, 形容詞 = adjective, 副詞 = adverb
  // Focus on nouns and verbs (most meaningful for buzz phrases)
  return (
    pos.startsWith("名詞") ||
    pos.startsWith("動詞") ||
    pos.startsWith("形容詞") ||
    pos.startsWith("副詞")
  );
}

function shouldBuildPhraseWith(pos: string): boolean {
  // Only include content words (nouns, verbs, adjectives, adverbs)
  // Exclude particles and auxiliary verbs to avoid generic short phrases
  return isContentWord(pos);
}

function normalizeNewlines(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function yearFromDate(date: string): number | null {
  const m = date.match(/^(\d{4})\/(\d{2})\/(\d{2})/);
  if (!m) return null;
  return Number(m[1]);
}

function cleanMessageContent(content: string) {
  return (
    content
      // LINE export placeholders
      .replace(/\[(スタンプ|写真|動画|アルバム)\]/g, " ")
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
  if (content.includes("メッセージの送信を取り消しました")) return true;
  if (content.includes("アナウンスしました")) return true;
  if (content.includes("[スタンプ]")) return true;
  if (content.includes("[写真]")) return true;
  if (content.includes("[アルバム]")) return true;
  if (content.includes("[ボイスメッセージ]")) return true;
  if (content.includes("[ノート]")) return true;
  return false;
}

function isMeaningfulPhrase(phrase: string) {
  if (phrase.length < MIN_PHRASE_LEN) return false;
  // Require at least some CJK signal to avoid random ASCII fragments.
  if (!/[\p{Script=Han}\p{Script=Katakana}]/u.test(phrase)) return false;
  return true;
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
  tokenizer: kuromoji.Tokenizer
) {
  const counts = new Map<
    string,
    {
      phrase: string;
      tokens: string[];
      count: number;
    }
  >();

  const tryCount = (params: {
    key: string;
    phrase: string;
    tokens: string[];
    countedKeysInMessage: Set<string>;
  }) => {
    const { key, phrase, tokens, countedKeysInMessage } = params;

    // Per-message dedupe
    if (countedKeysInMessage.has(key)) return;
    countedKeysInMessage.add(key);

    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(key, { phrase, tokens, count: 1 });
    }
  };

  for (const msg of messages) {
    const year = yearFromDate(msg.date);
    if (year !== targetYear) continue;

    if (shouldExcludeMessage(msg.content)) continue;

    const cleaned = cleanMessageContent(msg.content);
    if (!cleaned) continue;

    const countedKeysInMessage = new Set<string>();

    const normalizedWhole = normalizeKeyText(cleaned);

    // If message is short (≤10 chars) OR contains many emojis/symbols/punctuation,
    // count the whole message as a phrase.
    if (
      cleaned.length <= SHORT_MESSAGE_MAX_LEN ||
      countEmojiOrSymbolChars(normalizedWhole) >= EMOJI_OR_SYMBOL_MIN_COUNT
    ) {
      const key = `m:${normalizedWhole}`;
      tryCount({
        key,
        // Use normalized value for display too, so duplicates like "💦" vs "💦︎" collapse.
        phrase: normalizedWhole,
        tokens: [normalizedWhole],
        countedKeysInMessage,
      });
      continue;
    }

    // Use kuromoji for morphological analysis (with POS tagging)
    const tokens = tokenizer.tokenize(cleaned);

    // If there's no conjunction, treat short-ish messages as a single phrase.
    // Guarded by length to avoid counting full long sentences.
    if (cleaned.length <= FULL_COUNT_MAX_LEN_NO_CONJUNCTION && !hasConjunction(tokens)) {
      const key = `m:${normalizedWhole}`;
      tryCount({
        key,
        phrase: normalizedWhole,
        tokens: [normalizedWhole],
        countedKeysInMessage,
      });
      continue;
    }
    const segments: Array<{ text: string; pos: string }[]> = [];
    let current: { text: string; pos: string }[] = [];

    for (const token of tokens) {
      if (!shouldBuildPhraseWith(token.pos)) {
        if (current.length > 0) segments.push(current);
        current = [];
        continue;
      }
      current.push({ text: token.surface_form, pos: token.pos });
    }
    if (current.length > 0) segments.push(current);

    for (const segment of segments) {
      const maxN = Math.min(MAX_NGRAM, segment.length);
      for (let i = 0; i < segment.length; i++) {
        for (let n = 2; n <= maxN && i + n <= segment.length; n++) {
          const phraseItems = segment.slice(i, i + n);
          const phraseTokens = phraseItems.map((p) => p.text);
          const phrase = phraseTokens.join("");

          if (!isMeaningfulPhrase(phrase)) continue;

          // Key by token sequence to avoid merging different tokenizations.
          const key = `t:${phraseTokens.join("\u0001")}`;
          tryCount({
            key,
            phrase,
            tokens: phraseTokens,
            countedKeysInMessage,
          });
        }
      }
    }
  }

  // Performance: keep limited top candidates via min-heap
  type CountItem = {
    phrase: string;
    tokens: string[];
    count: number;
  };

  const isWorse = (a: CountItem, b: CountItem) => {
    if (a.count !== b.count) return a.count < b.count;
    if (a.tokens.length !== b.tokens.length) return a.tokens.length < b.tokens.length;
    return a.phrase.length < b.phrase.length;
  };

  const heap: CountItem[] = [];

  const heapSwap = (i: number, j: number) => {
    const tmp = heap[i];
    heap[i] = heap[j];
    heap[j] = tmp;
  };

  const heapUp = (idx: number) => {
    let i = idx;
    while (i > 0) {
      const p = Math.floor((i - 1) / 2);
      if (!isWorse(heap[i], heap[p])) break;
      heapSwap(i, p);
      i = p;
    }
  };

  const heapDown = (idx: number) => {
    let i = idx;
    while (true) {
      const l = i * 2 + 1;
      const r = i * 2 + 2;
      let smallest = i;

      if (l < heap.length && isWorse(heap[l], heap[smallest])) smallest = l;
      if (r < heap.length && isWorse(heap[r], heap[smallest])) smallest = r;
      if (smallest === i) break;
      heapSwap(i, smallest);
      i = smallest;
    }
  };

  for (const item of counts.values()) {
    if (heap.length < CANDIDATE_LIMIT) {
      heap.push(item);
      heapUp(heap.length - 1);
      continue;
    }

    // Replace the worst item if the new item is better.
    if (isWorse(heap[0], item)) {
      heap[0] = item;
      heapDown(0);
    }
  }

  const candidates = heap.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (b.tokens.length !== a.tokens.length) return b.tokens.length - a.tokens.length;
    return b.phrase.length - a.phrase.length;
  });

  const kept: TrendRow[] = [];

  for (const item of candidates) {
    kept.push({ phrase: item.phrase, count: item.count });

    if (kept.length >= TOP_N) break;
  }

  return kept;
}

export default function TrendAnalyzerPage() {
  const [tokenizer, setTokenizer] = useState<kuromoji.Tokenizer | null>(null);
  const [tokenizerError, setTokenenizerError] = useState<string>("");

  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedMessages, setParsedMessages] = useState<ParsedMessage[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [targetYear, setTargetYear] = useState<number>(() => new Date().getFullYear());
  const [error, setError] = useState<string>("");

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
            setTokenenizerError(
              `形態素解析器の初期化に失敗: ${errorMsg || "不明なエラー"}`
            );
            console.error("kuromoji init error:", err);
          } else if (tok) {
            setTokenizer(tok);
          }
        });
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        setTokenenizerError(`形態素解析器の初期化に失敗: ${errorMsg || "不明なエラー"}`);
        console.error("kuromoji init exception:", e);
      }
    };
    initTokenizer();
  }, []);

  const onFileChange = (file: File | null) => {
    setError("");
    setFile(file);

    // Selecting a file does not start parsing automatically.
    // Reset current results so the user clearly sees they need to start.
    setParsedMessages([]);
    setYears([]);
  };

  const startAnalyze = async () => {
    if (!file) return;
    if (!tokenizer) {
      setError("形態素解析器が未初期化です。しばらく待ってからお試しください。");
      return;
    }

    setError("");
    setIsParsing(true);
    setParsedMessages([]);
    setYears([]);

    try {
      const text = await file.text();
      const { messages, years: parsedYears } = parseLineChatExport(text);

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
    } finally {
      setIsParsing(false);
    }
  };

  const resultRows = useMemo(() => {
    if (parsedMessages.length === 0 || !tokenizer) return [];
    return analyzeBuzzwords(parsedMessages, targetYear, tokenizer);
  }, [parsedMessages, targetYear, tokenizer]);

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
        {tokenizerError && (
          <Text c="red" size="sm" mt="xs">
            {tokenizerError}
          </Text>
        )}
      </div>

      <FileInput
        label="LINE トーク履歴ファイル"
        placeholder="*.txt ファイルを選択"
        accept=".txt"
        onChange={onFileChange}
      />

      <Group>
        <Button onClick={startAnalyze} disabled={!file || !tokenizer} loading={isParsing}>
          解析開始
        </Button>
      </Group>

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
