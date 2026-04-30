"use client";

type WhitePagesProps = {
  latex: string;
};

function splitIntoPages(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return [];
  // Simple heuristic: split by 2+ newlines. Keeps it classic & readable.
  return trimmed.split(/\n{2,}/g).filter(Boolean);
}

export function WhitePages({ latex }: WhitePagesProps) {
  const pages = splitIntoPages(latex);

  if (pages.length === 0) {
    return (
      <div className="pagesWrap">
        <div className="pageSheet">
          <div className="pageBody pageMuted">
            Upload an image or type questions, then generate to see LaTeX here.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pagesWrap">
      {pages.map((p, idx) => (
        <div key={idx} className="pageSheet">
          <div className="pageBody">{p}</div>
          <div className="pageFooter">Page {idx + 1}</div>
        </div>
      ))}
    </div>
  );
}

