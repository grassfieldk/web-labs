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
  type LineMessage,
  parseLineChatHistory,
  yearFromDate,
} from "@/services/line/parser";

type ParsedMessage = LineMessage;

type TrendRow = {
  phrase: string;
  count: number;
  ids: string[];
};

const SHORT_MESSAGE_MAX_LEN = 10;
const MIN_PHRASE_LEN = 5;
const MAX_NGRAM = 8;
const TOP_N = 30;
const CANDIDATE_LIMIT = 600;

const EMOJI_OR_SYMBOL_MIN_COUNT = 3;
const FULL_COUNT_MAX_LEN_NO_CONJUNCTION = 30;

// Common stop words to exclude from trending phrases
// biome-ignore format: Preserve manual formatting to maintain category comments and alignment
const STOP_WORDS = new Set([
  "これ", "それ", "あれ", "どれ",
  "この", "その", "あの", "どの",
  "いや", "まあ", "たしか", "それで", "実は",
  "えっ", "あっ", "うわ", "うわあ", "ああ", "おう", "よう",
  "はい", "いいえ", "そう"
]);

function normalizeKeyText(text: string) {
  // Drop Unicode "format" chars (variation selectors, ZWJ/ZWNJ, etc)
  // so visually identical emojis don't appear as separate phrases.
  // Avoid NFKC here to keep non-emoji phrases' counts/rankings stable.
  let normalized = text.replace(/\p{Cf}/gu, "");

  // Normalize repeated characters: 3+ consecutive identical characters → 2
  // "きちゃあああああああ" → "きちゃああ"
  // "！！！！！" → "！！"
  normalized = normalized.replace(/(\S)\1{2,}/gu, "$1$1");

  // Normalize repeated 2-character sequences: 3+ consecutive identical sequences → 2
  // "！？！？！？" → "！？！？"
  normalized = normalized.replace(/(\S{2})\1{2,}/gu, "$1$1");

  return normalized;
}

