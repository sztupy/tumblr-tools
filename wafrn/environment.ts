import { environment as tumblrEnvironment } from '../environment.js';

export const environment = {
  logSQLQueries: tumblrEnvironment.logSql,
  databaseConnectionString: tumblrEnvironment.wafrnDatabase,
  adminUser: "admin",
  adminPassword: "AdminPassword1",
  adminEmail: "mail@sztupy.hu",
  deletedUser: "@DELETEDUSER",
  saltRounds: 14,
  pinoTransportOptions: {
    targets: [
      {
        target: 'pino/file',
        level: 0,
        options: {
          destination: 1
        }
      }
    ]
  },
  logLevel: 'debug'
}
