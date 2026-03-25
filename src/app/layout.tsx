import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Where Should I Live in Chicago?",
  description: "AI-powered Chicago neighborhood finder",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  );
}
