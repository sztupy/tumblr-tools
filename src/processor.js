import fs from 'fs';
import lodash from 'lodash';
import Zip from 'node-stream-zip';
import Sequelize from 'sequelize';
import crypto from 'crypto';

export default class Processor {
  constructor(database, fileName, options = {}) {
    this.database = database;
    this.options = options;

    this.cachedBlogNames = {};
    this.cachedLanguages = {};

    this.stats = {};

    this.currentImport = null;
  }

  run() {
    this.currentImport = await this.database.Import.findOne({ order: [ [ 'id','DESC'] ] });

    let counter = 0;

    let remaining = await this.database.Content.count({ where: { processed: false }});

    let results = ['a'];

    while (results.length != 0) {
      counter += 1;

      const startTime = Date.now();
      results = await this.database.Content.findAll({ where: { processed: false }, limit: 1000 });

      const transaction = await this.database.sequelize.transaction();

      let processes = [];

      for (const content of results) {
        processes.push(this.processContent(transaction, content));
      };

      for (const process of processes) {
        await process;
      };

      if (counter % 100 == 0) {
        console.log('Clearing cache');
        this.cachedBlogNames = {};
        this.cachedLanguages = {};

        counter = 0;
      }

      await transaction.commit();

      const endTime = Date.now();
      console.log(`Done pack ${remaining} in ${endTime - startTime}ms`);

      remaining -= results.length;
    }

    console.log("Finished processing");

    this.currentImport.phase = 'processed';
    this.currentImport.save();

    console.log(this.currentImport);
  }

  async processContent(transaction, content) {

  }

  async getBlogName(transaction, userName) {
    if (typeof userName != 'number') {
      userName = userName.substring(0,32);
    }
    let databaseBlogName = this.cachedBlogNames[userName];

    if (!databaseBlogName) {
      if (typeof userName == 'number') {
        databaseBlogName = await this.database.BlogName.findByPk(userName, {transaction: transaction});
      } else {
        [databaseBlogName, ] = await this.database.BlogName.findCreateFind({where: { name: userName }, defaults: { name: userName }, transaction: transaction});
      }
      this.cachedBlogNames[userName] = databaseBlogName;
    }

    return databaseBlogName;
  }
}
