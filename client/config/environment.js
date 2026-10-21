const fs = require("node:fs");
const path = require("node:path");
const { parseEnv } = require("node:util");

// Keep the existing .env precedence without placing server credentials in the bundle.
function loadEnvironment(directory, mode, target = process.env) {
  const files = [`.env.${mode}.local`, mode !== "test" && ".env.local", `.env.${mode}`, ".env"].filter(Boolean);
  for (const file of files) {
    const filename = path.join(directory, file);
    if (!fs.existsSync(filename)) continue;
    const values = parseEnv(fs.readFileSync(filename, "utf8"));
    const expand = (key, seen = new Set()) => {
      if (Object.hasOwn(target, key)) return target[key];
      if (seen.has(key)) throw new Error(`Circular environment reference in ${file}: ${key}`);
      seen.add(key);
      return (values[key] || "").replace(/(\\)?\$(?:\{([\w]+)(?::-([^}]*))?\}|([\w]+))/g, (match, escaped, braced, fallback, plain) => {
        if (escaped) return match.slice(1);
        const value = expand(braced || plain, new Set(seen));
        return value || fallback || "";
      });
    };
    const expanded = Object.fromEntries(Object.keys(values).map(key => [key, expand(key)]));
    for (const [key, value] of Object.entries(expanded)) if (!Object.hasOwn(target, key)) target[key] = value;
  }
  return target;
}

function publicEnvironment(mode, environment = process.env) {
  return { ...Object.fromEntries(Object.entries(environment).filter(([key]) => /^REACT_APP_/i.test(key))), NODE_ENV: mode, PUBLIC_URL: (environment.PUBLIC_URL || "").replace(/\/$/, "") };
}
module.exports = { loadEnvironment, publicEnvironment };
