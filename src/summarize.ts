const PROMPTS: Record<"S" | "L", string> = {
  S: "Summarize article. 1-2 sentences. Key point only.",
  L: "Summarize article. 5-15 sentences. Cover main points, arguments, conclusions.",
};

export async function summarize(
  text: string,
  style: "S" | "L"
): Promise<string | null> {
  const key = process.env["OPENROUTER_KEY"];
  const mdl = process.env["OPENROUTER_MODEL"];
  if (!key) throw new Error("OPENROUTER_KEY is required");
  if (!mdl) throw new Error("OPENROUTER_MODEL is required");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: mdl,
      messages: [
        { role: "system", content: PROMPTS[style] },
        { role: "user", content: text },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${body}`);
  }

  const json = (await res.json()) as { choices: { message: { content: string } }[] };
  if (!json.choices[0]?.message?.content) {
    console.error(`[summarize] OpenRouter returned empty content for ${text}`);
    return null;
  }
  return json.choices[0]!!!.message.content;
}
