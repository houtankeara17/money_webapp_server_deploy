/**
 * Server-side language negotiation middleware
 *
 * Supported locales: en, km
 *
 * Priority (first match wins):
 *  1. Query  ?lang=km | ?language=km
 *  2. Body   { "language": "km" }   (POST/PUT only, when present)
 *  3. Header X-Language: km
 *  4. Header Accept-Language (RFC 7231 q-values)
 *  5. Default DEFAULT_LANG (en)
 *
 * After auth (optional): if no *explicit* client preference was sent,
 * fall back to req.user.language when protect has run.
 *
 * Sets on request:
 *   req.lang          — "en" | "km"
 *   req.locale        — same
 *   req.langSource    — how it was chosen
 *   req.langExplicit  — true if client forced a language (query/body/X-Language)
 *
 * Sets response header: Content-Language
 */

const SUPPORTED = ["en", "km"];
const DEFAULT_LANG = process.env.DEFAULT_LANG || "en";

function normalizeLang(raw) {
  if (raw == null || raw === "") return null;
  const s = String(raw).toLowerCase().trim().replace(/_/g, "-");
  // km, km-KH, khmer
  if (s === "km" || s.startsWith("km-") || s === "khmer" || s === "kh")
    return "km";
  if (s === "en" || s.startsWith("en-")) return "en";
  return null;
}

/**
 * Parse Accept-Language: "km-KH,km;q=0.9,en-US;q=0.8,en;q=0.7"
 * → [{ tag, q }, ...] sorted by q desc
 */
function parseAcceptLanguage(header) {
  if (!header || typeof header !== "string") return [];
  return header
    .split(",")
    .map((part) => {
      const [tagPart, ...params] = part.trim().split(";");
      let q = 1;
      for (const p of params) {
        const m = p.trim().match(/^q\s*=\s*([0-9.]+)/i);
        if (m) {
          q = Math.min(1, Math.max(0, parseFloat(m[1]) || 0));
        }
      }
      return { tag: tagPart.trim().toLowerCase(), q };
    })
    .filter((x) => x.tag)
    .sort((a, b) => b.q - a.q);
}

function pickFromAcceptLanguage(header) {
  const parsed = parseAcceptLanguage(header);
  for (const { tag, q } of parsed) {
    if (q <= 0) continue;
    const n = normalizeLang(tag);
    if (n && SUPPORTED.includes(n)) return n;
  }
  return null;
}

/**
 * Core negotiation — does not read req.user (runs before auth).
 */
function negotiate(req) {
  // 1) Query
  const qLang = normalizeLang(req.query?.lang || req.query?.language);
  if (qLang && SUPPORTED.includes(qLang)) {
    return { lang: qLang, source: "query", explicit: true };
  }

  // 2) Body (only if JSON body already parsed)
  if (req.body && typeof req.body === "object") {
    const bLang = normalizeLang(req.body.language || req.body.lang);
    if (bLang && SUPPORTED.includes(bLang)) {
      return { lang: bLang, source: "body", explicit: true };
    }
  }

  // 3) X-Language (app UI)
  const xLang = normalizeLang(
    req.headers["x-language"] || req.headers["x-lang"],
  );
  if (xLang && SUPPORTED.includes(xLang)) {
    return { lang: xLang, source: "x-language", explicit: true };
  }

  // 4) Accept-Language
  const aLang = pickFromAcceptLanguage(req.headers["accept-language"]);
  if (aLang) {
    return { lang: aLang, source: "accept-language", explicit: false };
  }

  // 5) Default
  return { lang: DEFAULT_LANG, source: "default", explicit: false };
}

/**
 * Early middleware — attach negotiated language to every request.
 */
function languageMiddleware(req, res, next) {
  const result = negotiate(req);
  req.lang = result.lang;
  req.locale = result.lang;
  req.langSource = result.source;
  req.langExplicit = result.explicit;

  res.setHeader("Content-Language", req.lang);
  res.setHeader("Vary", "Accept-Language, X-Language");

  next();
}

/**
 * Call after `protect` to adopt user.language when client did not
 * explicitly request a language (no X-Language / ?lang= / body.language).
 */
function applyUserLanguage(req, res, next) {
  if (!req.langExplicit && req.user?.language) {
    const u = normalizeLang(req.user.language);
    if (u && SUPPORTED.includes(u) && u !== req.lang) {
      req.lang = u;
      req.locale = u;
      req.langSource = "user-profile";
      res.setHeader("Content-Language", req.lang);
    }
  }
  next();
}

module.exports = {
  languageMiddleware,
  applyUserLanguage,
  negotiate,
  normalizeLang,
  parseAcceptLanguage,
  pickFromAcceptLanguage,
  SUPPORTED,
  DEFAULT_LANG,
};
