"use client";

import Link from "next/link";
import { useState } from "react";
import { tools } from "@/config/pages";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed w-full bg-neutral-900 text-white">
      <div className="container mx-auto flex h-16 max-w-screen-xl items-center justify-between p-4">
        <Link href="/" className="text-xl">
          Web Utils
        </Link>

        {/* Menu Button */}
        <div className="relative">
          <button
            className="flex flex-col space-y-1 hover:opacity-80"
            onClick={() => setIsOpen(!isOpen)}
          >
            <div className="w-6 h-0.5 bg-white"></div>
            <div className="w-6 h-0.5 bg-white"></div>
            <div className="w-6 h-0.5 bg-white"></div>
          </button>

          {/* Dropdown Menu */}
          {isOpen && (
            <div className="absolute right-0 mt-2 bg-neutral-800 rounded-lg shadow-lg border border-neutral-700 z-50">
              <div className="flex flex-col py-2">
                {tools.map((tool) => (
                  <Link
                    key={tool.href}
                    href={tool.href}
                    className="block px-4 py-2 text-sm hover:bg-neutral-700 transition-colors whitespace-nowrap"
                    onClick={() => setIsOpen(false)}
                  >
                    {tool.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
