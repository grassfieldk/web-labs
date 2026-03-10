#!/usr/bin/env bun

import kuromoji from "kuromoji";
import { parseLineChatHistory } from "../src/services/line/parser";
import { analyzeBuzzwords } from "../src/services/line/trendAnalyzer";
import * as fs from "fs";

function usage() {
  console.log("Usage: bun run tool:trend <file> [year]");
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) usage();
  const file = args[0];
  const year = args[1] ? Number(args[1]) : undefined;
  if (!fs.existsSync(file)) {
    console.error(`File not found: ${file}`);
    process.exit(1);
  }
  const text = fs.readFileSync(file, "utf-8");
  const parsed = parseLineChatHistory(text);
  const allMessages = parsed.history.flatMap((h) => h.messages);
  const targetYear = year || (allMessages[0]?.date ? Number(allMessages[0].date.slice(0, 4)) : undefined);
  if (!targetYear) {
    console.error("年が特定できません。明示的に指定してください。");
    process.exit(1);
  }
  kuromoji.builder({ dicPath: "public/kuromoji/dict" }).build((err, tokenizer) => {
    if (err) {
      console.error("kuromojiの初期化に失敗:", err);
      process.exit(1);
    }
    const trends = analyzeBuzzwords(allMessages, targetYear, tokenizer);
    // CSVヘッダー
    console.log('"phrase","count","dayCount"');
    for (const row of trends) {
      // 値をダブルクォートで囲み、カンマ区切りで出力
      const phrase = row.phrase.replace(/"/g, '""');
      console.log(`"${phrase}","${row.count}","${row.dayCount}"`);
    }
  });
}

main();
