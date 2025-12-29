"use client";

import {
  Badge,
  Button,
  Grid,
  Group,
  Modal,
  NumberInput,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { MdPlayArrow, MdSkipNext } from "react-icons/md";

type PersonalityKey = "smart" | "normal" | "monster";

const PERSONALITIES: Record<PersonalityKey, { label: string; prompt: string }> = {
  smart: {
    label: "スマート",
    prompt:
      "知的かつ理性的な一般人。口調はそこまで堅くなく、丁寧語だが少しくだけた感じ。",
  },
  normal: {
    label: "一般人",
    prompt: "最低限の知識・教養を持つ人。くだけた口調。",
  },
  monster: {
    label: "バケモノ",
    prompt:
      "読解力ゼロで言語化能力も乏しく短い文をつなぎ合わせてしか喋れず、偏った知識・固定概念に囚われているバケモノ。感嘆符（！など）は絵文字（❗️など）で代用、国名の後ろに国旗を使用するなど絵文字を多用し、すぐ煽る。",
  },
};

type DebateMessage = {
  id: string;
  side: "pro" | "con";
  content: string;
};

export default function AiDystopiaPage() {
  const [topic, setTopic] = useState("");
  const [proPersonality, setProPersonality] = useState<PersonalityKey>("monster");
  const [conPersonality, setConPersonality] = useState<PersonalityKey>("smart");
  const [language, setLanguage] = useState("日本語");
  const [messagesPerPerson, setMessagesPerPerson] = useState(15);

  const [messages, setMessages] = useState<DebateMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const viewport = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (viewport.current) {
      viewport.current.scrollTo({
        top: viewport.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Need to scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const generateDebate = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setMessages([]); // Clear previous messages

    // Construct the prompt
    const systemPrompt = `
Simulate a debate between two personalities on the topic: "${topic}".
Language: ${language}

Pro (Agree): ${PERSONALITIES[proPersonality].prompt}
Con (Disagree): ${PERSONALITIES[conPersonality].prompt}

Instructions:
- Act as these two personalities debating.
- Generate a total of ${messagesPerPerson * 2} turns (${messagesPerPerson} from Pro, ${messagesPerPerson} from Con).
- Start with Pro.
- Make each response substantial (around 100-140 characters).
- Strictly follow this format for every line:
Pro: [Content]
Con: [Content]
`;

    try {
      const response = await fetch("/api/llm/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: systemPrompt }],
          provider: "gemini",
          model: "gemini-2.5-flash",
        }),
      });

      if (!response.ok) throw new Error("API Error");
      if (!response.body) throw new Error("No body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        const lines = buffer.split("\n");
        // Keep the last line in buffer as it might be incomplete
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith("Pro:")) {
            const content = trimmed.replace(/^Pro:\s*/, "");
            setMessages((prev) => [
              ...prev,
              { id: crypto.randomUUID(), side: "pro", content },
            ]);
          } else if (trimmed.startsWith("Con:")) {
            const content = trimmed.replace(/^Con:\s*/, "");
            setMessages((prev) => [
              ...prev,
              { id: crypto.randomUUID(), side: "con", content },
            ]);
          } else {
            // Append to the last message if it's a continuation
            setMessages((prev) => {
              if (prev.length === 0) return prev;
              const newMessages = [...prev];
              const lastMsg = newMessages[newMessages.length - 1];
              lastMsg.content += ` ${trimmed}`;
              return newMessages;
            });
          }
        }
      }

      // Process any remaining buffer
      if (buffer.trim()) {
        const trimmed = buffer.trim();
        if (trimmed.startsWith("Pro:")) {
          const content = trimmed.replace(/^Pro:\s*/, "");
          setMessages((prev) => [
            ...prev,
            { id: crypto.randomUUID(), side: "pro", content },
          ]);
        } else if (trimmed.startsWith("Con:")) {
          const content = trimmed.replace(/^Con:\s*/, "");
          setMessages((prev) => [
            ...prev,
            { id: crypto.randomUUID(), side: "con", content },
          ]);
        } else {
          setMessages((prev) => {
            if (prev.length === 0) return prev;
            const newMessages = [...prev];
            const lastMsg = newMessages[newMessages.length - 1];
            lastMsg.content += ` ${trimmed}`;
            return newMessages;
          });
        }
      }
    } catch (error) {
      console.error(error);
      // Show error as a system message or alert (optional)
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Stack h="calc(100vh - 140px)" gap="md">
      <Group justify="space-between" align="center">
        <Title order={1}>レスバトジェネレーター</Title>
      </Group>

      <Modal
        opened={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        title="設定"
        size="lg"
        centered
      >
        <Stack gap="sm">
          <TextInput
            label="討論トピック"
            value={topic}
            onChange={(e) => setTopic(e.currentTarget.value)}
            placeholder="地球は平面である"
          />
          <Grid>
            <Grid.Col span={6}>
              <Select
                label="賛成派の性格"
                data={Object.entries(PERSONALITIES).map(([k, v]) => ({
                  value: k,
                  label: v.label,
                }))}
                value={proPersonality}
                onChange={(v) => setProPersonality(v as PersonalityKey)}
                allowDeselect={false}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <Select
                label="反対派の性格"
                data={Object.entries(PERSONALITIES).map(([k, v]) => ({
                  value: k,
                  label: v.label,
                }))}
                value={conPersonality}
                onChange={(v) => setConPersonality(v as PersonalityKey)}
                allowDeselect={false}
              />
            </Grid.Col>
          </Grid>
          <Grid>
            <Grid.Col span={6}>
              <TextInput
                label="言語"
                value={language}
                onChange={(e) => setLanguage(e.currentTarget.value)}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <NumberInput
                label="一人あたりの発言数"
                value={messagesPerPerson}
                onChange={(v) => setMessagesPerPerson(Math.max(1, Number(v) || 1))}
                min={1}
                max={20}
              />
            </Grid.Col>
          </Grid>
        </Stack>
      </Modal>

      <Grid>
        <Grid.Col span={4}>
          <Button fullWidth onClick={() => setIsSettingsOpen(true)} variant="default">
            設定
          </Button>
        </Grid.Col>
        <Grid.Col span={8}>
          <Button
            fullWidth
            onClick={generateDebate}
            disabled={isLoading || !topic}
            leftSection={messages.length === 0 ? <MdPlayArrow /> : <MdSkipNext />}
            color="blue"
          >
            {messages.length === 0 ? "レスバト開始！" : "もう一回！"}
          </Button>
        </Grid.Col>
      </Grid>

      <Paper
        withBorder
        p={0}
        style={{
          flex: 1,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <ScrollArea viewportRef={viewport} style={{ flex: 1 }} p="md">
          <Stack gap="md">
            {messages.length === 0 && (
              <Text c="dimmed" ta="center" mt="xl">
                熱いレスバトがここに表示されます
              </Text>
            )}
            {messages.map((msg) => {
              const isPro = msg.side === "pro";
              return (
                <Group
                  key={msg.id}
                  justify={isPro ? "flex-start" : "flex-end"}
                  align="flex-start"
                >
                  <Stack gap={4} style={{ maxWidth: "80%" }}>
                    <Group justify={isPro ? "flex-start" : "flex-end"} gap={8}>
                      {isPro && (
                        <Badge color="blue" variant="light">
                          賛成
                        </Badge>
                      )}
                      <Text size="xs" c="dimmed">
                        {isPro
                          ? PERSONALITIES[proPersonality].label
                          : PERSONALITIES[conPersonality].label}
                      </Text>
                      {!isPro && (
                        <Badge color="red" variant="light">
                          反対
                        </Badge>
                      )}
                    </Group>
                    <Paper p="sm" radius="md" bg={isPro ? "blue.9" : "red.9"} c="white">
                      <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                        {msg.content}
                      </Text>
                    </Paper>
                  </Stack>
                </Group>
              );
            })}
            {isLoading && (
              <Text size="sm" c="dimmed" ta="center">
                議論を生成中...
              </Text>
            )}
          </Stack>
        </ScrollArea>
      </Paper>
    </Stack>
  );
}
