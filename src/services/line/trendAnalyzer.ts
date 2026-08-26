import type kuromoji from "kuromoji";
import { type LineMessage, yearFromDate } from "@/services/line/parser";

export type ParsedMessage = LineMessage;

export type TrendRow = {
  phrase: string;
  count: number;
  dayCount: number;
  ids: string[];
};

type PhraseToken = {
  text: string;
  pos: string;
  posDetail1: string;
  conjugatedForm: string;
  isStableContent: boolean;
  isSpecificContent: boolean;
};

type SurfaceEntry = {
  count: number;
  firstSeen: number;
};

type PhraseEntry = {
  normalized: string;
  surfaces: Map<string, SurfaceEntry>;
  specificContentCounts: Map<number, number>;
  count: number;
  maxTokenCount: number;
  firstSeen: number;
  isExclamationTemplate: boolean;
};

type AddCountContext = {
  countedKeysInMessage: Set<string>;
  messageIndex: number;
  sourceText: string;
  isExclamationTemplate: boolean;
};

type RankedEntry = {
  key: string;
  phrase: string;
  count: number;
  specificContentCounts: Map<number, number>;
  maxTokenCount: number;
  firstSeen: number;
  isExclamationTemplate: boolean;
};

// 短いメッセージは発言全体も候補にする
const SHORT_MESSAGE_MAX_LEN = 5;
// 部分フレーズとして扱う最小文字数
const MIN_PHRASE_LEN = 3;
// 助詞や助動詞を含めた連続フレーズの最大単語数
const MAX_NGRAM = 8;
// ランキング表示件数
const TOP_N = 30;
// 上位結果のうち末尾が感嘆符の定型文に保証する件数
const EXCLAMATION_TEMPLATE_RESULT_COUNT = Math.ceil(TOP_N * 0.2);
// 発言全体も候補にする強調記号数
const EXPRESSIVE_SYMBOL_MIN_COUNT = 3;
// 接続要素のないメッセージを発言全体として扱う最大文字数
const FULL_COUNT_MAX_LEN_NO_CONJUNCTION = 30;
const CONTENT_POS_PREFIXES = ["名詞", "動詞", "形容詞", "副詞", "感動詞"] as const;
const EXPRESSIVE_SYMBOL_PATTERN = /^[！？!?‼⁉ー〜~…]+$/u;
const EXCLUDED_MESSAGE_MARKERS = [
  "メッセージの送信を取り消しました",
  "アナウンスしました",
  "[スタンプ]",
  "[写真]",
  "[アルバム]",
  "[ボイスメッセージ]",
  "[ノート]",
] as const;

function normalizeKeyText(text: string) {
  // 書式文字を除去し、繰り返し記号と末尾の感嘆符・疑問符を正規化する
  let normalized = text.replace(/\p{Cf}/gu, "");
  normalized = normalized.replace(/\?/gu, "？");
  normalized = normalized.replace(/(\S)\1{2,}/gu, "$1$1");
  normalized = normalized.replace(/(\S{2})\1{2,}/gu, "$1$1");
  normalized = normalized.replace(/[!！]+$/u, (run) => (run.length >= 2 ? "！！" : run));
  normalized = normalized.replace(/[?？]+$/u, (run) => (run.length >= 2 ? "？？" : run));

  // ひらがなとカタカナは統合し、その他の表記は元のまま保つ
  return normalized.replace(/[\u3041-\u3096\u309d-\u309f]/gu, (char) => {
    const codePoint = char.codePointAt(0);
    return codePoint === undefined ? char : String.fromCodePoint(codePoint + 0x60);
  });
}

// biome-ignore format: Preserve manual formatting to maintain category comments and alignment
const STOP_WORDS = new Set([
  "これ", "それ", "あれ", "どれ",
  "この", "その", "あの", "どの",
  "いや", "まあ", "たしか", "それで", "実は",
  "えっ", "あっ", "うわ", "うわあ", "ああ", "おう", "よう",
  "はい", "いいえ", "そう",
  "こと", "もの", "ため", "ところ",
  "ある", "いる", "する", "なる", "ない", "てる", "てい",
  "みたい", "すぎる", "もう", "あと",
].map(normalizeKeyText));

const GENERIC_BASIC_FORMS = new Set(
  [
    "ある",
    "いる",
    "する",
    "なる",
    "やる",
    "できる",
    "ない",
    "てる",
    "みたい",
    "すぎる",
  ].map(normalizeKeyText)
);

