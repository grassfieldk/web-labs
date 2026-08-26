"use client";

import { useEffect } from "react";

interface SwaggerUIWindow extends Window {
  SwaggerUIBundle?: {
    (config: unknown): void;
    presets?: {
      apis: unknown;
    };
  };
  SwaggerUIStandalonePreset?: unknown;
}

const appendStylesheet = (href: string) => {
  const existing = document.querySelector(`link[href="${href}"]`);
  if (existing) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
};

const loadScript = (src: string) => {
  const existing = document.querySelector(
    `script[src="${src}"]`
  ) as HTMLScriptElement | null;

  if (existing?.dataset.loaded === "true") {
    return Promise.resolve();
  }

  const script = existing ?? document.createElement("script");
  if (!existing) {
    script.src = src;
    script.async = true;
    document.body.appendChild(script);
  }

  return new Promise<void>((resolve, reject) => {
    const onLoad = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    const onError = () => reject(new Error(`Failed to load script: ${src}`));

    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });
  });
};

export default function ApiDocsPage() {
  useEffect(() => {
    const loadSwaggerUI = async () => {
      appendStylesheet("/resources/swagger/swagger-ui.css");

      const win = window as unknown as SwaggerUIWindow;
      const tasks: Promise<void>[] = [];
      if (!win?.SwaggerUIBundle) {
        tasks.push(loadScript("/resources/swagger/swagger-ui-bundle.js"));
      }
      if (!win?.SwaggerUIStandalonePreset) {
        tasks.push(loadScript("/resources/swagger/swagger-ui-standalone-preset.js"));
      }
      if (tasks.length > 0) {
        await Promise.all(tasks);
      }

      win?.SwaggerUIBundle?.({
        url: "/resources/swagger/openapi.yaml",
        dom_id: "#swagger-ui",
        presets: [win?.SwaggerUIBundle?.presets?.apis, win?.SwaggerUIStandalonePreset],
        layout: "StandaloneLayout",
      });
    };
    loadSwaggerUI().catch((error) => {
      console.error("Swagger UI init error:", error);
    });
  }, []);

  return <div id="swagger-ui" />;
}
