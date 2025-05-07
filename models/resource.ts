/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Model,
  Table,
  Column,
  DataType,
  BelongsToMany,
  HasMany,
} from "sequelize-typescript";
import { Post } from "./post.js";
import { PostResource } from "./post_resource.js";
import { Import } from "./import.js";

export interface ResourceAttributes {
  id?: number;
  type?: string;
  url?: string;
  localUrl?: string;
  external?: boolean;
  meta?: Record<string, any>;
}

@Table({
  tableName: "resources",
  modelName: "resources",
  timestamps: false,
  underscored: true,
})
export class Resource
  extends Model<ResourceAttributes, ResourceAttributes>
  implements ResourceAttributes
{
  @Column({ allowNull: true, type: DataType.STRING(255) })
  declare type: string;

  @Column({ allowNull: true, type: DataType.STRING(255) })
  declare url: string;

  @Column({ allowNull: true, type: DataType.STRING(255) })
  declare localUrl: string;

  @Column({ allowNull: true, type: DataType.BOOLEAN })
  declare external: boolean;

  @Column({ allowNull: true, type: DataType.JSONB })
  declare meta: Record<string, any>;

  @BelongsToMany(() => Post, () => PostResource)
  declare posts: Post[];

  @HasMany(() => Import, { sourceKey: "id" })
  declare imports: Import[];
}
