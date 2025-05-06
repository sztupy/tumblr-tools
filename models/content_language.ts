import {
  Model,
  Table,
  Column,
  DataType,
  ForeignKey,
} from "sequelize-typescript";
import { Content } from "./content.js";
import { Language } from "./language.js";

export interface ContentLanguageAttributes {
  percentage?: number;
  score?: number;
  contentId: number;
  languageId: number;
}

@Table({
  tableName: "content_languages",
  modelName: "content_languages",
  timestamps: false,
  underscored: true,
})
export class ContentLanguage
  extends Model<ContentLanguageAttributes, ContentLanguageAttributes>
  implements ContentLanguageAttributes
{
  @Column({ allowNull: true, type: DataType.INTEGER })
  declare percentage: number;

  @Column({ allowNull: true, type: DataType.INTEGER })
  declare score: number;

  @ForeignKey(() => Content)
  @Column({ primaryKey: true, type: DataType.INTEGER })
  declare contentId: number;

  @ForeignKey(() => Language)
  @Column({ primaryKey: true, type: DataType.INTEGER })
  declare languageId: number;
}
