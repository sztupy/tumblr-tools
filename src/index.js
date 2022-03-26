// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
import Database from './database.js';
import Importer from './importer.js';
import crypto from 'crypto';

async function run() {
  //const db = Database('sqlite:db.sqlite');
  const db = Database('postgres://localhost:5432/tumblr');
  await db.sequelize.sync();
  let importer = new Importer(db,'/filename.zip');
  importer.run();
};

run();
