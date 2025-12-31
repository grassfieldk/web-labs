"use client";

import { Alert, Button, Stack, Text, Textarea } from "@mantine/core";
import { useRef, useState } from "react";
import { MdError } from "react-icons/md";
import PageBuilder from "@/components/layout/PageBuilder";
import { Caption } from "@/components/ui/Basics";
import { logMessage } from "@/utils/logger.client";
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

    logMessage("umatoma", "INFO", `Input: ${fullWidthInput}, Output: ${result}`);
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
    <PageBuilder
      title="うまトマ語翻訳機"
      description="ひらがな・カタカナをうまトマ語に翻訳します"
    >
      <Stack gap="md">
        <Stack gap={0}>
          <Text
            component="a"
            href="https://www.matsuyafoods.co.jp/matsuya/menu/teishoku/tei_umatoma_hp_250603.html"
            target="_blank"
            c="blue"
            size="sm"
          >
            うまトマハンバーグ定食の注文はこちらから
          </Text>
          <Caption>※ ライス小盛がおすすめです</Caption>
        </Stack>
        <div>
          <Text mb="xs">うまトマ語に変換したい文字列を入力してください</Text>
          <Textarea
            placeholder="ひらがな・カタカナを入力"
            value={input}
            onChange={(e) => setInput(e.currentTarget.value)}
            minRows={4}
          />
        </div>

        <Button onClick={convertText} fullWidth>
          変換
        </Button>

        <div>
          <Text mb="xs">結果</Text>
          <Textarea
            ref={outputRef}
            placeholder="ここに変換結果が表示されます"
            value={output}
            readOnly
            minRows={4}
          />
        </div>

        <Button onClick={copyOutput} fullWidth variant="light">
          コピー
        </Button>

        {message && (
          <Alert icon={<MdError size={16} />} color="red" title="メッセージ">
            {message}
          </Alert>
        )}
      </Stack>
    </PageBuilder>
  );
}
