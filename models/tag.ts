import {
  Model,
  Table,
  Column,
  DataType,
  BelongsToMany,
  HasMany,
} from "sequelize-typescript";
import { Post } from "./post.js";
import { PostTag } from "./post_tag.js";
import { Import } from "./import.js";

export interface TagAttributes {
  id?: number;
  name?: string;
}

@Table({
  tableName: "tags",
  modelName: "tags",
  timestamps: false,
  underscored: true,
})
export class Tag
  extends Model<TagAttributes, TagAttributes>
  implements TagAttributes
{
  @Column({ allowNull: true, type: DataType.STRING(65535) })
  name?: string;

  @BelongsToMany(() => Post, () => PostTag)
  posts?: Post[];

  @HasMany(() => Import, { sourceKey: "id" })
  imports?: Import[];
}
