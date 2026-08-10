import fs from "node:fs";
import path from "node:path";

const inputPath = process.argv[2];
const outputPath = path.resolve(process.cwd(), "src/server/services/growth-reference-data.ts");
const MAX_AGE_DAYS = 730;
const Z_2ND = -2.053748910631823;
const Z_25TH = -0.6744897501960817;
const Z_50TH = 0;
const Z_75TH = 0.6744897501960817;
const Z_98TH = 2.053748910631823;

if (!inputPath) {
  console.error("Usage: node scripts/generate-growth-reference-data.mjs <path-to-WHOref_d.csv>");
  process.exit(1);
}

const csv = fs.readFileSync(path.resolve(process.cwd(), inputPath), "utf8").replace(/^\uFEFF/, "");
const lines = csv.split(/\r?\n/).filter(Boolean);
const header = lines.shift().split(",");
const index = new Map(header.map((name, column) => [name, column]));
const requiredColumns = [
  "sex",
  "_agedays",
  "_headc_l",
  "_headc_m",
  "_headc_s",
  "_wei_l",
  "_wei_m",
  "_wei_s",
  "_len_l",
  "_len_m",
  "_len_s"
];

for (const column of requiredColumns) {
  if (!index.has(column)) throw new Error(`Missing required CSV column: ${column}`);
}

const references = { male: [], female: [] };
const sexNames = { 1: "male", 2: "female" };

for (const line of lines) {
  const cells = line.split(",");
  const sex = sexNames[Number(cells[index.get("sex")])];
  const ageCell = cells[index.get("_agedays")];
  const ageDays = Number(ageCell);
  if (!sex || !ageCell || !Number.isInteger(ageDays) || ageDays < 0 || ageDays > MAX_AGE_DAYS) continue;

  references[sex][ageDays] = {
    d: ageDays,
    w: metricValues(cells, index, "_wei", 1000, 0),
    l: metricValues(cells, index, "_len", 1, 1),
    h: metricValues(cells, index, "_headc", 1, 1)
  };
}

for (const sex of Object.keys(references)) {
  if (references[sex].length !== MAX_AGE_DAYS + 1 || references[sex].some((row) => !row)) {
    throw new Error(`Expected complete ${sex} reference rows from age 0 through ${MAX_AGE_DAYS}`);
  }
}

const output = `// Generated from CDC WHOref_d.csv LMS data. Values are p2, p25, p50, p75, p98, L, M, S for age days 0-${MAX_AGE_DAYS}.\n// Source: https://www.cdc.gov/growth-chart-training/media/files/WHOref_d.csv\nexport type GrowthReferenceValues = [number, number, number, number, number, number, number, number];\n\nexport interface GrowthReferenceDay {\n  d: number;\n  w: GrowthReferenceValues;\n  l: GrowthReferenceValues;\n  h: GrowthReferenceValues;\n}\n\nexport const WHO_GROWTH_REFERENCE_DAYS: Record<"male" | "female", GrowthReferenceDay[]> = ${JSON.stringify({ male: references.male, female: references.female }, null, 2)};\n`;

fs.writeFileSync(outputPath, output);
console.log(`Generated ${outputPath} for ages 0-${MAX_AGE_DAYS} days.`);

function metricValues(cells, columns, prefix, multiplier, percentileDecimals) {
  const l = Number(cells[columns.get(`${prefix}_l`)]);
  const m = Number(cells[columns.get(`${prefix}_m`)]) * multiplier;
  const s = Number(cells[columns.get(`${prefix}_s`)]);
  if (![l, m, s].every(Number.isFinite)) throw new Error(`Incomplete ${prefix} LMS row`);

  return [
    percentileValue(l, m, s, Z_2ND, percentileDecimals),
    percentileValue(l, m, s, Z_25TH, percentileDecimals),
    percentileValue(l, m, s, Z_50TH, percentileDecimals),
    percentileValue(l, m, s, Z_75TH, percentileDecimals),
    percentileValue(l, m, s, Z_98TH, percentileDecimals),
    l,
    m,
    s
  ];
}

function percentileValue(l, m, s, z, decimals) {
  const value = l === 0 ? m * Math.exp(s * z) : m * Math.pow(1 + l * s * z, 1 / l);
  if (decimals === 0) return Math.round(value);
  return round(value, decimals);
}

function round(value, decimals) {
  const factor = 10 ** decimals;
  const rounded = Math.round((value + Number.EPSILON) * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}
