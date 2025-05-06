import {
  Model,
  Table,
  Column,
  DataType,
  ForeignKey,
} from "sequelize-typescript";
import { Post } from "./post.js";
import { Resource } from "./resource.js";

export interface PostResourceAttributes {
  position?: number;
  postId: number;
  resourceId: number;
}

@Table({ tableName: "post_resources", schema: "public", timestamps: false })
export class PostResource
  extends Model<PostResourceAttributes, PostResourceAttributes>
  implements PostResourceAttributes
{
  @Column({ allowNull: true, type: DataType.INTEGER })
  declare position?: number;

  @ForeignKey(() => Post)
  @Column({ primaryKey: true, type: DataType.INTEGER })
  declare postId: number;

  @ForeignKey(() => Resource)
  @Column({ primaryKey: true, type: DataType.INTEGER })
  declare resourceId: number;
}
