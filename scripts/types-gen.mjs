// Cross-platform-Wrapper fuer `supabase gen types typescript`.
// Behebt den alten `types:gen`-Bug: bei Fehler hat das npm-Script die
// Ziel-Datei mit dem deutschen Stderr-Text ueberschrieben. Hier laeuft
// die Generierung gegen eine Tmp-Datei und wird nur bei exit 0 ueber
// die echte database.types.ts gemoved.

import { spawnSync } from "node:child_process";
import { renameSync, unlinkSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const TARGET = resolve(ROOT, "apps/web/src/lib/database.types.ts");
const TMP = `${TARGET}.tmp`;

const PROJECT_ID = process.env.SUPABASE_PROJECT_ID ?? "gsrdpwoejnuigbxhfgyr";
if (!/^[a-z0-9-]+$/.test(PROJECT_ID)) {
  console.error(`Unzulaessige SUPABASE_PROJECT_ID: ${PROJECT_ID}`);
  process.exit(1);
}

// shell:true + .cmd auf Windows; PROJECT_ID ist regex-validiert oben,
// daher keine Injection-Vektoren trotz DEP0190-Hinweis.
const useShell = process.platform === "win32";

const gen = spawnSync(
  "pnpm",
  [
    "-s",
    "dlx",
    "supabase",
    "gen",
    "types",
    "typescript",
    "--project-id",
    PROJECT_ID,
    "--schema",
    "public",
  ],
  { encoding: "utf8", shell: useShell },
);

if (gen.error) {
  console.error(`pnpm dlx konnte nicht gestartet werden: ${gen.error.message}`);
  process.exit(1);
}

if (gen.status !== 0) {
  console.error(gen.stderr || "supabase gen types fehlgeschlagen");
  if (existsSync(TMP)) unlinkSync(TMP);
  process.exit(gen.status ?? 1);
}

const out = gen.stdout;
if (!out || !out.includes("Database")) {
  console.error("Output sieht nicht nach einer Types-Datei aus, breche ab:");
  console.error(out?.slice(0, 200) ?? "(leer)");
  process.exit(1);
}

writeFileSync(TMP, out);
renameSync(TMP, TARGET);

const fmt = spawnSync("pnpm", ["-s", "exec", "prettier", "--write", TARGET], {
  encoding: "utf8",
  shell: useShell,
});
if (fmt.status !== 0) {
  console.error(fmt.stderr || "prettier --write fehlgeschlagen");
  process.exit(fmt.status ?? 1);
}

console.log(`Wrote ${TARGET} (${out.length} bytes, prettier-formatiert)`);
