import type kuromoji from "kuromoji";
import { type LineMessage, yearFromDate } from "@/services/line/parser";

export type ParsedMessage = LineMessage;

export type TrendRow = {
  phrase: string;
  count: number;
  dayCount: number;
  ids: string[];
};

// メッセージ全体をフレーズとして数える最大文字数
// これ以下の短いメッセージは全体を１フレーズとする
const SHORT_MESSAGE_MAX_LEN = 5;
// N-gram 抽出時の最小フレーズ文字数
// これより短いフレーズは N-gram 抽出を行わない
const MIN_PHRASE_LEN = 3;
// N-gram 抽出時の最大単語数
// この数まで連続フレーズを抽出
const MAX_NGRAM = 5;
// ランキング表示件数
const TOP_N = 30;
// パフォーマンス最適化用）ヒープ保持する候補フレーズ上限
// これを超える候補は最も頻度の低いものから削除
const CANDIDATE_LIMIT = 600;
// メッセージ全体をフレーズとして数えるための絵文字/記号の最小数
// これ以上含む場合、メッセージ全体を１フレーズとする
const EMOJI_OR_SYMBOL_MIN_COUNT = 3;
// 接続詞のない短めメッセージをフレーズとして数える最大文字数
// 接続詞がなくこの文字数以下の場合、メッセージ全体を１フレーズとする
const FULL_COUNT_MAX_LEN_NO_CONJUNCTION = 30;
// N-gram で抽出したフレーズの出現日数の除外頻度
// 総日数に対してこの比率を超えたら除外
const NGRAM_MAX_DAILY_FREQUENCY_RATIO = 0.1;

// Common stop words to exclude from trending phrases
// biome-ignore format: Preserve manual formatting to maintain category comments and alignment
const STOP_WORDS = new Set([
  "これ", "それ", "あれ", "どれ",
  "この", "その", "あの", "どの",
  "いや", "まあ", "たしか", "それで", "実は",
  "えっ", "あっ", "うわ", "うわあ", "ああ", "おう", "よう",
  "はい", "いいえ", "そう",
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

function isMeaningfulNGram(
  phrase: string,
  normalized: string,
  tokenCount: number,
  items: Array<{ text: string; pos: string }>
) {
  // Single words (n=1): noun only, 2+ characters to avoid common words like "気", "今"
  // Multiple words (n>=2): MIN_PHRASE_LEN characters AND must start with a noun
  if (tokenCount === 1) {
    if (phrase.length < 2) return false;
    if (!items[0].pos.startsWith("名詞")) return false;
  } else {
    if (phrase.length < MIN_PHRASE_LEN) return false;
    // Require first token to be a noun to filter out verb conjugations like "思って"
    if (!items[0].pos.startsWith("名詞")) return false;
  }
  if (shouldSkipNormalizedPhrase(normalized)) return false;
  // Require at least some CJK signal to avoid random ASCII fragments.
  if (!/[\p{Script=Han}\p{Script=Katakana}]/u.test(phrase)) return false;
  return true;
}

function getTopPhrases(
  counts: Map<
    string,
    {
      phrase: string;
      tokens: string[];
      count: number;
      dates: Set<string>;
      isFromNGram: boolean;
      ids: string[];
    }
  >,
  totalDaysCount: number
) {
  // Performance: keep limited top candidates via min-heap
  type CountItem = {
    phrase: string;
    tokens: string[];
    count: number;
    ids: string[];
    dates: Set<string>;
    isFromNGram: boolean;
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
    if (
      item.isFromNGram &&
      item.dates.size > totalDaysCount * NGRAM_MAX_DAILY_FREQUENCY_RATIO
    ) {
      continue;
    }

    kept.push({
      phrase: item.phrase,
      count: item.count,
      dayCount: item.dates.size,
      ids: item.ids,
    });

    if (kept.length >= TOP_N) break;
  }

  return kept;
}

export function analyzeBuzzwords(
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
      dates: Set<string>;
      isFromNGram: boolean;
    }
  >();

  const addCount = (
    text: string,
    tokens: string[],
    countedKeysInMessage: Set<string>,
    messageId: string,
    messageDate: string | null,
    isFromNGram: boolean = false
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
      if (messageDate) {
        existing.dates.add(messageDate);
      }
      existing.isFromNGram = existing.isFromNGram || isFromNGram;
    } else {
      const dates = new Set<string>();
      if (messageDate) {
        dates.add(messageDate);
      }
      counts.set(key, {
        phrase: displayPhrase,
        tokens,
        count: 1,
        ids: [messageId],
        dates,
        isFromNGram,
      });
    }
  };

  // 総日数を計算
  const uniqueDates = new Set(messages.map((m) => m.date).filter((d) => d));
  const totalDaysCount = uniqueDates.size;

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
      addCount(cleaned, [cleaned], countedKeysInMessage, msg.id, msg.date || null, false);
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
      addCount(cleaned, [cleaned], countedKeysInMessage, msg.id, msg.date || null, false);
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
        for (let n = 1; n <= maxN && i + n <= segment.length; n++) {
          const phraseItems = segment.slice(i, i + n);
          const phraseTokens = phraseItems.map((p) => p.text);
          const phrase = phraseTokens.join("");
          const normalizedPhrase = normalizeKeyText(phrase);

          if (!isMeaningfulNGram(phrase, normalizedPhrase, n, phraseItems)) continue;

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

        addCount(
          cand.phrase,
          cand.tokens,
          countedKeysInMessage,
          msg.id,
          msg.date || null,
          true
        );

        for (let k = cand.start; k < cand.end; k++) used[k] = true;
      }
    }
  }

  return getTopPhrases(counts, totalDaysCount);
}
