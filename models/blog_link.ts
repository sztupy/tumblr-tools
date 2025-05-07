import {
  Model,
  Table,
  Column,
  DataType,
  ForeignKey,
  HasMany,
  BelongsTo,
} from "sequelize-typescript";
import { Import } from "./import.js";
import { BlogName } from "./blog_name.js";

export interface BlogLinkAttributes {
  id?: number;
  type?: BlogLinkType;
  destinationId?: number;
  importId?: number;
  meta?: object;
  sourceId?: number;
}

export enum BlogLinkType {
  "author" = "author",
  "manual" = "manual",
  "rename" = "rename",
}

@Table({
  tableName: "blog_links",
  modelName: "blog_links",
  timestamps: false,
  underscored: true,
})
export class BlogLink
  extends Model<BlogLinkAttributes, BlogLinkAttributes>
  implements BlogLinkAttributes
{
  @Column({
    type: DataType.INTEGER,
    field: "id",
    allowNull: false,
    autoIncrement: true,
    primaryKey: true,
  })
  declare id: number;

  @Column({
    allowNull: true,
    type: DataType.ENUM(...Object.values(BlogLinkType)),
  })
  declare type: BlogLinkType;

  @ForeignKey(() => BlogName)
  @Column({ allowNull: true, type: DataType.INTEGER })
  declare destinationId: number;

  @ForeignKey(() => Import)
  @Column({ allowNull: true, type: DataType.INTEGER })
  declare importId: number;

  @Column({ allowNull: true, type: DataType.JSONB })
  declare meta: object;

  @ForeignKey(() => BlogName)
  @Column({ allowNull: true, type: DataType.INTEGER })
  declare sourceId: number;

  @HasMany(() => Import, { sourceKey: "id" })
  declare imports: Import[];

  @BelongsTo(() => BlogName)
  declare destination: BlogName;

  @BelongsTo(() => BlogName)
  declare source: BlogName;
}
