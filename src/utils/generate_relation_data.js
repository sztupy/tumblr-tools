// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
import Database from '../database.js';
import Utils from '../utils.js';

async function run() {
  //const db = Database('sqlite:db.sqlite');
  const db = Database('postgres://postgres:root@localhost:5432/tumblr', {
  //  skipProcessingIndices: true
  });
  await db.sequelize.sync();
  console.log("Database connected");
  let utils = new Utils(db);
  let spans = await utils.getSpans();

  let blogs = await db.Blog.findAll({ order: ['name']});

  for (const blog of blogs) {
    for (const spanName in spans) {
      let span = spans[spanName];

      let [results, ] = await db.sequelize.query("select blogs.name, count(*) all, count(distinct bc.tumblr_id) count from post_contents a join post_contents b on a.post_id = b.post_id and a.position = b.position - 1 join contents ac on a.content_id = ac.id join contents bc on b.content_id = bc.id join blog_names ab on ac.blog_name_id = ab.id join blogs on ab.blog_id = blogs.id where blogs.id != " + blog.id + " and bc.blog_name_id in (select id from blog_names where blog_id = " + blog.id + ") and bc.tumblr_id > " + span.start.id + " and bc.tumblr_id < " + span.end.id + " group by blogs.name order by count(distinct bc.tumblr_id) desc limit 50;");

      for (const result of results) {
        console.log(blog.name + " " + result['name'] + " " + spanName + " " + result['all'] + " " + result['count']);
      }
    }
  }
};

run();
