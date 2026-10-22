const { test } = require("node:test");
const assert = require("node:assert/strict");
const { existsSync } = require("node:fs");
const { join } = require("node:path");
const { countryDisplayCode, countryIsoCode, countryFlagCode } = require(".");

for (const [iso, display, flag, aliases] of [
  ["BRB", "BAR", "brb", ["BB"]],
  ["CAN", "CAN", "can", ["CA"]],
  ["GRD", "GRN", "grd", ["GD"]],
  ["LCA", "LCA", "lca", ["LC"]],
  ["VCT", "SVG", "svg", ["VC", "VIN"]],
  ["TTO", "TRI", "tto", ["TT"]],
  ["USA", "USA", "usa", ["US"]],
  ["VGB", "BVI", "vgb", ["VG", "IVB"]],
]) {
  test(`${display}: aliases share a display code, ISO identity and existing flag`, () => {
    for (const code of [iso, display, ...aliases]) {
      assert.equal(countryDisplayCode(` ${code.toLowerCase()} `), display);
      assert.equal(countryIsoCode(code), iso);
      assert.equal(countryFlagCode(code), flag);
    }
    assert.ok(existsSync(join(__dirname, "../../apps/web/public/flags", `${flag}.svg`)));
  });
}
test("unknown and rehearsal identifiers retain their identity", () => {
  for (const code of ["XTA", "XTB", "JAM", "KNA", "ZZZ"]) {
    assert.equal(countryDisplayCode(code), code);
    assert.equal(countryIsoCode(code), code);
    assert.equal(countryFlagCode(code), code.toLowerCase());
  }
  assert.equal(countryDisplayCode(null), "");
});
