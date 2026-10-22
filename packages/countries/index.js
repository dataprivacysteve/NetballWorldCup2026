// Event presentation codes are deliberately independent of database identifiers
// and existing flag filenames. Never use a display code as a database key.
const nations = [
  { iso: "BRB", display: "BAR", flag: "brb", aliases: ["BB"] },
  { iso: "CAN", display: "CAN", flag: "can", aliases: ["CA"] },
  { iso: "GRD", display: "GRN", flag: "grd", aliases: ["GD"] },
  { iso: "LCA", display: "LCA", flag: "lca", aliases: ["LC"] },
  { iso: "VCT", display: "SVG", flag: "svg", aliases: ["VC", "VIN"] },
  { iso: "TTO", display: "TRI", flag: "tto", aliases: ["TT"] },
  { iso: "USA", display: "USA", flag: "usa", aliases: ["US"] },
  { iso: "VGB", display: "BVI", flag: "vgb", aliases: ["VG", "IVB"] },
];
const lookup = new Map();
for (const nation of nations) {
  for (const code of [nation.iso, nation.display, ...nation.aliases]) {
    lookup.set(code, nation);
  }
}
const normalize = (code) => (code ?? "").trim().toUpperCase();

exports.countryDisplayCode = (code) => {
  const normalized = normalize(code);
  return lookup.get(normalized)?.display ?? normalized;
};
exports.countryIsoCode = (code) => {
  const normalized = normalize(code);
  return lookup.get(normalized)?.iso ?? normalized;
};
exports.countryFlagCode = (code) => {
  const normalized = normalize(code);
  return lookup.get(normalized)?.flag ?? normalized.toLowerCase();
};
