import Sequelize from 'sequelize';
import Finalizer from './finalizer.js';

export default class Utils {
  constructor(database, options = {}) {
    this.database = database;
    this.finalizer = options.finalizer || new Finalizer(database);
  }

  async mergeBlogs(source, destination, meta = {}) {
    if (source == destination) return;
    if (!source) return;
    if (!destination) return;

    const sourceBlog = await this.database.Blog.findOne({ where: { name: source } });
    const destinationBlog = await this.database.Blog.findOne({where: { name: destination }});

    if (!sourceBlog) return;
    if (!destinationBlog) return;

    const sourceBlogName = await this.database.BlogName.findOne({where: {name: sourceBlog.name}});
    const destinationBlogName = await this.database.BlogName.findOne({where: {name: destinationBlog.name}});

    if (!sourceBlogName) return;
    if (!destinationBlogName) return;

    this.currentImport = await this.database.Import.findOne({ order: [ [ 'id','DESC'] ] });

    await this.database.BlogLinks.create({
      type: 'manual',
      sourceId: sourceBlogName.id,
      destinationId: destinationBlogName.id,
      importId: this.currentImport.id,
      meta: meta
    });

    await this.database.Stats.destroy({ where : { blogId: [ sourceBlog.id, destinationBlog.id ]}});
    await this.database.BlogName.update({ blogId: destinationBlog.id }, { where: { blogId: sourceBlog.id } });

    let newBlogNames = await this.database.BlogName.findAll({ where: { blogId: destinationBlog.id } });
    await this.database.Stats.destroy({ where : { blogNameId: newBlogNames.map(blogName => blogName.id)}});
    await sourceBlog.destroy();

    await this.finalizer.runStats(destination);
  }

  async getSpans() {
    console.log("Obtaining timespans");
    let spans = {};
    spans.all = {};
    spans.all.start = {};
    spans.all.start.date = (await this.database.sequelize.query("SELECT MIN(date) date FROM posts WHERE date>'2006-01-01';"))[0][0]['date'];
    spans.all.start.id = (await this.database.sequelize.query("SELECT MIN(tumblr_id) id FROM posts;"))[0][0]['id'];
    spans.all.end = {};
    spans.all.end.date = (await this.database.sequelize.query("SELECT MAX(date) date FROM posts;"))[0][0]['date'];
    spans.all.end.id = (await this.database.sequelize.query("SELECT MAX(tumblr_id) id FROM posts WHERE date = ?;", { replacements: [ spans.all.end.date ]}))[0][0]['id'];

    for (let year = 2009; year <= new Date().getFullYear(); year++) {
      spans[year] = {};
      spans[year].start = {};
      spans[year].start.date = (await this.database.sequelize.query("SELECT MAX(date) date FROM posts WHERE date<'"+(year==2009 ? '1900' : year)+"-01-01';"))[0][0]['date'];
      spans[year].start.id = (await this.database.sequelize.query("SELECT MAX(tumblr_id) id FROM posts WHERE date = ?;", { replacements: [ spans[year].start.date ]}))[0][0]['id'];
      spans[year].end = {};
      spans[year].end.date = (await this.database.sequelize.query("SELECT MIN(date) date FROM posts WHERE date>'"+(year+1)+"-01-01';"))[0][0]['date'];
      spans[year].end.id = (await this.database.sequelize.query("SELECT MIN(tumblr_id) id FROM posts WHERE date = ?;", { replacements: [ spans[year].end.date ]}))[0][0]['id'];
      if (spans[year].end.date === null) {
        spans[year].end = spans.all.end;
        spans.current = spans[year];
        delete spans[year];
        break;
      }
    }

    return spans;
  }

  async assignLatestBlogName(id) {
    await this.database.sequelize.query("update blogs set name = (select name from (select blog_names.name as name, max(contents.tumblr_id) as maxid from blog_names join contents on contents.blog_name_id = blog_names.id where blog_names.blog_id = blogs.id group by blog_names.name) order by maxid desc limit 1) where blogs.id = ?", { replacements: [ id ] });
  }
}