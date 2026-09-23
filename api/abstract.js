const { ABSTRACT_SYSTEM, askClaude, extractJson, readJsonBody } = require("./_lib");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  try {
    const body = readJsonBody(req);
    const sentences = Array.isArray(body.sentences) ? body.sentences.filter(Boolean) : [];
    if (!sentences.length) {
      res.status(200).json({ words: [] });
      return;
    }

    const userContent =
      "以下は、ある人が内省のために書き留めた言葉の断片です。それぞれの奥にある感情を、" +
      "一語の名詞または形容詞(例:辛い、喪失感、苦しみ、安堵、焦り、迷い、寂しさ)に変換してください。\n" +
      "日本語で、説明や記号を付けず、単語だけのJSON配列として返してください。似た感情は一つにまとめてよく、" +
      "断片の数と厳密に一致させる必要はありません。\n\n断片:\n" +
      sentences.map(function (s, i) { return (i + 1) + ". " + s; }).join("\n");

    const raw = await askClaude({
      model: "claude-haiku-4-5-20251001",
      system: ABSTRACT_SYSTEM,
      userContent: userContent,
      maxTokens: 300,
    });

    const words = extractJson(raw);
    if (!Array.isArray(words) || !words.length) throw new Error("bad_shape");

    res.status(200).json({
      words: words.map(String).filter(function (w) { return w && w.trim(); }),
    });
  } catch (e) {
    res.status(502).json({ error: "failed" });
  }
};
