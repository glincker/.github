// Organization profile cards for GLINR Studios: hero, numbers strip, link pills, section headers, bento tiles, footer.
// Usage: node profile/studio/generate.mjs [outDir]   (STATIC=1 freezes motion for screenshots)
// Stars and repo data come from `gh api` when available and are cached in stats.json; offline runs reuse the cache.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = process.argv[2] ?? "profile/studio/out";
const STATIC = process.env.STATIC === "1";
const here = (p) => new URL(p, import.meta.url);
const config = JSON.parse(readFileSync(here("./projects.json"), "utf8"));
mkdirSync(OUT, { recursive: true });

// System font stacks only: web fonts do not load inside images on GitHub.
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

const THEMES = {
  dark: { bg: "#0B0B09", card: "#14140F", ink: "#F4F4F1", mute: "#9C9C92", edge: "#fff", edgeA: 0.1, glowA: 1 },
  light: { bg: "#F7F6F1", card: "#FFFFFF", ink: "#14140F", mute: "#6B6B62", edge: "#000", edgeA: 0.12, glowA: 0.55 },
};

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fmt = (n) => (n >= 1e4 ? `${Math.round(n / 1e3)}K` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n));

// ---------- data ----------
const gh = (args) => JSON.parse(execFileSync("gh", args, { encoding: "utf8", maxBuffer: 16e6 }));
let data;
try {
  const repos = gh(["repo", "list", "glincker", "--limit", "100", "--json", "name,description,stargazerCount,primaryLanguage,homepageUrl,isArchived,isPrivate,isFork"]);
  const live = repos.filter((r) => !r.isPrivate && !r.isArchived && !r.isFork);
  data = {
    updated: new Date().toISOString().slice(0, 10),
    count: live.length,
    stars: live.reduce((a, r) => a + r.stargazerCount, 0),
    top: live.reduce((a, r) => (r.stargazerCount > a.stargazerCount ? r : a), live[0]),
    repos: Object.fromEntries(live.map((r) => [r.name, { stars: r.stargazerCount, lang: r.primaryLanguage?.name ?? "" }])),
  };
  data.top = { name: data.top.name, stars: data.top.stargazerCount };
  writeFileSync(here("./stats.json"), `${JSON.stringify(data, null, 1)}\n`);
} catch {
  data = JSON.parse(readFileSync(here("./stats.json"), "utf8"));
}
const stat = (name) => data.repos[name] ?? { stars: 0, lang: "" };

// ---------- shared svg helpers ----------
const wrap = (w, h, alt, body, defs = "", extraCss = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(alt)}"><defs><style>${STATIC ? "" : "@media (prefers-reduced-motion:no-preference){.pl{animation:pulse 2s ease-in-out infinite}@keyframes pulse{50%{opacity:.3}}}"}${extraCss}text{font-kerning:normal}</style>${defs}</defs>${body}</svg>`;
const write = (name, svg) => {
  writeFileSync(`${OUT}/${name}.svg`, svg);
  if (svg.length > 60000) console.warn(`${name}.svg is ${svg.length} bytes`);
};

