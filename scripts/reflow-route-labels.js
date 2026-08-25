#!/usr/bin/env node

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { isDeepStrictEqual } = require("util");
const ts = require("typescript");
const { createClient } = require("@supabase/supabase-js");

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  module._compile(output, filename);
};

const {
  getHoldLabel,
  getRouteHoldBounds,
  resolveAllLabelOverlaps,
} = require(path.join(__dirname, "../utils/holds.ts"));

const apply = process.argv.includes("--apply");
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing Supabase service credentials");

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function fetchAll(table, columns) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

async function main() {
  const [routes, detected] = await Promise.all([
    fetchAll("routes", "id,title,photo_id,holds"),
    fetchAll("detected_holds", "id,photo_id,center,polygon"),
  ]);

  const detectedByPhoto = Map.groupBy(detected, (hold) => hold.photo_id);
  const changes = routes.flatMap((route) => {
    const handHolds = route.holds.hand_holds ?? [];
    const footHolds = route.holds.foot_holds ?? [];
    const allHolds = [...handHolds, ...footHolds];
    const bounds = getRouteHoldBounds(allHolds, detectedByPhoto.get(route.photo_id) ?? []);
    const labels = [
      ...handHolds.map((hold, index) => getHoldLabel(index, handHolds.length, hold.note)),
      ...footHolds.map((hold) => hold.note ?? ""),
    ];
    const resolved = resolveAllLabelOverlaps(allHolds, bounds, labels);
    const holds = {
      hand_holds: resolved.slice(0, handHolds.length),
      foot_holds: resolved.slice(handHolds.length),
    };
    return isDeepStrictEqual(holds, route.holds)
      ? []
      : [{ id: route.id, title: route.title, before: route.holds, after: holds }];
  });

  console.log(`${changes.length}/${routes.length} routes need reflow`);
  for (const change of changes) console.log(`${change.id}  ${change.title}`);
  if (!apply || changes.length === 0) {
    console.log(apply ? "No changes applied" : "Dry run only. Pass --apply to update routes");
    return;
  }

  const backup = `/tmp/up-app-route-labels-${new Date().toISOString().replaceAll(":", "-")}.json`;
  fs.writeFileSync(backup, JSON.stringify(changes, null, 2));

  for (const change of changes) {
    const { error } = await supabase
      .from("routes")
      .update({ holds: change.after })
      .eq("id", change.id);
    if (error) throw new Error(`${change.id}: ${error.message}`);
  }

  const { data: updated, error } = await supabase
    .from("routes")
    .select("id,holds")
    .in("id", changes.map((change) => change.id));
  if (error) throw error;
  for (const change of changes) {
    const route = updated.find((item) => item.id === change.id);
    if (!route || !isDeepStrictEqual(route.holds, change.after)) {
      throw new Error(`Verification failed for ${change.id}`);
    }
  }

  console.log(`Updated and verified ${changes.length} routes`);
  console.log(`Backup: ${backup}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
