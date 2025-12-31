"use client";

import { Text, type TextProps } from "@mantine/core";

type CaptionProps = Omit<TextProps, "size" | "c"> & {
  children: React.ReactNode;
};

export function Caption({ children, ...props }: CaptionProps) {
  return (
    <Text size="sm" c="dimmed" {...props}>
      {children}
    </Text>
  );
}
