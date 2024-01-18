import Sequelize from 'sequelize';
import Utils from './utils.js';

export default class Finalizer {
  constructor(database, targetLanguage = "HUNGARIAN", options = {}) {
    this.targetLanguage = targetLanguage;
    this.minimumPercentage = options['minimumLanguagePercentage'] || 10;
    this.minimumContents = options['minimumContents'] || 1000;
    this.minimumContentPercentage = options['minimumContentPercentage'] || 75;
    this.database = database;
    this.options = options;

    this.cachedBlogs = {};
    this.cachedBlogNames = {};
    this.cachedLanguages = {};

    this.stats = {};

    this.currentImport = null;

    this.utils = options.utils || new Utils(database, { finalizer: this });
  }

  async initialize() {
    this.currentImport = await this.database.Import.findOne({ order: [ [ 'id','DESC'] ] });
    if (typeof this.targetLanguage === 'string') {
      this.targetLanguage = await this.database.Language.findOne({ where: { name: this.targetLanguage }});
    }
  }

  async run() {
    await this.initialize();

    if (!this.options['skipBlogUpdates']) {
      console.log("Obtaining blogs tied to the target language");
      let [result, ] = await this.database.sequelize.query("select blog_names.name, count(contents.id)*100 total, coalesce(sum(percentage),0) hun, coalesce(sum(percentage),0)::float/count(contents.id)::float percen from blog_names join contents on blog_names.id = contents.blog_name_id left join content_languages on language_id = ? and content_id = contents.id group by blog_names.name having coalesce(sum(percentage),0) > ? and coalesce(sum(percentage),0)::float/count(contents.id)::float > ? order by percen desc;",{
        replacements: [this.targetLanguage.id, this.minimumContents, this.minimumPercentage],
        type: Sequelize.QueryTypes.RAW,
      });

      let transaction = await this.database.sequelize.transaction();
      console.log("Making sure blogs exist in the database");
      await Promise.all(result.map(blog => this.getBlog(transaction, blog.name)));
      await transaction.commit();
    }

    if (!this.options['skipBlogMerges']) {
      console.log("Merging blogs");
      let blogs = await this.database.Blog.findAll();
      const transaction = await this.database.sequelize.transaction();

      for (const blog of blogs) {
        let blogName = await this.database.BlogName.findOne({ where: { name: blog.name }, transaction: transaction });

        if (!blogName) {
          blogName = await this.getBlogName(transaction, blog.name);
        }

        if (!blogName.blogId) {
          blogName.blogId = blog.id;
          await blogName.save({ transaction: transaction });
        }

        let links = await this.database.BlogLinks.findAll({ where: { sourceId: blogName.id, type: 'rename' }, transaction: transaction });
        if (links.length > 0) {
          for (const link of links) {
            let destinationBlogName = await this.database.BlogName.findByPk(link.destinationId, { transaction: transaction });

            if (destinationBlogName.blogId) {
              if (destinationBlogName.blogId != blog.id) {
                console.log("Merging blog " + destinationBlogName.name + " into " + blog.name + " with others");
                await this.database.sequelize.query("UPDATE blog_names SET blog_id = ? WHERE blog_id = ?", {
                  replacements: [blog.id, destinationBlogName.blogId],
                  transaction: transaction
                });
              }
            } else {
              console.log("Merging blog " + destinationBlogName.name + " into " + blog.name);
              destinationBlogName.blogId = blog.id;
              await destinationBlogName.save({ transaction: transaction });
            }
          }
        }
      }

      await this.database.sequelize.query("DELETE FROM blogs WHERE NOT EXISTS (SELECT id FROM blog_names WHERE blog_id = blogs.id)", {
        transaction: transaction
      });
      await transaction.commit();
    }

    let spans = await this.utils.getSpans();

    console.log("Obtaining statistics");
    let blogs = await this.database.Blog.findAll({ include: this.database.BlogName });
    while (blogs.length > 0) {
      let remaining = blogs.length;

      const startTime = Date.now();
      const transaction = await this.database.sequelize.transaction();

      let awaits = [];
      for (const blog of blogs.splice(0, 4)) {
        console.log("Processing blog " + blog.name);

        awaits.push(this.runStatistics(transaction, spans, blog));
        //await this.runStatistics(transaction, spans, blog);
      }

      await Promise.all(awaits);

      await transaction.commit();
      const endTime = Date.now();
      console.log(`Done pack ${remaining} in ${endTime - startTime}ms`);

      // return;
    }

    console.log("Finished all processing on the import");

    this.currentImport.phase = 'finalized';
    this.currentImport.statId = (await this.database.sequelize.query("SELECT MAX(id) as id from stats;"))[0][0]['id'];
    this.currentImport.blogId = (await this.database.sequelize.query("SELECT MAX(id) as id from blogs;"))[0][0]['id'];
    this.currentImport.blogLinkId = (await this.database.sequelize.query("SELECT MAX(id) as id from blog_links;"))[0][0]['id'];
    this.currentImport.languageId = (await this.database.sequelize.query("SELECT MAX(id) as id from languages;"))[0][0]['id'];
    this.currentImport.save();

    console.log(this.currentImport);
  }

