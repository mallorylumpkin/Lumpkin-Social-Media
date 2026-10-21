// AI provider layer. Server-side only: the key lives in an environment variable and is never sent to the browser.
// Provider: Google Gemini API (free tier). Swap by adding another branch here; nothing else in the app changes.
// Free-tier note: Google may use free-tier prompts to improve its products and humans may review them,
// so prompts contain product facts only: never personal data, account details, or private messages.

export type AiResult = { ok: true; json: unknown; tokensIn: number | null; tokensOut: number | null; model: string } | { ok: false; error: string; model: string };

export async function generateJson(opts: { provider: string; model: string; system: string; prompt: string }): Promise<AiResult> {
  const model = opts.model;
  if (opts.provider === "none") return { ok: false, error: "AI is turned off in Settings (ai.provider = none).", model };
  if (opts.provider !== "gemini") return { ok: false, error: `Unknown AI provider "${opts.provider}".`, model };

  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, error: "GEMINI_API_KEY is not set. Add it in Netlify > Site configuration > Environment variables, then redeploy. Until then use 'Quick draft (no AI)'.", model };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 22000);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.system }] },
        contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.8, maxOutputTokens: 3072 }
      }),
      signal: controller.signal
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 429) return { ok: false, error: "Free AI limit reached for now (Google rate limit). Wait a minute, or use 'Quick draft (no AI)'. The daily limit resets at midnight Pacific time.", model };
      if (res.status === 404) return { ok: false, error: `Google does not recognise the model "${model}". Change ai.model in Settings (see ai.google.dev/gemini-api/docs/models).`, model };
      if (res.status === 400 || res.status === 403) return { ok: false, error: `Google rejected the request (${res.status}). Check the API key. ${body.slice(0, 160)}`, model };
      return { ok: false, error: `AI service error ${res.status}.`, model };
    }
    const data: any = await res.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? "").join("");
    if (!text) return { ok: false, error: "The AI returned no text (it may have been filtered). Try again or edit the facts.", model };
    let json: unknown;
    try {
      json = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
    } catch {
      return { ok: false, error: "The AI reply was not valid JSON. Try again.", model };
    }
    return { ok: true, json, tokensIn: data?.usageMetadata?.promptTokenCount ?? null, tokensOut: data?.usageMetadata?.candidatesTokenCount ?? null, model };
  } catch (e: any) {
    return { ok: false, error: e?.name === "AbortError" ? "The AI took too long. Try again." : "Could not reach the AI service.", model };
  } finally {
    clearTimeout(timer);
  }
}
