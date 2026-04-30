import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Math Summary (LaTeX JSON)",
  description: "Generate LaTeX-only math summaries via Gemini JSON schema.",
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
