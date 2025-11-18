<img width="1536" height="494" alt="ReadMe Banner" src="https://github.com/user-attachments/assets/ee9b494e-2d41-4576-9013-7d0e5a10371c" />

# LeetCode Mock Interviewer v1.0

[![Version](https://img.shields.io/badge/version-1.0-blue)]()
[![Built with Next.js](https://img.shields.io/badge/next.js-%5E14-000000?style=flat&logo=next.js)]()
[![Monaco Editor](https://img.shields.io/badge/Monaco--Editor-FFB86B?style=flat)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)]()


> AI-powered FAANG-style coding interview simulator. Paste your LeetCode progress JSON, pick one of your solved problems, practice in an integrated Monaco editor, and get evaluation & hints from an AI interviewer.

---

## 📌 Features (v1.0)

- **AI-driven interviewer**: conversational feedback, hints, and evaluation.
- **Monaco editor workspace**: load starter snippets, auto-save drafts per problem.
- **Submit to AI**: submit your editor code as a chat message for review.
- **Auto-hint system**: detects user inactivity (default 60s) and pushes a hint.
- **Notes & Timer**: per-problem notes (localStorage) and timeboxing (30m/45m).
- **Problem viewer**: rich problem content, tags, and starter snippets.
- **Pagination**: paginated solved-problems list (5/10/50/100).
- **Personalization**: optional LeetCode username shown in the header.
- **Guide modal**: step-by-step instructions for extracting the LeetCode JSON.

---

## 🧩 Why this project?

This tool emulates a realistic interview environment:
- practice explaining your approach,
- write and refine code in-browser,
- and receive structured feedback from an AI interviewer — all while tracking time and notes.

Perfect for interview prep and coding practice.

---

## 🛠️ Tech stack

- **Framework**: Next.js (App Router)  
- **Styling**: Tailwind CSS  
- **Editor**: Monaco Editor (`@monaco-editor/react`)  
- **Fonts**: Geist / Playfair Display  
- **State**: React hooks + `localStorage`  
- **Deployment**: Vercel
- **AI backend**: serverless API route (proxy to your LLM of choice)

---

## 🔧 Installation & Local Development

1. **Clone**
   ```bash
   git clone https://github.com/yourname/leetcode-mock-interviewer.git
   cd leetcode-mock-interviewer
2. **Install**
   ```bash
   npm install # or yarn install
3. **Environment**
   ```bash
   GROQ_API_KEY = "Your API Key Here"
4. **Run**
   ```bash
   npm run dev # or yarn dev
Open http://localhost:3000
