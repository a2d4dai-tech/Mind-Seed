// Shared helpers for the api/* functions. Filenames starting with "_" are
// not turned into routes by Vercel, so this file is safe to import from.

const INSTRUCTIONS =
  "あなたは、ある人が自分の頭の中のぐちゃぐちゃした考えに、そっと一緒に潜っていく相棒です。" +
  "答えを出したり、まとめたり、導いたりする役目ではありません。ただ隣にいて、静かに耳を傾けます。" +
  "相手はこれから、あなたの問いに一言、二言で答えていきます。\n\n" +
  "あなたの仕事は、相手が今書いた内容を注意深く読み、そこに出てきた具体的な言葉やニュアンスを踏まえて、" +
  "次に聞くべき問いを一つだけ考えることです。\n\n" +
  "ルール:\n" +
  "1. 誰にでも当てはまるテンプレート的な問い(『それについてどう感じる?』『なぜだと思う?』『本当はどうしたい?』のような" +
  "使い古された言い方)は避け、相手が実際に使った言葉を引きながら、その人だけに刺さる問いを作ること。\n" +
  "2. 尋問のように聞こえないこと。『〜ですか?』『〜ますか?』といった硬い聞き方は避け、隣で" +
  "そっとつぶやくような、柔らかく優しい結び方にすること(例:『〜んだろうね』『〜のかもしれないね』" +
  "『〜なのかな』『〜だったりする?』のような言い回し)。相手を評価したり急かしたりする響きを持たせないこと。\n" +
  "3. 問いは一文だけ、短く。分析っぽくならないこと。\n" +
  "4. まだ聞いていない角度を選ぶこと。同じ切り口を繰り返さない。\n" +
  "5. 対話を自分の判断で終わらせないこと。相手が望むだけ、いつまでも続けてよい。\n\n" +
  "必ず次のJSON形式だけを返すこと。前置きや説明、コードブロックの記号は一切つけないこと:\n" +
  '{"question": "次に聞く問い"}';

const WRAP_SUGGESTION_NOTE =
  "\n\n追記: すでに10回以上やりとりが続いています。相手の様子を見て、次の問いの代わりに、" +
  "『なんとなく、考えていることの輪郭が見えてきたかもしれないね。一度、確認してみる?』というような、" +
  "気づきをそっと差し出す一言を返してもよい。これは終わりの合図ではなく、いま見えてきた形を一度眺めてみないか、" +
  "という軽い誘いです。『終える』『区切る』といった言い方は避けること。相手がまだ話したい様子なら、通常の問いを続けること。";

const SUGGEST_WRAP_AFTER = 10;

const ABSTRACT_SYSTEM =
  "あなたは、ある人が内省のために書き留めた言葉の断片から、その奥にある感情を読み取る役目です。" +
  "書かれている内容の重さ・明るさを、そのまま正直に映してください(重ければ重いまま、軽ければ軽いままで構いません)。" +
  "説明や前置きは一切つけず、指示された形式だけを返してください。";

const ANALYZE_SYSTEM =
  "あなたは、ある人が内省ツールに書き留めてきた言葉に、そっと寄り添う役目です。" +
  "答えを出したり導いたりせず、気づきをそっと差し出すだけの、温かい書き手です。" +
  "内容が重く、しんどいものであれば、無理に明るくしたり軽く見せたりせず、そのまま受け止めてください。";

const REFRAME_SYSTEM =
  "あなたは、ある人の感情の言葉に、そっと別の見え方を添える役目です。重さやつらさを打ち消したり、" +
  "軽くしたり、なかったことにしたりはしません。そのままの重さの上に、もう一つの視点をそっと重ねるだけです。" +
  "断定せず、説教せず、短い言葉で。";

async function askClaude({ model, system, userContent, maxTokens }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const err = new Error("missing_api_key");
    err.code = "missing_api_key";
    throw err;
  }

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: model,
      max_tokens: maxTokens || 400,
      system: system,
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!r.ok) {
    const text = await r.text().catch(() => "");
    const err = new Error("anthropic_error_" + r.status + ": " + text);
    err.code = "anthropic_error";
    err.status = r.status;
    throw err;
  }

  const data = await r.json();
  return (data.content || []).map((b) => b.text || "").join("");
}

// Reads tolerantly, the same way the rest of Claude's tooling does: the
// whole reply as JSON; else a ```-fenced block; else the first [...] or
// {...} that actually parses (tried in that order, since a reply holding
// several {...} objects loose inside a [...] array made a naive "match
// whichever bracket appears" pick the wrong, unparseable span).
function extractJson(text) {
  const fenced = text.trim().match(/^```[a-zA-Z]*\s*([\s\S]*?)\s*```$/);
  const body = fenced ? fenced[1] : text;

  try {
    return JSON.parse(body);
  } catch (e) {}

  const arr = body.match(/\[[\s\S]*\]/);
  if (arr) {
    try {
      return JSON.parse(arr[0]);
    } catch (e) {}
  }

  const obj = body.match(/\{[\s\S]*\}/);
  if (obj) {
    try {
      return JSON.parse(obj[0]);
    } catch (e) {}
  }

  return null;
}

function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try {
    return JSON.parse(req.body || "{}");
  } catch (e) {
    return {};
  }
}

module.exports = {
  INSTRUCTIONS,
  WRAP_SUGGESTION_NOTE,
  SUGGEST_WRAP_AFTER,
  ABSTRACT_SYSTEM,
  ANALYZE_SYSTEM,
  REFRAME_SYSTEM,
  askClaude,
  extractJson,
  readJsonBody,
};
