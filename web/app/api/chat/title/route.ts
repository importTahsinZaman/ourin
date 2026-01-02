import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { verifyChatToken, extractChatToken } from "@/lib/verifyChatToken";

/**
 * deterministically extract a clean title from model output.
 * takes first line, strips markdown/quotes, limits to 5 words.
 */
function extractTitle(rawText: string): string {
  const title = rawText
    // take only the first line
    .split("\n")[0]
    .trim()
    // remove markdown formatting (**, *, `, ~~)
    .replace(/\*\*|__|\*|_|`|~~/g, "")
    // remove surrounding quotes
    .replace(/^["'`]+|["'`]+$/g, "")
    // remove trailing punctuation (except ?)
    .replace(/[.,:;!]+$/, "")
    .trim();

  // limit to 5 words max
  const words = title.split(/\s+/).slice(0, 5);
  return words.join(" ");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userMessage } = body;

    // extract token from authorization header (preferred) or body (fallback)
    const chatToken =
      extractChatToken(req) || (body.chatToken as string | undefined);

    if (!chatToken) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - no token provided" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const tokenResult = await verifyChatToken(chatToken);
    if (!tokenResult.valid) {
      const errorMessage =
        tokenResult.error === "expired"
          ? "Unauthorized - token expired"
          : tokenResult.error === "invalid_signature"
            ? "Unauthorized - invalid token signature"
            : tokenResult.error === "malformed_token"
              ? "Unauthorized - malformed token"
              : "Unauthorized - invalid token";

      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!userMessage || typeof userMessage !== "string") {
      return new Response(
        JSON.stringify({ error: "User message is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // special case: if asking about ourin itself, return a fixed title
    const lowerMessage = userMessage.toLowerCase();
    const isAskingAboutOurin =
      /\b(tell me about|what is|what's|explain|describe|introduce me to)\s+ourin\b/i.test(
        lowerMessage
      ) || /\babout ourin\b/i.test(lowerMessage);

    if (isAskingAboutOurin) {
      return new Response(JSON.stringify({ title: "Intro to Ourin" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const generateResult = await generateText({
      model: anthropic("claude-3-5-haiku-latest"),
      system: `Generate a very short title (2-5 words) for a conversation that starts with the user message below.
The title should capture the main topic or intent.
Respond with ONLY the title, no quotes, no explanation, no punctuation at the end.
Examples: "Python debugging help", "Recipe for pasta", "Travel plans for Japan"`,
      prompt: userMessage,
      maxOutputTokens: 12,
      experimental_telemetry: {
        isEnabled: true,
        functionId: "title-generation",
      },
    });

    const title = extractTitle(generateResult.text);

    return new Response(JSON.stringify({ title }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Title generation error:", error);
    return new Response(JSON.stringify({ error: "Failed to generate title" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