function countExpressiveSymbols(text: string) {
  // 通常の句読点は数えず、絵文字と強調に使われる記号だけを数える
  return (text.match(/[\p{Extended_Pictographic}！？!?‼⁉〜~…]/gu) ?? []).length;
}

function isExpressiveText(text: string) {
  return EXPRESSIVE_SYMBOL_PATTERN.test(text);
}

function hasConjunctionOrParticle(tokens: PhraseToken[]) {
  return tokens.some(
    (token) =>
      token.pos.startsWith("接続詞") ||
      token.pos.startsWith("助詞") ||
      token.pos.startsWith("助動詞") ||
      (token.pos.startsWith("記号") && !isExpressivePhraseToken(token))
  );
}

function isContentWord(pos: string) {
  return CONTENT_POS_PREFIXES.some((prefix) => pos.startsWith(prefix));
}

function isPhraseToken(token: PhraseToken) {
  return (
    isContentWord(token.pos) ||
    token.pos.startsWith("助詞") ||
    token.pos.startsWith("助動詞") ||
    token.pos.startsWith("接頭詞") ||
    isExpressivePhraseToken(token)
  );
}

function isExpressivePhraseToken(token: PhraseToken) {
  return token.pos.startsWith("記号") && isExpressiveText(token.text);
}

function toPhraseToken(token: kuromoji.Token): PhraseToken {
  const basicForm = token.basic_form ?? token.surface_form;
  const posDetail1 = token.pos_detail_1 ?? "*";
  const isStableContent =
    isContentWord(token.pos) &&
    posDetail1 !== "非自立" &&
    posDetail1 !== "接尾" &&
    !(token.pos.startsWith("名詞") && posDetail1 === "数");
  const normalizedBasicForm = normalizeKeyText(basicForm);

  return {
    text: token.surface_form,
    pos: token.pos,
    posDetail1,
    conjugatedForm: token.conjugated_form ?? "*",
    isStableContent,
    isSpecificContent: isStableContent && !isGenericBasicForm(normalizedBasicForm),
  };
}

function isStableContentToken(token: PhraseToken) {
  return token.isStableContent;
}

function isGenericBasicForm(normalizedBasicForm: string) {
  return (
    GENERIC_BASIC_FORMS.has(normalizedBasicForm) || STOP_WORDS.has(normalizedBasicForm)
  );
}

function isSpecificContentToken(token: PhraseToken) {
  return token.isSpecificContent;
}

function countSpecificContentTokens(tokens: PhraseToken[]) {
  return tokens.reduce(
    (count, token) => count + (isSpecificContentToken(token) ? 1 : 0),
    0
  );
}

function canStartPhrase(token: PhraseToken) {
  return isStableContentToken(token) || token.pos.startsWith("接頭詞");
}

function isCompleteConjugation(token: PhraseToken) {
  return (
    token.conjugatedForm === "*" ||
    token.conjugatedForm === "基本形" ||
    token.conjugatedForm.startsWith("命令")
  );
}

function isMeaningfulStandaloneVerb(token: PhraseToken) {
  if (isCompleteConjugation(token)) return true;
  return token.conjugatedForm === "連用形" && !token.text.endsWith("っ");
}

function canEndPhrase(token: PhraseToken) {
  if (token.pos.startsWith("接頭詞")) return false;
  if (token.pos.startsWith("動詞") || token.pos.startsWith("形容詞")) {
    return isCompleteConjugation(token);
  }
  if (token.pos.startsWith("助詞")) return token.posDetail1 === "終助詞";
  if (token.pos.startsWith("名詞")) return token.posDetail1 !== "非自立";
  return true;
}

function isMeaningfulSingleToken(token: PhraseToken, allowVerb: boolean) {
  if (!isSpecificContentToken(token)) return false;
  if (token.pos.startsWith("名詞")) {
    return token.posDetail1 !== "代名詞" && token.posDetail1 !== "数";
  }
  if (token.pos.startsWith("動詞")) {
    return allowVerb && isMeaningfulStandaloneVerb(token);
  }
  if (token.pos.startsWith("形容詞")) return isCompleteConjugation(token);
  return token.pos.startsWith("副詞") || token.pos.startsWith("感動詞");
}

