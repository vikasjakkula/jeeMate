# Project Syntax (Structure + Snippets)

This repo currently runs a **minimal Next.js app** (home page renders: `nextjs`).

## Recommended structure (ML + Web)

```
prakalp26/
├── app/                          # Next.js App Router
│   ├── layout.tsx
│   ├── page.tsx                  # localhost:3000 -> "nextjs"
│   └── globals.css
├── ml-models/
│   ├── training/
│   │   ├── data_pipeline.py
│   │   ├── train.py
│   │   └── evaluate.py
│   ├── inference/
│   │   └── predictor.py
│   └── models/                   # Saved artifacts (joblib/onnx/etc)
├── supabase/
│   ├── migrations/               # SQL migrations (if you use Supabase CLI)
│   ├── functions/                # Edge Functions (TypeScript)
│   └── seed.sql
├── lib/
│   ├── supabase/                 # Supabase clients/helpers
│   ├── ml/                       # Model loader + preprocessing in TS
│   └── utils/
├── public/
├── package.json
└── README.md
```

## UI snippet (Tailwind button class + your SVG)

Button classes:

```
bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold shadow-sm hover:opacity-90 rounded-lg inline-flex items-center gap-x-2
```

SVG (exact attributes you requested):

```html
<svg
  viewBox="0 0 20 20"
  fill="currentColor"
  aria-hidden="true"
  data-slot="icon"
  class="size-4"
>
  <path d="M10 2a8 8 0 100 16 8 8 0 000-16z" />
</svg>
```

Headline classes (for your hero/title):

```
text-pretty text-3xl font-semibold tracking-tight text-foreground sm:text-5xl
```

## Lucide icons (example import)

```ts
import { Brain, Database, Rocket } from "lucide-react";
```

