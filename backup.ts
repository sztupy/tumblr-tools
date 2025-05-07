/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs';
import { createClient } from './lib/tumblr/index.js';
import { environment } from './environment.js';
import { eachLimit } from 'async';
import archiver from 'archiver';
import { fileURLToPath } from 'url';
import path from 'path';

const client = createClient(environment.tumblrKeys);
const usernames = fs.readFileSync('blogs.dat').toString().trim().split("\n");

const MAX_DASHBOARD_OFFSET = 100;
const CONCURRENCY = 10;
const DUMP_MEDIA = false;

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename);

if (!fs.existsSync(__dirname + "/dump")) {
  fs.mkdirSync(__dirname + "/dump");
}

try {
  await eachLimit(usernames, CONCURRENCY, async function (username) {
    try {
      if (!fs.existsSync(__dirname + "/dump/" + username)) {
        fs.mkdirSync(__dirname + "/dump/" + username);
      }
      console.log("START %s", username);
      const options = {
        limit: 50,
        offset: 0,
        reblog_info: true
      }
      while (true) {
        const [body,] = username == 'dashboard' ? await client.userDashboardAsync(options) : await client.blogPostsAsync(username, options);

        if (options.offset === 0) {
          console.log("BLOG %s", username);
        }

        if (username == 'dashboard') {
          console.log("PRG %s %s", username, options.offset);
        } else {
          console.log("PRG %s %s", username, ((options.offset / body.blog.total_posts) * 100).toFixed(3) + "%");
        }

        const json = JSON.stringify(body);
        fs.writeFile('dump/' + username + '/dump-' + options.offset + '.json', json, 'utf8', function () { });

        if (username == 'dashboard' ? MAX_DASHBOARD_OFFSET > options.offset : body.posts.length >= options.limit) {
          options.offset += options.limit;
        } else {
          console.log("DONE %s", username);
          break;
        }
      }
    } catch (error) {
      console.log(error);
    }
  });
} catch (error) {
  console.log(error);
}

const output = fs.createWriteStream(__dirname + `/backup-${Date.now()}.zip`);
const archive = archiver('zip', {
  zlib: { level: 9 } // Sets the compression level.
});

output.on('close', function () {
  console.log(archive.pointer() + ' total bytes');
  console.log('dump has been finalized and the output file descriptor has closed.');
});

archive.on('error', function (err) {
  console.log(err);
});

archive.pipe(output);

archive.directory(__dirname + '/dump', 'dump');

archive.finalize();
