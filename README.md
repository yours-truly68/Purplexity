<img width="1703" height="990" alt="image" src="https://github.com/user-attachments/assets/88bd846a-4e54-4a69-adcc-83385d69260d" />


# 🔮 Purplexity

Purplexity is a high-performance, minimalist, AI-powered search companion designed to deliver instantaneous, contextualized answers to complex queries. Engineered with a hyper-fast **Bun** runtime/bundler, a sleek **React** single-page application frontend styled with **shadcn/ui**, and a strongly typed **Prisma + PostgreSQL** data layer running a native pg-pool driver adapter, Purplexity bridges the gap between raw AI execution speed and premium, elite design aesthetics.

---

## ✨ Features

- **Blazing Fast Bundling:** Powered entirely by the **Bun Bundler** for rapid frontend bundling, sub-millisecond page builds, and robust native hot-reloading (`--hot`).
- **Premium Component Design:** Polished, fluid user interface leveraging **shadcn/ui** primitives built on Radix UI and Tailwind CSS for top-tier design taste and strict typographic scales.
- **Conversational Architecture:** A deeply integrated streaming database design maintaining persistent chat sessions, responsive cascading relationships, and user-to-assistant context tracking.
- **Secure OAuth Authentication:** Native middleware processing designed to safely bridge Supabase Auth OAuth tokens (**Google** and **GitHub**) with a persistent, relational PostgreSQL user graph.

---

## 🛠️ Tech Stack

- **Runtime & Bundler:** [Bun](https://bun.sh/)
- **Frontend SPA:** React, TypeScript, Tailwind CSS, [shadcn/ui](https://ui.shadcn.com/)
- **Backend API Server:** Express
- **Database & ORM:** PostgreSQL (Supabase) + [Prisma ORM](https://www.prisma.io/) using `@prisma/adapter-pg`
- **AI Ecosystem:** Vercel AI SDK (`ai`), Groq Cloud API (`qwen/qwen3.6-27b`)
- **Search Provider:** Tavily AI Core Search API

---

## 🗺️ API Reference & Endpoints

### Authentication
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET/POST` | `/api/auth/login/google` | Processes inbound Google OAuth single sign-on tokens |
| `GET/POST` | `/api/auth/login/github` | Processes inbound GitHub OAuth single sign-on tokens |

### Chat & Search Execution
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/purplexity_ask` | Submits an initial search query to trigger web indexing and returns a text/event-stream with structured citations. |
| `POST` | `/api/purplexity_ask/follow_up` | Submits a follow-up query maintaining full, historical conversation thread context. |

### Conversation Management
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/conversations` | Fetches a historical list of all active conversations belonging to the authenticated user. |
| `GET` | `/api/conversations/:conversationId` | Retrieves the full sorted message chain for a specific session. |

---

## 📂 Project Architecture

```text
purplexity/
├── frontend/             # React Client Source (Bun Bundler + shadcn/ui)
│   ├── src/
│   │   ├── components/   # UI components styled via shadcn/ui
│   │   │   └── ui/       # Radix Primitives (button, input, dialog, etc.)
│   │   ├── index.html    # Single page entrypoint
│   │   ├── index.tsx     # Application mount point
│   │   └── App.tsx       # Core layout and structural routing
│   └── package.json
└── backend/              # Express Server + Prisma Engine
    ├── prisma/
    │   ├── generated/    # Custom isolated client build targets
    │   └── schema.prisma # PostgreSQL relational definitions
    ├── src/
    │   ├── index.ts      # Main Express API routing architecture
    │   ├── middleware.ts # OAuth / Supabase user ingestion engine
    │   └── db.ts         # Prisma Client instantiation with pg-pool adapter
    └── package.json
