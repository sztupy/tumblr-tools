// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
import Database from './database.js';
import Importer from './importer.js';
import Processor from './processor.js';
import Finalizer from './finalizer.js';
import Utils from './utils.js';

async function run() {
  const db = Database('postgres://postgres:root@localhost:5432/tumblr', {
  //  skipProcessingIndices: true
  });
  await db.sequelize.sync();
  console.log("Database connected");
  // let importer = new Importer(db,'/mnt/f/tumblr/magyar-tumbli-2023-11-11.zip', {
  //   skipUntil: 'dump/klucksize/dump-65850.json'
  // });
  // await importer.run();
  // let processor = new Processor(db);
  // await processor.run();
  // let finalizer = new Finalizer(db, 'HUNGARIAN', { skipBlogUpdates: false, skipBlogMerges: false });
  // await finalizer.run();

  
};

run();
