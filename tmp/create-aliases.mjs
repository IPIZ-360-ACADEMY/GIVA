/**
 * Criar auth_login_aliases para alunos I422, I776, I299304
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env");
const envContent = readFileSync(envPath, "utf-8");
const envVars = {};
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const idx = trimmed.indexOf("=");
  if (idx < 0) continue;
  envVars[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
}

const sb = createClient(envVars.VITE_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const aliases = [
  { user_id: "56384ab7-5031-4e7f-a689-6aa6084b1fbd", alias: "I422", login_email: "aluno.i422@giva.ao", account_type: "student" },
  { user_id: "56384ab7-5031-4e7f-a689-6aa6084b1fbd", alias: "aluno.i422@giva.ao", login_email: "aluno.i422@giva.ao", account_type: "student" },
  { user_id: "c461e990-c957-4678-8d32-fa6b43b6f8dc", alias: "I776", login_email: "aluno.i776@giva.ao", account_type: "student" },
  { user_id: "c461e990-c957-4678-8d32-fa6b43b6f8dc", alias: "aluno.i776@giva.ao", login_email: "aluno.i776@giva.ao", account_type: "student" },
  { user_id: "d22abad0-8296-4c91-9bcf-5da5a01c9a85", alias: "I299304", login_email: "aluno.i299304@giva.ao", account_type: "student" },
  { user_id: "d22abad0-8296-4c91-9bcf-5da5a01c9a85", alias: "aluno.i299304@giva.ao", login_email: "aluno.i299304@giva.ao", account_type: "student" },
];

for (const a of aliases) {
  const { error } = await sb.from("auth_login_aliases").upsert(a, { onConflict: "alias" });
  if (error) console.error("ERR:", a.alias, error.message);
  else console.log("OK:", a.alias);
}
console.log("Feito.");
