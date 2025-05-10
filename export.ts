import WafrnExport from "./services/wafrnExport.js";

async function run() {
  const exporter = new WafrnExport();
  await exporter.run();

  process.exit(0);
}

run();
