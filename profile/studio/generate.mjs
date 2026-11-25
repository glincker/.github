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

const ACCENT = "#f97316";
const THEMES = {
  dark: { card: "#0a0a0a", ink: "#ffffff", mute: "#9a9a9a", edge: "#fff", edgeA: 0.2, well: "#fff", wellA: 0.25 },
  light: { card: "#ffffff", ink: "#111111", mute: "#6b6b6b", edge: "#111", edgeA: 1, well: "#e5e5e5", wellA: 1 },
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

// ---------- alt text, shared by the README images and the SVG title and desc ----------
const lowerFirst = (x) => x.charAt(0).toLowerCase() + x.slice(1);
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const tileStars = (p) => (p.repos ? p.repos.reduce((a, r) => a + stat(r).stars, 0) : stat(p.name).stars);
const altHero = `GLINR Studios logo. Open source developer tools by GLINR Studios, ${plural(data.count, "public repository").replace("repositorys", "repositories")} and ${data.stars.toLocaleString("en-US")} GitHub stars`;
const altHeader = (s) => `${s.title}, ${lowerFirst(s.line)}`;
const MORE = { id: "more", title: "More from GLINR Studios", line: "Developer tools, libraries, curated lists, research and community" };
const altTile = (p) => {
  const lang = p.logos || p.name === "ecosystem" ? "" : stat(p.name).lang;
  const base = `${p.name}, GLINR Studios open source repository on GitHub. ${p.desc.replace(/\.$/, "")}.`;
  return `${base}${lang ? ` ${lang} project with ${plural(tileStars(p), "GitHub star")}.` : ` ${plural(tileStars(p), "GitHub star")}.`}`;
};
const altFooter = "Made by the GLINR Studios team, glinr.com";

// ---------- shared svg helpers ----------
const wrap = (w, h, alt, body, defs = "", extraCss = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(alt)}"><title>${esc(alt)}</title><desc>${esc(alt)}</desc><defs><style>${extraCss}text{font-kerning:normal}</style>${defs}</defs>${body}</svg>`;
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
// Inline a full-colour logo. Ids are prefixed so several inlined files never clash.
const logoAt = (spec, x, y, size, pfx) => {
  const file = typeof spec === "string" ? spec : spec.file;
  if (file.endsWith(".png")) {
    const b64 = readFileSync(here(`./logos/${file}`)).toString("base64");
    return `<image href="data:image/png;base64,${b64}" x="${x}" y="${y}" width="${size}" height="${size}"/>`;
  }
  const l = logo(file);
  const ids = (s) => s.replace(/\bid="([^"]+)"/g, `id="${pfx}$1"`).replace(/url\(#([^)]+)\)/g, `url(#${pfx}$1)`).replace(/href="#/g, `href="#${pfx}`)
    .replace(/\bclass="([^"]+)"/g, (_, c) => `class="${c.split(" ").map((k) => pfx + k).join(" ")}"`)
    .replace(/<style>([\s\S]*?)<\/style>/g, (_, css) => `<style>${css.replace(/\.([A-Za-z_][\w-]*)/g, `.${pfx}$1`)}</style>`);
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="${l.vb}" ${ids(l.attrs)}>${ids(l.inner.replace(/\sstyle="[^"]*"/g, ""))}</svg>`;
};
// A white well keeps full-colour logos readable on both themes.
const well = (file, x, y, size, pfx, t) => {
  const pad = size >= 40 ? 6 : size * 0.15;
  return `<rect x="${x + .5}" y="${y + .5}" width="${size - 1}" height="${size - 1}" rx="${size >= 40 ? 10 : 8}" fill="#fff" stroke="${t.well}" stroke-opacity="${t.wellA}"/>${logoAt(file, x + pad, y + pad, size - 2 * pad, pfx)}`;
};
const LANG = { TypeScript: "typescript", Go: "go", Rust: "rust", Python: "python", Ruby: "ruby", JavaScript: "javascript", MDX: "mdx" };
const langChip = (lang, x, y, size, pfx, t) => (LANG[lang] ? well(`${LANG[lang]}-${lang === "Go" ? "light" : "default"}`, x, y, size, pfx, t) : "");

// ---------- hero: wordmark, tagline, numbers line and a static strip of product logos ----------
const HERO_PRODUCTS = ["levelrail-default", "thesvg-default", "theauth-default", "stacklit-light", "featuredrop-default", "glinui.png"];
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
  const text = `<text x="${x0}" y="${tagY}" font-family="${SANS}" font-weight="500" font-size="${mobile ? 12 : 16}" fill="${t.ink}">${esc(config.tagline[0])}</text><text x="${x0}" y="${tagY + (mobile ? 20 : 26)}" font-family="${MONO}" font-weight="600" font-size="${mobile ? 8.5 : 10.5}" letter-spacing="${mobile ? 0.8 : 1.4}" fill="${t.mute}">${esc(nums)}</text>`;
  const items = HERO_PRODUCTS.slice(0, mobile ? 4 : 6);
  const size = mobile ? 30 : 46;
  const gap = mobile ? 8 : 12;
  const stripW = items.length * size + (items.length - 1) * gap;
  const sx = mobile ? x0 : W - 40 - stripW;
  const sy = mobile ? H - 16 - size : 72;
  const strip = items.map((file, i) => well(file, sx + i * (size + gap), sy, size, `hp${i}`, t)).join("");
  const cap = `<text x="${mobile ? sx + stripW + 12 : sx}" y="${mobile ? sy + size / 2 + 3 : sy - 14}" font-family="${MONO}" font-weight="600" font-size="${mobile ? 8.5 : 11}" letter-spacing="${mobile ? 1 : 1.6}" fill="${t.mute}">OUR PRODUCTS</text>`;
  const defs = `<clipPath id="hclip"><rect width="${W}" height="${H}" rx="${r}"/></clipPath>`;
  const body = `<g clip-path="url(#hclip)"><rect width="${W}" height="${H}" fill="${t.card}"/>${mobile ? "" : `<rect x="14" y="14" width="3" height="14" rx="1.5" fill="${ACCENT}"/>`}<svg x="${x0}" y="${wmY}" width="${wmW}" height="${wmH.toFixed(1)}" viewBox="${wm.vb}">${wm.inner}</svg>${text}${cap}${strip}</g>${edge(W, H, r, t)}`;
  return wrap(W, H, altHero, body, defs);
}

