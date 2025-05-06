import { Sequelize } from "sequelize-typescript";
import { environment } from "../environment.js";

const sequelize = new Sequelize(environment.databaseConnectionString, {
  logging:
    environment.logSql &&
    ((sql: string, timingMs?: number) => {
      if ((timingMs || 0) > 1000)
        console.log(`SLOW QUERY: ${sql} - Elapsed time: ${timingMs}ms`);
    }),
  benchmark: true,
  define: {
    underscored: true,
    timestamps: false,
    charset: "utf8",
  },
});

export { sequelize, sequelize as Sequelize };
