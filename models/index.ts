import { Sequelize, sequelize } from "./sequelize.js";
import { BlogLink } from "./blog_link.js";
import { Blog } from "./blog.js";
import { BlogName } from "./blog_name.js";
import { Import } from "./import.js";
import { Post } from "./post.js";
import { Content } from "./content.js";
import { BlogNamePing } from "./blog_name_ping.js";
import { PostContent } from "./post_content.js";
import { PostResource } from "./post_resource.js";
import { Resource } from "./resource.js";
import { PostTag } from "./post_tag.js";
import { Tag } from "./tag.js";
import { PostLanguage } from "./post_language.js";
import { Language } from "./language.js";
import { ContentLanguage } from "./content_language.js";
import { Stat } from "./stat.js";

sequelize.addModels([
  Blog,
  BlogName,
  Import,
  BlogLink,
  Post,
  Content,
  BlogNamePing,
  PostContent,
  PostResource,
  Resource,
  PostTag,
  Tag,
  PostLanguage,
  Language,
  ContentLanguage,
  Stat,
]);

export {
  sequelize,
  Sequelize,
  Blog,
  BlogName,
  Import,
  BlogLink,
  Post,
  Content,
  BlogNamePing,
  PostContent,
  PostResource,
  Resource,
  PostTag,
  Tag,
  PostLanguage,
  Language,
  ContentLanguage,
  Stat,
}
