/* eslint-disable @typescript-eslint/no-explicit-any */
// imports a ZIP file containing Tumblr API dumps in JSON format into the database
import { sequelize } from "../models/sequelize.js";
import fs from "fs";
import Zip from "node-stream-zip";
import { Import, ImportPhase } from "../models/import.js";
import { Blog } from "../models/blog.js";
import { BlogLinkType } from "../models/blog_link.js";
import { BlogName } from "../models/blog_name.js";
import { Tag } from "../models/tag.js";
import { Language } from "../models/language.js";
import Importer from "./importer.js";

type Options = {
  skipUntil?: string;
  importer?: Importer;
};

export default class ZipFileImporter {
  fileName: string;
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

  constructor(fileName: string, options: Options = {}) {
    this.fileName = fileName;
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
    const { ctime } = fs.statSync(this.fileName);
    const zip = new Zip({ file: this.fileName });

    zip.on("ready", async () => {
      const importData = {
        fileDate: ctime,
        fileName: this.fileName,
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

      for (const entry of Object.values(zip.entries())) {
        if (this.options["skipUntil"]) {
          if (entry.name.indexOf(this.options["skipUntil"]) != -1) {
            this.start = true;
          }
        } else {
          this.start = true;
        }
        let stats : any = {};

        if (this.start && entry.isFile) {
          const startTime = Date.now();
          console.log(`Starting ${entry.name}`);
          counter += 1;
          // some audio metadata contains unicode NULLs, we get rid of all of them here
          const blog = JSON.parse(
            zip.entryDataSync(entry).toString("utf8").replaceAll("\\u0000", ""),
          );

          if (blog.posts) {
            stats = await this.importer.run(blog, this.currentImport, this.lastImport, counter);
          } else {
            console.log(`Invalid file ${entry.name}`);
          }
          const endTime = Date.now();
          console.log(stats);
          console.log(`Done with ${entry.name} in ${endTime - startTime}ms`);
        }
      }

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
      zip.close();
    });
  }
}
