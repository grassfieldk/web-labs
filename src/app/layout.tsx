import { AppProvider } from "@/components/AppProvider";
import Navbar from "@/components/layout/Navbar";
import { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import "./globals.css";

export const metadata: Metadata = {
  title: process.env.SITE_TITLE,
  description: process.env.SITE_DESCRIPTION,
};

const notoSansJp = Noto_Sans_JP({ subsets: ["latin"] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <meta property="og:url" content={process.env.SITE_URL} />
        <meta property="og:title" content={process.env.SITE_TITLE} />
        <meta property="og:site_name" content={process.env.SITE_TITLE} />
        <meta property="og:description" content={process.env.SITE_DESCRIPTION} />
        <meta property="og:image" content={process.env.SITE_IMAGE} />
        <meta property="twitter:title" content={process.env.SITE_TITLE} />
        <meta property="twitter:description" content={process.env.SITE_DESCRIPTION} />
        <meta property="twitter:image" content="/images/ogp/image_twitter.png" />
        <meta property="twitter:card" content="summary" />
      </head>
      <body className={notoSansJp.className}>
        <AppProvider>
          <Navbar />
          <main className="container mx-auto max-w-screen-xl pt-20 pb-8">{children}</main>
        </AppProvider>
      </body>
    </html>
  );
}