// ---------- link pills: bordered, transparent fill, one orange dot ----------
function pill({ id, label, alt }, mode) {
  const t = THEMES[mode];
  const w = Math.round(label.length * 7.6 + 34);
  const body = `<rect x=".5" y=".5" width="${w - 1}" height="29" rx="15" fill="none" stroke="${t.edge}" stroke-opacity="${t.edgeA}"/><circle cx="16" cy="15" r="3.5" fill="${ACCENT}"/><text x="27" y="19.5" font-family="${SANS}" font-weight="600" font-size="12.5" fill="${t.ink}">${esc(label)}</text>`;
  write(`link-${id}-${mode}`, wrap(w, 30, alt, body));
}

// ---------- slim section headers with a chevron so they read as expandable ----------
function header(s, count, mode, mobile, chevron = true) {
  const t = THEMES[mode];
  const W = mobile ? 360 : 1200;
  const H = mobile ? 40 : 44;
  const r = mobile ? 12 : 14;
  const x0 = mobile ? 14 : 22;
  const cxr = W - (mobile ? 22 : 30);
  const body = `<rect width="${W}" height="${H}" rx="${r}" fill="${t.card}"/><rect x="${x0}" y="${H / 2 - 9}" width="3" height="18" rx="1.5" fill="${ACCENT}"/><text x="${x0 + 14}" y="${H / 2 + 5.5}" font-family="${SANS}" font-weight="700" font-size="${mobile ? 14 : 15.5}" fill="${t.ink}">${esc(s.title)}</text>${mobile ? "" : `<text x="${x0 + 14 + s.title.length * 8.6 + 18}" y="${H / 2 + 4.5}" font-family="${SANS}" font-weight="500" font-size="13" fill="${t.mute}">${esc(s.line)}</text>`}<text x="${chevron ? cxr - 22 : cxr + 5}" y="${H / 2 + 4}" text-anchor="end" font-family="${MONO}" font-weight="600" font-size="10" letter-spacing="1.2" fill="${t.mute}">${count}</text>${chevron ? `<path d="M${cxr - 5} ${H / 2 - 2.5}l5 5l5 -5" fill="none" stroke="${ACCENT}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>` : ""}${edge(W, H, r, t)}`;
  return wrap(W, H, altHeader(s), body);
}

