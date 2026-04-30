import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Question → Answer (LaTeX only)",
  description: "Upload questions, scan with Gemini, and generate LaTeX-only answers.",
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <div className="pageRoot">
          <div className="pageInner">{children}</div>
        </div>
      </body>
    </html>
  );
}
