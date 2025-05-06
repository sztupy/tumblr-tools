import {
  Model,
  Table,
  Column,
  DataType,
  BelongsToMany,
  HasMany,
} from "sequelize-typescript";
import { Post } from "./post.js";
import { PostLanguage } from "./post_language.js";
import { Content } from "./content.js";
import { ContentLanguage } from "./content_language.js";
import { Stat } from "./stat.js";
import { Import } from "./import.js";

export interface LanguageAttributes {
  id?: number;
  name?: string;
}

@Table({
  tableName: "languages",
  modelName: "languages",
  timestamps: false,
  underscored: true,
})
export class Language
  extends Model<LanguageAttributes, LanguageAttributes>
  implements LanguageAttributes
{
  @Column({ allowNull: true, type: DataType.STRING(255) })
  declare name: string;

  @BelongsToMany(() => Post, () => PostLanguage)
  declare posts: Post[];

  @BelongsToMany(() => Content, () => ContentLanguage)
  declare contents: Content[];

  @HasMany(() => Stat, { sourceKey: "id" })
  declare stats: Stat[];

  @HasMany(() => Import, { sourceKey: "id" })
  declare imports: Import[];
}
