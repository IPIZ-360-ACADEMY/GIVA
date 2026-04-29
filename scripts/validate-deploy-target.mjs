const deployEnv = String(process.env.DEPLOY_ENV ?? "").trim().toLowerCase();
const deployTarget = String(process.env.DEPLOY_TARGET ?? "").trim().toLowerCase();

const allowedTargets = new Set(["", "gh-pages"]);

if (!allowedTargets.has(deployTarget)) {
  console.error(
    `Invalid DEPLOY_TARGET="${deployTarget}". Allowed values: "gh-pages" or empty.`,
  );
  process.exit(1);
}

if (deployEnv === "github-pages" && deployTarget !== "gh-pages") {
  console.error(
    "Invalid deploy configuration: GitHub Pages requires DEPLOY_TARGET=gh-pages.",
  );
  process.exit(1);
}

if (deployEnv === "vercel" && deployTarget === "gh-pages") {
  console.error(
    "Invalid deploy configuration: Vercel cannot run with DEPLOY_TARGET=gh-pages.",
  );
  process.exit(1);
}

const resolvedBase = deployTarget === "gh-pages" ? "/GIVA/" : "/";
console.log(
  `Deploy configuration OK. DEPLOY_ENV=${deployEnv || "(unset)"}, DEPLOY_TARGET=${deployTarget || "(unset)"}, base=${resolvedBase}`,
);