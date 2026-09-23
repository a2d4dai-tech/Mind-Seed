const { REFRAME_SYSTEM, askClaude, extractJson, readJsonBody } = require("./_lib");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  try {
    const body = readJsonBody(req);
    const sentences = Array.isArray(body.sentences) ? body.sentences.filter(Boolean) : [];
    const words = Array.isArray(body.words) ? body.words.filter(Boolean) : [];
    if (!words.length) {
      res.status(200).json({ pairs: [] });
      return;
    }

    const userContent =
      "ある人が内省のために書き留めた言葉の断片と、そこから抽出された感情の言葉があります。\n\n" +
      "断片:\n" + sentences.map(function (s) { return "・" + s; }).join("\n") +
      "\n\n感情の言葉:\n" + words.map(function (w, i) { return (i + 1) + ". " + w; }).join("\n") +
      "\n\nそれぞれの感情の言葉について、その重さやつらさをなかったことにせず、そのままの上に、" +
      "もう一つの見え方を短い言葉(2〜8文字程度)で差し出してください。たとえば、その感情が生まれるのは" +
      "何を大切に思っているからか、そこにどんな願いや強さが隠れているか、といった角度です。" +
      "説教くさくならず、決めつけないこと。\n\n" +
      "必ず次のJSON形式の配列だけを返してください。他の文章は一切含めないこと。配列の要素数は、" +
      "渡された感情の言葉の数と同じにしてください:\n" +
      '[{"original": "元の感情の言葉", "reframed": "もう一つの見え方"}]';

    const raw = await askClaude({
      model: "claude-haiku-4-5-20251001",
      system: REFRAME_SYSTEM,
      userContent: userContent,
      maxTokens: 500,
    });

    let parsed = extractJson(raw);
    if (parsed && !Array.isArray(parsed) && typeof parsed === "object") {
      const firstArray = Object.values(parsed).find(Array.isArray);
      if (firstArray) parsed = firstArray;
    }
    if (!Array.isArray(parsed) || !parsed.length) {
      const err = new Error("bad_shape, raw=" + raw.slice(0, 300));
      throw err;
    }

    const pairs = parsed
      .map(function (p) {
        return {
          original: String((p && p.original) || "").trim(),
          reframed: String((p && p.reframed) || "").trim(),
        };
      })
      .filter(function (p) { return p.original && p.reframed; });

    if (!pairs.length) throw new Error("empty");

    res.status(200).json({ pairs: pairs });
  } catch (e) {
    res.status(502).json({ error: "failed", detail: String((e && e.message) || e) });
  }
};
