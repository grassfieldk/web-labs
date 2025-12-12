"use client";

import Link from "next/link";
import { tools } from "@/config/pages";

export default function Home() {
  return (
    <div className="mx-auto max-w-screen-xl p-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Web Utils</h1>
        <p className="text-gray-600">
          便利で実用的なツールをまとめたユーティリティプラットフォーム
        </p>
      </div>

      {/* Tools Section */}
      <div className="space-y-4">
        {tools.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="block p-6 border border-gray-200 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-colors"
          >
            <h2>{tool.name}</h2>
            <p className="text-gray-600">{tool.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
