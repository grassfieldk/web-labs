"use client";

import { MantineProvider } from "@mantine/core";
import { IconContext } from "react-icons";

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MantineProvider
    defaultColorScheme="light"
    theme={{
      fontSizes: {
        xs: "14px",
        sm: "16px",
        md: "16px",
        lg: "18px",
        xl: "20px",
      },
    }}
  >
    <IconContext.Provider value={{ className: "inline-block" }}>
      {children}
    </IconContext.Provider>
  </MantineProvider>
);
