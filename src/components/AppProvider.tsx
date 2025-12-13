"use client";

import { MantineProvider } from "@mantine/core";
import { IconContext } from "react-icons";

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MantineProvider defaultColorScheme="light">
    <IconContext.Provider value={{ className: "inline-block" }}>
      {children}
    </IconContext.Provider>
  </MantineProvider>
);
