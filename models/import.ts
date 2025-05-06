import {
  Model,
  Table,
  Column,
  DataType,
  ForeignKey,
  BelongsTo,
} from "sequelize-typescript";
import { Post } from "./post.js";
import { Content } from "./content.js";
import { Tag } from "./tag.js";
import { Resource } from "./resource.js";
import { Blog } from "./blog.js";
import { BlogName } from "./blog_name.js";
import { BlogLink } from "./blog_link.js";
import { Language } from "./language.js";
import { Stat } from "./stat.js";

export interface ImportAttributes {
  id?: number;
  fileDate?: Date;
  fileName?: string;
  phase?: ImportPhase;
  postId?: number;
  contentId?: number;
  tagId?: number;
  resourceId?: number;
  blogId?: number;
  blogNameId?: number;
  blogLinkId?: number;
  languageId?: number;
  statId?: number;
}

export enum ImportPhase {
  "need_import" = "need_import",
  "import_finished" = "import_finished",
  "processed" = "processed",
  "finalized" = "finalized",
}

@Table({
  tableName: "imports",
  modelName: "imports",
  timestamps: false,
  underscored: true,
})
export class Import
  extends Model<ImportAttributes, ImportAttributes>
  implements ImportAttributes
{
  @Column({ allowNull: true, type: DataType.DATE })
  declare fileDate: Date;

  @Column({ allowNull: true, type: DataType.STRING(255) })
  declare fileName: string;

  @Column({
    allowNull: true,
    type: DataType.ENUM(...Object.values(ImportPhase)),
  })
  declare phase: ImportPhase;

  @ForeignKey(() => Post)
  @Column({ allowNull: true, type: DataType.INTEGER })
  declare postId: number;

  @ForeignKey(() => Content)
  @Column({ allowNull: true, type: DataType.INTEGER })
  declare contentId: number;

  @ForeignKey(() => Tag)
  @Column({ allowNull: true, type: DataType.INTEGER })
  declare tagId: number;

  @ForeignKey(() => Resource)
  @Column({ allowNull: true, type: DataType.INTEGER })
  declare resourceId: number;

  @ForeignKey(() => Blog)
  @Column({ allowNull: true, type: DataType.INTEGER })
  declare blogId: number;

  @ForeignKey(() => BlogName)
  @Column({ allowNull: true, type: DataType.INTEGER })
  declare blogNameId: number;

  @ForeignKey(() => BlogLink)
  @Column({ allowNull: true, type: DataType.INTEGER })
  declare blogLinkId: number;

  @ForeignKey(() => Language)
  @Column({ allowNull: true, type: DataType.INTEGER })
  declare languageId: number;

  @Column({ allowNull: true, type: DataType.INTEGER })
  declare statId: number;

  @BelongsTo(() => Post)
  declare post: Post;

  @BelongsTo(() => Content)
  declare content: Content;

  @BelongsTo(() => Tag)
  declare tag: Tag;

  @BelongsTo(() => Resource)
  declare resource: Resource;

  @BelongsTo(() => Blog)
  declare blog: Blog;

  @BelongsTo(() => BlogName)
  declare blogName: BlogName;

  @BelongsTo(() => BlogLink)
  declare blogLink: BlogLink;

  @BelongsTo(() => Language)
  declare language: Language;

  @BelongsTo(() => Stat)
  declare stat: Stat;
}
