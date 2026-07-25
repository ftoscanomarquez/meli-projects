import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Solo dev: permite el HMR (recarga en caliente) al probar desde el
  // celular por IP de red local — Next.js no acepta CIDR aquí, solo
  // hostnames/IPs exactas o comodines de subdominio (`*.ejemplo.com`), ver
  // node_modules/next/dist/esm/server/app-render/csrf-protection.js. Si tu
  // celular usa otra IP, agrégala aquí y reinicia `npm run dev`.
  allowedDevOrigins: ["192.168.56.1", "192.168.101.7"],
  // Cabeceras de seguridad — ver AGENTS.md §12 y SPECIFICATION-SUMMARY.md §5.6 (OWASP API8)
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
