import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function readDotEnv() {
  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const envPath = path.resolve(__dirname, "../.env");
    if (!fs.existsSync(envPath)) {
      return {};
    }

    const content = fs.readFileSync(envPath, "utf8");
    const entries = {};

    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) {
        continue;
      }

      const separator = line.indexOf("=");
      if (separator < 0) {
        continue;
      }

      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim().replace(/^['\"]|['\"]$/g, "");
      if (key) {
        entries[key] = value;
      }
    }

    return entries;
  } catch {
    return {};
  }
}

const envFromFile = readDotEnv();

const supabaseUrl = process.env.SUPABASE_URL ?? envFromFile.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? envFromFile.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exitCode = 1;
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const AREA_INFO = "11111111-1111-1111-1111-111111111111";
const AREA_ELEC = "22222222-2222-2222-2222-222222222222";

const users = [
  {
    email: "admin@giva.ao",
    password: "ChangeMe!12345",
    app_metadata: {
      role: "SUPER_ADMIN",
      area_id: AREA_INFO,
      scopes: ["cross_area"],
    },
    user_metadata: {
      display_name: "Administrador GIVA",
      type: "admin",
    },
  },
  {
    email: "coordenador.info@giva.ao",
    password: "ChangeMe!12345",
    app_metadata: {
      role: "ADMIN_1",
      area_id: AREA_INFO,
    },
    user_metadata: {
      display_name: "Coordenador Informatica",
      type: "admin",
    },
  },
  {
    email: "coordenador.elec@giva.ao",
    password: "ChangeMe!12345",
    app_metadata: {
      role: "ADMIN_1",
      area_id: AREA_ELEC,
    },
    user_metadata: {
      display_name: "Coordenador Electricidade",
      type: "admin",
    },
  },
  {
    email: "empresa.demo@giva.ao",
    password: "ChangeMe!12345",
    app_metadata: {
      role: "COMPANY",
      area_id: AREA_INFO,
    },
    user_metadata: {
      display_name: "Empresa Demo GIVA",
      type: "company",
    },
  },
  {
    email: "estudante.demo@giva.ao",
    password: "ChangeMe!12345",
    app_metadata: {
      role: "STUDENT",
      area_id: AREA_INFO,
    },
    user_metadata: {
      display_name: "Estudante Demo GIVA",
      type: "student",
    },
  },
  {
    email: "externo.demo@giva.ao",
    password: "ChangeMe!12345",
    app_metadata: {
      role: "EXTERNAL",
      area_id: AREA_INFO,
    },
    user_metadata: {
      display_name: "Externo Demo GIVA",
      type: "external",
    },
  },
];

async function upsertUser(user) {
  const { error: createError } = await supabase.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    app_metadata: user.app_metadata,
    user_metadata: user.user_metadata,
  });

  if (!createError) {
    console.log(`Created user ${user.email}`);
    return;
  }

  const normalized = `${createError.message ?? ""}`.toLowerCase();
  const isAlreadyRegistered =
    normalized.includes("already") ||
    normalized.includes("registered") ||
    normalized.includes("exists") ||
    normalized.includes("duplicate");

  if (isAlreadyRegistered) {
    console.log(`User ${user.email} already exists; skipped create.`);
    return;
  }

  throw createError;
}

async function main() {
  for (const user of users) {
    await upsertUser(user);
  }

  console.log("Demo users provisioned successfully.");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
