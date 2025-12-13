"use client";

import { ActionIcon, Burger, Group, Menu, useMantineColorScheme } from "@mantine/core";
import Link from "next/link";
import { useEffect, useState } from "react";
import { MdDarkMode, MdLightMode } from "react-icons/md";
import { tools } from "@/config/pages";

const Navbar = () => {
  const [menuOpened, setMenuOpened] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingLeft: 20,
        paddingRight: 20,
        borderBottom: `1px solid ${isMounted && colorScheme === "dark" ? "var(--mantine-color-dark-5)" : "var(--mantine-color-gray-3)"}`,
        backgroundColor:
          isMounted && colorScheme === "dark"
            ? "var(--mantine-color-dark-8)"
            : "var(--mantine-color-gray-0)",
        zIndex: 1000,
      }}
    >
      <Link
        href="/"
        style={{
          textDecoration: "none",
          color: "inherit",
          fontSize: 18,
          fontWeight: 600,
        }}
      >
        Web Utils
      </Link>

      <Group gap="xs">
        <ActionIcon onClick={() => toggleColorScheme()} variant="default" size="lg">
          {isMounted &&
            (colorScheme === "dark" ? (
              <MdLightMode size={20} />
            ) : (
              <MdDarkMode size={20} />
            ))}
        </ActionIcon>

        <Menu
          opened={menuOpened}
          onOpen={() => setMenuOpened(true)}
          onClose={() => setMenuOpened(false)}
        >
          <Menu.Target>
            <Burger
              opened={menuOpened}
              onClick={() => setMenuOpened(!menuOpened)}
              size="sm"
            />
          </Menu.Target>

          <Menu.Dropdown>
            {tools.map((tool) => (
              <Link
                key={tool.href}
                href={tool.href}
                style={{ textDecoration: "none", color: "inherit" }}
                onClick={() => setMenuOpened(false)}
              >
                <Menu.Item>{tool.name}</Menu.Item>
              </Link>
            ))}
          </Menu.Dropdown>
        </Menu>
      </Group>
    </header>
  );
};

export default Navbar;
