import Processor from "./lib/processor.js";
import Finalizer from "./lib/finalizer.js";
import ZipFileImporter from "./lib/zipFileImporter.js";

async function run() {
  const importer = new ZipFileImporter("/mnt/f/tumblr/magyar-tumbli-2023-11-11.zip", {
    skipUntil: "dump/klucksize/dump-65850.json",
  });
  await importer.run();

  const processor = new Processor();
  await processor.run();

  const finalizer = new Finalizer("HUNGARIAN", {
    skipBlogUpdates: false,
    skipBlogMerges: false,
  });
  await finalizer.run();
}

run();
