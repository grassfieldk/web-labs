"use client";

import { IconContext } from "react-icons";

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <IconContext.Provider value={{ className: "mx-1 inline-block align-[-0.12em]" }}>
    {children}
  </IconContext.Provider>
);
