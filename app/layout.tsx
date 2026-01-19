import type { Metadata } from "next";
import "./globals.css";
import Navigation from "./components/Navigation";

export const metadata: Metadata = {
  title: "Butler",
  description: "Your personal finance assistant",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">
        <Navigation />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-12">
          {children}
        </main>
      </body>
    </html>
  );
}