function isMeaningfulWholeMessage(normalized: string, items: PhraseToken[]) {
  if (shouldSkipNormalizedPhrase(normalized) || items.length === 0) return false;
  if (items.length === 1) return isMeaningfulSingleToken(items[0], true);
  const lastItem = items.at(-1);
  if (!lastItem || !canStartPhrase(items[0]) || !canEndPhrase(lastItem)) return false;
  return items.some(isSpecificContentToken);
}

function cleanMessageContent(content: string) {
  return content
    .replace(/\(emoji\)/g, " ")
    .replace(/\[(スタンプ|写真|動画|アルバム)\]/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/@[\w\-_.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function collapseRepeatedExclamationTemplate(text: string) {
  // 同じ感嘆符付き定型文の連続だけを 1 回分にまとめる
  const match = text.match(/^(.+?[!！])(?:\s*\1)+$/u);
  const repeatedTemplate = match?.[1];
  if (!repeatedTemplate) return text;

  const contentWithoutExclamation = repeatedTemplate.replace(/[!！]/gu, "").trim();
  return contentWithoutExclamation ? repeatedTemplate : text;
}

function shouldExcludeMessage(content: string) {
  return EXCLUDED_MESSAGE_MARKERS.some((marker) => content.includes(marker));
}

function shouldSkipNormalizedPhrase(normalized: string) {
  if (STOP_WORDS.has(normalized)) return true;
  if (
    normalized.length === 1 &&
    /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(normalized)
  ) {
    return true;
  }
  if (/^w+$/i.test(normalized)) return true;
  return false;
}

function isMeaningfulCandidate(phrase: string, normalized: string, items: PhraseToken[]) {
  if (shouldSkipNormalizedPhrase(normalized)) return false;
  if (!canStartPhrase(items[0])) return false;
  if (!items.some(isSpecificContentToken)) return false;
  const lastItem = items.at(-1);
  if (!lastItem || !canEndPhrase(lastItem)) return false;

  if (items.length === 1) {
    if (phrase.length < 2) return false;
    if (!items[0].pos.startsWith("名詞")) return false;
    if (!isMeaningfulSingleToken(items[0], false)) return false;
  } else if (phrase.length < MIN_PHRASE_LEN) {
    return false;
  }

  // ひらがなだけの動詞や形容詞も対象に含める
  return /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(phrase);
}

function countTrailingPunctuation(text: string) {
  return text.match(/[!！?？]+$/u)?.[0].length ?? 0;
}

function escapeSurfacePattern(text: string) {
  return Array.from(text)
    .map((char) => {
      if (char === "?" || char === "？") return "[?？]";
      if (char === "!" || char === "！") return "[!！]";
      return char.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    })
    .join("");
}

function canonicalizeDisplaySurface(text: string) {
  return text.replace(/\?/gu, "？");
}

type RepeatedUnit = {
  unit: string;
  prefix: string;
  suffix: string;
};

function findRepeatedUnits(text: string) {
  const chars = Array.from(text);
  const repeatedUnits: RepeatedUnit[] = [];

  for (let unitLength = 1; unitLength <= 2; unitLength++) {
    for (let start = 0; start + unitLength * 2 <= chars.length; start++) {
      const unit = chars.slice(start, start + unitLength).join("");
      const nextUnit = chars.slice(start + unitLength, start + unitLength * 2).join("");
      if (unit !== nextUnit) continue;

      repeatedUnits.push({
        unit,
        prefix: chars.slice(0, start).join(""),
        suffix: chars.slice(start + unitLength * 2).join(""),
      });
    }
  }

  return repeatedUnits;
}

function selectSurfaceForMessage(text: string, sourceText: string) {
  if (text === sourceText) return canonicalizeDisplaySurface(text);

  const hasTrailingPunctuation = /[!！?？]+$/u.test(text);
  const repeatedUnits = findRepeatedUnits(text);
  if (!hasTrailingPunctuation && repeatedUnits.length === 0) {
    return canonicalizeDisplaySurface(text);
  }

  const normalized = normalizeKeyText(text);
  let selected = text;
  const consider = (candidate: string) => {
    if (
      normalizeKeyText(candidate) === normalized &&
      candidate.length > selected.length
    ) {
      selected = candidate;
    }
  };

  if (sourceText.includes(text)) consider(text);

  const trailing = text.match(/[!！?？]+$/u);
  if (trailing) {
    const body = text.slice(0, -trailing[0].length);
    const pattern = new RegExp(`${escapeSurfacePattern(body)}[!！?？]+`, "gu");
    for (const match of sourceText.matchAll(pattern)) consider(match[0]);
  }

  for (const { unit, prefix, suffix } of repeatedUnits) {
    const pattern = new RegExp(
      `${escapeSurfacePattern(prefix)}(?:${escapeSurfacePattern(unit)}){2,}${escapeSurfacePattern(suffix)}`,
      "gu"
    );
    for (const match of sourceText.matchAll(pattern)) consider(match[0]);
  }

  return canonicalizeDisplaySurface(selected);
}

function selectDisplayPhrase(entry: PhraseEntry) {
  let selected = "";
  let selectedCount = -1;
  let selectedTrailingPunctuationCount = -1;
  let selectedLength = -1;
  let selectedOrder = Number.POSITIVE_INFINITY;

  for (const [phrase, surface] of entry.surfaces) {
    const trailingPunctuationCount = countTrailingPunctuation(phrase);
    if (
      surface.count > selectedCount ||
      (surface.count === selectedCount &&
        (trailingPunctuationCount > selectedTrailingPunctuationCount ||
          (trailingPunctuationCount === selectedTrailingPunctuationCount &&
            (phrase.length > selectedLength ||
              (phrase.length === selectedLength && surface.firstSeen < selectedOrder)))))
    ) {
      selected = phrase;
      selectedCount = surface.count;
      selectedTrailingPunctuationCount = trailingPunctuationCount;
      selectedLength = phrase.length;
      selectedOrder = surface.firstSeen;
    }
  }

  return selected;
}

function findRanges(text: string, target: string) {
  const ranges: Array<{ start: number; end: number }> = [];
  let offset = 0;

  while (offset <= text.length - target.length) {
    const start = text.indexOf(target, offset);
    if (start < 0) break;
    ranges.push({ start, end: start + target.length });
    offset = start + 1;
  }

  return ranges;
}

function isFullyCoveredByLongerPhrase(
  shorter: PhraseEntry,
  longer: PhraseEntry,
  normalizedMessages: string[]
) {
  if (!longer.normalized.includes(shorter.normalized)) return false;

  for (const [messageIndex, shorterContentCount] of shorter.specificContentCounts) {
    const longerContentCount = longer.specificContentCounts.get(messageIndex);
    if (longerContentCount === undefined || longerContentCount <= shorterContentCount) {
      return false;
    }

    const message = normalizedMessages[messageIndex];
    const shortRanges = findRanges(message, shorter.normalized);
    const longRanges = findRanges(message, longer.normalized);

    if (
      shortRanges.length === 0 ||
      longRanges.length === 0 ||
      shortRanges.some(
        (shortRange) =>
          !longRanges.some(
            (longRange) =>
              longRange.start <= shortRange.start && longRange.end >= shortRange.end
          )
      )
    ) {
      return false;
    }
  }

  return true;
}

function removeRedundantNestedPhrases(
  entries: PhraseEntry[],
  normalizedMessages: string[]
) {
  const entriesByOccurrences = new Map<string, PhraseEntry[]>();

  for (const entry of entries) {
    const signature = [...entry.specificContentCounts.keys()].join(",");
    const group = entriesByOccurrences.get(signature);
    if (group) {
      group.push(entry);
    } else {
      entriesByOccurrences.set(signature, [entry]);
    }
  }

  const kept: PhraseEntry[] = [];

  for (const group of entriesByOccurrences.values()) {
    group.sort((a, b) => {
      if (b.normalized.length !== a.normalized.length) {
        return b.normalized.length - a.normalized.length;
      }
      return a.firstSeen - b.firstSeen;
    });

    const longerPhrases: PhraseEntry[] = [];
    for (const entry of group) {
      const isRedundant = longerPhrases.some((longer) =>
        isFullyCoveredByLongerPhrase(entry, longer, normalizedMessages)
      );
      if (!isRedundant) {
        kept.push(entry);
        longerPhrases.push(entry);
      }
    }
  }

  return kept;
}

function compareRank(a: RankedEntry, b: RankedEntry) {
  if (a.count !== b.count) return b.count - a.count;
  if (a.maxTokenCount !== b.maxTokenCount) {
    return b.maxTokenCount - a.maxTokenCount;
  }
  if (a.phrase.length !== b.phrase.length) return b.phrase.length - a.phrase.length;
  return a.firstSeen - b.firstSeen;
}

function isBetterRank(a: RankedEntry, b: RankedEntry) {
  return compareRank(a, b) < 0;
}

function isWorseRank(a: RankedEntry, b: RankedEntry) {
  return compareRank(a, b) > 0;
}

function swapRankEntries(heap: RankedEntry[], left: number, right: number) {
  const value = heap[left];
  heap[left] = heap[right];
  heap[right] = value;
}

function moveRankHeapUp(heap: RankedEntry[], index: number) {
  let current = index;
  while (current > 0) {
    const parent = Math.floor((current - 1) / 2);
    if (!isWorseRank(heap[current], heap[parent])) break;
    swapRankEntries(heap, current, parent);
    current = parent;
  }
}

function moveRankHeapDown(heap: RankedEntry[], index: number) {
  let current = index;
  while (true) {
    const left = current * 2 + 1;
    const right = left + 1;
    let worst = current;

    if (left < heap.length && isWorseRank(heap[left], heap[worst])) worst = left;
    if (right < heap.length && isWorseRank(heap[right], heap[worst])) worst = right;
    if (worst === current) break;
    swapRankEntries(heap, current, worst);
    current = worst;
  }
}

function addToRankHeap(heap: RankedEntry[], entry: RankedEntry, limit: number) {
  if (heap.length < limit) {
    heap.push(entry);
    moveRankHeapUp(heap, heap.length - 1);
  } else if (isBetterRank(entry, heap[0])) {
    heap[0] = entry;
    moveRankHeapDown(heap, 0);
  }
}

function getTopPhrases(entries: PhraseEntry[], targetMessages: ParsedMessage[]) {
  const generalHeap: RankedEntry[] = [];
  const templateHeap: RankedEntry[] = [];

  for (const entry of entries) {
    const ranked: RankedEntry = {
      key: `${entry.isExclamationTemplate ? "t" : "p"}:${entry.normalized}`,
      phrase: selectDisplayPhrase(entry),
      count: entry.count,
      specificContentCounts: entry.specificContentCounts,
      maxTokenCount: entry.maxTokenCount,
      firstSeen: entry.firstSeen,
      isExclamationTemplate: entry.isExclamationTemplate,
    };

    addToRankHeap(generalHeap, ranked, TOP_N);
    if (ranked.isExclamationTemplate) {
      addToRankHeap(templateHeap, ranked, EXCLAMATION_TEMPLATE_RESULT_COUNT);
    }
  }

  const selected: RankedEntry[] = [];
  const selectedKeys = new Set<string>();
  for (const entry of templateHeap.sort(compareRank)) {
    selected.push(entry);
    selectedKeys.add(entry.key);
  }
  for (const entry of generalHeap.sort(compareRank)) {
    if (selectedKeys.has(entry.key)) continue;
    selected.push(entry);
    selectedKeys.add(entry.key);
    if (selected.length >= TOP_N) break;
  }

  return selected.sort(compareRank).map<TrendRow>((entry) => {
    const ids: string[] = [];
    const dates = new Set<string>();

    for (const messageIndex of entry.specificContentCounts.keys()) {
      const message = targetMessages[messageIndex];
      if (!message) continue;

      if (message.date) {
        if (!dates.has(message.date)) ids.push(message.id);
        dates.add(message.date);
      } else {
        ids.push(message.id);
      }
    }

    return {
      phrase: entry.phrase,
      count: entry.count,
      dayCount: dates.size,
      ids,
    };
  });
}

/**
 * LINE メッセージから対象年の流行フレーズを集計する
 */
export function analyzeBuzzwords(
  messages: ParsedMessage[],
  targetYear: number,
  tokenizer: kuromoji.Tokenizer
) {
  const counts = new Map<string, PhraseEntry>();
  const targetMessages = messages.filter(
    (message) => message.date && yearFromDate(message.date) === targetYear
  );
  const normalizedMessages = new Array<string>(targetMessages.length).fill("");
  let sequence = 0;

  const addCount = (
    text: string,
    normalized: string,
    tokenCount: number,
    context: AddCountContext,
    specificContentCount: number
  ) => {
    const { countedKeysInMessage, messageIndex, sourceText, isExclamationTemplate } =
      context;
    if (shouldSkipNormalizedPhrase(normalized)) return;

    const key = `${isExclamationTemplate ? "t" : "p"}:${normalized}`;
    if (countedKeysInMessage.has(key)) return;
    countedKeysInMessage.add(key);

    const displayText = isExclamationTemplate
      ? canonicalizeDisplaySurface(text)
      : selectSurfaceForMessage(text, sourceText);
    const surfaceOrder = sequence++;
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
      existing.specificContentCounts.set(messageIndex, specificContentCount);
      existing.maxTokenCount = Math.max(existing.maxTokenCount, tokenCount);

      const surface = existing.surfaces.get(displayText);
      if (surface) {
        surface.count += 1;
      } else {
        existing.surfaces.set(displayText, { count: 1, firstSeen: surfaceOrder });
      }

      return;
    }

    counts.set(key, {
      normalized,
      surfaces: new Map([[displayText, { count: 1, firstSeen: surfaceOrder }]]),
      specificContentCounts: new Map([[messageIndex, specificContentCount]]),
      count: 1,
      maxTokenCount: tokenCount,
      firstSeen: surfaceOrder,
      isExclamationTemplate,
    });
  };

  for (const [messageIndex, message] of targetMessages.entries()) {
    if (shouldExcludeMessage(message.content)) continue;

    const cleaned = cleanMessageContent(message.content);
    if (!cleaned) continue;

    const countedKeysInMessage = new Set<string>();
    if (/[!！]$/u.test(cleaned)) {
      const template = collapseRepeatedExclamationTemplate(cleaned);
      const normalizedTemplate = normalizeKeyText(template);
      normalizedMessages[messageIndex] = normalizedTemplate;
      const context: AddCountContext = {
        countedKeysInMessage,
        messageIndex,
        sourceText: template,
        isExclamationTemplate: true,
      };
      addCount(template, normalizedTemplate, 1, context, 0);
      continue;
    }

    const normalizedCleaned = normalizeKeyText(cleaned);
    normalizedMessages[messageIndex] = normalizedCleaned;

    const phraseItems = tokenizer.tokenize(cleaned).map(toPhraseToken);
    const expressiveSymbolCount = countExpressiveSymbols(cleaned);
    const isMeaningfulWhole = isMeaningfulWholeMessage(normalizedCleaned, phraseItems);
    const specificContentCount = countSpecificContentTokens(phraseItems);
    const context: AddCountContext = {
      countedKeysInMessage,
      messageIndex,
      sourceText: cleaned,
      isExclamationTemplate: false,
    };
    const shouldCountWholeMessage =
      expressiveSymbolCount >= EXPRESSIVE_SYMBOL_MIN_COUNT ||
      (cleaned.length <= SHORT_MESSAGE_MAX_LEN &&
        (isMeaningfulWhole || expressiveSymbolCount > 0)) ||
      (cleaned.length <= FULL_COUNT_MAX_LEN_NO_CONJUNCTION &&
        !hasConjunctionOrParticle(phraseItems) &&
        isMeaningfulWhole);

    if (shouldCountWholeMessage) {
      addCount(cleaned, normalizedCleaned, 1, context, specificContentCount);
    }

    const segments: PhraseToken[][] = [];
    let currentSegment: PhraseToken[] = [];

    for (const token of phraseItems) {
      if (!isPhraseToken(token)) {
        if (currentSegment.length > 0) segments.push(currentSegment);
        currentSegment = [];
        continue;
      }
      currentSegment.push(token);
    }
    if (currentSegment.length > 0) segments.push(currentSegment);

    for (const segment of segments) {
      for (let start = 0; start < segment.length; start++) {
        if (!canStartPhrase(segment[start])) continue;

        let phrase = "";
        const endLimit = Math.min(segment.length, start + MAX_NGRAM);

        for (let end = start; end < endLimit; end++) {
          phrase += segment[end].text;
          const items = segment.slice(start, end + 1);
          if (
            isExpressivePhraseToken(segment[end]) &&
            segment[end + 1] !== undefined &&
            isExpressivePhraseToken(segment[end + 1])
          ) {
            continue;
          }
          const normalized = normalizeKeyText(phrase);
          if (!isMeaningfulCandidate(phrase, normalized, items)) continue;

          addCount(
            phrase,
            normalized,
            end - start + 1,
            context,
            countSpecificContentTokens(items)
          );
        }
      }
    }
  }

  const nonRedundantEntries = removeRedundantNestedPhrases(
    [...counts.values()],
    normalizedMessages
  );
  return getTopPhrases(nonRedundantEntries, targetMessages);
}
