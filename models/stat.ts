import {
  Model,
  Table,
  Column,
  DataType,
  ForeignKey,
  BelongsTo,
  HasMany,
} from "sequelize-typescript";
import { Language } from "./language.js";
import { BlogName } from "./blog_name.js";
import { Blog } from "./blog.js";
import { Import } from "./import.js";

export interface StatAttributes {
  id?: number;
  from?: Date;
  to?: Date;
  name?: string;
  postsCount?: string;
  contentsCount?: string;
  postsBytes?: string;
  contentsBytes?: string;
  appearances?: string;
  reblogReach?: string;
  rootReach?: string;
  languageId?: number;
  blogNameId?: number;
  blogId?: number;
  importId?: number;
}

@Table({
  tableName: "stats",
  modelName: "stats",
  timestamps: false,
  underscored: true,
})
export class Stat
  extends Model<StatAttributes, StatAttributes>
  implements StatAttributes
{
  @Column({ allowNull: true, type: DataType.DATE })
  declare from: Date;

  @Column({ allowNull: true, type: DataType.DATE })
  declare to: Date;

  @Column({ allowNull: true, type: DataType.STRING(255) })
  declare name: string;

  @Column({ allowNull: true, type: DataType.BIGINT })
  declare postsCount?: string;

  @Column({ allowNull: true, type: DataType.BIGINT })
  declare contentsCount?: string;

  @Column({ allowNull: true, type: DataType.BIGINT })
  declare postsBytes?: string;

  @Column({ allowNull: true, type: DataType.BIGINT })
  declare contentsBytes?: string;

  @Column({ allowNull: true, type: DataType.BIGINT })
  declare appearances?: string;

  @Column({ allowNull: true, type: DataType.BIGINT })
  declare reblogReach?: string;

  @Column({ allowNull: true, type: DataType.BIGINT })
  declare rootReach?: string;

  @ForeignKey(() => Language)
  @Column({ allowNull: true, type: DataType.INTEGER })
  declare languageId?: number;

  @ForeignKey(() => BlogName)
  @Column({ allowNull: true, type: DataType.INTEGER })
  declare blogNameId?: number;

  @ForeignKey(() => Blog)
  @Column({ allowNull: true, type: DataType.INTEGER })
  declare blogId?: number;

  @ForeignKey(() => Import)
  @Column({ allowNull: true, type: DataType.INTEGER })
  declare importId?: number;

  @BelongsTo(() => Language)
  declare language?: Language;

  @BelongsTo(() => BlogName)
  declare blogName?: BlogName;

  @BelongsTo(() => Blog)
  declare blog?: Blog;

  @BelongsTo(() => Import)
  declare import?: Import;

  @HasMany(() => Import, { sourceKey: "id" })
  declare imports?: Import[];
}
