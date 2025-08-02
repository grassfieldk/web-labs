"use client";

import Link from "next/link";

const Navbar = () => {
  return (
    <nav className="fixed w-full bg-neutral-900 text-white">
      <div className="container mx-auto flex h-16 max-w-screen-xl items-center justify-between p-4">
        <Link href="/" className="text-xl">
          Web Utils
        </Link>
        <div className="flex items-center space-x-4">
          <Link href="/line-chat-history-viewer">LINE Chat History Viewer</Link>
          <Link href="/video-downloader">Video Downloader</Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
