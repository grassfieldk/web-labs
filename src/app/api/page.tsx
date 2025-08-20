"use client";

import { useEffect, useRef } from "react";

export default function ApiDocsPage() {
  const swaggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadSwaggerUI = async () => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/resources/swagger/swagger-ui.css";
      document.head.appendChild(link);

      const bundleScript = document.createElement("script");
      bundleScript.src = "/resources/swagger/swagger-ui-bundle.js";
      bundleScript.async = true;
      document.body.appendChild(bundleScript);

      const presetScript = document.createElement("script");
      presetScript.src = "/resources/swagger/swagger-ui-standalone-preset.js";
      presetScript.async = true;
      document.body.appendChild(presetScript);

      bundleScript.onload = () => {
        const win = window as any;
        win?.SwaggerUIBundle?.({
          url: "/resources/swagger/openapi.yaml",
          dom_id: "#swagger-ui",
          presets: [win?.SwaggerUIBundle?.presets?.apis, win?.SwaggerUIStandalonePreset],
          layout: "StandaloneLayout",
        });
      };
    };
    loadSwaggerUI();
  }, []);

  return <div id="swagger-ui" ref={swaggerRef} />;
}
