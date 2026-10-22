// Optional AI via FreeLLMAPI (https://github.com/tashfeenahmed/freellmapi), a self-hosted
// OpenAI-compatible router over free LLM tiers. Any OpenAI-compatible endpoint works.

const base = () => process.env.FREELLM_BASE_URL?.replace(/\/$/, "");
const key = () => process.env.FREELLM_API_KEY;

export const hasLlm = () => Boolean(base() && key());

export async function chat(system: string, user: string): Promise<string> {
  const res = await fetch(`${base()}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key()}` },
    body: JSON.stringify({
      model: process.env.FREELLM_MODEL || "auto",
      temperature: 0.4,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}`);
  const data = await res.json();
  return String(data.choices?.[0]?.message?.content ?? "");
}
