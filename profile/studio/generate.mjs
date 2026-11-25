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
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(alt)}"><defs><style>${extraCss}text{font-kerning:normal}</style>${defs}</defs>${body}</svg>`;
const write = (name, svg) => {
  writeFileSync(`${OUT}/${name}.svg`, svg);
  if (svg.length > 60000) console.warn(`${name}.svg is ${svg.length} bytes`);
};

// Brand logos from the thesvg registry, inlined and tinted. Root presentation attributes carry over so stroke icons stay stroked.
const logoCache = {};
const logo = (file) => {
  if (!logoCache[file]) {
    const raw = readFileSync(here(`./logos/${file}.svg`), "utf8").replace(/<!--[\s\S]*?-->/g, "");
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

// ---------- logos ----------
// Inline a registry or own logo. Ids are prefixed so several inlined files never clash; tinted logos take one flat colour.
const TINT = "#E6E6E0";
const logoAt = (spec, x, y, size, pfx, tint = TINT) => {
  if (spec.file.endsWith(".png")) {
    const b64 = readFileSync(here(`./logos/${spec.file}`)).toString("base64");
    return `<image href="data:image/png;base64,${b64}" x="${x}" y="${y}" width="${size}" height="${size}"/>`;
  }
  const l = logo(spec.file);
  const attrs = spec.tint ? (/\bfill=/.test(l.attrs) ? l.attrs : `${l.attrs} fill="${tint}"`).replace(/currentColor/g, tint) : l.attrs;
  const ids = (s) => s.replace(/\bid="([^"]+)"/g, `id="${pfx}$1"`).replace(/url\(#([^)]+)\)/g, `url(#${pfx}$1)`).replace(/href="#/g, `href="#${pfx}`);
  const inner = ids(l.inner.replace(/\sstyle="[^"]*"/g, ""));
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="${l.vb}" ${spec.tint ? `color="${tint}" ` : ""}${ids(attrs).replace(/currentColor/g, tint)}>${spec.tint ? inner.replace(/currentColor/g, tint) : inner}</svg>`;
};
const LANG = { TypeScript: "typescript", Go: "go", Rust: "rust", Python: "python", Ruby: "ruby", JavaScript: "javascript", Shell: "shell", MDX: "mdx" };
const langChip = (lang, x, y, size, pfx) => (LANG[lang] ? logoAt({ file: `${LANG[lang]}-mono`, tint: true }, x, y, size, pfx, "#9A9A92") : "");

// ---------- hero: wordmark, tagline, numbers line and a static strip of product logos ----------
const HERO_PRODUCTS = (mode, t) => [
  { file: "levelrail-mono", tint: true, color: t.ink },
  { file: `thesvg-${mode}` },
  { file: `theauth-${mode}` },
  { file: `stacklit-${mode}` },
  { file: "featuredrop-default" },
  { file: "glinui.png" },
];
function hero(mode, mobile) {
  const t = THEMES[mode];
  const W = mobile ? 360 : 1200;
  const H = mobile ? 172 : 164;
  const r = mobile ? 14 : 20;
  const wm = logo(mode === "dark" ? "wm-dark" : "wm-light");
  const wmW = mobile ? 210 : 360;
  const wmH = (wmW * 90.85) / 589.59;
  const x0 = mobile ? 16 : 40;
  const wmY = mobile ? 16 : 28;
  const nums = `${data.stars.toLocaleString("en-US")} STARS  /  ${data.count} REPOS  /  TOP ${data.top.name.toUpperCase()} ${data.top.stars.toLocaleString("en-US")}`;
  const tagY = wmY + wmH + (mobile ? 24 : 32);
  const text = `<text x="${x0}" y="${tagY}" font-family="${SANS}" font-weight="500" font-size="${mobile ? 12 : 16}" fill="${t.ink}" fill-opacity=".8">${esc(config.tagline[0])}</text><text x="${x0}" y="${tagY + (mobile ? 20 : 26)}" font-family="${MONO}" font-weight="600" font-size="${mobile ? 8.5 : 10.5}" letter-spacing="${mobile ? 0.8 : 1.4}" fill="${t.mute}">${esc(nums)}</text>`;
  const tileFill = mode === "dark" ? "#17171B" : "#FFFFFF";
  const items = HERO_PRODUCTS(mode, t).slice(0, mobile ? 4 : 6);
  const size = mobile ? 30 : 46;
  const gap = mobile ? 8 : 12;
  const stripW = items.length * size + (items.length - 1) * gap;
  const sx = mobile ? x0 : W - 40 - stripW;
  const sy = mobile ? H - 16 - size : 72;
  const strip = items
    .map((it, i) => {
      const x = sx + i * (size + gap);
      const inner = size * 0.58;
      return `<rect x="${x + .5}" y="${sy + .5}" width="${size - 1}" height="${size - 1}" rx="${mobile ? 9 : 12}" fill="${tileFill}" stroke="${t.edge}" stroke-opacity="${mode === "dark" ? 0.14 : 0.16}"/>${logoAt(it.color ? { ...it, tint: true } : it, x + (size - inner) / 2, sy + (size - inner) / 2, inner, `hp${i}`, it.color ?? TINT)}`;
    })
    .join("");
  const cap = `<text x="${mobile ? sx + stripW + 12 : sx}" y="${mobile ? sy + size / 2 + 3 : sy - 14}" font-family="${MONO}" font-weight="600" font-size="${mobile ? 8.5 : 11}" letter-spacing="${mobile ? 1 : 1.6}" fill="${t.mute}">OUR PRODUCTS</text>`;
  const bgTop = mode === "dark" ? "#131316" : "#FAFAF7";
  const bgBot = mode === "dark" ? "#0D0D0F" : "#F1F0EB";
  const defs = `<linearGradient id="hbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bgTop}"/><stop offset="1" stop-color="${bgBot}"/></linearGradient><clipPath id="hclip"><rect width="${W}" height="${H}" rx="${r}"/></clipPath>`;
  const body = `<g clip-path="url(#hclip)"><rect width="${W}" height="${H}" fill="url(#hbg)"/><svg x="${x0}" y="${wmY}" width="${wmW}" height="${wmH.toFixed(1)}" viewBox="${wm.vb}">${wm.inner}</svg>${text}${cap}${strip}</g>${edge(W, H, r, t)}`;
  return wrap(W, H, `GLINR Studios, open source developer tools. ${data.stars} GitHub stars across ${data.count} public repositories, top repository ${data.top.name} with ${data.top.stars}. Products: Levelrail, theSVG, theAuth, Stacklit, featuredrop, glinui`, body, defs);
}

// ---------- link pills (themeless: dark pill reads on both page colours) ----------
function pill({ id, label, color }) {
  const w = Math.round(label.length * 7.6 + 34);
  const body = `<rect x=".5" y=".5" width="${w - 1}" height="29" rx="15" fill="#17171A" stroke="#fff" stroke-opacity=".16"/><circle cx="16" cy="15" r="3.5" fill="${color}"/><text x="27" y="19.5" font-family="${SANS}" font-weight="600" font-size="12.5" fill="#EDEDE8">${esc(label)}</text>`;
  write(`link-${id}`, wrap(w, 30, label, body));
}

// ---------- slim section headers with a chevron so they read as expandable ----------
function header(s, count, mode, mobile) {
  const t = THEMES[mode];
  const W = mobile ? 360 : 1200;
  const H = mobile ? 40 : 44;
  const r = mobile ? 12 : 14;
  const x0 = mobile ? 14 : 22;
  const cxr = W - (mobile ? 22 : 30);
  const body = `<rect width="${W}" height="${H}" rx="${r}" fill="${t.card}"/><rect x="${x0}" y="${H / 2 - 9}" width="3" height="18" rx="1.5" fill="${s.color}"/><text x="${x0 + 14}" y="${H / 2 + 5.5}" font-family="${SANS}" font-weight="700" font-size="${mobile ? 14 : 15.5}" fill="${t.ink}">${esc(s.title)}</text>${mobile ? "" : `<text x="${x0 + 14 + s.title.length * 8.6 + 18}" y="${H / 2 + 4.5}" font-family="${SANS}" font-weight="500" font-size="13" fill="${t.mute}">${esc(s.line)}</text>`}<text x="${cxr - 22}" y="${H / 2 + 4}" text-anchor="end" font-family="${MONO}" font-weight="600" font-size="10" letter-spacing="1.2" fill="${t.mute}">${count}</text><path d="M${cxr - 5} ${H / 2 - 2.5}l5 5l5 -5" fill="none" stroke="${t.mute}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>${edge(W, H, r, t)}`;
  return wrap(W, H, `${s.title}: ${s.line}`, body);
}

// ---------- tiles: calm neutral cards, a thin accent edge and a small accent icon ----------
const wrapText = (text, maxChars, maxLines) => {
  const lines = [];
  let cur = "";
  for (const w of text.split(" ")) {
    if (cur && `${cur} ${w}`.length > maxChars) { lines.push(cur); cur = w; } else cur = cur ? `${cur} ${w}` : w;
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
  const lines = [];
  let cur = "";
  for (const part of name.split("-")) {
    const next = cur ? `${cur}-${part}` : part;
    if (cur && next.length > maxChars) { lines.push(`${cur}-`); cur = part; } else cur = next;
  }
  lines.push(cur);
  return lines;
};

function tile(p, frac, mobile) {
  const full = (mobile ? 360 : 1200) * frac;
  const H = mobile ? 108 : 132;
  const m = mobile ? 3 : 4;
  const w = full - 2 * m;
  const h = H - 2 * m;
  const pad = mobile ? 11 : 18;
  const narrow = mobile && frac < 0.4;
  const s = stat(p.name);
  const c = p.fill;
  const box = mobile ? 26 : 38;
  const id = `${p.name.replace(/[^a-z0-9]/gi, "")}${Math.round(frac * 100)}${mobile ? "m" : "d"}`;
  const X = m + pad;
  const slot = `<rect x="${X}" y="${m + pad}" width="${box}" height="${box}" rx="${box * 0.26}" fill="#fff" fill-opacity=".07"/>`;
  let mark;
  if (p.logos) {
    const sz = box * 0.5;
    mark = p.logos.map((l, i) => logoAt(l, X + 6 + i * (sz + 4), m + pad + (box - sz) / 2, sz, `${id}${i}`)).join("");
  } else if (p.logo) {
    mark = logoAt(p.logo, X + box * 0.2, m + pad + box * 0.2, box * 0.6, id);
  } else mark = "";
  const slotW = p.logos ? p.logos.length * (box * 0.5 + 4) + 8 : box;
  const icon = p.logos ? `<rect x="${X}" y="${m + pad}" width="${slotW}" height="${box}" rx="${box * 0.26}" fill="#fff" fill-opacity=".07"/>${mark}` : `${slot}${mark}`;
  // Name sits beside the icon, except in narrow mobile tiles where it wraps below.
  let nameSvg;
  let y;
  if (narrow) {
    const lines = splitName(p.name, Math.floor((w - 2 * pad) / 6.6));
    nameSvg = lines.map((l, i) => `<text x="${X}" y="${m + pad + box + 16 + i * 13}" font-family="${SANS}" font-weight="700" font-size="11.5" fill="#F2F2EE">${esc(l)}</text>`).join("");
    y = 0;
  } else {
    const avail = w - 2 * pad - slotW - 10 - (mobile ? 0 : 30);
    const fs = Math.min(mobile ? 13 : 17, avail / (p.name.length * 0.58));
    nameSvg = `<text x="${X + slotW + 10}" y="${m + pad + box / 2 + fs * 0.35}" font-family="${SANS}" font-weight="700" font-size="${fs.toFixed(1)}" letter-spacing="-.2" fill="#F2F2EE">${esc(p.name)}</text>`;
    y = m + pad + box + (mobile ? 15 : 21);
  }
  const showChips = (p.chips ?? []).length > 0 && (!mobile || frac >= 0.9);
  const dFs = mobile ? 10 : 12.5;
  const lines = narrow ? [] : wrapText(p.desc, Math.floor((w - 2 * pad) / (dFs * 0.53)), 2);
  const descSvg = lines.map((l, i) => `<text x="${X}" y="${(y + i * dFs * 1.4).toFixed(1)}" font-family="${SANS}" font-weight="400" font-size="${dFs}" fill="#A9A9A1">${esc(l)}</text>`).join("");
  const cs = mobile ? 12 : 16;
  const tag = p.logos || p.name === "glinr-whitepapers" ? "" : langChip(s.lang, m + w - pad - cs, m + pad + (mobile ? 1 : 3), cs, `${id}l`);
  const stars = p.repos ? p.repos.reduce((a, r) => a + stat(r).stars, 0) : s.stars;
  const by = m + h - (mobile ? 9 : 12);
  const sz = mobile ? 10 : 12;
  const starsTxt = stars > 0 ? `${STAR(X, by - sz + 1, sz, c)}<text x="${X + sz + 5}" y="${by}" font-family="${MONO}" font-weight="600" font-size="${mobile ? 10 : 12}" fill="#C9C9C1">${fmt(stars)}</text>` : "";
  let chipSvg = "";
  if (showChips) {
    const cw = (t) => Math.round(t.length * (mobile ? 5.6 : 6.6) + 18);
    let cx = m + w - pad;
    for (const t of [...p.chips].reverse()) {
      const wd = cw(t);
      cx -= wd;
      const ch = mobile ? 16 : 20;
      chipSvg += `<rect x="${cx}" y="${by - ch + 4}" width="${wd - 6}" height="${ch}" rx="${ch / 2}" fill="#fff" fill-opacity=".07" stroke="#fff" stroke-opacity=".08"/><text x="${cx + (wd - 6) / 2}" y="${by - ch / 2 + 7}" text-anchor="middle" font-family="${MONO}" font-weight="600" font-size="${mobile ? 8 : 10}" fill="#C9C9C1">${esc(t)}</text>`;
    }
  }
  const defs = `<clipPath id="c${id}"><rect x="${m}" y="${m}" width="${w}" height="${h}" rx="${mobile ? 10 : 14}"/></clipPath><linearGradient id="d${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1A1B1F"/><stop offset="1" stop-color="#141518"/></linearGradient>`;
  const body = `<g clip-path="url(#c${id})"><rect x="${m}" y="${m}" width="${w}" height="${h}" fill="url(#d${id})"/><rect x="${m}" y="${m}" width="3" height="${h}" fill="${c}"/>${icon}${tag}${nameSvg}${descSvg}${starsTxt}${chipSvg}</g><rect x="${m + .5}" y="${m + .5}" width="${w - 1}" height="${h - 1}" rx="${mobile ? 10 : 14}" fill="none" stroke="#fff" stroke-opacity=".1"/>`;
  return wrap(full, H, `${p.name}: ${p.desc}`, body, defs);
}

// ---------- footer ----------
function footer(mode, mobile) {
  const t = THEMES[mode];
  const W = mobile ? 360 : 1200;
  const H = mobile ? 32 : 36;
  const body = `<rect width="${W}" height="${H}" rx="${H / 2.4}" fill="${t.card}"/>${edge(W, H, H / 2.4, t)}<text x="${mobile ? 14 : 22}" y="${H / 2 + 4}" font-family="${MONO}" font-weight="600" font-size="${mobile ? 9 : 10.5}" letter-spacing="1.4" fill="${t.mute}">MADE BY THE GLINR STUDIOS TEAM</text>${mobile ? "" : `<text x="${W - 22}" y="${H / 2 + 4}" text-anchor="end" font-family="${MONO}" font-weight="600" font-size="10.5" letter-spacing="1.4" fill="${t.mute}">GLINR.COM</text>`}`;
  return wrap(W, H, "Made by the GLINR Studios team", body);
}

// ---------- emit ----------
for (const mode of ["dark", "light"]) {
  for (const mobile of [false, true]) {
    const sfx = `${mode}${mobile ? "-mobile" : ""}`;
    write(`hero-${sfx}`, hero(mode, mobile));
    write(`footer-${sfx}`, footer(mode, mobile));
    for (const s of config.sections) {
      const n = s.names.length;
      write(`header-${s.id}-${sfx}`, header(s, n ? `${n} ${n === 1 ? "REPO" : "REPOS"}` : "DISCORD", mode, mobile));
    }
  }
}
config.links.forEach(pill);
const projects = config.projects;
for (const row of config.rows) {
  for (const [name, frac] of row) {
    const p = projects.find((x) => x.name === name);
    p.desc = p.desc.replace(/[\u2013\u2014]/g, ",");
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
const pills = config.links.map((l) => `<a href="${HREFS[l.id]}"><img src="${P}/link-${l.id}.svg" alt="${esc(l.label)}" height="30" /></a>`).join(" ");
const repoLink = (r) => `<a href="https://github.com/glincker/${r}">${r}</a>`;
const byName = (n) => projects.find((p) => p.name === n);
const listed = new Set(projects.flatMap((p) => [p.name, ...(p.repos ?? [])]));
const more = Object.keys(data.repos).filter((r) => !listed.has(r) && r !== ".github" && r !== "docs").sort();
const extra = {
  products: `<sub>Packaging: ${byName("ecosystem").repos.map(repoLink).join(", ")}</sub>`,
  research: `<sub>Experiments: ${byName("glinr-whitepapers").repos.slice(1).map(repoLink).join(", ")}</sub>`,
  community: `<a href="https://discord.gg/Ar5pcaZB99"><img src="https://discord.com/api/guilds/829168897080557579/widget.png?style=banner2" alt="GLINR Discord server widget" width="400" /></a>\n\n<sub>More repositories: ${more.map(repoLink).join(", ")}</sub>`,
};
const details = config.sections
  .map((s) => {
    const rows = config.rows.filter((row) => row.every(([n]) => s.names.includes(n)));
    const tiles = rows.map((row) => row.map(([n, f]) => tilePic(byName(n), f)).join("")).join("\n");
    return `<details${s.id === "products" ? " open" : ""}>\n<summary>${themed(`header-${s.id}`, `${s.title}: ${s.line}`)}</summary>\n\n<div align="center">\n\n${tiles}${tiles ? "\n\n" : ""}${extra[s.id] ?? ""}\n\n</div>\n\n</details>`;
  })
  .join("\n");
const readme = `<div align="center">

<a href="https://glinr.com">${themed("hero", `GLINR Studios, open source developer tools. ${data.stars} GitHub stars across ${data.count} public repositories`)}</a><br>
${pills}

</div>

${details}

<div align="center">

${themed("footer", "Made by the GLINR Studios team")}

<sub>Logos from <a href="https://thesvg.org">theSVG</a></sub>

</div>
`;
writeFileSync(here("../README.md"), readme);
console.log(`stars ${data.stars}, repos ${data.count}, top ${data.top.name} ${data.top.stars}`);
