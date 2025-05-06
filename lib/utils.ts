/* eslint-disable @typescript-eslint/no-explicit-any */
import { sequelize } from "../models/sequelize.js";
import Finalizer from "./finalizer.js";
import { Blog } from "../models/blog.js";
import { BlogName } from "../models/blog_name.js";
import { Import } from "../models/import.js";
import { BlogLink, BlogLinkType } from "../models/blog_link.js";
import { Stat } from "../models/stat.js";

export type Spans = {
  all?: Span;
  current?: Span;
  [key: number]: Span;
};

export type SpanData = {
  date?: Date;
  id?: number;
};

export type Span = {
  start: SpanData;
  end: SpanData;
};

type Options = {
  finalizer?: Finalizer;
};

export default class Utils {
  finalizer: Finalizer;
  currentImport?: Import | null;

  constructor(options: Options = {}) {
    this.finalizer = options.finalizer || new Finalizer();
  }

  async mergeBlogs(source: string, destination: string, meta = {}) {
    if (source == destination) return;
    if (!source) return;
    if (!destination) return;

    const sourceBlog = await Blog.findOne({ where: { name: source } });
    const destinationBlog = await Blog.findOne({
      where: { name: destination },
    });

    if (!sourceBlog) return;
    if (!destinationBlog) return;

    const sourceBlogName = await BlogName.findOne({
      where: { name: sourceBlog.name },
    });
    const destinationBlogName = await BlogName.findOne({
      where: { name: destinationBlog.name },
    });

    if (!sourceBlogName) return;
    if (!destinationBlogName) return;

    this.currentImport = await Import.findOne({ order: [["id", "DESC"]] });

    await BlogLink.create({
      type: BlogLinkType.manual,
      sourceId: sourceBlogName.id,
      destinationId: destinationBlogName.id,
      importId: this.currentImport?.id,
      meta: meta,
    });

    await Stat.destroy({
      where: { blogId: [sourceBlog.id, destinationBlog.id] },
    });
    await BlogName.update(
      { blogId: destinationBlog.id },
      { where: { blogId: sourceBlog.id } },
    );

    const newBlogNames = await BlogName.findAll({
      where: { blogId: destinationBlog.id },
    });
    await Stat.destroy({
      where: { blogNameId: newBlogNames.map((blogName) => blogName.id) },
    });
    await sourceBlog.destroy();

    await this.finalizer.runStats(destination);
  }

  async getSpans(): Promise<Spans> {
    console.log("Obtaining timespans");
    const spans: Spans = {};
    spans.all = { start: {}, end: {} };
    spans.all.start.date = (
      (await sequelize.query(
        "SELECT MIN(date) date FROM posts WHERE date>'2006-01-01';",
      )) as any
    )[0][0]["date"] as Date;
    spans.all.start.id = (
      (await sequelize.query("SELECT MIN(tumblr_id) id FROM posts;")) as any
    )[0][0]["id"] as number;
    spans.all.end = {};
    spans.all.end.date = (
      (await sequelize.query("SELECT MAX(date) date FROM posts;")) as any
    )[0][0]["date"];
    spans.all.end.id = (
      (await sequelize.query(
        "SELECT MAX(tumblr_id) id FROM posts WHERE date = ?;",
        { replacements: [spans.all.end.date] },
      )) as any
    )[0][0]["id"];

    for (let year = 2009; year <= new Date().getFullYear(); year++) {
      spans[year] = { start: {}, end: {} };
      spans[year].start.date = (
        (await sequelize.query(
          "SELECT MAX(date) date FROM posts WHERE date<'" +
            (year == 2009 ? "1900" : year) +
            "-01-01';",
        )) as any
      )[0][0]["date"];
      spans[year].start.id = (
        (await sequelize.query(
          "SELECT MAX(tumblr_id) id FROM posts WHERE date = ?;",
          { replacements: [spans[year].start.date] },
        )) as any
      )[0][0]["id"];
      spans[year].end.date = (
        (await sequelize.query(
          "SELECT MIN(date) date FROM posts WHERE date>'" +
            (year + 1) +
            "-01-01';",
        )) as any
      )[0][0]["date"] as Date;
      spans[year].end.id = (
        (await sequelize.query(
          "SELECT MIN(tumblr_id) id FROM posts WHERE date = ?;",
          { replacements: [spans[year].end.date] },
        )) as any
      )[0][0]["id"];
      if (spans[year].end.date === null) {
        spans[year].end = spans.all.end;
        spans.current = spans[year];
        delete spans[year];
        break;
      }
    }

    return spans;
  }

  async assignLatestBlogName(id: number) {
    await sequelize.query(
      "update blogs set name = (select name from (select blog_names.name as name, max(contents.tumblr_id) as maxid from blog_names join contents on contents.blog_name_id = blog_names.id where blog_names.blog_id = blogs.id group by blog_names.name) order by maxid desc limit 1) where blogs.id = ?",
      { replacements: [id] },
    );
  }
}