  async runStats(blogName) {
    await this.initialize();

    let blog = await this.database.Blog.findOne({ where: { name: blogName }, include: this.database.BlogName });
    let spans = await this.utils.getSpans();

    const transaction = await this.database.sequelize.transaction();
    await this.runStatistics(transaction, spans, blog);
    await transaction.commit();
  }

  // private

  async runStatistics(transaction, spans, blog) {
    let [existing, ] = await this.database.sequelize.query("SELECT id FROM stats where blog_id = ? AND import_id = ? LIMIT 1;",{
      replacements: [ blog.id, this.currentImport.id ],
      transaction: transaction
    });
    if (existing.length > 0) {
      return;
    }
    console.log("Included blogs: ", blog.blog_names.map(blog_name => blog_name.name).join());
    for (const spanName in spans) {
      let span = spans[spanName];
      let blogStats = {};
      blogStats.all = {};
      blogStats[this.targetLanguage.id] = {};
      let startTime;
      // console.log(spanName);
      for (const blogName of blog.blog_names) {
        let blogNameStats = {};
        // startTime = Date.now();
        let [contentStats, ] = await this.database.sequelize.query("select COUNT(contents.id) contents_count, coalesce(SUM(length(contents.text)),0) contents_bytes FROM contents where tumblr_id >= ? and tumblr_id <= ? and blog_name_id = ?", {
          replacements: [ span.start.id, span.end.id, blogName.id ],
          transaction: transaction
        });
        // console.log(`1 ${Date.now() - startTime}ms`);

        // startTime = Date.now();
        let [postStats, ] = await this.database.sequelize.query("select COUNT(posts.id) posts_count, coalesce(SUM(length(title))+SUM(length(contents.text)),0) posts_bytes FROM posts LEFT JOIN post_contents ON post_id = posts.id AND position = -1 LEFT JOIN contents ON content_id = contents.id WHERE posts.tumblr_id >= ? and posts.tumblr_id <= ? and posts.blog_name_id = ?", {
          replacements: [ span.start.id, span.end.id, blogName.id ],
          transaction: transaction
        });
        // console.log(`2 ${Date.now() - startTime}ms`);

        // startTime = Date.now();
        let [appearances, ] = await this.database.sequelize.query("select count(*) appearances from post_contents join contents on content_id = contents.id where contents.tumblr_id >= ? and contents.tumblr_id <= ? and contents.blog_name_id = ?;", {
          replacements: [ span.start.id, span.end.id, blogName.id ],
          transaction: transaction
        });
        // console.log(`3 ${Date.now() - startTime}ms`);

        // startTime = Date.now();
        let [rootReach, ] = await this.database.sequelize.query("select count(*) root_reach from posts where root_blog_name_id = ? and blog_name_id != ? and tumblr_id >= ? and tumblr_id <= ?;", {
          replacements: [ blogName.id, blogName.id, span.start.id, span.end.id ],
          transaction: transaction
        });
        // console.log(`4 ${Date.now() - startTime}ms`);

        // startTime = Date.now();
        let [fromReach, ] = await this.database.sequelize.query("select count(*) reblog_reach from posts where from_blog_name_id = ? and blog_name_id != ? and tumblr_id >= ? and tumblr_id <= ?;", {
          replacements: [ blogName.id, blogName.id, span.start.id, span.end.id ],
          transaction: transaction
        });
        // console.log(`5 ${Date.now() - startTime}ms`);

        blogNameStats.all = {...contentStats[0], ...postStats[0], ...appearances[0], ...rootReach[0], ...fromReach[0]};


        // startTime = Date.now();
        let [contentStatsLang, ] = await this.database.sequelize.query("select COUNT(contents.id) contents_count, coalesce(SUM(length(contents.text)),0) contents_bytes FROM contents JOIN content_languages ON content_id = contents.id where tumblr_id >= ? and tumblr_id <= ? and blog_name_id = ? and language_id = ? and percentage > ?", {
          replacements: [ span.start.id, span.end.id, blogName.id, this.targetLanguage.id, this.minimumContentPercentage ],
          transaction: transaction
        });
        // console.log(`6 ${Date.now() - startTime}ms`);

        // startTime = Date.now();
        let [postStatsLang, ] = await this.database.sequelize.query("select COUNT(posts.id) posts_count, coalesce(SUM(length(title))+SUM(length(contents.text)),0) posts_bytes FROM posts JOIN post_languages ON post_languages.post_id = posts.id LEFT JOIN post_contents ON post_contents.post_id = posts.id AND position = -1 LEFT JOIN contents ON content_id = contents.id WHERE posts.tumblr_id >= ? and posts.tumblr_id <= ? and posts.blog_name_id = ? AND language_id = ? and percentage > ?", {
          replacements: [ span.start.id, span.end.id, blogName.id, this.targetLanguage.id, this.minimumContentPercentage ],
          transaction: transaction
        });
        // console.log(`7 ${Date.now() - startTime}ms`);

        // startTime = Date.now();
        let [appearancesLang, ] = await this.database.sequelize.query("select count(*) appearances from post_contents join contents on post_contents.content_id = contents.id join content_languages on content_languages.content_id = contents.id where contents.tumblr_id >= ? and contents.tumblr_id <= ? and contents.blog_name_id = ? AND language_id = ? and percentage > ?;", {
          replacements: [ span.start.id, span.end.id, blogName.id, this.targetLanguage.id, this.minimumContentPercentage ],
          transaction: transaction
        });
        // console.log(`8 ${Date.now() - startTime}ms`);

        // startTime = Date.now();
        // note these two are not producing fully correct stats in case there are multiple versions of the same content
        let [rootReachLang, ] = await this.database.sequelize.query("select count(*) root_reach from posts join contents on root_tumblr_id = contents.tumblr_id and contents.blog_name_id = ? join content_languages on content_id = contents.id where root_blog_name_id = ? and posts.blog_name_id != ? and posts.tumblr_id >= ? and posts.tumblr_id <= ? AND language_id = ? and percentage > ?;", {
          replacements: [ blogName.id, blogName.id, blogName.id, span.start.id, span.end.id, this.targetLanguage.id, this.minimumContentPercentage ],
          transaction: transaction
        });
        // console.log(`9 ${Date.now() - startTime}ms`);

        // startTime = Date.now();
        // note these two are not producing fully correct stats in case there are multiple versions of the same content
        let [fromReachLang, ] = await this.database.sequelize.query("select count(*) reblog_reach from posts join contents on from_tumblr_id = contents.tumblr_id and contents.blog_name_id = ? join content_languages on content_id = contents.id  where from_blog_name_id = ? and posts.blog_name_id != ? and posts.tumblr_id >= ? and posts.tumblr_id <= ? AND language_id = ? and percentage > ?;", {
          replacements: [ blogName.id, blogName.id, blogName.id, span.start.id, span.end.id, this.targetLanguage.id, this.minimumContentPercentage ],
          transaction: transaction
        });
        // console.log(`10 ${Date.now() - startTime}ms`);

        blogNameStats[this.targetLanguage.id] = {...contentStatsLang[0], ...postStatsLang[0], ...appearancesLang[0], ...rootReachLang[0], ...fromReachLang[0]};

        for (const key of Object.keys(blogNameStats.all)) {
          blogStats.all[key] ||= 0;
          blogStats[this.targetLanguage.id][key] ||= 0;

          blogStats.all[key] += parseInt(blogNameStats.all[key]);
          blogStats[this.targetLanguage.id][key] += parseInt(blogNameStats[this.targetLanguage.id][key]);
        }

        blogNameStats.all.name = spanName;
        blogNameStats.all.blogNameId = blogName.id;
        blogNameStats.all.from = span.start.date;
        blogNameStats.all.to = span.end.date;
        blogNameStats.all.importId = this.currentImport.id;

        blogNameStats[this.targetLanguage.id].name = spanName;
        blogNameStats[this.targetLanguage.id].blogNameId = blogName.id;
        blogNameStats[this.targetLanguage.id].from = span.start.date;
        blogNameStats[this.targetLanguage.id].to = span.end.date;
        blogNameStats[this.targetLanguage.id].languageId = this.targetLanguage.id;
        blogNameStats[this.targetLanguage.id].importId = this.currentImport.id;

        await this.database.Stats.create(blogNameStats.all,{
          transaction: transaction
        });

        await this.database.Stats.create(blogNameStats[this.targetLanguage.id],{
          transaction: transaction
        });
      }

      blogStats.all.name = spanName;
      blogStats.all.blogId = blog.id;
      blogStats.all.from = span.start.date;
      blogStats.all.to = span.end.date;
      blogStats.all.importId = this.currentImport.id;

      blogStats[this.targetLanguage.id].name = spanName;
      blogStats[this.targetLanguage.id].blogId = blog.id;
      blogStats[this.targetLanguage.id].from = span.start.date;
      blogStats[this.targetLanguage.id].to = span.end.date;
      blogStats[this.targetLanguage.id].languageId = this.targetLanguage.id;
      blogStats[this.targetLanguage.id].importId = this.currentImport.id;

      await this.database.Stats.create(blogStats.all,{
        transaction: transaction
      });

      await this.database.Stats.create(blogStats[this.targetLanguage.id],{
        transaction: transaction
      });
    }
  }

