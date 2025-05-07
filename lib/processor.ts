/* eslint-disable @typescript-eslint/no-explicit-any */
// Process a previously imported batch of data and fill in language and blog ping informations

import { sequelize } from "../models/sequelize.js";
import cld, { Language as CldLanguage } from "cld";
import { Import, ImportPhase } from "../models/import.js";
import { Content } from "../models/content.js";
import { Post } from "../models/post.js";
import { QueryTypes, Transaction } from "sequelize";
import { Language } from "../models/language.js";
import { BlogName } from "../models/blog_name.js";

export default class Processor {
  options: object;
  cachedBlogNames: Record<string, BlogName>;
  cachedLanguages: Record<string, Language>;
  stats: object;
  currentImport: Import | null;

  constructor(options = {}) {
    this.options = options;

    this.cachedBlogNames = {};
    this.cachedLanguages = {};

    this.stats = {};

    this.currentImport = null;
  }

  async run() {
    this.currentImport = await Import.findOne({
      order: [["id", "DESC"]],
    });

    if (!this.currentImport) {
      console.log("No current import present");
      return;
    }

    let counter = 0;

    console.log("Checking contents");
    let remaining = await Content.count({
      where: { processed: false },
    });

    {
      let results = [new Content()];

      // process contents;
      console.log("Processing contents");
      while (results.length != 0) {
        counter += 1;

        const startTime = Date.now();
        results = await Content.findAll({
          where: { processed: false },
          limit: 10000,
        });

        const transaction = await sequelize.transaction();

        const processes = [];

        for (const content of results) {
          processes.push(this.processContent(transaction, content));
        }

        for (const process of processes) {
          await process;
        }

        await Content.update(
          { processed: true },
          {
            where: {
              id: results.map((content) => content.id),
            },
            transaction: transaction,
          },
        );

        if (counter % 100 == 0) {
          console.log("Clearing cache");
          this.cachedBlogNames = {};

          counter = 0;
        }

        await transaction.commit();

        const endTime = Date.now();
        console.log(`Done pack ${remaining} in ${endTime - startTime}ms`);

        remaining -= results.length;
      }

      console.log("Checking posts");
      remaining = await Post.count({ where: { processed: false } });
    }

    {
      let results = [new Post()];

      // process posts;
      console.log("Processing posts");
      while (results.length != 0) {
        counter += 1;

        const startTime = Date.now();
        results = await Post.findAll({
          where: { processed: false },
          limit: 10000,
        });

        const transaction = await sequelize.transaction();

        const processes = [];

        for (const post of results) {
          processes.push(this.processPost(transaction, post));
        }

        for (const process of processes) {
          await process;
        }

        await Post.update(
          { processed: true },
          {
            where: {
              id: results.map((post) => post.id),
            },
            transaction: transaction,
          },
        );

        if (counter % 100 == 0) {
          console.log("Clearing cache");
          this.cachedBlogNames = {};

          counter = 0;
        }

        await transaction.commit();

        const endTime = Date.now();
        console.log(`Done pack ${remaining} in ${endTime - startTime}ms`);

        remaining -= results.length;
      }
    }

    console.log("Finished processing");

    this.currentImport.phase = ImportPhase.processed;
    this.currentImport.blogId = (
      (await sequelize.query("SELECT MAX(id) as id from blogs;")) as any
    )[0][0]["id"];
    this.currentImport.blogLinkId = (
      (await sequelize.query("SELECT MAX(id) as id from blog_links;")) as any
    )[0][0]["id"];
    this.currentImport.languageId = (
      (await sequelize.query("SELECT MAX(id) as id from languages;")) as any
    )[0][0]["id"];
    this.currentImport.save();

    console.log(this.currentImport);
  }

  async processPost(transaction: Transaction, post: Post) {
    let reliable = false;
    let languages: CldLanguage[] = [];
    try {
      let text = "";
      if (post.title) {
        text = post.title + "\n";
      }
      for (const tag of await post.getTags({ transaction: transaction })) {
        text += tag.name + "\n";
      }
      for (const content of await post.getContents({
        transaction: transaction,
      })) {
        if (
          content.post_contents.position == -1 ||
          content.post_contents.isLast
        ) {
          text += content.text + "\n";
        }
      }

      ({ reliable, languages } = await cld.detect(text, { isHTML: true }));
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) { /* empty */ }

    if (reliable) {
      for (const lang of languages) {
        const dbLang = await this.getLanguage(transaction, lang.name);
        await sequelize.query(
          "INSERT INTO post_languages (post_id,language_id,percentage,score) VALUES (?,?,?,?) ON CONFLICT DO NOTHING;",
          {
            replacements: [post.id, dbLang.id, lang.percent, lang.score],
            type: QueryTypes.RAW,
            transaction: transaction,
          },
        );
      }
    }
  }

  async processContent(transaction: Transaction, content: Content) {
    let reliable = false;
    let languages: CldLanguage[] = [];
    try {
      ({ reliable, languages } = await cld.detect(content.text, {
        isHTML: true,
      }));
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) { /* empty */ }

    if (reliable) {
      for (const lang of languages) {
        const dbLang = await this.getLanguage(transaction, lang.name);
        await sequelize.query(
          "INSERT INTO content_languages (content_id,language_id,percentage,score) VALUES (?,?,?,?) ON CONFLICT DO NOTHING;",
          {
            replacements: [content.id, dbLang.id, lang.percent, lang.score],
            type: QueryTypes.RAW,
            transaction: transaction,
          },
        );
      }
    }

    for (const result of content.text.matchAll(/@([0-9-a-z]{2,32})/g)) {
      const blogLink = await this.getBlogName(transaction, result[1]);
      await sequelize.query(
        "INSERT INTO blog_name_pings (content_id,blog_name_id) VALUES (?,?) ON CONFLICT DO NOTHING;",
        {
          replacements: [content.id, blogLink.id],
          type: QueryTypes.RAW,
          transaction: transaction,
        },
      );
    }
  }

  async getLanguage(transaction: Transaction, language: string) {
    let lang = this.cachedLanguages[language];
    if (!lang) {
      [lang] = await Language.findCreateFind({
        where: { name: language },
        defaults: { name: language },
        transaction: transaction,
      });
      this.cachedLanguages[language] = lang;
    }
    return lang;
  }

  async getBlogName(transaction: Transaction, userName: string) {
    if (typeof userName != "number") {
      userName = userName.substring(0, 32);
    }
    let databaseBlogName = this.cachedBlogNames[userName];

    if (!databaseBlogName) {
      if (typeof userName == "number") {
        const result = await BlogName.findByPk(userName, {
          transaction: transaction,
        });
        if (!result) throw new Error("Could not find blog user");
        databaseBlogName = result;
      } else {
        [databaseBlogName] = await BlogName.findCreateFind({
          where: { name: userName },
          defaults: { name: userName },
          transaction: transaction,
        });
      }
      this.cachedBlogNames[userName] = databaseBlogName;
    }

    return databaseBlogName;
  }
}
