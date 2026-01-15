var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// api/update.js
async function onRequest(context) {
  const { env, request } = context;
  const db = env.UPDATES_DB;
  if (!db) return new Response(JSON.stringify({ error: "D1 database binding `UPDATES_DB` not found" }), { status: 500, headers: { "Content-Type": "application/json" } });
  function sanitizeHtml(html) {
    if (!html || typeof html !== "string") return "";
    html = html.replace(/<!--([\s\S]*?)-->/g, "");
    html = html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
    html = html.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "");
    html = html.replace(/\s(on\w+)\s*=\s*("[\s\S]*?"|'[\s\S]*?')/gi, "");
    html = html.replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*("|')/gi, "");
    html = html.replace(/<iframe[\s\S]*?src\s*=\s*("|')(.*?)\1[\s\S]*?><\/iframe>/gi, (m, q, src) => {
      if (/^https?:\/\/(www\.)?youtube\.com\/embed\//i.test(src)) {
        return `<iframe src="${src}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
      }
      return "";
    });
    html = html.replace(/<img[\s\S]*?src\s*=\s*("|')(.*?)\1[\s\S]*?>/gi, (m, q, src) => {
      if (/^(https?:|\/|data:)/i.test(src)) {
        const alt = (m.match(/\salt\s*=\s*("|')(.*?)\1/i) || [])[2] || "";
        return `<img src="${src}" alt="${alt}" style="max-width:100%">`;
      }
      return "";
    });
    html = html.replace(/<a[\s\S]*?href\s*=\s*("|')(.*?)\1[\s\S]*?>/gi, (m, q, href) => {
      if (/^(https?:|\/|mailto:)/i.test(href)) return `<a href="${href}" target="_blank" rel="noopener noreferrer">`;
      return "<a>";
    });
    html = html.replace(/\sstyle\s*=\s*("[\s\S]*?"|'[\s\S]*?')/gi, "");
    return html;
  }
  __name(sanitizeHtml, "sanitizeHtml");
  try {
    const url = new URL(request.url);
    const idParam = url.searchParams.get("id");
    const slug = url.searchParams.get("slug");
    const reqLang = (url.searchParams.get("lang") || "").toLowerCase();
    const SUPPORTED = ["en", "mrh", "my"];
    const lang = SUPPORTED.indexOf(reqLang) !== -1 ? reqLang : null;
    let row = null;
    if (idParam) {
      const r = await db.prepare("SELECT id, date, title, summary, body FROM updates WHERE id = ? LIMIT 1").bind(idParam).all();
      row = r && r.results && r.results[0] ? r.results[0] : null;
    } else if (slug) {
      if (/^[0-9]+$/.test(slug)) {
        const r = await db.prepare("SELECT id, date, title, summary, body FROM updates WHERE id = ? LIMIT 1").bind(slug).all();
        row = r && r.results && r.results[0] ? r.results[0] : null;
      }
      if (!row) {
        const sLike = "%" + slug + "%";
        const r2 = await db.prepare('SELECT id, date, title, summary, body FROM updates WHERE json_extract(title, "$.en") LIKE ? OR json_extract(title, "$.mrh") LIKE ? LIMIT 1').bind(sLike, sLike).all();
        row = r2 && r2.results && r2.results[0] ? r2.results[0] : null;
      }
    }
    if (!row) return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
    const item = { id: row.id, date: row.date };
    try {
      item.title = typeof row.title === "string" ? JSON.parse(row.title) : row.title;
    } catch (e) {
      item.title = row.title;
    }
    try {
      item.summary = typeof row.summary === "string" ? JSON.parse(row.summary) : row.summary;
    } catch (e) {
      item.summary = row.summary;
    }
    try {
      item.body = typeof row.body === "string" ? JSON.parse(row.body) : row.body;
    } catch (e) {
      item.body = row.body;
    }
    ["title", "summary", "body"].forEach((field) => {
      const obj = item[field];
      if (!obj || typeof obj !== "object") return;
      if (obj.mara && !obj.mrh) obj.mrh = obj.mara;
      Object.keys(obj).forEach((k) => {
        const m = k.match(/^([a-z]{2,3})(?:[-_].+)$/i);
        if (m) {
          const base = m[1].toLowerCase();
          if (!obj[base]) obj[base] = obj[k];
        }
      });
    });
    if (lang) {
      const out = { id: item.id, date: item.date };
      ["title", "summary", "body"].forEach((f) => {
        const obj = item[f];
        let val = !obj ? "" : typeof obj === "string" ? obj : obj[lang] || obj.mrh || obj.en || "";
        if (f === "body") val = sanitizeHtml(val);
        out[f] = val;
      });
      return new Response(JSON.stringify(out), { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=30" } });
    }
    if (item.body && typeof item.body === "string") item.body = sanitizeHtml(item.body);
    return new Response(JSON.stringify(item), { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=30" } });
  } catch (err) {
    console.error("update api error", err);
    return new Response(JSON.stringify({ error: "failed to query update" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
__name(onRequest, "onRequest");

// api/updates.js
async function onRequest2(context) {
  const { env, request } = context;
  const db = env.UPDATES_DB;
  if (!db) return new Response(JSON.stringify({ error: "D1 database binding `UPDATES_DB` not found" }), { status: 500, headers: { "Content-Type": "application/json" } });
  function sanitizeHtml(html) {
    if (!html || typeof html !== "string") return "";
    html = html.replace(/<!--([\s\S]*?)-->/g, "");
    html = html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
    html = html.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "");
    html = html.replace(/\s(on\w+)\s*=\s*("[\s\S]*?"|'[\s\S]*?')/gi, "");
    html = html.replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*("|')/gi, "");
    html = html.replace(/<iframe[\s\S]*?src\s*=\s*("|')(.*?)\1[\s\S]*?><\/iframe>/gi, (m, q, src) => {
      if (/^https?:\/\/(www\.)?youtube\.com\/embed\//i.test(src)) {
        return `<iframe src="${src}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
      }
      return "";
    });
    html = html.replace(/<img[\s\S]*?src\s*=\s*("|')(.*?)\1[\s\S]*?>/gi, (m, q, src) => {
      if (/^(https?:|\/|data:)/i.test(src)) {
        const alt = (m.match(/\salt\s*=\s*("|')(.*?)\1/i) || [])[2] || "";
        return `<img src="${src}" alt="${alt}" style="max-width:100%">`;
      }
      return "";
    });
    html = html.replace(/<a[\s\S]*?href\s*=\s*("|')(.*?)\1[\s\S]*?>/gi, (m, q, href) => {
      if (/^(https?:|\/|mailto:)/i.test(href)) return `<a href="${href}" target="_blank" rel="noopener noreferrer">`;
      return "<a>";
    });
    html = html.replace(/\sstyle\s*=\s*("[\s\S]*?"|'[\s\S]*?')/gi, "");
    return html;
  }
  __name(sanitizeHtml, "sanitizeHtml");
  try {
    const url = new URL(request.url);
    const idParam = url.searchParams.get("id");
    const pathParts = url.pathname.replace(/\/+/g, "/").split("/").filter(Boolean);
    const lastPart = pathParts[pathParts.length - 1];
    const idFromPath = pathParts.length >= 2 && pathParts[pathParts.length - 2] === "updates" && /^[0-9]+$/.test(lastPart) ? lastPart : null;
    const id = idParam || idFromPath;
    if (id) {
      const qRow = "SELECT id, date, title, summary, body FROM updates WHERE id = ? LIMIT 1";
      const rRow = await db.prepare(qRow).bind(id).all();
      const row = rRow && rRow.results && rRow.results[0] ? rRow.results[0] : null;
      if (!row) return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
      const item = { id: row.id, date: row.date };
      try {
        item.title = typeof row.title === "string" ? JSON.parse(row.title) : row.title;
      } catch (e) {
        item.title = row.title;
      }
      try {
        item.summary = typeof row.summary === "string" ? JSON.parse(row.summary) : row.summary;
      } catch (e) {
        item.summary = row.summary;
      }
      try {
        item.body = typeof row.body === "string" ? JSON.parse(row.body) : row.body;
      } catch (e) {
        item.body = row.body;
      }
      ["title", "summary", "body"].forEach((field) => {
        const obj = item[field];
        if (!obj || typeof obj !== "object") return;
        if (obj.mara && !obj.mrh) obj.mrh = obj.mara;
        Object.keys(obj).forEach((k) => {
          const m = k.match(/^([a-z]{2,3})(?:[-_].+)$/i);
          if (m) {
            const base = m[1].toLowerCase();
            if (!obj[base]) obj[base] = obj[k];
          }
        });
      });
      const reqLang2 = (url.searchParams.get("lang") || "").toLowerCase();
      const SUPPORTED2 = ["en", "mrh", "my"];
      if (reqLang2 && SUPPORTED2.indexOf(reqLang2) !== -1) {
        const out = { id: item.id, date: item.date };
        ["title", "summary", "body"].forEach((f) => {
          const obj = item[f];
          let val = !obj ? "" : typeof obj === "string" ? obj : obj[reqLang2] || obj.mrh || obj.en || "";
          if (f === "body") val = sanitizeHtml(val);
          out[f] = val;
        });
        return new Response(JSON.stringify(out), { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=30" } });
      }
      if (item.body && typeof item.body === "string") item.body = sanitizeHtml(item.body);
      return new Response(JSON.stringify(item), { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=30" } });
    }
    const reqLang = (url.searchParams.get("lang") || "").toLowerCase();
    const SUPPORTED = ["en", "mrh", "my"];
    const lang = SUPPORTED.indexOf(reqLang) !== -1 ? reqLang : "en";
    const limit = parseInt(url.searchParams.get("limit") || "6", 10) || 6;
    const offset = parseInt(url.searchParams.get("offset") || "0", 10) || 0;
    const q = (url.searchParams.get("q") || "").trim();
    const year = (url.searchParams.get("year") || "").trim();
    let where = "1=1";
    const params = [];
    if (year) {
      where += " AND substr(date,1,4) = ?";
      params.push(year);
    }
    if (q) {
      const like = "%" + q + "%";
      where += ` AND ( (json_extract(title, '$."' || ? || '"') LIKE ?) OR (json_extract(summary, '$."' || ? || '"') LIKE ?) OR (json_extract(title, '$.en') LIKE ?) OR (json_extract(summary, '$.en') LIKE ?) )`;
      params.push(lang, like, lang, like, like, like);
    }
    const countSql = "SELECT COUNT(*) AS cnt FROM updates WHERE " + where;
    const countRes = await db.prepare(countSql).bind(...params).all();
    const total = countRes && countRes.results && countRes.results[0] ? countRes.results[0].cnt : 0;
    const sql = "SELECT id, date, title, summary, body FROM updates WHERE " + where + " ORDER BY date DESC LIMIT ? OFFSET ?";
    const allParams = params.slice();
    allParams.push(limit);
    allParams.push(offset);
    const r = await db.prepare(sql).bind(...allParams).all();
    const rows = r && r.results ? r.results : [];
    const items = rows.map((row) => {
      const it = { id: row.id, date: row.date };
      try {
        it.title = typeof row.title === "string" ? JSON.parse(row.title) : row.title;
      } catch (e) {
        it.title = row.title;
      }
      try {
        it.summary = typeof row.summary === "string" ? JSON.parse(row.summary) : row.summary;
      } catch (e) {
        it.summary = row.summary;
      }
      try {
        it.body = typeof row.body === "string" ? JSON.parse(row.body) : row.body;
      } catch (e) {
        it.body = row.body;
      }
      ["title", "summary", "body"].forEach((field) => {
        const obj = it[field];
        if (!obj || typeof obj !== "object") return;
        if (obj.mara && !obj.mrh) obj.mrh = obj.mara;
        Object.keys(obj).forEach((k) => {
          const m = k.match(/^([a-z]{2,3})(?:[-_].+)$/i);
          if (m) {
            const base = m[1].toLowerCase();
            if (!obj[base]) obj[base] = obj[k];
          }
        });
      });
      if (reqLang && SUPPORTED.indexOf(reqLang) !== -1) {
        const out = { id: it.id, date: it.date };
        ["title", "summary", "body"].forEach((f) => {
          const obj = it[f];
          let val = !obj ? "" : typeof obj === "string" ? obj : obj[reqLang] || obj.mrh || obj.en || "";
          if (f === "body") val = sanitizeHtml(val);
          out[f] = val;
        });
        return out;
      }
      if (it.body && typeof it.body === "string") it.body = sanitizeHtml(it.body);
      return it;
    });
    return new Response(JSON.stringify({ items, total }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        // Cache short on CDN, let revalidation handle freshness
        "Cache-Control": "public, max-age=30"
      }
    });
  } catch (err) {
    console.error("updates api error", err);
    return new Response(JSON.stringify({ error: "failed to query updates" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
__name(onRequest2, "onRequest");

// ../.wrangler/tmp/pages-2MJJgD/functionsRoutes-0.4919875533758833.mjs
var routes = [
  {
    routePath: "/api/update",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest]
  },
  {
    routePath: "/api/updates",
    mountPath: "/api",
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

// ../.wrangler/tmp/bundle-YLeA3x/middleware-insertion-facade.js
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

// ../.wrangler/tmp/bundle-YLeA3x/middleware-loader.entry.ts
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
//# sourceMappingURL=functionsWorker-0.40292058749397786.mjs.map