  async getLanguage(transaction, language) {
    let lang = this.cachedLanguages[language];
    if (!lang) {
      [lang, ] = await this.database.Language.findCreateFind({ where: { name: language }, default: { name: language }, transaction: transaction});
      this.cachedLanguages[language] = lang;
    }
    return lang;
  }

  async getBlogName(transaction, userName) {
    if (typeof userName != 'number') {
      userName = userName.substring(0,32);
    }
    let databaseBlogName = this.cachedBlogNames[userName];

    if (!databaseBlogName) {
      if (typeof userName == 'number') {
        databaseBlogName = await this.database.BlogName.findByPk(userName, {transaction: transaction});
      } else {
        [databaseBlogName, ] = await this.database.BlogName.findCreateFind({where: { name: userName }, defaults: { name: userName }, transaction: transaction});
      }
      this.cachedBlogNames[userName] = databaseBlogName;
    }

    return databaseBlogName;
  }

  async getBlog(transaction, userName) {
    if (typeof userName != 'number') {
      userName = userName.substring(0,32);
    }
    let databaseBlog = this.cachedBlogs[userName];

    if (!databaseBlog) {
      if (typeof userName == 'number') {
        databaseBlog = await this.database.Blog.findByPk(userName, {transaction: transaction});
      } else {
        [databaseBlog, ] = await this.database.Blog.findCreateFind({where: { name: userName }, defaults: { name: userName }, transaction: transaction});
      }
      this.cachedBlogs[userName] = databaseBlog;
    }

    return databaseBlog;
  }
}
