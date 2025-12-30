"use client";

import { Card, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import Link from "next/link";
import { tools } from "@/config/pages";

export default function Home() {
  return (
    <Stack gap="xl">
      <div>
        <Title order={1} mb="sm">
          Web Labs
        </Title>
        <Text c="dimmed">
          便利で実用的なツールをまとめたユーティリティプラットフォーム
        </Text>
      </div>

      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
        {tools.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <Card
              shadow="sm"
              padding="lg"
              radius="md"
              withBorder
              style={{ cursor: "pointer", transition: "all 0.2s", height: "100%" }}
            >
              <Title order={3} size="h4" mb="xs">
                {tool.name}
              </Title>
              <Text size="sm" c="dimmed">
                {tool.description}
              </Text>
            </Card>
          </Link>
        ))}
      </SimpleGrid>
    </Stack>
  );
}
