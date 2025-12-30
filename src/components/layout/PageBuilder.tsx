import { Stack, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";

interface PageBuilderProps {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}

const PageBuilder = ({ title, description, children }: PageBuilderProps) => {
  return (
    <Stack gap="lg">
      <div>
        <Title order={1} size="h2">
          {title}
        </Title>
        <Text c="dimmed" size="sm" mt="xs">
          {description}
        </Text>{" "}
      </div>
      <Stack gap="md">{children}</Stack>
    </Stack>
  );
};

export default PageBuilder;
