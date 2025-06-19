"use client";

import { useState, useRef } from "react";

export default function VideoDownloaderPage() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const outputRef = useRef<HTMLTextAreaElement>(null);

  const convertText = () => {
    let trimmed = false;
    let result = "";

    if (!/[ぁ-んァ-ン]/.test(input)) {
      setMessage("うまトマ語に対応しているのはひらがなまたはカタカナのみです");
      return;
    }

    for (const ch of input) {
      if (ch === "\n") {
        result += "\n";
      } else if (ch === " ") {
        result += " ";
      } else if ("！？、。～ー".includes(ch)) {
        result += ch;
      } else if (/^[\u3040-\u309F]$/.test(ch)) {
        // hiragana
        if ("あかさたなはまやらわえけせてねへめれ".includes(ch)) {
          result += "ま";
        } else {
          result += "う";
        }
      } else if (/^[\u30A0-\u30FF]$/.test(ch)) {
        // katakana
        result += "マ";
      } else {
        trimmed = true;
      }
    }
    setOutput(result);
    setMessage(trimmed ? "うまトマ語に非対応の文字は煮込む過程で消滅しました" : null);
  };

  const copyOutput = async () => {
    if (outputRef.current) {
      try {
        await navigator.clipboard.writeText(outputRef.current.value);
      } catch (err) {
        console.error("Failed to copy text: ", err);
        setMessage("クリップボードへのコピーに失敗しました。");
      }
    }
  };

  return (
    <div className="mx-auto max-w-xl p-6">
      <h1>うま と マ</h1>
      <div className="flex flex-col gap-4">
        <div>
          <a
            href="https://www.matsuyafoods.co.jp/matsuya/menu/teishoku/tei_umatoma_hp_250603.html"
            target="_blank"
            className="mb-0 block text-sky-600"
          >
            うまトマハンバーグ定食の注文はこちらから
          </a>
          <span className="text-sm">※ ライス小盛がおすすめです</span>
        </div>
        <div>
          <label>入力</label>
          <textarea
            className="w-full"
            placeholder="ひらがな・カタカナを入力"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <div className="text-right">
            <button className="w-[6em]" onClick={convertText}>
              変換
            </button>
          </div>
        </div>
        <div>
          <label>結果</label>
          <textarea
            ref={outputRef}
            className="w-full"
            placeholder="ここに変換結果が表示されます"
            value={output}
            readOnly
          />
          <div className="text-right">
            <button className="w-[6em]" onClick={copyOutput}>
              コピー
            </button>
          </div>
        </div>
        {message && <div className="mt-2 text-red-600">{message}</div>}
      </div>
    </div>
  );
}