// Brand logos from the thesvg registry, inlined and tinted. Root presentation attributes carry over so stroke icons stay stroked.
const logoCache = {};
const logo = (file) => {
  if (!logoCache[file]) {
    const raw = readFileSync(here(`./logos/${file}.svg`), "utf8");
    const head = raw.match(/<svg([^>]*)>/)[1];
    const vb = head.match(/viewBox="([^"]+)"/)[1];
    const attrs = head.replace(/(^|\s)(xmlns|viewBox|width|height)="[^"]*"/g, "$1").trim();
    const inner = raw.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "").replace(/<title>[^<]*<\/title>/g, "");
    logoCache[file] = { vb, attrs, inner };
  }
  return logoCache[file];
};
const logoMark = (file, x, y, size, color) => {
  const l = logo(file);
  const attrs = /\bfill=/.test(l.attrs) ? l.attrs : `${l.attrs} fill="${color}"`;
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="${l.vb}" color="${color}" ${attrs.replace(/currentColor/g, color)}>${l.inner.replace(/currentColor/g, color)}</svg>`;
};
const edge = (w, h, r, t) => `<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="${r}" fill="none" stroke="${t.edge}" stroke-opacity="${t.edgeA}"/>`;
const glow = (blobs, id, a) => ({
  defs: blobs.map((b, i) => `<radialGradient id="${id}${i}"><stop offset="0" stop-color="${b.c}" stop-opacity="${b.a * a}"/><stop offset="1" stop-color="${b.c}" stop-opacity="0"/></radialGradient>`).join(""),
  body: blobs.map((b, i) => `<ellipse cx="${b.x}" cy="${b.y}" rx="${b.rx}" ry="${b.ry}" fill="url(#${id}${i})"/>`).join(""),
});
const STAR = (x, y, s, c) => `<path transform="translate(${x} ${y}) scale(${s / 24})" d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" fill="${c}"/>`;

// ---------- hero ----------
const ORBIT = [
  { key: "levelrail", r: 1, dur: 16, off: 0 },
  { key: "thesvg", r: 1, dur: 16, off: 8 },
  { key: "theauth", r: 2, dur: 24, off: 3 },
  { key: "stacklit", r: 2, dur: 24, off: 15 },
  { key: "glinui", r: 3, dur: 34, off: 7 },
  { key: "sslx", r: 3, dur: 34, off: 24 },
];
function hero(mode, mobile) {
  const t = THEMES[mode];
  const W = mobile ? 360 : 1200;
  const H = mobile ? 362 : 400;
  const cx = mobile ? 180 : 940;
  const cy = mobile ? 268 : 200;
  const radii = mobile ? [30, 52, 74] : [74, 124, 174];
  const nodeR = mobile ? 11 : 17;
  const accents = config.projects;
  const g = glow(
    [
      { x: mobile ? 60 : 900, y: 20, rx: mobile ? 200 : 420, ry: mobile ? 140 : 240, c: "#8B5CF6", a: 0.5 },
      { x: mobile ? 300 : 500, y: 0, rx: mobile ? 160 : 280, ry: mobile ? 110 : 190, c: "#22D3EE", a: 0.34 },
      { x: mobile ? 320 : 1150, y: mobile ? 300 : 60, rx: mobile ? 160 : 240, ry: mobile ? 120 : 200, c: "#F97316", a: 0.38 },
    ],
    "hg",
    t.glowA,
  );
  const wm = logo(mode === "dark" ? "wm-dark" : "wm-light");
  const wmW = mobile ? 300 : 640;
  const wmH = (wmW * 90.85) / 589.59;
  const wmX = mobile ? 30 : 64;
  const wmY = mobile ? 52 : 118;
  const rings = radii.map((r, i) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${t.ink}" stroke-opacity="${0.2 - i * 0.04}" ${i === 1 ? 'stroke-dasharray="3 8"' : ""}/>`).join("");
  const orbit = (r) => `M${cx - r} ${cy} a${r} ${r} 0 1 1 ${2 * r} 0 a${r} ${r} 0 1 1 ${-2 * r} 0`;
  const nodes = ORBIT.map((n, i) => {
    const p = accents.find((a) => a.name === n.key);
    const r = radii[n.r - 1];
    const lg = p.logo ? logoMark(`${p.logo}-mono`, -nodeR * 0.55, -nodeR * 0.55, nodeR * 1.1, p.fg) : `<text y="${nodeR * 0.36}" text-anchor="middle" font-family="${SANS}" font-weight="700" font-size="${nodeR * 0.95}" fill="${p.fg}">${esc(p.mono)}</text>`;
    const inner = `<circle r="${nodeR}" fill="${p.fill}"/>${lg}`;
    if (STATIC) {
      const a = (n.off / n.dur) * 2 * Math.PI - Math.PI / 2 + i;
      return `<g transform="translate(${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)})">${inner}</g>`;
    }
    return `<g><animateMotion dur="${n.dur}s" begin="-${n.off}s" repeatCount="indefinite" path="${orbit(r)}"/>${inner}</g>`;
  }).join("");
  const tag = config.tagline;
  const text = mobile
    ? `${wrapText(tag[0], 34, 2).map((l, i) => `<text x="30" y="${wmY + wmH + 34 + i * 21}" font-family="${SANS}" font-weight="600" font-size="16" fill="${t.ink}">${esc(l)}</text>`).join("")}<text x="30" y="${wmY + wmH + 82}" font-family="${SANS}" font-weight="500" font-size="12" fill="${t.mute}">${esc(tag[1])}</text>`
    : `<text x="64" y="${wmY + wmH + 56}" font-family="${SANS}" font-weight="600" font-size="30" letter-spacing="-.8" fill="${t.ink}">${esc(tag[0])}</text><text x="64" y="${wmY + wmH + 92}" font-family="${SANS}" font-weight="500" font-size="19" fill="${t.mute}">${esc(tag[1])}</text>`;
  const eyebrow = `<text x="${mobile ? 30 : 66}" y="${mobile ? 34 : 84}" font-family="${MONO}" font-weight="600" font-size="${mobile ? 10 : 12}" letter-spacing="${mobile ? 2 : 3}" fill="${t.mute}">OPEN SOURCE  /  DEVELOPER TOOLS</text>`;
  const star = `<circle cx="${cx}" cy="${cy}" r="${mobile ? 13 : 30}" fill="url(#hcore)"/>`;
  const defs = `${g.defs}<radialGradient id="hcore"><stop offset="0" stop-color="#FFB27A"/><stop offset="1" stop-color="#F97316"/></radialGradient><clipPath id="hclip"><rect width="${W}" height="${H}" rx="${mobile ? 18 : 24}"/></clipPath>`;
  const body = `<g clip-path="url(#hclip)"><rect width="${W}" height="${H}" fill="${t.bg}"/>${g.body}${rings}${nodes}${star}${eyebrow}<svg x="${wmX}" y="${wmY}" width="${wmW}" height="${wmH.toFixed(1)}" viewBox="${wm.vb}">${wm.inner}</svg>${text}</g>${edge(W, H, mobile ? 18 : 24, t)}`;
  return wrap(W, H, "GLINR Studios: open source developer tools", body, defs);
}

// ---------- numbers ----------
function numbers(mode, mobile) {
  const t = THEMES[mode];
  const W = mobile ? 360 : 1200;
  const H = mobile ? 96 : 150;
  const cols = [
    ["GITHUB STARS", data.stars.toLocaleString("en-US"), "#F97316"],
    ["PUBLIC REPOS", `${data.count}`, "#A78BFA"],
    [`TOP REPO / ${data.top.name.toUpperCase()}`, data.top.stars.toLocaleString("en-US"), "#22D3EE"],
  ];
  const cw = W / 3;
  const body = cols
    .map(([label, val, c], i) => {
      const x = i * cw + (mobile ? 14 : 44);
      return `${i ? `<line x1="${i * cw}" y1="${mobile ? 20 : 34}" x2="${i * cw}" y2="${H - (mobile ? 22 : 40)}" stroke="${t.edge}" stroke-opacity="${t.edgeA}"/>` : ""}<rect x="${x}" y="${mobile ? 18 : 34}" width="${mobile ? 18 : 28}" height="${mobile ? 3 : 4}" rx="2" fill="${c}"/><text x="${x}" y="${mobile ? 40 : 66}" font-family="${MONO}" font-weight="600" font-size="${mobile ? 8 : 12}" letter-spacing="${mobile ? 0.8 : 1.8}" fill="${t.mute}">${esc(mobile && label.length > 16 ? label.slice(0, 16) : label)}</text><text x="${x}" y="${mobile ? 78 : 118}" font-family="${SANS}" font-weight="700" font-size="${mobile ? 30 : 52}" letter-spacing="-1.2" fill="${c}">${val}</text>`;
    })
    .join("");
  const defs = `<clipPath id="nclip"><rect width="${W}" height="${H}" rx="${mobile ? 16 : 24}"/></clipPath>`;
  return wrap(W, H, `${data.stars} GitHub stars, ${data.count} public repositories, top repository ${data.top.name} with ${data.top.stars} stars`, `<g clip-path="url(#nclip)"><rect width="${W}" height="${H}" fill="${t.card}"/>${body}</g>${edge(W, H, mobile ? 16 : 24, t)}`, defs);
}

// ---------- link pills (themeless: dark pill reads on both page colours) ----------
function pill({ id, label, color }) {
  const w = Math.round(label.length * 8.4 + 46);
  const body = `<rect x=".5" y=".5" width="${w - 1}" height="35" rx="18" fill="#17171A" stroke="#fff" stroke-opacity=".18"/><circle cx="19" cy="18" r="5" fill="${color}"/><text x="32" y="23" font-family="${SANS}" font-weight="600" font-size="14" fill="#F4F4F1">${esc(label)}</text>`;
  write(`link-${id}`, wrap(w, 36, label, body));
  return w;
}

// ---------- section headers ----------
function header(num, title, count, c, mode, mobile) {
  const t = THEMES[mode];
  const W = mobile ? 360 : 1200;
  const H = mobile ? 52 : 72;
  const r = mobile ? 14 : 22;
  const body = `<defs><clipPath id="sh"><rect width="${W}" height="${H}" rx="${r}"/></clipPath><linearGradient id="sl" x1="0" x2="1"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient></defs><g clip-path="url(#sh)"><rect width="${W}" height="${H}" fill="${t.card}"/><rect y="${H - 3}" width="${W}" height="3" fill="url(#sl)"/><text x="${mobile ? 16 : 32}" y="${mobile ? 20 : 30}" font-family="${MONO}" font-weight="600" font-size="${mobile ? 9 : 11}" letter-spacing="2" fill="${c}">${num} / ${esc(title.toUpperCase())}</text><text x="${mobile ? 16 : 32}" y="${mobile ? 41 : 58}" font-family="${SANS}" font-weight="700" font-size="${mobile ? 18 : 26}" letter-spacing="-.6" fill="${t.ink}">${esc(config.sections.find((s) => s.title === title).line)}</text><text x="${W - (mobile ? 36 : 66)}" y="${mobile ? 34 : 42}" text-anchor="end" font-family="${MONO}" font-weight="600" font-size="${mobile ? 10 : 12}" letter-spacing="1.4" fill="${t.mute}">${count}</text><circle cx="${W - (mobile ? 20 : 40)}" cy="${mobile ? 30 : 36}" r="${mobile ? 5 : 7}" fill="${c}"/><circle class="pl" cx="${W - (mobile ? 20 : 40)}" cy="${mobile ? 30 : 36}" r="${mobile ? 5 : 7}" fill="${c}"/></g>${edge(W, H, r, t)}`;
  return wrap(W, H, `${title}: ${config.sections.find((s) => s.title === title).line}`, body);
}

// ---------- bento tiles ----------
// Greedy word wrap by an average glyph width; the last line gets an ellipsis when the text is cut.
const wrapText = (text, maxChars, maxLines) => {
  const words = text.split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    if ((cur ? `${cur} ${w}` : w).length > maxChars && cur) { lines.push(cur); cur = w; } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].replace(/[.,;:]$/, "")}...`;
    return kept;
  }
  return lines;
};
const splitName = (name, maxChars) => {
  if (name.length <= maxChars) return [name];
  const parts = name.split("-");
  const lines = [];
  let cur = "";
  for (const p of parts) {
    const next = cur ? `${cur}-${p}` : p;
    if (next.length > maxChars && cur) { lines.push(`${cur}-`); cur = p; } else cur = next;
  }
  lines.push(cur);
  return lines;
};

function tile(p, frac, mobile) {
  const CW = mobile ? 360 : 1200;
  const full = CW * frac;
  const H = mobile ? 150 : 210;
  const m = mobile ? 3 : 5; // outer gap so neighbouring tiles do not touch
  const w = full - 2 * m;
  const h = H - 2 * m;
  const pad = mobile ? 12 : 26;
  const narrow = mobile && frac < 0.4;
  const s = stat(p.repo ?? p.name);
  const id = `${p.name.replace(/[^a-z0-9]/gi, "")}${Math.round(frac * 100)}${mobile ? "m" : "d"}`;
  const box = mobile ? 30 : 46;
  const fs = mobile ? 13 : p.wide ? 30 : 26;
  const nameMax = Math.floor((w - 2 * pad) / (fs * 0.58));
  const nameLines = splitName(p.name, nameMax);
  const nameFs = Math.max(mobile ? 10 : 18, Math.min(fs, (w - 2 * pad) / (Math.max(...nameLines.map((l) => l.length)) * 0.58)));
  const lh = nameFs * 1.15;
  let y = pad + box + (mobile ? 20 : 34);
  const nameSvg = nameLines.map((l, i) => `<text x="${m + pad}" y="${(y + i * lh).toFixed(1)}" font-family="${SANS}" font-weight="700" font-size="${nameFs.toFixed(1)}" letter-spacing="-.5" fill="${p.fg}">${esc(l)}</text>`).join("");
  y += (nameLines.length - 1) * lh;
  const showChips = (p.chips ?? []).length > 0 && (!mobile || frac >= 0.9);
  const descFs = mobile ? 10 : 13.5;
  const descLines = narrow ? [] : wrapText(p.desc, Math.floor((w - 2 * pad) * (showChips ? 0.56 : 1) / (descFs * 0.53)), mobile ? 3 : 2);
  const descSvg = descLines.map((l, i) => `<text x="${m + pad}" y="${(y + (mobile ? 15 : 24) + i * descFs * 1.4).toFixed(1)}" font-family="${SANS}" font-weight="500" font-size="${descFs}" fill="${p.fg}" fill-opacity=".88">${esc(l)}</text>`).join("");
  // Mark: real brand logo when the registry has one, otherwise a typographic monogram.
  const mark = p.logo
    ? logoMark(`${p.logo}-mono`, m + pad + box * 0.22, m + pad + box * 0.22, box * 0.56, p.fg)
    : `<text x="${m + pad + box / 2}" y="${m + pad + box * 0.66}" text-anchor="middle" font-family="${SANS}" font-weight="800" font-size="${box * 0.42}" letter-spacing="-.5" fill="${p.fg}">${esc(p.mono)}</text>`;
  const lang = p.tag ?? s.lang;
  const tag = lang && !narrow ? `<text x="${m + w - pad}" y="${m + pad + (mobile ? 14 : 20)}" text-anchor="end" font-family="${MONO}" font-weight="600" font-size="${mobile ? 8 : 11}" letter-spacing="${mobile ? 1 : 1.8}" fill="${p.fg}" fill-opacity=".78">${esc(lang.toUpperCase())}</text>` : "";
  const stars = p.repos ? p.repos.reduce((a, r) => a + stat(r).stars, 0) : s.stars;
  const starsTxt = stars > 0 ? `${STAR(m + pad, m + h - pad - (mobile ? 11 : 15), mobile ? 11 : 15, p.fg)}<text x="${m + pad + (mobile ? 15 : 21)}" y="${m + h - pad - (mobile ? 2 : 3)}" font-family="${MONO}" font-weight="700" font-size="${mobile ? 11 : 14}" fill="${p.fg}">${fmt(stars)}</text>` : "";
  const chips = (showChips ? p.chips : [])
    .map((c, i) => {
      const cwid = Math.round(c.length * (mobile ? 6.4 : 7.6) + 22);
      return { c, cwid };
    });
  let chipSvg = "";
  if (chips.length) {
    let cx = m + w - pad;
    const rows = chips.length > 3 ? 2 : 1;
    // Right aligned chips, stacked in rows from the bottom up.
    const perRow = Math.ceil(chips.length / rows);
    for (let r = 0; r < rows; r++) {
      const row = chips.slice(r * perRow, (r + 1) * perRow);
      cx = m + w - pad;
      const cy = m + h - pad - (rows - 1 - r) * (mobile ? 22 : 32) - (mobile ? 18 : 26);
      for (const { c, cwid } of [...row].reverse()) {
        cx -= cwid;
        chipSvg += `<rect x="${cx}" y="${cy}" width="${cwid - 6}" height="${mobile ? 18 : 26}" rx="${mobile ? 9 : 13}" fill="${p.fg}" fill-opacity=".16"/><text x="${cx + (cwid - 6) / 2}" y="${cy + (mobile ? 12.5 : 17.5)}" text-anchor="middle" font-family="${MONO}" font-weight="600" font-size="${mobile ? 8.5 : 11.5}" fill="${p.fg}">${esc(c)}</text>`;
      }
    }
  }
  const arrowR = mobile ? 11 : 16;
  const arrow = !narrow && !chips.length ? `<circle cx="${m + w - pad - arrowR}" cy="${m + h - pad - arrowR}" r="${arrowR}" fill="${p.fg}"/><path d="M${m + w - pad - arrowR * 1.7} ${m + h - pad - arrowR}h${arrowR * 0.75}m-${arrowR * 0.32} -${arrowR * 0.32}l${arrowR * 0.32} ${arrowR * 0.32}l-${arrowR * 0.32} ${arrowR * 0.32}" fill="none" stroke="${p.fill2}" stroke-width="${mobile ? 1.6 : 2.2}" stroke-linecap="round" stroke-linejoin="round" transform="translate(${arrowR * 0.55} 0)"/>` : "";
  const defs = `<clipPath id="c${id}"><rect x="${m}" y="${m}" width="${w}" height="${h}" rx="${mobile ? 14 : 22}"/></clipPath><linearGradient id="d${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.fill}"/><stop offset="1" stop-color="${p.fill2}"/></linearGradient><radialGradient id="h${id}" cx=".15" cy="0" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".24"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`;
  const ringX = m + w - (mobile ? 10 : 24);
  const ringY = m + h - (mobile ? 6 : 16);
  const body = `<g clip-path="url(#c${id})"><rect x="${m}" y="${m}" width="${w}" height="${h}" fill="url(#d${id})"/><rect x="${m}" y="${m}" width="${w}" height="${h}" fill="url(#h${id})"/><circle cx="${ringX}" cy="${ringY}" r="${mobile ? 60 : 130}" fill="none" stroke="${p.fg}" stroke-opacity=".14" stroke-width="1.5"/><circle cx="${ringX}" cy="${ringY}" r="${mobile ? 36 : 86}" fill="none" stroke="${p.fg}" stroke-opacity=".14" stroke-width="1.5"/><rect x="${m + pad}" y="${m + pad}" width="${box}" height="${box}" rx="${box * 0.28}" fill="${p.fg}" fill-opacity=".16"/>${mark}${tag}${nameSvg}${descSvg}${starsTxt}${chipSvg}${arrow}<path d="M${m + 26} ${m + 1}H${m + w - 26}" stroke="#fff" stroke-opacity=".5" stroke-linecap="round"/></g><rect x="${m + 0.5}" y="${m + 0.5}" width="${w - 1}" height="${h - 1}" rx="${mobile ? 14 : 22}" fill="none" stroke="#fff" stroke-opacity=".22"/>`;
  return wrap(full, H, `${p.name}: ${p.desc}`, body, defs);
}

// ---------- footer and community ----------
function footer(mode, mobile) {
  const t = THEMES[mode];
  const W = mobile ? 360 : 1200;
  const H = mobile ? 48 : 60;
  const body = `<rect width="${W}" height="${H}" rx="${H / 2.6}" fill="${t.card}"/>${edge(W, H, H / 2.6, t)}<circle class="pl" cx="${mobile ? 20 : 34}" cy="${H / 2}" r="5" fill="#34D399"/><circle cx="${mobile ? 20 : 34}" cy="${H / 2}" r="5" fill="#34D399"/><text x="${mobile ? 34 : 52}" y="${H / 2 + 4.5}" font-family="${MONO}" font-weight="600" font-size="${mobile ? 10 : 12}" letter-spacing="${mobile ? 0.8 : 1.6}" fill="${t.mute}">MADE BY THE GLINR STUDIOS TEAM</text>${mobile ? "" : `<text x="${W - 34}" y="${H / 2 + 4.5}" text-anchor="end" font-family="${MONO}" font-weight="600" font-size="12" letter-spacing="1.6" fill="#F97316">GLINR.COM</text>`}`;
  return wrap(W, H, "Made by the GLINR Studios team", body);
}
function community(mode, mobile) {
  const t = THEMES[mode];
  const W = mobile ? 360 : 1200;
  const H = mobile ? 120 : 150;
  const r = mobile ? 16 : 24;
  const g = glow([{ x: W * 0.9, y: 20, rx: W * 0.4, ry: 160, c: "#5865F2", a: 0.6 }], "cg", t.glowA);
  const bx = mobile ? 20 : 44;
  const body = `<defs><clipPath id="cc"><rect width="${W}" height="${H}" rx="${r}"/></clipPath>${g.defs}</defs><g clip-path="url(#cc)"><rect width="${W}" height="${H}" fill="${t.card}"/>${g.body}<text x="${bx}" y="${mobile ? 30 : 42}" font-family="${MONO}" font-weight="600" font-size="${mobile ? 9 : 11}" letter-spacing="2" fill="#5865F2">COMMUNITY</text><text x="${bx}" y="${mobile ? 62 : 86}" font-family="${SANS}" font-weight="700" font-size="${mobile ? 20 : 34}" letter-spacing="-.8" fill="${t.ink}">Build with us on Discord</text><text x="${bx}" y="${mobile ? 84 : 118}" font-family="${SANS}" font-weight="500" font-size="${mobile ? 12 : 16}" fill="${t.mute}">Chat with the team and other builders.</text>${mobile ? "" : `<rect x="${W - 232}" y="55" width="188" height="40" rx="20" fill="#5865F2"/><text x="${W - 138}" y="80" text-anchor="middle" font-family="${SANS}" font-weight="700" font-size="15" fill="#fff">Join the server</text>`}</g>${edge(W, H, r, t)}`;
  return wrap(W, H, "Join the GLINR Discord community", body);
}

// ---------- emit ----------
for (const mode of ["dark", "light"]) {
  for (const mobile of [false, true]) {
    const sfx = `${mode}${mobile ? "-mobile" : ""}`;
    write(`hero-${sfx}`, hero(mode, mobile));
    write(`numbers-${sfx}`, numbers(mode, mobile));
    write(`footer-${sfx}`, footer(mode, mobile));
    write(`community-${sfx}`, community(mode, mobile));
    config.sections.forEach((s, i) => {
      const n = s.names.length;
      write(`header-${s.id}-${sfx}`, header(`0${i + 1}`, s.title, `${n} ${n === 1 ? "REPO" : "REPOS"}`, s.color, mode, mobile));
    });
  }
}
config.links.forEach(pill);
const projects = config.projects;
for (const row of config.rows) {
  for (const [name, frac] of row) {
    const p = projects.find((x) => x.name === name);
    p.desc = p.desc.replace(/[–—]/g, ",");
    if (p.desc.length > 90) console.warn(`${name} description is ${p.desc.length} chars`);
    write(`tile-${name}`, tile(p, frac, false));
    write(`tile-${name}-mobile`, tile(p, frac, true));
  }
}
// ---------- README ----------
// Relative paths resolve from profile/README.md. Mobile sources win below 640px; dark sources follow the viewer's colour scheme.
const P = "studio/out";
const themed = (name, alt, width = "100%") =>
  `<picture><source media="(max-width: 640px) and (prefers-color-scheme: dark)" srcset="${P}/${name}-dark-mobile.svg" /><source media="(max-width: 640px)" srcset="${P}/${name}-light-mobile.svg" /><source media="(prefers-color-scheme: dark)" srcset="${P}/${name}-dark.svg" /><img src="${P}/${name}-light.svg" alt="${esc(alt)}" width="${width}" /></picture>`;
const tilePic = (p, frac) =>
  `<a href="https://github.com/glincker/${p.name}"><picture><source media="(max-width: 640px)" srcset="${P}/tile-${p.name}-mobile.svg" /><img src="${P}/tile-${p.name}.svg" alt="${esc(`${p.name}: ${p.desc}`)}" width="${(frac * 100).toFixed(1)}%" /></picture></a>`;
const HREFS = { github: "https://github.com/glincker", glinr: "https://glinr.com", discord: "https://discord.gg/Ar5pcaZB99", thesvg: "https://thesvg.org", levelrail: "https://levelrail.com" };
const pills = config.links.map((l) => `<a href="${HREFS[l.id]}"><img src="${P}/link-${l.id}.svg" alt="${esc(l.label)}" height="36" /></a>`).join(" ");
const repoLink = (r) => `<a href="https://github.com/glincker/${r}">${r}</a>`;
const byName = (n) => projects.find((p) => p.name === n);
const listed = new Set(projects.flatMap((p) => [p.name, ...(p.repos ?? [])]));
const more = Object.keys(data.repos).filter((r) => !listed.has(r) && r !== ".github" && r !== "docs").sort();
const extra = {
  products: `<sub>Packaging: ${byName("ecosystem").repos.map(repoLink).join(", ")}</sub>`,
  research: `<sub>Experiments: ${byName("glinr-whitepapers").repos.slice(1).map(repoLink).join(", ")}</sub>`,
};
const details = config.sections
  .map((s) => {
    const rows = config.rows.filter((row) => row.every(([n]) => s.names.includes(n)));
    const tiles = rows.map((row) => row.map(([n, f]) => tilePic(byName(n), f)).join("")).join("\n");
    return `<details open>\n<summary>${themed(`header-${s.id}`, `${s.title}: ${s.line}`)}</summary>\n\n<div align="center">\n\n${tiles}\n\n${extra[s.id] ?? ""}\n\n</div>\n\n</details>`;
  })
  .join("\n\n");
const readme = `<div align="center">

<a href="https://glinr.com">${themed("hero", "GLINR Studios: open source tools for the people who build software")}</a><br>
${themed("numbers", `${data.stars} GitHub stars, ${data.count} public repositories, ${data.top.name} leads with ${data.top.stars} stars`)}<br>

${pills}

</div>

${details}

<div align="center">

<sub>Also on GitHub: ${more.map(repoLink).join(", ")}</sub>

<a href="https://discord.gg/Ar5pcaZB99">${themed("community", "Join the GLINR Discord community")}</a><br>
<a href="https://discord.gg/Ar5pcaZB99"><img src="https://discord.com/api/guilds/829168897080557579/widget.png?style=banner2" alt="GLINR Discord server widget" width="400" /></a>

${themed("footer", "Made by the GLINR Studios team")}

</div>
`;
writeFileSync(here("../README.md"), readme);
console.log(`stars ${data.stars}, repos ${data.count}, top ${data.top.name} ${data.top.stars}`);