// ---------- tiles: bordered neutral cards, logo in a white well, one orange accent for stars ----------
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

function tile(p, frac, mobile, mode) {
  const t = THEMES[mode];
  const full = (mobile ? 360 : 1200) * frac;
  const H = mobile ? 108 : 132;
  const m = mobile ? 3 : 4;
  const w = full - 2 * m;
  const h = H - 2 * m;
  const pad = mobile ? 11 : 18;
  const narrow = mobile && frac < 0.4;
  const s = stat(p.name);
  const box = mobile ? 28 : 40;
  const pd = mobile ? 4 : 6;
  const id = `${p.name.replace(/[^a-z0-9]/gi, "")}${Math.round(frac * 100)}${mobile ? "m" : "d"}`;
  const X = m + pad;
  const files = p.logos ?? [p.logo];
  const lg = box - 2 * pd;
  const slotW = files.length * lg + (files.length - 1) * 4 + 2 * pd;
  const icon = `<rect x="${X + .5}" y="${m + pad + .5}" width="${slotW - 1}" height="${box - 1}" rx="${mobile ? 8 : 10}" fill="#fff" stroke="${t.well}" stroke-opacity="${t.wellA}"/>${files.map((f, i) => logoAt(f, X + pd + i * (lg + 4), m + pad + pd, lg, `${id}${i}`)).join("")}`;
  // Name sits beside the icon, except in narrow mobile tiles where it wraps below.
  let nameSvg;
  let y;
  if (narrow) {
    const lines = splitName(p.name, Math.floor((w - 2 * pad) / 6.6));
    nameSvg = lines.map((l, i) => `<text x="${X}" y="${m + pad + box + 16 + i * 13}" font-family="${SANS}" font-weight="700" font-size="11.5" fill="${t.ink}">${esc(l)}</text>`).join("");
    y = 0;
  } else {
    const avail = w - 2 * pad - slotW - 10 - (mobile ? 0 : 36);
    const fs = Math.min(mobile ? 13 : 17, avail / (p.name.length * 0.58));
    nameSvg = `<text x="${X + slotW + 10}" y="${m + pad + box / 2 + fs * 0.35}" font-family="${SANS}" font-weight="700" font-size="${fs.toFixed(1)}" letter-spacing="-.2" fill="${t.ink}">${esc(p.name)}</text>`;
    y = m + pad + box + (mobile ? 15 : 21);
  }
  const showChips = (p.chips ?? []).length > 0 && (!mobile || frac >= 0.9);
  const dFs = mobile ? 10 : 12.5;
  const lines = narrow ? [] : wrapText(p.desc, Math.floor((w - 2 * pad) / (dFs * 0.53)), 2);
  const descSvg = lines.map((l, i) => `<text x="${X}" y="${(y + i * dFs * 1.4).toFixed(1)}" font-family="${SANS}" font-weight="400" font-size="${dFs}" fill="${t.mute}">${esc(l)}</text>`).join("");
  const cw = mobile ? 20 : 26;
  const tag = p.logos || p.name === "glinr-whitepapers" ? "" : langChip(s.lang, m + w - pad - cw, m + pad, cw, `${id}l`, t);
  const stars = p.repos ? p.repos.reduce((a, r) => a + stat(r).stars, 0) : s.stars;
  const by = m + h - (mobile ? 9 : 12);
  const sz = mobile ? 10 : 12;
  const starsTxt = stars > 0 ? `${STAR(X, by - sz + 1, sz, ACCENT)}<text x="${X + sz + 5}" y="${by}" font-family="${MONO}" font-weight="700" font-size="${mobile ? 10 : 12}" fill="${ACCENT}">${fmt(stars)}</text>` : "";
  let chipSvg = "";
  if (showChips) {
    const cwd = (c) => Math.round(c.length * (mobile ? 5.6 : 6.6) + 18);
    let cx = m + w - pad;
    for (const c of [...p.chips].reverse()) {
      const wd = cwd(c);
      cx -= wd;
      const ch = mobile ? 16 : 20;
      chipSvg += `<rect x="${cx + .5}" y="${by - ch + 4.5}" width="${wd - 7}" height="${ch - 1}" rx="${ch / 2}" fill="none" stroke="${t.edge}" stroke-opacity="${t.edgeA * 0.6}"/><text x="${cx + (wd - 6) / 2}" y="${by - ch / 2 + 7}" text-anchor="middle" font-family="${MONO}" font-weight="600" font-size="${mobile ? 8 : 10}" fill="${t.ink}">${esc(c)}</text>`;
    }
  }
  const rx = mobile ? 10 : 14;
  const defs = `<clipPath id="c${id}"><rect x="${m}" y="${m}" width="${w}" height="${h}" rx="${rx}"/></clipPath><filter id="s${id}" x="-5%" y="-10%" width="110%" height="130%"><feDropShadow dx="0" dy="1" stdDeviation=".8" flood-color="#000" flood-opacity=".06"/><feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000" flood-opacity=".04"/></filter>`;
  const body = `<rect x="${m}" y="${m}" width="${w}" height="${h}" rx="${rx}" fill="${t.card}"${mode === "light" ? ` filter="url(#s${id})"` : ""}/><g clip-path="url(#c${id})">${icon}${tag}${nameSvg}${descSvg}${starsTxt}${chipSvg}</g><rect x="${m + .5}" y="${m + .5}" width="${w - 1}" height="${h - 1}" rx="${rx}" fill="none" stroke="${t.edge}" stroke-opacity="${t.edgeA}"/>`;
  return wrap(full, H, altTile(p), body, defs);
}