function truncateRepeatedPhrases(text: string) {
  // Cap repeated characters at 5
  // "きちゃああああああ" → "きちゃあああああ"
  let truncated = text.replace(/(\S)\1{4,}/gu, "$1$1$1$1$1");

  // Cap repeated 2-char sequences at 5
  // "！？！？！？！？！？！？" → "！？！？！？！？！？"
  truncated = truncated.replace(/(\S{2})\1{4,}/gu, "$1$1$1$1$1");

  return truncated;
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
  //   ただし、感嘆符・疑問符・長音・チルダ（！？!?‼⁉ー〜~）は文末の強調や伸ばし棒として
  //   フレーズの一部とみなすため、これらのみで構成される記号トークンは「接続的な記号」とはみなさない。
  return tokens.some(
    (t) =>
      t.pos.startsWith("接続詞") ||
      t.pos.startsWith("助詞") ||
      t.pos.startsWith("助動詞") ||
      (t.pos.startsWith("記号") && !/^[！？!?‼⁉ー〜~]+$/.test(t.surface_form))
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

function shouldBuildPhraseWith(token: kuromoji.Token): boolean {
  // Only include content words (nouns, verbs, adjectives, adverbs)
  // Exclude particles and auxiliary verbs to avoid generic short phrases
  // Also include exclamation/question marks, prolonged sounds, and tildes as they add meaning/nuance.
  if (isContentWord(token.pos)) return true;
  if (token.pos.startsWith("記号") && /^[！？!?‼⁉ー〜~]+$/.test(token.surface_form))
    return true;
  return false;
}

function cleanMessageContent(content: string) {
  return (
    content
      // LINE stamp emoji (e.g., "(emoji)")
      .replace(/\(emoji\)/g, " ")
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

function shouldSkipNormalizedPhrase(normalized: string): boolean {
  if (STOP_WORDS.has(normalized)) return true;
  // Single hiragana/katakana
  if (
    normalized.length === 1 &&
    /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(normalized)
  ) {
    return true;
  }
  // Grass (w, www)
  if (/^w+$/i.test(normalized)) return true;

  return false;
}

function isMeaningfulNGram(phrase: string, normalized: string) {
  if (phrase.length < MIN_PHRASE_LEN) return false;
  if (shouldSkipNormalizedPhrase(normalized)) return false;
  // Require at least some CJK signal to avoid random ASCII fragments.
  if (!/[\p{Script=Han}\p{Script=Katakana}]/u.test(phrase)) return false;
  return true;
}

function getTopPhrases(
  counts: Map<string, { phrase: string; tokens: string[]; count: number }>
) {
  // Performance: keep limited top candidates via min-heap
  type CountItem = {
    phrase: string;
    tokens: string[];
    count: number;
    ids: string[];
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
      heap.push(item as CountItem);
      heapUp(heap.length - 1);
      continue;
    }

    // Replace the worst item if the new item is better.
    if (isWorse(heap[0], item as CountItem)) {
      heap[0] = item as CountItem;
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
    kept.push({ phrase: item.phrase, count: item.count, ids: item.ids });

    if (kept.length >= TOP_N) break;
  }

  return kept;
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
      ids: string[];
    }
  >();

  const addCount = (
    text: string,
    tokens: string[],
    countedKeysInMessage: Set<string>,
    messageId: string
  ) => {
    const normalized = normalizeKeyText(text);

    if (shouldSkipNormalizedPhrase(normalized)) return;

    // Unified key generation: use normalized text to group variations
    const key = `p:${normalized}`;

    // Per-message dedupe
    if (countedKeysInMessage.has(key)) return;
    countedKeysInMessage.add(key);

    const displayPhrase = truncateRepeatedPhrases(text);

    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
      // Keep the longer phrase version (original, not normalized)
      if (displayPhrase.length > existing.phrase.length) {
        existing.phrase = displayPhrase;
      }
      existing.ids.push(messageId);
    } else {
      counts.set(key, { phrase: displayPhrase, tokens, count: 1, ids: [messageId] });
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

    // 1. Short message OR Emoji/Symbol spam
    // If message is short (≤10 chars) OR contains many emojis/symbols/punctuation,
    // count the whole message as a phrase.
    if (
      cleaned.length <= SHORT_MESSAGE_MAX_LEN ||
      countEmojiOrSymbolChars(normalizedWhole) >= EMOJI_OR_SYMBOL_MIN_COUNT
    ) {
      addCount(cleaned, [cleaned], countedKeysInMessage, msg.id);
      continue;
    }

    // Use kuromoji for morphological analysis (with POS tagging)
    const tokens = tokenizer.tokenize(cleaned);

    // 2. Short-ish message with no conjunctions
    // If there's no connective signal (conjunction/particle/auxverb/symbol),
    // treat short-ish messages as a single phrase.
    if (
      cleaned.length <= FULL_COUNT_MAX_LEN_NO_CONJUNCTION &&
      !hasConjunctionOrParticle(tokens)
    ) {
      addCount(cleaned, [cleaned], countedKeysInMessage, msg.id);
      continue;
    }

    // 3. N-gram extraction
    const segments: Array<{ text: string; pos: string }[]> = [];
    let current: { text: string; pos: string }[] = [];

    for (const token of tokens) {
      if (!shouldBuildPhraseWith(token)) {
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
          const normalizedPhrase = normalizeKeyText(phrase);

          if (!isMeaningfulNGram(phrase, normalizedPhrase)) continue;

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
        // Prefer longer token spans to reduce sub-phrase duplicates.
        if (b.tokens.length !== a.tokens.length) return b.tokens.length - a.tokens.length;
        // Then prefer longer surface length.
        if (b.phrase.length !== a.phrase.length) return b.phrase.length - a.phrase.length;
        // Finally prefer noun-only phrases if lengths are equal.
        return a.isNounOnly === b.isNounOnly ? 0 : a.isNounOnly ? -1 : 1;
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

        addCount(cand.phrase, cand.tokens, countedKeysInMessage, msg.id);

        for (let k = cand.start; k < cand.end; k++) used[k] = true;
      }
    }
  }

  return getTopPhrases(counts);
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

  const allMessages = useMemo(() => {
    return history.flatMap((h) => h.messages);
  }, [history]);

  useEffect(() => {
    if (selectedDate && selectedRow && allMessages.length > 0) {
      const sortedMessages = allMessages.sort((a, b) => {
        const aDateTime =
          a.date && a.time ? new Date(`${a.date} ${a.time}`).getTime() : 0;
        const bDateTime =
          b.date && b.time ? new Date(`${b.date} ${b.time}`).getTime() : 0;
        return aDateTime - bDateTime;
      });
      // Find the first id of the phrase on the selected date
      const firstId = selectedRow.ids.find((id) => {
        const msg = allMessages.find((m) => m.id === id);
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
  }, [selectedDate, selectedRow, allMessages]);

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
                <Table.Th w="4em">#</Table.Th>
                <Table.Th>フレーズ</Table.Th>
                <Table.Th w="8em">出現回数</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {resultRows.map((row, idx) => (
                <Table.Tr
                  key={row.phrase}
                  onClick={() => setSelectedRow(row)}
                  style={{ cursor: "pointer" }}
                >
                  <Table.Td>{idx + 1}</Table.Td>
                  <Table.Td>{row.phrase}</Table.Td>
                  <Table.Td>{row.count}</Table.Td>
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
        title={selectedDate ? "メッセージ履歴" : "メッセージ履歴"}
        size="xl"
      >
        <Stack>
          {selectedRow && !selectedDate && (
            <SimpleGrid cols={2}>
              {[
                ...new Set(
                  selectedRow.ids
                    .map((id) => {
                      const msg = allMessages.find((m) => m.id === id);
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
