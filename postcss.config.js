import purgecss from "@fullhuman/postcss-purgecss";
import tailwindcss from "@tailwindcss/postcss";

const isProduction = process.env.NODE_ENV === "production";
const purgecssPlugin = purgecss.default ?? purgecss;

const dynamicSafelist = {
  standard: [
    "active",
    "done",
    "own",
    "mobile-open",
    "mobile-hidden",
    "danger",
    "success",
    "spinning",
  ],
  greedy: [
    /^material-icons/,
    /^tag/,
    /^btn/,
    /^tab/,
    /^toast/,
    /^modal/,
    /^sidebar/,
    /^chat-/,
    /^post-/,
    /^tools-/,
    /^company-/,
    /^status-/,
    /^badge-/,
    /^intern-/,
    /^timeline-/,
    /^stepper-/,
    /^create-/,
    /^partner-/,
    /^app-status/,
    /^line/,
  ],
};

const plugins = [tailwindcss()];

if (isProduction) {
  plugins.push(purgecssPlugin({
    content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
    safelist: dynamicSafelist,
    defaultExtractor(content) {
      return content.match(/[A-Za-z0-9_:/-]+/g) || [];
    },
  }));
}

export default { plugins };
