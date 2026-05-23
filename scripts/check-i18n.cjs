const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");

function readDictionary(relativePath, variableName) {
  const filePath = path.join(ROOT, relativePath);
  const source = fs.readFileSync(filePath, "utf8");
  const executable = `${source.replace(/export default\s+\w+;?\s*$/m, "")}\nresult = ${variableName};`;
  const context = { result: null };
  vm.createContext(context);
  vm.runInContext(executable, context, { filename: filePath });
  return context.result;
}

function describe(value) {
  if (Array.isArray(value)) return `array:${value.length}`;
  if (value === null) return "null";
  return typeof value;
}

function flatten(value, prefix = "", output = new Map()) {
  if (Array.isArray(value)) {
    output.set(prefix, describe(value));
    return output;
  }

  if (value && typeof value === "object") {
    Object.keys(value)
      .sort()
      .forEach((key) => {
        flatten(value[key], prefix ? `${prefix}.${key}` : key, output);
      });
    return output;
  }

  output.set(prefix, describe(value));
  return output;
}

function compare(baseName, base, targetName, target) {
  const missing = [];
  const extra = [];
  const typeMismatches = [];

  for (const [key, type] of base.entries()) {
    if (!target.has(key)) {
      missing.push(key);
      continue;
    }
    const targetType = target.get(key);
    if (targetType !== type) {
      typeMismatches.push(`${key}: ${baseName}=${type}, ${targetName}=${targetType}`);
    }
  }

  for (const key of target.keys()) {
    if (!base.has(key)) extra.push(key);
  }

  return { missing, extra, typeMismatches };
}

const zhTW = flatten(readDictionary("src/lib/i18n/locales/zh-TW.js", "zhTW"));
const en = flatten(readDictionary("src/lib/i18n/locales/en.js", "en"));
const result = compare("zh-TW", zhTW, "en", en);

if (result.missing.length || result.extra.length || result.typeMismatches.length) {
  console.error("i18n dictionary check failed.");
  if (result.missing.length) {
    console.error("\nMissing in en:");
    result.missing.forEach((key) => console.error(`- ${key}`));
  }
  if (result.extra.length) {
    console.error("\nExtra in en:");
    result.extra.forEach((key) => console.error(`- ${key}`));
  }
  if (result.typeMismatches.length) {
    console.error("\nType or array-length mismatches:");
    result.typeMismatches.forEach((key) => console.error(`- ${key}`));
  }
  process.exit(1);
}

console.log(`i18n dictionary check passed (${zhTW.size} keys).`);
