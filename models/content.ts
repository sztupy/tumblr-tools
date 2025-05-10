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
import { BlogNamePing } from "./blog_name_ping.js";
import { Post } from "./post.js";
import { PostContent } from "./post_content.js";
import { Language } from "./language.js";
import { ContentLanguage } from "./content_language.js";
import { Import } from "./import.js";
import { BelongsToGetAssociationMixin } from "sequelize";

export interface ContentAttributes {
  id?: number;
  tumblrId?: string;
  version?: string;
  text?: string;
  processed?: boolean;
  blogNameId?: number;
}

@Table({
  tableName: "contents",
  modelName: "contents",
  timestamps: false,
  underscored: true,
})
export class Content
  extends Model<ContentAttributes, ContentAttributes>
  implements ContentAttributes
{
  @Column({ allowNull: true, type: DataType.BIGINT })
  declare tumblrId: string;

  @Column({ allowNull: true, type: DataType.STRING(64) })
  declare version: string;

  @Column({ allowNull: true, type: DataType.TEXT })
  declare text: string;

  @Column({ type: DataType.BOOLEAN, defaultValue: Sequelize.literal("false") })
  declare processed: boolean;

  @ForeignKey(() => BlogName)
  @Column({ allowNull: true, type: DataType.INTEGER })
  declare blogNameId: number;

  @BelongsTo(() => BlogName)
  declare blogName: BlogName;
  declare getBlogName: BelongsToGetAssociationMixin<BlogName>;

  @BelongsToMany(
    () => BlogName,
    () => BlogNamePing,
    "content_id",
    "blog_name_id",
  )
  declare pingedBlogNames: BlogName[];

  @HasMany(() => PostContent, { sourceKey: "id" })
  declare postContents: PostContent[];

  @BelongsToMany(() => Post, () => PostContent)
  declare posts: Array<Post & { post_contents: PostContent }>;

  @BelongsToMany(() => Language, () => ContentLanguage)
  declare languages: Language[];

  @HasMany(() => Import, { sourceKey: "id" })
  declare imports: Import[];
}
