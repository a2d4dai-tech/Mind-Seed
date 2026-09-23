const {
  INSTRUCTIONS,
  WRAP_SUGGESTION_NOTE,
  SUGGEST_WRAP_AFTER,
  askClaude,
  extractJson,
  readJsonBody,
} = require("./_lib");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  try {
    const body = readJsonBody(req);
    const history = Array.isArray(body.history) ? body.history : [];

    const transcript = history
      .map(function (pair, i) {
        return (
          (i + 1) +
          ". 問い: " +
          String(pair.question || "") +
          "\n   答え: " +
          (pair.answer && String(pair.answer).trim()
            ? String(pair.answer)
            : "(なにも書かなかった)")
        );
      })
      .join("\n");

    const userContent =
      "これまでのやりとり:\n\n" +
      transcript +
      "\n\n次に聞く問いを考えて、指定されたJSON形式だけで返してください。";

    const system = INSTRUCTIONS + (history.length >= SUGGEST_WRAP_AFTER ? WRAP_SUGGESTION_NOTE : "");

    const raw = await askClaude({
      model: "claude-haiku-4-5-20251001",
      system: system,
      userContent: userContent,
      maxTokens: 200,
    });

    const parsed = extractJson(raw);
    if (!parsed || typeof parsed.question !== "string" || !parsed.question.trim()) {
      throw new Error("bad_shape");
    }

    res.status(200).json({ question: parsed.question.trim() });
  } catch (e) {
    res.status(502).json({ error: "failed", detail: String((e && e.message) || e) });
  }
};
