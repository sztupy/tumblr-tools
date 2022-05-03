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
}
