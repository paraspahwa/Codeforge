import fs from "node:fs";
import path from "node:path";

const appDir = path.resolve("apps/web/app");
const src = fs.readFileSync(path.join(appDir, "globals.css"), "utf8");
const lines = src.split(/\r?\n/);
const stylesDir = path.join(appDir, "styles");
fs.mkdirSync(stylesDir, { recursive: true });
fs.writeFileSync(path.join(stylesDir, "base.css"), `${lines.slice(0, 27).join("\n")}\n`);
fs.writeFileSync(path.join(stylesDir, "app-shell.css"), `${lines.slice(27, 193).join("\n")}\n`);
fs.writeFileSync(path.join(stylesDir, "components.css"), lines.slice(193).join("\n"));
fs.writeFileSync(
  path.join(appDir, "globals.css"),
  `@import "./styles/base.css";\n@import "./styles/app-shell.css";\n@import "./styles/components.css";\n`,
);
console.log("globals.css split complete");
