import {
  Model,
  Table,
  Column,
  DataType,
  ForeignKey,
} from "sequelize-typescript";
import { Post } from "./post.js";
import { Tag } from "./tag.js";

export interface PostTagAttributes {
  position?: number;
  postId: number;
  tagId: number;
}

@Table({
  tableName: "post_tags",
  modelName: "post_tags",
  timestamps: false,
  underscored: true,
})
export class PostTag
  extends Model<PostTagAttributes, PostTagAttributes>
  implements PostTagAttributes
{
  @Column({ allowNull: true, type: DataType.INTEGER })
  declare position?: number;

  @ForeignKey(() => Post)
  @Column({ primaryKey: true, type: DataType.INTEGER })
  declare postId: number;

  @ForeignKey(() => Tag)
  @Column({ primaryKey: true, type: DataType.INTEGER })
  declare tagId: number;
}
