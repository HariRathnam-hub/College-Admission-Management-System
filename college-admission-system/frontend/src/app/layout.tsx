import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "College Admission Management System",
  description: "Apply, review, and manage college admissions online.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
