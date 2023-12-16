// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
import Database from '../database.js';
import Utils from '../utils.js';

async function run() {
  //const db = Database('sqlite:db.sqlite');
  const db = Database('postgres://localhost:5432/tumblr', {
  //  skipProcessingIndices: true
  });
  await db.sequelize.sync();
  console.log("Database connected");
  let utils = new Utils(db);
  let spans = await utils.getSpans();

  // for (const spanName in spans) {
  //   let span = spans[spanName];

  //   let [results, ] = await db.sequelize.query(`SELECT count(distinct a.tumblr_id) from
  //   (
  //     select tumblr_id from contents join blog_names on contents.blog_name_id = blog_names.id and blog_names.blog_id is not null

  //   union

  //     select root_tumblr_id from posts join blog_names on root_blog_name_id = blog_names.id and blog_names.blog_id is not null
  //   ) a
  //   where a.tumblr_id > ${span.start.id} and a.tumblr_id < ${span.end.id};`);

  //   for (const result of results) {
  //     console.log(spanName+" "+result['count']);
  //   }
  // }

  // for (const spanName in spans) {
  //   let span = spans[spanName];

  //   let [results, ] = await db.sequelize.query(`SELECT count(distinct tumblr_id) from contents join content_languages on contents.id = content_languages.content_id
  //   where tumblr_id > ${span.start.id} and tumblr_id < ${span.end.id} and language_id = 2;`);

  //   for (const result of results) {
  //     console.log(spanName+" "+result['count']);
  //   }
  // }
};

run();
