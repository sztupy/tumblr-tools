/* eslint-disable @typescript-eslint/no-explicit-any */
// imports a blog through from the Tumblr API to the database
import { sequelize, Import, Blog, BlogName, Tag, Language } from "../models/index.js";
import { ImportPhase } from "../models/import.js";
import { BlogLinkType } from "../models/blog_link.js";
import Importer from "../lib/importer.js";
import { apiDownloader } from "../lib/apiDownloader.js";
import { createClient } from "../lib/tumblr.js";
import { environment } from "../environment.js";

type Options = {
  fromPage?: number;
  toPage?: number;
  importer?: Importer;
};

export default class APIImporter {
  config: any;
  options: Options;
  cachedBlogs: Record<string, Blog>;
  cachedBlogLinks: Record<number | string, Record<number | string, BlogLinkType>>
  cachedBlogNames: Record<string, BlogName>;
  cachedTags: Record<string, Tag>;
  cachedLanguages: Record<string, Language>;
  start: boolean;
  currentImport: Import | null;
  lastImport: Import | null;
  importer: Importer;

  constructor(config: any, options: Options = {}) {
    this.config = config;
    this.options = options;
    this.importer = options.importer || new Importer();

    this.cachedBlogs = {};
    this.cachedBlogLinks = {};
    this.cachedBlogNames = {};
    this.cachedTags = {};
    this.cachedLanguages = {};

    this.start = false;

    this.currentImport = null;
    this.lastImport = null;
  }

  async run() {
    const client = createClient(environment.tumblrKeys);

    const ctime = new Date();

    const importData = {
      fileDate: ctime,
      fileName: ''+ctime.getTime(),
      phase: ImportPhase.need_import,
    };

    [this.currentImport] = await Import.findCreateFind({
      where: {
        fileDate: ctime,
      },
      defaults: importData,
    });

    this.lastImport = await Import.findByPk(this.currentImport.id - 1);

    let counter = 0;

    const logger = console.log;

    const initScript = () => {
      counter += 1;
      console.log(`Starting entry`);
    }

    const mainScript = async (_config: any, username: string, options: any, body: any) => {
      // fixes some weird audio posts that have unicode NULs in them
      const bodyFixed = JSON.parse(JSON.stringify(body).replaceAll("\\u0000",""))
      if (this.currentImport) {
        console.log(username);
        console.log(options);
        const stats = await this.importer.run(bodyFixed, this.currentImport, this.lastImport, counter);
        console.log(stats);
      } else {
        console.log("Import data missing");
      }
    }

    await apiDownloader(this.config, client, logger, initScript, mainScript );


    console.log("Finished import");

    this.currentImport.postId = (
      (await sequelize.query("SELECT MAX(id) as id from posts;")) as any
    )[0][0]["id"];
    this.currentImport.contentId = (
      (await sequelize.query("SELECT MAX(id) as id from contents;")) as any
    )[0][0]["id"];
    this.currentImport.tagId = (
      (await sequelize.query("SELECT MAX(id) as id from tags;")) as any
    )[0][0]["id"];
    this.currentImport.resourceId = (
      (await sequelize.query("SELECT MAX(id) as id from resources;")) as any
    )[0][0]["id"];
    this.currentImport.blogNameId = (
      (await sequelize.query("SELECT MAX(id) as id from blog_names;")) as any
    )[0][0]["id"];
    this.currentImport.blogId = (
      (await sequelize.query("SELECT MAX(id) as id from blogs;")) as any
    )[0][0]["id"];
    this.currentImport.blogLinkId = (
      (await sequelize.query("SELECT MAX(id) as id from blog_links;")) as any
    )[0][0]["id"];
    this.currentImport.languageId = (
      (await sequelize.query("SELECT MAX(id) as id from languages;")) as any
    )[0][0]["id"];
    this.currentImport.phase = ImportPhase.import_finished;
    this.currentImport.save();

    console.log(this.currentImport);
  }
}