// ---------- footer ----------
function footer(mode, mobile) {
  const t = THEMES[mode];
  const W = mobile ? 360 : 1200;
  const H = mobile ? 32 : 36;
  const body = `<rect width="${W}" height="${H}" rx="${H / 2.4}" fill="${t.card}"/>${edge(W, H, H / 2.4, t)}<text x="${mobile ? 14 : 22}" y="${H / 2 + 4}" font-family="${MONO}" font-weight="600" font-size="${mobile ? 9 : 10.5}" letter-spacing="1.4" fill="${t.mute}">MADE BY THE GLINR STUDIOS TEAM</text>${mobile ? "" : `<text x="${W - 22}" y="${H / 2 + 4}" text-anchor="end" font-family="${MONO}" font-weight="600" font-size="10.5" letter-spacing="1.4" fill="${t.mute}">GLINR.COM</text>`}`;
  return wrap(W, H, altFooter, body);
}

// ---------- emit ----------
const projects = config.projects;
const byName = (n) => projects.find((p) => p.name === n);
const listed = new Set(projects.flatMap((p) => [p.name, ...(p.repos ?? [])]));
const more = Object.keys(data.repos).filter((r) => !listed.has(r) && r !== ".github" && r !== "docs").sort();
const secondary = config.sections.slice(1).flatMap((sec) => sec.names.flatMap((n) => [n, ...(byName(n).repos ?? [])]));
const moreCount = new Set([...secondary, ...more]).size;
for (const mode of ["dark", "light"]) {
  for (const mobile of [false, true]) {
    const sfx = `${mode}${mobile ? "-mobile" : ""}`;
    write(`hero-${sfx}`, hero(mode, mobile));
    write(`footer-${sfx}`, footer(mode, mobile));
    const [first, ...rest] = config.sections;
    write(`header-products-${sfx}`, header(first, plural(first.names.length, "REPO").replace("REPOs", "REPOS"), mode, mobile));
    write(`header-more-${sfx}`, header(MORE, plural(moreCount, "REPO").replace("REPOs", "REPOS"), mode, mobile));
    for (const sec of rest) {
      const n = sec.names.length;
      write(`sub-${sec.id}-${sfx}`, header(sec, n ? plural(n, "REPO").replace("REPOs", "REPOS") : "DISCORD", mode, mobile, false));
    }
    for (const row of config.rows) {
      for (const [name, frac] of row) {
        const p = projects.find((x) => x.name === name);
        p.desc = p.desc.replace(/[\u2013\u2014]/g, ",");
        if (p.desc.length > 90) console.warn(`${name} description is ${p.desc.length} chars`);
        write(`tile-${name}-${sfx}`, tile(p, frac, mobile, mode));
      }
    }
  }
  config.links.forEach((l) => pill(l, mode));
}

