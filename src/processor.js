// Process a previously imported batch of data and fill in language and blog ping informations

import Sequelize from 'sequelize';
import cld from 'cld';

export default class Processor {
  constructor(database, options = {}) {
    this.database = database;
    this.options = options;

    this.cachedBlogNames = {};
    this.cachedLanguages = {};

    this.stats = {};

    this.currentImport = null;
  }

  async run() {
    this.currentImport = await this.database.Import.findOne({ order: [ [ 'id','DESC'] ] });

    let counter = 0;

    console.log("Checking contents");
    let remaining = await this.database.Content.count({ where: { processed: false }});

    let results = ['a'];

    // process contents;
    console.log("Processing contents");
    while (results.length != 0) {
      counter += 1;

      const startTime = Date.now();
      results = await this.database.Content.findAll({ where: { processed: false }, limit: 10000 });

      const transaction = await this.database.sequelize.transaction();

      let processes = [];

      for (const content of results) {
        processes.push(this.processContent(transaction, content));
      };

      for (const process of processes) {
        await process;
      };

      await this.database.Content.update(
        { processed : true },
        { where: {
          id: results.map(content => content.id)
        }},
        { transaction: transaction}
      );

      if (counter % 100 == 0) {
        console.log('Clearing cache');
        this.cachedBlogNames = {};

        counter = 0;
      }

      await transaction.commit();

      const endTime = Date.now();
      console.log(`Done pack ${remaining} in ${endTime - startTime}ms`);

      remaining -= results.length;
    }

    console.log("Checking posts");
    remaining = await this.database.Post.count({ where: { processed: false }});

    results = ['a'];

    // process posts;
    console.log("Processing posts");
    while (results.length != 0) {
      counter += 1;

      const startTime = Date.now();
      results = await this.database.Post.findAll({ where: { processed: false }, limit: 10000 });

      const transaction = await this.database.sequelize.transaction();

      let processes = [];

      for (const post of results) {
        processes.push(this.processPost(transaction, post));
      };

      for (const process of processes) {
        await process;
      };

      await this.database.Post.update(
        { processed : true },
        { where: {
          id: results.map(post => post.id)
        }},
        { transaction: transaction}
      );

      if (counter % 100 == 0) {
        console.log('Clearing cache');
        this.cachedBlogNames = {};

        counter = 0;
      }

      await transaction.commit();

      const endTime = Date.now();
      console.log(`Done pack ${remaining} in ${endTime - startTime}ms`);

      remaining -= results.length;
    }

    console.log("Finished processing");

    this.currentImport.phase = 'processed';
    this.currentImport.blogId = (await this.database.sequelize.query("SELECT MAX(id) as id from blogs;"))[0][0]['id'];
    this.currentImport.blogLinkId = (await this.database.sequelize.query("SELECT MAX(id) as id from blog_links;"))[0][0]['id'];
    this.currentImport.languageId = (await this.database.sequelize.query("SELECT MAX(id) as id from languages;"))[0][0]['id'];
    this.currentImport.save();

    console.log(this.currentImport);
  }

  async processPost(transaction, post) {
    let reliable = false;
    let languages = [];
    try {
      let text = "";
      if (post.title) {
         text = post.title + "\n";
      }
      for (const tag of (await post.getTags({ transaction: transaction }))) {
        text += tag.name + "\n";
      }
      for (const content of (await post.getContents({ transaction: transaction }))) {
        if (content.post_contents.position == -1 || content.post_contents.is_last) {
          text += content.text + "\n";
        }
      }

      ({ reliable, languages } = await cld.detect(text, { isHTML: true }));
    } catch (err) { }

    if (reliable) {
      for (const lang of languages) {
        let dbLang = await this.getLanguage(transaction, lang.name);
        await this.database.sequelize.query("INSERT INTO post_languages (post_id,language_id,percentage,score) VALUES (?,?,?,?) ON CONFLICT DO NOTHING;", {
          replacements: [ post.id, dbLang.id, lang.percent, lang.score],
          type: Sequelize.QueryTypes.RAW,
          transaction: transaction
        });
      }
    }
  }

  async processContent(transaction, content) {
    let reliable = false;
    let languages = [];
    try {
      ({ reliable, languages } = await cld.detect(content.text, { isHTML: true }));
    } catch (err) { }

    if (reliable) {
      for (const lang of languages) {
        let dbLang = await this.getLanguage(transaction, lang.name);
        await this.database.sequelize.query("INSERT INTO content_languages (content_id,language_id,percentage,score) VALUES (?,?,?,?) ON CONFLICT DO NOTHING;", {
          replacements: [ content.id, dbLang.id, lang.percent, lang.score],
          type: Sequelize.QueryTypes.RAW,
          transaction: transaction
        });
      }
    }

    for (const result of content.text.matchAll(/@([0-9-a-z]{2,32})/g)) {
      let blogLink = await this.getBlogName(transaction, result[1]);
      await this.database.sequelize.query("INSERT INTO blog_name_pings (content_id,blog_name_id) VALUES (?,?) ON CONFLICT DO NOTHING;", {
        replacements: [ content.id, blogLink.id ],
        type: Sequelize.QueryTypes.RAW,
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
}
