/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Model,
  Table,
  Column,
  DataType,
  Sequelize,
  ForeignKey,
  BelongsTo,
  BelongsToMany,
  HasMany,
} from "sequelize-typescript";
import { BlogName } from "./blog_name.js";
import { Content } from "./content.js";
import { PostContent } from "./post_content.js";
import { Resource } from "./resource.js";
import { PostResource } from "./post_resource.js";
import { Tag } from "./tag.js";
import { PostTag } from "./post_tag.js";
import { Language } from "./language.js";
import { PostLanguage } from "./post_language.js";
import { Import } from "./import.js";
import { BelongsToManyGetAssociationsMixin } from "sequelize";

export interface PostAttributes {
  id?: number;
  tumblrId?: string;
  title?: string;
  type?: PostType;
  meta?: Record<string, any>;
  date?: Date;
  url?: string;
  root?: boolean;
  rootTumblrId?: string;
  fromTumblrId?: string;
  processed?: boolean;
  blogNameId?: number;
  fromBlogNameId?: number;
  rootBlogNameId?: number;
}

export enum PostType {
  "text" = "text",
  "link" = "link",
  "photo" = "photo",
  "audio" = "audio",
  "quote" = "quote",
  "chat" = "chat",
  "video" = "video",
  "answer" = "answer",
}

@Table({
  tableName: "posts",
  modelName: "posts",
  timestamps: false,
  underscored: true,
})
export class Post
  extends Model<PostAttributes, PostAttributes>
  implements PostAttributes
{
  @Column({ allowNull: true, type: DataType.BIGINT })
  declare tumblrId: string;

  @Column({ allowNull: true, type: DataType.STRING(255) })
  declare title: string;

  @Column({ allowNull: true, type: DataType.ENUM(...Object.values(PostType)) })
  declare type: PostType;

  @Column({ allowNull: true, type: DataType.JSONB })
  declare meta: Record<string, any>;

  @Column({ allowNull: true, type: DataType.DATE })
  declare date: Date;

  @Column({ allowNull: true, type: DataType.STRING(65535) })
  declare url: string;

  @Column({ allowNull: true, type: DataType.BOOLEAN })
  declare root: boolean;

  @Column({ allowNull: true, type: DataType.BIGINT })
  declare rootTumblrId: string;

  @Column({ allowNull: true, type: DataType.BIGINT })
  declare fromTumblrId: string;

  @Column({ type: DataType.BOOLEAN, defaultValue: Sequelize.literal("false") })
  declare processed: boolean;

  @ForeignKey(() => BlogName)
  @Column({ allowNull: true, type: DataType.INTEGER })
  declare blogNameId?: number;

  @Column({ allowNull: true, type: DataType.INTEGER })
  declare fromBlogNameId?: number;

  @Column({ allowNull: true, type: DataType.INTEGER })
  declare rootBlogNameId?: number;

  @BelongsTo(() => BlogName)
  declare blogName: BlogName;

  @HasMany(() => PostContent)
  declare postContents: PostContent[];

  @BelongsToMany(() => Content, () => PostContent)
  declare contents: Array<Content & { post_contents: PostContent }>;
  declare getContents: BelongsToManyGetAssociationsMixin<
    Content & { post_contents: PostContent }
  >;

  @BelongsToMany(() => Resource, () => PostResource)
  declare resources: Resource[];

  @BelongsToMany(() => Tag, () => PostTag)
  declare tags: Tag[];
  declare getTags: BelongsToManyGetAssociationsMixin<Tag>;

  @BelongsToMany(() => Language, () => PostLanguage)
  declare languages: Language[];

  @HasMany(() => Import, { sourceKey: "id" })
  declare imports: Import[];
}