// ---------- README ----------
// Relative paths resolve from profile/README.md. Mobile sources win below 640px; dark sources follow the viewer's colour scheme.
const P = "studio/out";
const themed = (name, alt, width = "100%") =>
  `<picture><source media="(max-width: 640px) and (prefers-color-scheme: dark)" srcset="${P}/${name}-dark-mobile.svg" /><source media="(max-width: 640px)" srcset="${P}/${name}-light-mobile.svg" /><source media="(prefers-color-scheme: dark)" srcset="${P}/${name}-dark.svg" /><img src="${P}/${name}-light.svg" alt="${esc(alt)}" width="${width}" /></picture>`;
const tilePic = (p, frac) =>
  `<a href="https://github.com/glincker/${p.name}"><picture><source media="(max-width: 640px) and (prefers-color-scheme: dark)" srcset="${P}/tile-${p.name}-dark-mobile.svg" /><source media="(max-width: 640px)" srcset="${P}/tile-${p.name}-light-mobile.svg" /><source media="(prefers-color-scheme: dark)" srcset="${P}/tile-${p.name}-dark.svg" /><img src="${P}/tile-${p.name}-light.svg" alt="${esc(altTile(p))}" width="${(frac * 100).toFixed(1)}%" /></picture></a>`;
const HREFS = { github: "https://github.com/glincker", glinr: "https://glinr.com", discord: "https://discord.gg/Ar5pcaZB99", thesvg: "https://thesvg.org", levelrail: "https://levelrail.com" };
const pills = config.links.map((l) => `<a href="${HREFS[l.id]}"><picture><source media="(prefers-color-scheme: dark)" srcset="${P}/link-${l.id}-dark.svg" /><img src="${P}/link-${l.id}-light.svg" alt="${esc(l.alt)}" height="30" /></picture></a>`).join(" ");
const repoLink = (r) => `<a href="https://github.com/glincker/${r}">${r}</a>`;
const extra = {
  products: `<sub>Packaging: ${byName("ecosystem").repos.map(repoLink).join(", ")}</sub>`,
  research: `<sub>Experiments: ${byName("glinr-whitepapers").repos.slice(1).map(repoLink).join(", ")}</sub>`,
  community: `<a href="https://discord.gg/Ar5pcaZB99"><img src="https://discord.com/api/guilds/829168897080557579/widget.png?style=banner2" alt="GLINR Discord server, members online and invite link" width="400" /></a>`,
};
const tilesOf = (sec) => config.rows.filter((row) => row.every(([n]) => sec.names.includes(n))).map((row) => row.map(([n, f]) => tilePic(byName(n), f)).join("")).join("\n");
const block = (sec, name, alt) => `${themed(name, alt)}\n\n${tilesOf(sec)}${tilesOf(sec) ? "\n\n" : ""}${extra[sec.id] ?? ""}`;
const [first, ...rest] = config.sections;
const products = `<details open>\n<summary>${themed("header-products", altHeader(first))}</summary>\n\n<div align="center">\n\n${tilesOf(first)}\n\n${extra.products}\n\n</div>\n\n</details>`;
const secondaryBlocks = rest.map((sec) => block(sec, `sub-${sec.id}`, altHeader(sec))).join("\n\n");
const moreDetails = `<details>\n<summary>${themed("header-more", altHeader(MORE))}</summary>\n\n<div align="center">\n\n${secondaryBlocks}\n\n<sub>Also on GitHub: ${more.map(repoLink).join(", ")}</sub>\n\n</div>\n\n</details>`;
const L = (r, label) => `<a href="https://github.com/glincker/${r}">${label}</a>`;
const intro = `<sub>GLINR Studios builds open source developer tools: ${L("levelrail", "Levelrail")} for self-hosted deploys, ${L("thesvg", "theSVG")} the open SVG brand library, ${L("theauth", "theAuth")} for AI agent and human auth, ${L("stacklit", "Stacklit")} for codebase context, and more. Free, open source, MIT.</sub>`;
const readme = `<div align="center">

<a href="https://glinr.com">${themed("hero", altHero)}</a><br>
${pills}

${intro}

</div>

${products}

${moreDetails}

<div align="center">

${themed("footer", altFooter)}

<sub>Logos from <a href="https://thesvg.org">theSVG</a></sub>

</div>
`;
writeFileSync(here("../README.md"), readme);
console.log(`stars ${data.stars}, repos ${data.count}, top ${data.top.name} ${data.top.stars}`);
