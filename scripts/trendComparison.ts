#!/usr/bin/env bun

import * as fs from "node:fs";
import * as path from "node:path";
import iconv from "iconv-lite";
import kuromoji from "kuromoji";
import { parseLineChatHistory } from "../src/services/line/parser";
import {
  analyzeBuzzwords,
  type TrendRow,
} from "../src/services/line/trendAnalyzer";

type SnapshotRow = Pick<TrendRow, "phrase" | "count" | "dayCount">;

type TrendSnapshot = {
  generatedAt: string;
  targetYear: number;
  rows: SnapshotRow[];
};

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function csvCell(value: string | number | null) {
  if (value === null) return "";
  return `"${String(value).replace(/"/g, '""')}"`;
}

function writeText(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function writeCsv(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const windowsNewlines = content.replace(/\r?\n/g, "\r\n");
  fs.writeFileSync(filePath, iconv.encode(windowsNewlines, "cp932"));
}

function buildTokenizer(): Promise<kuromoji.Tokenizer> {
  return new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath: "public/kuromoji/dict" }).build((error, tokenizer) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(tokenizer);
    });
  });
}

function writeSnapshot(outputBase: string, snapshot: TrendSnapshot) {
  const jsonPath = `${outputBase}.json`;

  writeText(jsonPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`集計年: ${snapshot.targetYear}`);
  console.log(`集計件数: ${snapshot.rows.length}`);
  console.log(`出力: ${jsonPath}`);
}

async function snapshot(inputPath: string, outputBase: string, yearText?: string) {
  if (!fs.existsSync(inputPath)) fail(`入力ファイルがありません: ${inputPath}`);

  const parsed = parseLineChatHistory(fs.readFileSync(inputPath, "utf8"));
  const messages = parsed.history.flatMap((group) => group.messages);
  const requestedYear = yearText ? Number(yearText) : undefined;
  if (yearText && !Number.isInteger(requestedYear)) fail(`年が不正です: ${yearText}`);

  const targetYear = requestedYear ?? parsed.history[0]?.year;
  if (!targetYear) fail("集計対象の年を特定できませんでした");

  const tokenizer = await buildTokenizer();
  const rows = analyzeBuzzwords(messages, targetYear, tokenizer).map(
    ({ phrase, count, dayCount }) => ({ phrase, count, dayCount })
  );
  writeSnapshot(outputBase, {
    generatedAt: new Date().toISOString(),
    targetYear,
    rows,
  });
}

function readSnapshot(filePath: string): TrendSnapshot {
  if (!fs.existsSync(filePath)) fail(`集計結果がありません: ${filePath}`);
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as TrendSnapshot;
}

function compare(beforePath: string, afterPath: string, outputBase: string) {
  const before = readSnapshot(beforePath);
  const after = readSnapshot(afterPath);
  if (before.targetYear !== after.targetYear) {
    fail(`集計年が一致しません: ${before.targetYear}, ${after.targetYear}`);
  }

  const beforeByPhrase = new Map(
    before.rows.map((row, index) => [row.phrase, { row, rank: index + 1 }])
  );
  const afterByPhrase = new Map(
    after.rows.map((row, index) => [row.phrase, { row, rank: index + 1 }])
  );
  const phrases = [
    ...after.rows.map((row) => row.phrase),
    ...before.rows
      .map((row) => row.phrase)
      .filter((phrase) => !afterByPhrase.has(phrase)),
  ];

  const changes = phrases.map((phrase) => {
    const oldValue = beforeByPhrase.get(phrase);
    const newValue = afterByPhrase.get(phrase);
    const status = !oldValue
      ? "added"
      : !newValue
        ? "removed"
        : oldValue.rank !== newValue.rank ||
            oldValue.row.count !== newValue.row.count ||
            oldValue.row.dayCount !== newValue.row.dayCount
          ? "changed"
          : "unchanged";

    return {
      phrase,
      beforeRank: oldValue?.rank ?? null,
      afterRank: newValue?.rank ?? null,
      rankChange:
        oldValue && newValue ? oldValue.rank - newValue.rank : null,
      beforeCount: oldValue?.row.count ?? null,
      afterCount: newValue?.row.count ?? null,
      countChange:
        oldValue && newValue ? newValue.row.count - oldValue.row.count : null,
      beforeDayCount: oldValue?.row.dayCount ?? null,
      afterDayCount: newValue?.row.dayCount ?? null,
      dayCountChange:
        oldValue && newValue
          ? newValue.row.dayCount - oldValue.row.dayCount
          : null,
      status,
    };
  });

  const headers = [
    "rank",
    "beforePhrase",
    "beforeCount",
    "beforeDayCount",
    "afterPhrase",
    "afterCount",
    "afterDayCount",
  ];
  const csvRows = [
    headers.map(csvCell).join(","),
    ...Array.from(
      { length: Math.max(before.rows.length, after.rows.length) },
      (_, index) => {
        const beforeRow = before.rows[index];
        const afterRow = after.rows[index];
        return [
          index + 1,
          beforeRow?.phrase ?? null,
          beforeRow?.count ?? null,
          beforeRow?.dayCount ?? null,
          afterRow?.phrase ?? null,
          afterRow?.count ?? null,
          afterRow?.dayCount ?? null,
        ]
          .map(csvCell)
          .join(",");
      }
    ),
  ];
  const jsonPath = `${outputBase}.json`;
  const csvPath = `${outputBase}.csv`;

  writeText(
    jsonPath,
    `${JSON.stringify(
      {
        targetYear: before.targetYear,
        beforeGeneratedAt: before.generatedAt,
        afterGeneratedAt: after.generatedAt,
        changes,
      },
      null,
      2
    )}\n`
  );
  writeCsv(csvPath, `${csvRows.join("\n")}\n`);
  console.log(`比較件数: ${changes.length}`);
  console.log(`出力: ${jsonPath}, ${csvPath}`);
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "snapshot" && args.length >= 2) {
    await snapshot(args[0], args[1], args[2]);
    return;
  }
  if (command === "compare" && args.length === 3) {
    compare(args[0], args[1], args[2]);
    return;
  }

  fail(
    "Usage:\n" +
      "  bun scripts/trendComparison.ts snapshot <input> <output-base> [year]\n" +
      "  bun scripts/trendComparison.ts compare <before.json> <after.json> <output-base>"
  );
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
