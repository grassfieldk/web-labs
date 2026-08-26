#!/usr/bin/env bun

import assert from "node:assert/strict";
import kuromoji from "kuromoji";
import type { LineMessage } from "../src/services/line/parser";
import { parseLineChatHistory } from "../src/services/line/parser";
import { analyzeBuzzwords } from "../src/services/line/trendAnalyzer";

const TARGET_YEAR = 2026;

function buildTokenizer(): Promise<kuromoji.Tokenizer> {
  return new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath: "public/kuromoji/dict" }).build((error, tokenizer) => {
      if (error) {
        reject(error);
        return;
      }
      if (!tokenizer) {
        reject(new Error("形態素解析器を初期化できませんでした"));
        return;
      }
      resolve(tokenizer);
    });
  });
}

function createMessages(contents: string[]): LineMessage[] {
  return contents.map((content, index) => ({
    id: `message-${index}`,
    date: `${TARGET_YEAR}/01/${String((index % 28) + 1).padStart(2, "0")}`,
    content,
  }));
}

function findPhrase(
  rows: ReturnType<typeof analyzeBuzzwords>,
  phrase: string
) {
  return rows.find((row) => row.phrase === phrase);
}

async function main() {
  const parsedHistory = parseLineChatHistory(
    "[LINE] テストとのトーク履歴\r\n" +
      "2026/01/01\r\n" +
      "09:00\t自分\t一行目\r\n" +
      "続き\r\n" +
      "2026/01/01\r\n" +
      "10:00\t相手\t二行目\r\n" +
      "2025/12/31\r\n" +
      "11:00\t自分\t前年\r\n"
  );
  assert.equal(parsedHistory.partnerName, "テスト");
  assert.deepEqual(
    parsedHistory.history.map(({ year, month, messages }) => ({
      year,
      month,
      messageCount: messages.length,
    })),
    [
      { year: 2026, month: 1, messageCount: 2 },
      { year: 2025, month: 12, messageCount: 1 },
    ]
  );
  assert.equal(parsedHistory.history[0]?.messages[0]?.content, "一行目\n続き");

  const tokenizer = await buildTokenizer();

  const additiveRows = analyzeBuzzwords(
    createMessages([
      "今日はポケモンしか勝たん！",
      "やっぱりポケモンしか勝たん！",
    ]),
    TARGET_YEAR,
    tokenizer
  );
  assert.equal(findPhrase(additiveRows, "今日はポケモンしか勝たん！")?.count, 1);
  assert.equal(findPhrase(additiveRows, "やっぱりポケモンしか勝たん！")?.count, 1);
  assert.equal(findPhrase(additiveRows, "ポケモンしか勝たん！"), undefined);

  const repeatedTemplateRows = analyzeBuzzwords(
    createMessages([
      "日向は木の葉にて最強！",
      "日向は木の葉にて最強！日向は木の葉にて最強！",
      "日向は木の葉にて最強！ 日向は木の葉にて最強！ 日向は木の葉にて最強！",
      "！！",
    ]),
    TARGET_YEAR,
    tokenizer
  );
  assert.equal(findPhrase(repeatedTemplateRows, "日向は木の葉にて最強！")?.count, 3);
  assert.equal(
    findPhrase(
      repeatedTemplateRows,
      "日向は木の葉にて最強！日向は木の葉にて最強！"
    ),
    undefined
  );
  assert.equal(findPhrase(repeatedTemplateRows, "！！")?.count, 1);

  const additivePartialRows = analyzeBuzzwords(
    createMessages([
      "今日はポケモンしか勝たん！？！？",
      "やっぱりポケモンしか勝たん！？！？",
    ]),
    TARGET_YEAR,
    tokenizer
  );
  assert.equal(findPhrase(additivePartialRows, "ポケモンしか勝たん！？！？")?.count, 2);

  const overlapRows = analyzeBuzzwords(
    createMessages([
      "東京駅新宿方面に行く",
      "東京駅渋谷方面に行く",
      "東京駅池袋方面に行く",
      "東京駅品川方面に行く",
      "東京駅上野方面に行く",
    ]),
    TARGET_YEAR,
    tokenizer
  );
  assert.equal(findPhrase(overlapRows, "東京駅")?.count, 5);

  const nestedRows = analyzeBuzzwords(
    createMessages(["猫の手も借りたい", "猫の手も借りたい"]),
    TARGET_YEAR,
    tokenizer
  );
  assert.equal(findPhrase(nestedRows, "猫の手も借りたい")?.count, 2);
  assert.equal(findPhrase(nestedRows, "猫の手"), undefined);

  const punctuationMessage =
    "今日は、普通の文章として、いくつかの内容を、説明しています。";
  const longMarkMessage =
    "スーパーマーケットでコーヒーメーカーを確認しています。";
  const punctuationRows = analyzeBuzzwords(
    createMessages([punctuationMessage, longMarkMessage, "！！！", "？"]),
    TARGET_YEAR,
    tokenizer
  );
  assert.equal(findPhrase(punctuationRows, punctuationMessage), undefined);
  assert.equal(findPhrase(punctuationRows, longMarkMessage), undefined);
  assert.equal(findPhrase(punctuationRows, "！！！")?.count, 1);
  assert.equal(findPhrase(punctuationRows, "？")?.count, 1);

  const notationRows = analyzeBuzzwords(
    createMessages([
      "すごい！",
      "すごい！",
      "すごい！",
      "スゴイ！",
      "スゴイ！",
      "すごい!",
      "ｽｺﾞｲ！",
      "やばい！？",
      "やばい！？",
      "やばい？",
      "やばい？？",
    ]),
    TARGET_YEAR,
    tokenizer
  );
  assert.equal(findPhrase(notationRows, "すごい！")?.count, 5);
  assert.equal(findPhrase(notationRows, "すごい!")?.count, 1);
  assert.equal(findPhrase(notationRows, "ｽｺﾞｲ！")?.count, 1);
  assert.equal(findPhrase(notationRows, "やばい！？")?.count, 2);
  assert.equal(findPhrase(notationRows, "やばい？？")?.count, 1);
  assert.equal(findPhrase(notationRows, "やばい？")?.count, 1);

  const repeatedSymbolRows = analyzeBuzzwords(
    createMessages([
      "？？？",
      "？？？？",
      "！！",
      "！！！！",
      "！？！？！？",
      "！？！？！？！？",
    ]),
    TARGET_YEAR,
    tokenizer
  );
  assert.equal(findPhrase(repeatedSymbolRows, "？？？？")?.count, 2);
  assert.equal(findPhrase(repeatedSymbolRows, "？？？"), undefined);
  assert.equal(findPhrase(repeatedSymbolRows, "！！！！")?.count, 2);
  assert.equal(findPhrase(repeatedSymbolRows, "！！"), undefined);
  assert.equal(findPhrase(repeatedSymbolRows, "！？！？！？！？")?.count, 2);
  assert.equal(findPhrase(repeatedSymbolRows, "！？！？！？"), undefined);

  const singleAndRepeatedSymbolRows = analyzeBuzzwords(
    createMessages(["？", "？", "？？", "？？？？", "？？？？"]),
    TARGET_YEAR,
    tokenizer
  );
  assert.equal(findPhrase(singleAndRepeatedSymbolRows, "？")?.count, 2);
  assert.equal(findPhrase(singleAndRepeatedSymbolRows, "？？？？")?.count, 3);
  assert.equal(findPhrase(singleAndRepeatedSymbolRows, "？？"), undefined);

  const displayPreferenceRows = analyzeBuzzwords(
    createMessages([
      "？？",
      "？？",
      "？？？？？",
      "？？？？？",
      "？？？？？",
      "！！",
      "！！",
      "！！！！",
      "！！！！",
    ]),
    TARGET_YEAR,
    tokenizer
  );
  assert.equal(findPhrase(displayPreferenceRows, "？？？？？")?.count, 5);
  assert.equal(findPhrase(displayPreferenceRows, "？？"), undefined);
  assert.equal(findPhrase(displayPreferenceRows, "！！！！")?.count, 4);
  assert.equal(findPhrase(displayPreferenceRows, "！！"), undefined);

  const repeatedWordRows = analyzeBuzzwords(
    createMessages([
      "おいおい",
      "おいおいおい",
      "おいおいおい",
      "おいおいおいおい",
      "きちゃあああ",
      "きちゃあああああ",
      "きちゃあああああ",
      "きちゃああああああああああ",
    ]),
    TARGET_YEAR,
    tokenizer
  );
  assert.equal(findPhrase(repeatedWordRows, "おいおいおい")?.count, 4);
  assert.equal(findPhrase(repeatedWordRows, "きちゃあああああ")?.count, 4);
  assert.equal(findPhrase(repeatedWordRows, "きちゃあああ"), undefined);

  const tiedSurfaceRows = analyzeBuzzwords(
    createMessages(["おいおい", "おいおいおい"]),
    TARGET_YEAR,
    tokenizer
  );
  assert.equal(findPhrase(tiedSurfaceRows, "おいおいおい")?.count, 2);
  assert.equal(findPhrase(tiedSurfaceRows, "おいおい"), undefined);

  const repeatedPhraseRows = analyzeBuzzwords(
    createMessages(["合ってる？", "合ってる？"]),
    TARGET_YEAR,
    tokenizer
  );
  assert.equal(findPhrase(repeatedPhraseRows, "合ってる")?.count, 2);
  assert.equal(findPhrase(repeatedPhraseRows, "合ってる？")?.count, 2);

  const questionNotationRows = analyzeBuzzwords(
    createMessages(["?", "？"]),
    TARGET_YEAR,
    tokenizer
  );
  assert.equal(findPhrase(questionNotationRows, "？")?.count, 2);
  assert.equal(findPhrase(questionNotationRows, "?"), undefined);

  const hiraganaRows = analyzeBuzzwords(
    createMessages(["今日は本当にやばいかも", "それはかなりやばいね"]),
    TARGET_YEAR,
    tokenizer
  );
  assert.equal(findPhrase(hiraganaRows, "やばい"), undefined);

  const fragmentWords = [
    "てる",
    "てい",
    "こと",
    "ある",
    "する",
    "ない",
    "なっ",
    "みたい",
    "すぎる",
    "なん",
    "やっ",
    "なる",
    "てない",
    "すぎ",
    "もう",
  ];
  const fragmentRows = analyzeBuzzwords(
    createMessages(fragmentWords),
    TARGET_YEAR,
    tokenizer
  );
  for (const phrase of fragmentWords) {
    assert.equal(findPhrase(fragmentRows, phrase), undefined);
  }

  const meaningfulWordRows = analyzeBuzzwords(
    createMessages(["やばい", "マジ", "ほんま", "わかる", "まて"]),
    TARGET_YEAR,
    tokenizer
  );
  for (const phrase of ["やばい", "マジ", "ほんま", "わかる", "まて"]) {
    assert.equal(findPhrase(meaningfulWordRows, phrase)?.count, 1);
  }

  const completeVerbRows = analyzeBuzzwords(
    createMessages(["私はそう思ってる", "彼も強く思ってる"]),
    TARGET_YEAR,
    tokenizer
  );
  assert.equal(findPhrase(completeVerbRows, "思ってる")?.count, 2);

  const oneOffRows = analyzeBuzzwords(
    createMessages(["唯一無二"]),
    TARGET_YEAR,
    tokenizer
  );
  assert.equal(findPhrase(oneOffRows, "唯一無二")?.count, 1);

  const templatePhrases = [
    "定型文甲！",
    "定型文乙！",
    "定型文丙！",
    "定型文丁！",
    "定型文戊！",
    "定型文己！",
  ];
  const crowdedRows = analyzeBuzzwords(
    createMessages([
      ...templatePhrases,
      ...Array.from({ length: 35 }, (_, index) =>
        Array.from({ length: 3 }, () => `一般候補${index}`)
      ).flat(),
    ]),
    TARGET_YEAR,
    tokenizer
  );
  for (const phrase of templatePhrases) {
    assert.equal(findPhrase(crowdedRows, phrase)?.count, 1);
  }

  const isolatedTemplateRows = analyzeBuzzwords(
    createMessages(["定型文！", "定型文！", "定型文！でも続きます"]),
    TARGET_YEAR,
    tokenizer
  );
  assert.equal(findPhrase(isolatedTemplateRows, "定型文！")?.count, 2);

  console.log("流行語集計テスト: 成功");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
