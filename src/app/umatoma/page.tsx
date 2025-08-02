"use client";

import { useRef, useState } from "react";
import { LOG_PATHS } from "@/config/logPaths";
import { logMessage } from "@/utils/logger";
import { halfToFullWidth } from "@/utils/stringConverter";

export default function VideoDownloaderPage() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const outputRef = useRef<HTMLTextAreaElement>(null);

  const convertText = () => {
    let trimmed = false;
    let result = "";
    const fullWidthInput = halfToFullWidth(input, true);

    if (!/[ぁ-んァ-ン]/.test(fullWidthInput)) {
      setMessage("うまトマ語に対応しているのは ひらがな または カタカナ のみです");
      return;
    }

    for (const ch of fullWidthInput) {
      if (ch === "\n") {
        result += "\n";
      } else if (ch === " ") {
        result += " ";
      } else if ("！？「」『』（）【】○◯●△▲▽▼＝♡♥☆★↑↓←→、。～ーっッ".includes(ch)) {
        result += ch;
      } else if (/^[\u3040-\u309F]$/.test(ch)) {
        if ("あかさたなはまやらわえけせてねへめれぁゃ".includes(ch)) {
          result += "ま";
        } else if ("がざだばげぜでべ".includes(ch)) {
          result += "ま";
        } else if ("ゔぎじぢびぐずづぶごぞどぼ".includes(ch)) {
          result += "ゔ";
        } else {
          result += "う";
        }
      } else if (/^[\u30A0-\u30FF]$/.test(ch)) {
        result += "マ";
      } else {
        trimmed = true;
      }
    }

    setOutput(result);
    setMessage(trimmed ? "うまトマ語に非対応の文字は煮込む過程で消滅しました" : null);

    // Use centralized log path
    logMessage(
      LOG_PATHS.LOG_UMATOMA,
      "INFO",
      `Input: ${fullWidthInput}, Output: ${result}`
    );
  };

  const copyOutput = async () => {
    if (outputRef.current) {
      try {
        await navigator.clipboard.writeText(outputRef.current.value);
      } catch (err) {
        console.error("Failed to copy text: ", err);
        setMessage("こぼしてしまったためコピーできませんでした");
      }
    }
  };

  return (
    <div className="mx-auto max-w-xl p-6">
      <h1>かなカナ/うまトマ語コンバーター</h1>
      <div className="flex flex-col gap-4">
        <div>
          <a
            href="https://www.matsuyafoods.co.jp/matsuya/menu/teishoku/tei_umatoma_hp_250603.html"
            target="_blank"
            className="mb-0 block text-sky-600"
            rel="noopener"
          >
            うまトマハンバーグ定食の注文はこちらから
          </a>
          <span className="text-sm">※ ライス小盛がおすすめです</span>
        </div>
        <div>
          うまトマ語に変換したい文字列を入力してください
          <textarea
            className="w-full"
            placeholder="ひらがな・カタカナを入力"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <div className="text-right">
            <button type="button" className="w-[6em]" onClick={convertText}>
              変換
            </button>
          </div>
        </div>
        <div>
          結果
          <textarea
            ref={outputRef}
            className="w-full"
            placeholder="ここに変換結果が表示されます"
            value={output}
            readOnly
          />
          <div className="text-right">
            <button type="button" className="w-[6em]" onClick={copyOutput}>
              コピー
            </button>
          </div>
        </div>
        {message && <div className="mt-2 text-red-600">{message}</div>}
      </div>
    </div>
  );
}
