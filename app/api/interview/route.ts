import { Groq } from "groq-sdk";
/* eslint-disable @typescript-eslint/no-explicit-any */

export async function POST(req: Request) {
  try {
    const { messages, problem } = await req.json();

    if (!problem) {
      return Response.json(
        { error: "Missing problem context" },
        { status: 400 }
      );
    }

    const client = new Groq({
      apiKey: process.env.GROQ_API_KEY!,
    });

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const systemPrompt = `
You are a senior FAANG interviewer.
Interview the candidate about the problem:
"${problem.title}" (${problem.difficulty})

Rules:
- Ask one question at a time
- Don't reveal full solution
- Ask for approach first 
- Push candidate for clarity
- Give hints slowly and only when necessary
- Maintain a calm, professional, FAANG-style tone.
`;

        const chat = await client.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          stream: true,
          temperature: 0.4,
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
        });

        try {
          for await (const chunk of chat) {
            const token = chunk.choices?.[0]?.delta?.content || "";
            controller.enqueue(encoder.encode(token));
          }
        } catch (err) {
          console.error("Streaming Error:", err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (err: any) {
    console.error("Groq API error:", err.message);
    return Response.json(
      { error: "Groq error", detail: err.message },
      { status: 500 }
    );
  }
}
