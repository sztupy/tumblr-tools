import { DataTypes } from "sequelize";
import { Migration } from "../migrate.js";

export const up: Migration = async (params) => {
  const queryInterface = params.context
  await queryInterface.addColumn('posts', 'exported', {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: true
  })
}

export const down: Migration = async (params) => {
  const queryInterface = params.context
  await queryInterface.removeColumn('posts', 'exported')
}
