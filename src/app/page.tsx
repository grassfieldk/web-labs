"use client";

import { Card, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import Link from "next/link";
import { tools } from "@/config/pages";

const linkStyle = { textDecoration: "none", color: "inherit" } as const;
const cardStyle = {
  cursor: "pointer",
  transition: "all 0.2s",
  height: "100%",
} as const;

const ToolCard = ({ name, description, href }: (typeof tools)[number]) => {
  return (
    <Link href={href} style={linkStyle}>
      <Card shadow="sm" padding="lg" radius="md" withBorder style={cardStyle}>
        <Title order={3} size="h4" mb="xs">
          {name}
        </Title>
        <Text size="sm" c="dimmed">
          {description}
        </Text>
      </Card>
    </Link>
  );
};

export default function Home() {
  return (
    <Stack gap="xl">
      <div>
        <Title order={1} mb="sm">
          Web Labs
        </Title>
        <Text c="dimmed">思いついたものをつくってまとめるサイト</Text>
      </div>

      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
        {tools.map((tool) => (
          <ToolCard key={tool.href} {...tool} />
        ))}
      </SimpleGrid>
    </Stack>
  );
}
