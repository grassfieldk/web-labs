"use client";

import { MantineProvider } from "@mantine/core";
import { IconContext } from "react-icons";

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MantineProvider
    defaultColorScheme="light"
    theme={{
      components: {
        Input: {
          styles: {
            input: {
              fontSize: "16px",
            },
          },
        },
        Textarea: {
          styles: {
            input: {
              fontSize: "16px",
            },
          },
        },
        Select: {
          styles: {
            input: {
              fontSize: "16px",
            },
          },
        },
        NumberInput: {
          styles: {
            input: {
              fontSize: "16px",
            },
          },
        },
      },
    }}
  >
    <IconContext.Provider value={{ className: "inline-block" }}>
      {children}
    </IconContext.Provider>
  </MantineProvider>
);
