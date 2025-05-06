import {
  Model,
  Table,
  Column,
  DataType,
  ForeignKey,
} from "sequelize-typescript";
import { Content } from "./content.js";
import { BlogName } from "./blog_name.js";

export interface BlogNamePingAttributes {
  contentId: number;
  blogNameId: number;
}

@Table({
  tableName: "blog_name_pings",
  modelName: "blog_name_pings",
  timestamps: false,
  underscored: true,
})
export class BlogNamePing
  extends Model<BlogNamePingAttributes, BlogNamePingAttributes>
  implements BlogNamePingAttributes
{
  @ForeignKey(() => Content)
  @Column({ primaryKey: true, type: DataType.INTEGER })
  declare contentId: number;

  @ForeignKey(() => BlogName)
  @Column({ primaryKey: true, type: DataType.INTEGER })
  declare blogNameId: number;
}
