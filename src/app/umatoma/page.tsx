"use client";

import { Alert, Button, Stack, Text, Textarea } from "@mantine/core";
import { useCallback, useRef, useState } from "react";
import { MdError } from "react-icons/md";
import PageBuilder from "@/components/layout/PageBuilder";
import { Caption } from "@/components/ui/Basics";
import { translateUmatomaText } from "@/services/umatoma/translator";
import { logMessage } from "@/utils/logger.client";

export default function UmatomaPage() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const outputRef = useRef<HTMLTextAreaElement>(null);

  const convertText = useCallback(() => {
    const { output, message, fullWidthInput } = translateUmatomaText(input);
    setOutput(output);
    setMessage(message);

    if (output) {
      logMessage("umatoma", "INFO", `Input: ${fullWidthInput}, Output: ${output}`);
    }
  }, [input]);

  const copyOutput = useCallback(async () => {
    if (outputRef.current) {
      try {
        await navigator.clipboard.writeText(outputRef.current.value);
      } catch (err) {
        console.error("Failed to copy text: ", err);
        setMessage("こぼしてしまったためコピーできませんでした");
      }
    }
  }, []);

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
