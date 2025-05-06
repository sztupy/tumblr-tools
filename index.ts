// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
import Importer from "./lib/importer.js";
import Processor from "./lib/processor.js";
import Finalizer from "./lib/finalizer.js";

async function run() {
  const importer = new Importer("/mnt/f/tumblr/magyar-tumbli-2023-11-11.zip", {
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
