"use client";

import {
  Alert,
  Box,
  Button,
  FileInput,
  Group,
  Select,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import kuromoji from "kuromoji";
import { useEffect, useMemo, useState } from "react";
import { MdError } from "react-icons/md";
import PageBuilder from "@/components/layout/PageBuilder";
import { Caption } from "@/components/ui/Basics";
import {
  type LineMessage,
  parseLineChatHistory,
  yearFromDate,
  yearMonthFromDate,
} from "@/services/line/parser";

type ParsedMessage = LineMessage;

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

function hasConjunctionOrParticle(tokens: kuromoji.Token[]) {
  // Treat "connective" signals broadly.
  // - 接続詞: そして/でも/だから...
  // - 助詞: が/は/に/を/て/で/けど...
  // - 助動詞: だ/です/ます/た...
  // - 記号: 読点/句点/括弧など（kuromoji上は多くが"記号"）
  return tokens.some(
    (t) =>
      t.pos.startsWith("接続詞") ||
      t.pos.startsWith("助詞") ||
      t.pos.startsWith("助動詞") ||
      t.pos.startsWith("記号")
  );
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
    const year = msg.date ? yearFromDate(msg.date) : null;
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

    // If there's no connective signal (conjunction/particle/auxverb/symbol),
    // treat short-ish messages as a single phrase.
    // Guarded by length to avoid counting full long sentences.
    if (
      cleaned.length <= FULL_COUNT_MAX_LEN_NO_CONJUNCTION &&
      !hasConjunctionOrParticle(tokens)
    ) {
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

      // Avoid extracting multiple overlapping phrases from the same region.
      // Generate candidates, then greedily pick non-overlapping ones.
      type SegmentCandidate = {
        start: number;
        end: number;
        phrase: string;
        tokens: string[];
        isNounOnly: boolean;
      };

      const candidates: SegmentCandidate[] = [];

      for (let i = 0; i < segment.length; i++) {
        for (let n = 2; n <= maxN && i + n <= segment.length; n++) {
          const phraseItems = segment.slice(i, i + n);
          const phraseTokens = phraseItems.map((p) => p.text);
          const phrase = phraseTokens.join("");

          if (!isMeaningfulPhrase(phrase)) continue;

          candidates.push({
            start: i,
            end: i + n,
            phrase,
            tokens: phraseTokens,
            isNounOnly: phraseItems.every((p) => p.pos.startsWith("名詞")),
          });
        }
      }

      candidates.sort((a, b) => {
        // Prefer noun-only phrases first.
        if (a.isNounOnly !== b.isNounOnly) return a.isNounOnly ? -1 : 1;
        // Prefer longer token spans to reduce sub-phrase duplicates.
        if (b.tokens.length !== a.tokens.length) return b.tokens.length - a.tokens.length;
        // Then prefer longer surface length.
        return b.phrase.length - a.phrase.length;
      });

      const used = new Array<boolean>(segment.length).fill(false);

      for (const cand of candidates) {
        let overlaps = false;
        for (let k = cand.start; k < cand.end; k++) {
          if (used[k]) {
            overlaps = true;
            break;
          }
        }
        if (overlaps) continue;

        // Key by token sequence to avoid merging different tokenizations.
        const key = `t:${cand.tokens.join("\u0001")}`;
        tryCount({
          key,
          phrase: cand.phrase,
          tokens: cand.tokens,
          countedKeysInMessage,
        });

        for (let k = cand.start; k < cand.end; k++) used[k] = true;
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
  const [history, setHistory] = useState<
    Array<{ year: number; month: number; messages: LineMessage[] }>
  >([]);
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
      const { history: parsedHistory } = parseLineChatHistory(text);

      if (parsedHistory.length === 0) {
        throw new Error(
          "チャット履歴を解析できませんでした。LINEのトーク履歴（*.txt）を指定してください。"
        );
      }

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

  const resultRows = useMemo(() => {
    if (history.length === 0 || !tokenizer) return [];
    const yearMessages = history
      .filter((h) => h.year === targetYear)
      .flatMap((h) => h.messages);
    if (yearMessages.length === 0) return [];
    return analyzeBuzzwords(yearMessages, targetYear, tokenizer);
  }, [history, targetYear, tokenizer]);

  const targetYearMessageCount = useMemo(() => {
    return history
      .filter((h) => h.year === targetYear)
      .reduce((sum, h) => sum + h.messages.length, 0);
  }, [history, targetYear]);

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

        {error && (
          <Alert icon={<MdError size={16} />} color="red" title="Error">
            {error}
          </Alert>
        )}

        {history.length > 0 && (
          <Group align="end">
            <Select
              label="年"
              data={Array.from(new Set(history.map((h) => h.year)))
                .sort((a, b) => b - a)
                .map((y) => ({ value: String(y), label: `${String(y)}年` }))}
              value={String(targetYear)}
              onChange={(v) => {
                if (!v) return;
                const y = Number(v);
                if (!Number.isNaN(y)) {
                  setTargetYear(y);
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
        )}
      </Stack>
    </PageBuilder>
  );
}
