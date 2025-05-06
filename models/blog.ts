import { Model, Table, Column, DataType, HasMany } from "sequelize-typescript";
import { BlogName } from "./blog_name.js";
import { Stat } from "./stat.js";
import { Import } from "./import.js";

export interface BlogAttributes {
  id?: number;
  name?: string;
  type?: BlogType;
}

export enum BlogType {
  "active" = "active",
  "deactivated" = "deactivated",
}

@Table({
  tableName: "blogs",
  modelName: "blogs",
  timestamps: false,
  underscored: true,
})
export class Blog
  extends Model<BlogAttributes, BlogAttributes>
  implements BlogAttributes
{
  @Column({ allowNull: true, type: DataType.STRING(255) })
  declare name: string;

  @Column({ allowNull: true, type: DataType.ENUM(...Object.values(BlogType)) })
  declare type: BlogType;

  @HasMany(() => BlogName, { sourceKey: "id" })
  declare blogNames: BlogName[];

  @HasMany(() => Stat, { sourceKey: "id" })
  declare stats?: Stat[];

  @HasMany(() => Import, { sourceKey: "id" })
  declare imports?: Import[];
}
