const fs = require("fs");
const path = require("path");

const root = process.cwd();
const srcDir = path.join(root, "src");

// Netlify-n a saját URL-t nem localhost-ra hardcode-oljuk
const SITE_URL = process.env.URL || "http://localhost:3000";

// Subfolder prefix ("" lokál root, "/casa-ambrozia" Netlify-n)
const BASE_PATH = process.env.BASE_PATH || "";

// Kimeneti mappa: alapból dist, de Netlify-n PUBLIC alá tudjuk írni
const distDir = process.env.OUT_DIR
  ? path.join(root, process.env.OUT_DIR)
  : path.join(root, "dist");

const P = {
  translations: path.join(srcDir, "translations.json"),
  rootHtml: path.join(srcDir, "root.html"),
  layout: path.join(srcDir, "layouts", "base.html"),
  pages: path.join(srcDir, "pages"),
  partials: path.join(srcDir, "partials"),
  assets: path.join(srcDir, "assets"),
  downloads: path.join(srcDir, "downloads"),
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function cleanDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  ensureDir(dir);
}

function readUtf8(p) {
  return fs.readFileSync(p, "utf8");
}

function copyDir(src, dest) {
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function loadPartials(dir) {
  const partials = {};
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".html")) continue;
    const name = path.basename(file, ".html");
    partials[name] = readUtf8(path.join(dir, file));
  }
  return partials;
}

function applyPartials(template, partials) {
  return template.replace(/{{>\s*([a-zA-Z0-9_-]+)\s*}}/g, (_, name) => {
    if (!(name in partials)) throw new Error(`Hiányzó partial: ${name}.html`);
    return partials[name];
  });
}

function renderVars(template, vars) {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => {
    if (!(key in vars)) throw new Error(`Hiányzó kulcs: "{{${key}}}"`);
    return String(vars[key]);
  });
}

function listPages(pagesDir) {
  return fs
    .readdirSync(pagesDir)
    .filter((f) => f.endsWith(".html"))
    .map((f) => ({
      file: f,
      name: path.basename(f, ".html"), // home, about, ...
    }));
}

function pageOutputPath(lang, pageName) {
  // home.html -> /<lang>/index.html
  if (pageName === "home")
    return {
      dir: path.join(distDir, lang),
      relUrl: `/${lang}/`,
      outFile: "index.html",
    };
  // others -> /<lang>/<page>/index.html
  return {
    dir: path.join(distDir, lang, pageName),
    relUrl: `/${lang}/${pageName}/`,
    outFile: "index.html",
  };
}

function buildStructuredData(vars) {
  const data = {
    "@context": "https://schema.org",
    "@type": vars.schemaType || "LocalBusiness",
    name: vars.siteName,
    url: vars.canonicalUrl,
    image: `${vars.siteUrl}${vars.assetBase}/images/${vars.heroImage}`,
    telephone: vars.phoneRaw,
    email: vars.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: vars.address,
      addressLocality: vars.addressLocality || "",
      addressCountry: vars.addressCountry || "",
    },
  };
  return JSON.stringify(data, null, 2);
}

function writeRobots() {
  const robots = `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`;
  fs.writeFileSync(path.join(distDir, "robots.txt"), robots, "utf8");
}

function writeSitemap(urls) {
  const lastmod = new Date().toISOString().slice(0, 10);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>`,
  )
  .join("\n")}
</urlset>
`;
  fs.writeFileSync(path.join(distDir, "sitemap.xml"), xml, "utf8");
}

function main() {
  cleanDir(distDir);

  const translations = JSON.parse(readUtf8(P.translations));
  const layoutRaw = readUtf8(P.layout);
  const partials = loadPartials(P.partials);
  const pages = listPages(P.pages);

  // root redirect index.html
  if (fs.existsSync(P.rootHtml)) {
    fs.copyFileSync(P.rootHtml, path.join(distDir, "index.html"));
  }

  // assets -> dist/assets
  if (fs.existsSync(P.assets)) {
    copyDir(P.assets, path.join(distDir, "assets"));
  }
    // downloads -> dist/downloads + dist/downloads.json
  if (fs.existsSync(P.downloads)) {
    copyDir(P.downloads, path.join(distDir, "downloads"));

    const files = fs
      .readdirSync(P.downloads, { withFileTypes: true })
      .filter((d) => d.isFile())
      .map((d) => d.name)
      .filter((name) => !name.startsWith("."));

    fs.writeFileSync(
      path.join(distDir, "downloads.json"),
      JSON.stringify({ files }, null, 2),
      "utf8"
    );
  }


  const urlsForSitemap = [];

  for (const lang of Object.keys(translations)) {
    for (const page of pages) {
      const pageHtml = readUtf8(path.join(P.pages, page.file));
      const out = pageOutputPath(lang, page.name);

      ensureDir(out.dir);
      const t = translations[lang]; 
      
      const isRo = lang === "ro";
      const metaTitle = t[`metaTitle_${page.name}`] || t.metaTitle;
      const metaDescription = t[`metaDescription_${page.name}`] || t.metaDescription;

      // out.relUrl pl: "/hu/about/" vagy "/ro/"
      const currentRel = out.relUrl;

      // csere: /hu/... -> /ro/... és vissza
      const toLang = (target) => currentRel.replace(`/${lang}/`, `/${target}/`);

      // ha van BASE_PATH, prefixeld, ha nincs, legyen ""
      const base = BASE_PATH; // pl "" lokál, "/casa-ambrozia" deploynál

      const switchToRo = `${base}${toLang("ro")}`;
      const switchToHu = `${base}${toLang("hu")}`;
      const vars = {
        ...translations[lang],
        lang,
        siteUrl: SITE_URL,
        basePath: BASE_PATH,                    // "/casa-ambrozia"
        langRoot: `${BASE_PATH}/${lang}/`,      // "/casa-ambrozia/hu/" vagy "/casa-ambrozia/ro/"
        assetBase: `${BASE_PATH}/assets`,       // "/casa-ambrozia/assets"
        canonicalUrl: `${SITE_URL}${BASE_PATH}${out.relUrl}`,
        // lang switch highlight
        langRoActive: isRo ? "isActive" : "",
        langHuActive: !isRo ? "isActive" : "",
        metaTitle,
        metaDescription,
        switchToRo,
        switchToHu
      };

      vars.structuredData = buildStructuredData(vars);

      let html = applyPartials(layoutRaw, partials);
      html = html.replace("{{content}}", pageHtml);
      html = renderVars(html, vars);

      fs.writeFileSync(path.join(out.dir, out.outFile), html, "utf8");
      urlsForSitemap.push(`${SITE_URL}${out.relUrl}`);
    }
  }

  writeRobots();
  writeSitemap(urlsForSitemap);

  console.log("OK: build kész. dist/ frissítve.");
}

main();
