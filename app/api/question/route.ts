import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { titleSlug } = await req.json();

    const query = `
      query questionDetail($titleSlug: String!) {
        question(titleSlug: $titleSlug) {
          title
          titleSlug
          content
          difficulty
          stats
          topicTags { name slug }
          hints
          metaData
          exampleTestcaseList
          codeSnippets { lang langSlug code }
        }
      }
    `;

    const response = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "referer": "https://leetcode.com",
        "origin": "https://leetcode.com",
        "user-agent": "Mozilla/5.0", // Necessary trick OR LeetCode rejects request
      },
      body: JSON.stringify({
        operationName: "questionDetail",
        query,
        variables: { titleSlug },
      }),
    });

    const data = await response.json();

    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: "LeetCode Query Failed", detail: String(e) },
      { status: 500 }
    );
  }
}
