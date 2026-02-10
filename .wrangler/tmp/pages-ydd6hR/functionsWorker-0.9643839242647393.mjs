var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// api/news/[id].js
async function onRequest(context) {
  const { request, env, params } = context;
  const db = env.UPDATES_DB;
  if (!db) return json(500, { error: "D1 binding missing" });
  const id = params.id;
  if (!id) return json(400, { error: "Missing id" });
  const claims = await auth(request, env);
  const isAdmin = !!claims?.email;
  const actor = claims?.email || "anonymous";
  if (request.method === "OPTIONS") return handleCors();
  if (request.method === "GET") {
    const url = new URL(request.url);
    const SUPPORTED = ["en", "mrh", "my"];
    const reqLang = (url.searchParams.get("lang") || "").toLowerCase();
    const lang = SUPPORTED.includes(reqLang) ? reqLang : null;
    let row = null;
    if (isAdmin) {
      row = /^\d+$/.test(id) ? await db.prepare("SELECT * FROM news WHERE id = ?").bind(id).first() : await db.prepare("SELECT * FROM news WHERE slug = ?").bind(id).first();
    } else {
      const cols = "id, slug, publish_date AS date, title, summary, body, category, featured_image, tags";
      if (/^\d+$/.test(id)) {
        row = await db.prepare(
          `SELECT ${cols} FROM news WHERE id = ? AND status = 'published' LIMIT 1`
        ).bind(id).first();
      } else {
        row = await db.prepare(
          `SELECT ${cols} FROM news WHERE slug = ? AND status = 'published' LIMIT 1`
        ).bind(id).first();
      }
      if (!row && /^\d+$/.test(id) === false) {
      }
    }
    if (!row) return json(404, { error: "not found" });
    if (isAdmin) {
      return json(200, rowToAdminItem(row), { ETag: row.etag || "" });
    } else {
      const item = rowToPublicItem(row);
      return json(200, lang ? localize(item, lang) : item, { "Cache-Control": "public, max-age=30" });
    }
  }
  if (request.method === "PUT") {
    if (!isAdmin) return json(401, { error: "unauthorized" });
    const body = await request.json().catch(() => null);
    if (!body) return json(400, { error: "Invalid JSON" });
    const errs = validate(body);
    if (Object.keys(errs).length) return json(422, { errors: errs });
    const etag = request.headers.get("if-match") || "";
    const existing = await db.prepare("SELECT etag FROM news WHERE id = ?").bind(id).first();
    if (!existing) return json(404, { error: "not found" });
    if (existing.etag !== etag) return json(409, { error: "Version conflict \u2014 reload and retry" });
    const nextEtag = crypto.randomUUID();
    await db.prepare(
      `UPDATE news SET slug=?,title=?,summary=?,body=?,category=?,author=?,publish_date=?,status=?,featured_image=?,tags=?,updated_at=datetime('now'),updated_by=?,etag=? WHERE id=?`
    ).bind(
      body.slug,
      sanitizeI18n(parseI18n(body.title)),
      sanitizeI18n(parseI18n(body.summary)),
      sanitizeI18n(parseI18n(body.body), true),
      body.category || null,
      body.author,
      body.publish_date,
      body.status,
      body.featured_image || null,
      body.tags ? JSON.stringify(body.tags) : null,
      actor,
      nextEtag,
      id
    ).run();
    return json(200, { ok: true }, { ETag: nextEtag });
  }
  if (request.method === "DELETE") {
    if (!isAdmin) return json(401, { error: "unauthorized" });
    const etag = request.headers.get("if-match") || "";
    const existing = await db.prepare("SELECT etag FROM news WHERE id = ?").bind(id).first();
    if (!existing) return json(404, { error: "not found" });
    if (existing.etag !== etag) return json(409, { error: "Version conflict" });
    await db.prepare("DELETE FROM news WHERE id = ?").bind(id).run();
    return json(200, { ok: true });
  }
  return json(405, { error: "method not allowed" });
}
__name(onRequest, "onRequest");
async function auth(req, env) {
  const tok = req.headers.get("Cf-Access-Jwt-Assertion") || req.headers.get("CF_Authorization") || (req.headers.get("cookie") || "").match(/CF_Authorization=([^;]+)/)?.[1];
  if (!tok && env?.ADMIN_BYPASS_ACCESS === "1") return { email: "dev@localhost" };
  if (!tok) return null;
  return { email: req.headers.get("cf-access-verified-email") || "unknown" };
}
__name(auth, "auth");
function json(status, data, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", ...extra }
  });
}
__name(json, "json");
function handleCors() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, If-Match, CF_Authorization, Cf-Access-Jwt-Assertion",
      "Access-Control-Max-Age": "86400"
    }
  });
}
__name(handleCors, "handleCors");
function sanitizeHtml(html) {
  if (!html || typeof html !== "string") return "";
  let s = html;
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(/<script[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, "");
  s = s.replace(/\son\w+\s*=\s*("[\s\S]*?"|'[^']*?')/gi, "");
  s = s.replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*("|')/gi, '$1="#"');
  return s;
}
__name(sanitizeHtml, "sanitizeHtml");
function isoDateValid(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
}
__name(isoDateValid, "isoDateValid");
function parseI18n(val) {
  if (!val) return {};
  if (typeof val === "string") {
    try {
      const p = JSON.parse(val);
      return typeof p === "object" && p !== null ? p : { en: val };
    } catch {
      return { en: val };
    }
  }
  return typeof val === "object" && val !== null ? val : {};
}
__name(parseI18n, "parseI18n");
function sanitizeI18n(obj, html = false) {
  const o = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string" && v.trim()) o[k] = html ? sanitizeHtml(v) : v.trim();
  }
  return JSON.stringify(o);
}
__name(sanitizeI18n, "sanitizeI18n");
function validate(body) {
  const err = {};
  const t = parseI18n(body.title);
  if (!t.en || t.en.length > 200) err.title = "English title required (\u2264200 chars)";
  if (!body.slug || !/^[-a-z0-9]+$/.test(body.slug)) err.slug = "Slug: lowercase, numbers, hyphens";
  if (!body.author) err.author = "Author required";
  if (!body.publish_date || !isoDateValid(body.publish_date)) err.publish_date = "Date: YYYY-MM-DD";
  if (!["draft", "published", "archived"].includes(body.status)) err.status = "Invalid status";
  const b = parseI18n(body.body);
  if (!b.en) err.body = "English content required";
  return err;
}
__name(validate, "validate");
function rowToAdminItem(r) {
  const it = { ...r };
  for (const f of ["title", "summary", "body"]) it[f] = parseI18n(it[f]);
  if (typeof it.tags === "string") {
    try {
      it.tags = JSON.parse(it.tags);
    } catch {
      it.tags = [];
    }
  }
  return it;
}
__name(rowToAdminItem, "rowToAdminItem");
function rowToPublicItem(r) {
  const it = {
    id: r.id,
    slug: r.slug,
    date: r.date || r.publish_date,
    category: r.category || void 0,
    image: r.featured_image || void 0
  };
  it.title = parseI18n(r.title);
  it.summary = parseI18n(r.summary);
  it.body = parseI18n(r.body);
  if (typeof r.tags === "string") {
    try {
      it.tags = JSON.parse(r.tags);
    } catch {
      it.tags = [];
    }
  }
  ["title", "summary", "body"].forEach((f) => {
    const obj = it[f];
    if (!obj || typeof obj !== "object") return;
    if (obj.mara && !obj.mrh) obj.mrh = obj.mara;
    Object.keys(obj).forEach((k) => {
      const m = k.match(/^([a-z]{2,3})[-_]/i);
      if (m) {
        const b = m[1].toLowerCase();
        if (!obj[b]) obj[b] = obj[k];
      }
    });
  });
  return it;
}
__name(rowToPublicItem, "rowToPublicItem");
function localize(item, lang) {
  const loc = { ...item };
  for (const f of ["title", "summary", "body"]) {
    if (loc[f] && typeof loc[f] === "object") {
      loc[f] = loc[f][lang] || loc[f].en || Object.values(loc[f])[0] || "";
    }
  }
  return loc;
}
__name(localize, "localize");

// api/news/index.js
async function onRequest2(context) {
  const { request, env } = context;
  const db = env.UPDATES_DB;
  if (!db) return json2(500, { error: "D1 binding missing" });
  const claims = await auth2(request, env);
  const isAdmin = !!claims?.email;
  const actor = claims?.email || "anonymous";
  if (request.method === "OPTIONS") return handleCors2(request);
  if (request.method === "GET") {
    const url = new URL(request.url);
    const p = Object.fromEntries(url.searchParams);
    const SUPPORTED = ["en", "mrh", "my"];
    const reqLang = (p.lang || "").toLowerCase();
    const lang = SUPPORTED.includes(reqLang) ? reqLang : null;
    let where = "1=1";
    const vals = [];
    if (isAdmin) {
      if (p.status) {
        where += ` AND status = ?`;
        vals.push(p.status);
      }
    } else {
      where += ` AND status = 'published'`;
    }
    if (p.category) {
      where += " AND category = ?";
      vals.push(p.category);
    }
    const year = (p.year || "").trim();
    if (year) {
      where += " AND substr(publish_date,1,4) = ?";
      vals.push(year);
    }
    const q = (p.q || p.search || "").trim();
    if (q) {
      const like = "%" + q + "%";
      where += " AND (title LIKE ? OR summary LIKE ? OR body LIKE ? OR author LIKE ?)";
      vals.push(like, like, like, like);
    }
    const limit = Math.min(parseInt(p.limit || (isAdmin ? "20" : "6")) || 6, 100);
    const offset = parseInt(p.offset || "0") || 0;
    const cntRow = await db.prepare(`SELECT COUNT(*) AS c FROM news WHERE ${where}`).bind(...vals).first();
    const total = cntRow?.c || 0;
    const cols = isAdmin ? "*" : "id, slug, publish_date AS date, title, summary, body, category, featured_image, tags";
    const rows = await db.prepare(
      `SELECT ${cols} FROM news WHERE ${where} ORDER BY publish_date DESC LIMIT ? OFFSET ?`
    ).bind(...vals, limit, offset).all();
    const items = (rows.results || []).map((r) => {
      const it = isAdmin ? rowToAdminItem2(r) : rowToPublicItem2(r);
      return !isAdmin && lang ? localize2(it, lang) : it;
    });
    const headers = isAdmin ? {} : { "Cache-Control": "public, max-age=30" };
    return json2(200, { items, total }, headers);
  }
  if (request.method === "POST") {
    if (!isAdmin) return json2(401, { error: "unauthorized" });
    const body = await request.json().catch(() => null);
    if (!body) return json2(400, { error: "Invalid JSON" });
    const errs = validate2(body);
    if (Object.keys(errs).length) return json2(422, { errors: errs });
    const etag = crypto.randomUUID();
    try {
      const res = await db.prepare(
        `INSERT INTO news (slug,title,summary,body,category,content_html,author,publish_date,status,featured_image,tags,created_by,updated_by,etag)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).bind(
        body.slug,
        sanitizeI18n2(parseI18n2(body.title)),
        sanitizeI18n2(parseI18n2(body.summary)),
        sanitizeI18n2(parseI18n2(body.body), true),
        body.category || null,
        "",
        // legacy column
        body.author,
        body.publish_date,
        body.status,
        body.featured_image || null,
        body.tags ? JSON.stringify(body.tags) : null,
        actor,
        actor,
        etag
      ).run();
      return json2(201, { id: res.meta.last_row_id, etag }, { ETag: etag });
    } catch (e) {
      if (e?.message?.includes("UNIQUE")) return json2(409, { error: "Slug already exists" });
      throw e;
    }
  }
  return json2(405, { error: "method not allowed" });
}
__name(onRequest2, "onRequest");
async function auth2(req, env) {
  const tok = req.headers.get("Cf-Access-Jwt-Assertion") || req.headers.get("CF_Authorization") || (req.headers.get("cookie") || "").match(/CF_Authorization=([^;]+)/)?.[1];
  if (!tok && env?.ADMIN_BYPASS_ACCESS === "1") return { email: "dev@localhost" };
  if (!tok) return null;
  return { email: req.headers.get("cf-access-verified-email") || "unknown" };
}
__name(auth2, "auth");
function json2(status, data, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", ...extra }
  });
}
__name(json2, "json");
function handleCors2(req) {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, If-Match, CF_Authorization, Cf-Access-Jwt-Assertion",
      "Access-Control-Max-Age": "86400"
    }
  });
}
__name(handleCors2, "handleCors");
function sanitizeHtml2(html) {
  if (!html || typeof html !== "string") return "";
  let s = html;
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(/<script[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, "");
  s = s.replace(/\son\w+\s*=\s*("[\s\S]*?"|'[^']*?')/gi, "");
  s = s.replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*("|')/gi, '$1="#"');
  return s;
}
__name(sanitizeHtml2, "sanitizeHtml");
function isoDateValid2(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
}
__name(isoDateValid2, "isoDateValid");
function parseI18n2(val) {
  if (!val) return {};
  if (typeof val === "string") {
    try {
      const p = JSON.parse(val);
      return typeof p === "object" && p !== null ? p : { en: val };
    } catch {
      return { en: val };
    }
  }
  return typeof val === "object" && val !== null ? val : {};
}
__name(parseI18n2, "parseI18n");
function sanitizeI18n2(obj, html = false) {
  const o = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string" && v.trim()) o[k] = html ? sanitizeHtml2(v) : v.trim();
  }
  return JSON.stringify(o);
}
__name(sanitizeI18n2, "sanitizeI18n");
function validate2(body) {
  const err = {};
  const t = parseI18n2(body.title);
  if (!t.en || t.en.length > 200) err.title = "English title required (\u2264200 chars)";
  if (!body.slug || !/^[-a-z0-9]+$/.test(body.slug)) err.slug = "Slug: lowercase, numbers, hyphens";
  if (!body.author) err.author = "Author required";
  if (!body.publish_date || !isoDateValid2(body.publish_date)) err.publish_date = "Date: YYYY-MM-DD";
  if (!["draft", "published", "archived"].includes(body.status)) err.status = "Invalid status";
  const b = parseI18n2(body.body);
  if (!b.en) err.body = "English content required";
  if (body.tags && !Array.isArray(body.tags)) err.tags = "Tags must be array";
  return err;
}
__name(validate2, "validate");
function rowToAdminItem2(r) {
  const it = { ...r };
  for (const f of ["title", "summary", "body"]) it[f] = parseI18n2(it[f]);
  if (typeof it.tags === "string") {
    try {
      it.tags = JSON.parse(it.tags);
    } catch {
      it.tags = [];
    }
  }
  return it;
}
__name(rowToAdminItem2, "rowToAdminItem");
function rowToPublicItem2(r) {
  const it = {
    id: r.id,
    slug: r.slug,
    date: r.date || r.publish_date,
    category: r.category || void 0,
    image: r.featured_image || void 0
  };
  it.title = parseI18n2(r.title);
  it.summary = parseI18n2(r.summary);
  it.body = parseI18n2(r.body);
  if (typeof r.tags === "string") {
    try {
      it.tags = JSON.parse(r.tags);
    } catch {
      it.tags = [];
    }
  }
  ["title", "summary", "body"].forEach((f) => {
    const obj = it[f];
    if (!obj || typeof obj !== "object") return;
    if (obj.mara && !obj.mrh) obj.mrh = obj.mara;
    Object.keys(obj).forEach((k) => {
      const m = k.match(/^([a-z]{2,3})[-_]/i);
      if (m) {
        const b = m[1].toLowerCase();
        if (!obj[b]) obj[b] = obj[k];
      }
    });
  });
  return it;
}
__name(rowToPublicItem2, "rowToPublicItem");
function localize2(item, lang) {
  const loc = { ...item };
  for (const f of ["title", "summary", "body"]) {
    if (loc[f] && typeof loc[f] === "object") {
      loc[f] = loc[f][lang] || loc[f].en || Object.values(loc[f])[0] || "";
    }
  }
  return loc;
}
__name(localize2, "localize");

// ../.wrangler/tmp/pages-ydd6hR/functionsRoutes-0.4728001996035185.mjs
var routes = [
  {
    routePath: "/api/news/:id",
    mountPath: "/api/news",
    method: "",
    middlewares: [],
    modules: [onRequest]
  },
  {
    routePath: "/api/news",
    mountPath: "/api/news",
    method: "",
    middlewares: [],
    modules: [onRequest2]
  }
];

// ../../../AppData/Roaming/npm/node_modules/wrangler/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../../../AppData/Roaming/npm/node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");

// ../../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// ../.wrangler/tmp/bundle-OPOx0d/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = pages_template_worker_default;

// ../../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// ../.wrangler/tmp/bundle-OPOx0d/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=functionsWorker-0.9643839242647393.mjs.map
