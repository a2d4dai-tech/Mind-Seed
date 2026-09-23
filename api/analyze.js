const { ANALYZE_SYSTEM, askClaude, readJsonBody } = require("./_lib");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  try {
    const body = readJsonBody(req);
    const sentences = Array.isArray(body.sentences) ? body.sentences.filter(Boolean) : [];
    const words = Array.isArray(body.words) ? body.words.filter(Boolean) : [];
    if (!sentences.length) {
      res.status(200).json({ text: "" });
      return;
    }

    const userContent =
      "ある人が内省ツールに書き留めてきた言葉の断片と、そこから抽出された感情の言葉があります。\n\n" +
      "断片:\n" + sentences.map(function (s) { return "・" + s; }).join("\n") +
      "\n\n感情の言葉:\n" + words.join("、") +
      "\n\nこれら全体を通して見えてくる感情の傾向やパターンについて、温かく、断定せず、押しつけがましくない口調で" +
      "日本語で3〜4文の短い考察を書いてください。アドバイスや解決策ではなく、そっと気づきを差し出すような文章にしてください。";

    const text = await askClaude({
      model: "claude-sonnet-5",
      system: ANALYZE_SYSTEM,
      userContent: userContent,
      maxTokens: 500,
    });

    res.status(200).json({ text: text.trim() });
  } catch (e) {
    res.status(502).json({ error: "failed", detail: String((e && e.message) || e) });
  }
};
