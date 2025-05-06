import {
  Model,
  Table,
  Column,
  DataType,
  ForeignKey,
} from "sequelize-typescript";
import { Post } from "./post.js";
import { Language } from "./language.js";

export interface PostLanguageAttributes {
  percentage?: number;
  score?: number;
  postId: number;
  languageId: number;
}

@Table({
  tableName: "post_languages",
  schema: "post_languages",
  timestamps: false,
  underscored: true,
})
export class PostLanguage
  extends Model<PostLanguageAttributes, PostLanguageAttributes>
  implements PostLanguageAttributes
{
  @Column({ allowNull: true, type: DataType.INTEGER })
  declare percentage: number;

  @Column({ allowNull: true, type: DataType.INTEGER })
  declare score: number;

  @ForeignKey(() => Post)
  @Column({ primaryKey: true, type: DataType.INTEGER })
  declare postId: number;

  @ForeignKey(() => Language)
  @Column({ primaryKey: true, type: DataType.INTEGER })
  declare languageId: number;
}
