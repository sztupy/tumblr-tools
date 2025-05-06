import {
  Model,
  Table,
  Column,
  DataType,
  ForeignKey,
  BelongsTo,
  BelongsToMany,
  HasMany,
} from "sequelize-typescript";
import { Blog } from "./blog.js";
import { BlogLink } from "./blog_link.js";
import { Post } from "./post.js";
import { Content } from "./content.js";
import { BlogNamePing } from "./blog_name_ping.js";
import { Stat } from "./stat.js";
import { Import } from "./import.js";

export interface BlogNameAttributes {
  id?: number;
  name?: string;
  blogId?: number;
}

@Table({
  tableName: "blog_names",
  modelName: "blog_names",
  timestamps: false,
  underscored: true,
})
export class BlogName
  extends Model<BlogNameAttributes, BlogNameAttributes>
  implements BlogNameAttributes
{
  @Column({ allowNull: true, type: DataType.STRING(255) })
  declare name: string;

  @ForeignKey(() => Blog)
  @Column({ allowNull: true, type: DataType.INTEGER })
  declare blogId?: number;

  @BelongsTo(() => Blog)
  declare blog: Blog;

  @BelongsToMany(() => BlogName, () => BlogLink, "destination_id", "source_id")
  declare source: BlogName[];

  @BelongsToMany(() => BlogName, () => BlogLink, "source_id", "destination_id")
  declare destination: BlogName[];

  @HasMany(() => Post, { sourceKey: "id" })
  declare posts: Post[];

  @HasMany(() => Content, { sourceKey: "id" })
  declare contents: Content[];

  @BelongsToMany(
    () => Content,
    () => BlogNamePing,
    "blog_name_id",
    "content_id",
  )
  declare pingedContents: Content[];

  @HasMany(() => Stat, { sourceKey: "id" })
  declare stats: Stat[];

  @HasMany(() => Import, { sourceKey: "id" })
  declare imports: Import[];
}
