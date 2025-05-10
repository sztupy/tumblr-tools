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

export interface PostContentAttributes {
  position: number;
  isLast?: boolean;
  postId: number;
  contentId: number;
}

@Table({
  tableName: "post_contents",
  modelName: "post_contents",
  timestamps: false,
  underscored: true,
})
export class PostContent
  extends Model<PostContentAttributes, PostContentAttributes>
  implements PostContentAttributes
{
  @Column({ allowNull: false, type: DataType.INTEGER })
  declare position: number;

  @Column({ allowNull: true, type: DataType.BOOLEAN })
  declare isLast: boolean;

  @ForeignKey(() => Post)
  @Column({ primaryKey: true, type: DataType.INTEGER })
  declare postId: number;

  @ForeignKey(() => Content)
  @Column({ primaryKey: true, type: DataType.INTEGER })
  declare contentId: number;

  @BelongsTo(() => Post)
  declare post: Post;

  @BelongsTo(() => Content)
  declare content: Content;
}
