/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs';
import { createClient } from './lib/tumblr/index.js';
import { environment } from './environment.js';
import { eachLimit } from 'async';
import archiver from 'archiver';
import { fileURLToPath } from 'url';
import path from 'path';
import { JSDOM } from "jsdom";
import Axios from 'axios';
import * as stream from 'stream';
import { promisify } from 'util';
import YAML from 'yaml'

const client = createClient(environment.tumblrKeys);
const config = YAML.parse(fs.readFileSync(process.argv[2] || 'backup_config.yaml').toString())

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename);

if (!fs.existsSync(__dirname + "/dump")) {
  fs.mkdirSync(__dirname + "/dump");
}

const finished = promisify(stream.finished);
const recentFiles: Record<string, boolean> = {}

function getConfig(username: string, key: string, defaultValue: any = null) {
  return config.users[username][key] || config.defaults[key] || defaultValue
}

async function downloadFile(fileUrl: string, outputLocationPath: string): Promise<any> {
  const cacheKey = fileUrl + ':' + outputLocationPath
  if (!recentFiles[cacheKey]) {
    recentFiles[cacheKey] = true;
    const writer = fs.createWriteStream(outputLocationPath);
    return Axios({
      method: 'get',
      url: fileUrl,
      responseType: 'stream',
    }).then(response => {
      response.data.pipe(writer);
      return finished(writer);
    });
  }
}

async function downloadImage(url: string, blogName: string, postBlogName: string) {
  if (getConfig(blogName, 'dump_media', false) && (blogName == postBlogName || getConfig(blogName, 'dump_all_media', false))) {
    let name = "";
    let path = "";
    if (url.match("tumblr.com")) {
      const fragments = url.split('/')
      while (name.length < 8)
        name = name + fragments.pop()

      path = `${__dirname}/dump/tumblr_files/${name}`
    } else {
      name = url.replaceAll(/[^a-zA-Z0-9._-]/, '_')
      path = `${__dirname}/dump/tumblr_files/external/${name}`
    }

    if (!fs.existsSync(__dirname + "/dump/tumblr_files")) {
      fs.mkdirSync(__dirname + "/dump/tumblr_files");
    }
    if (!fs.existsSync(__dirname + "/dump/tumblr_files/external")) {
      fs.mkdirSync(__dirname + "/dump/tumblr_files/external");
    }

    if (!fs.existsSync(path) || !fs.statSync(path).size) {
      await downloadFile(url, path);
    }
  }
}

async function fetchPhotos(post: any, blogName: string) {
  const firstTrail = post.trail.first
  const trailUser = firstTrail?.blog.name

  for (const element of post.photos) {
    await fetchPhoto(element, blogName, post.reblogged_root_name || trailUser || post.blog_name);
  };
}

async function fetchPhoto(photo: any, blogName: string, postBlogName: string) {
  const sizes = photo.alt_sizes
  if (photo.original_size)
    sizes.push(photo.original_size)

  if (!sizes)
    return

  sizes.sort((a: any, b: any) => b.width - a.width);

  for (const size of sizes) {
    const url = size.url;
    if (!url)
      continue;

    try {
      await downloadImage(url, blogName, postBlogName);
      return;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) { /* empty */ }
  }
}

try {
  await eachLimit(Object.keys(config.users), config.concurrency || 10, async function (username) {
    try {
      if (!fs.existsSync(__dirname + "/dump/" + username)) {
        fs.mkdirSync(__dirname + "/dump/" + username);
      }
      console.log("START %s", username);
      const options = {
        limit: 50,
        offset: getConfig(username, 'offset', 0),
        reblog_info: true,
        type: 'audio'
      }
      while (true) {
        const [body,] = username == 'dashboard' ? await client.userDashboardAsync(options) : await client.blogPostsAsync(username, options);
        const promises: Promise<any>[] = [];

        if (options.offset === 0) {
          console.log("BLOG %s", username);
        }

        if (username == 'dashboard') {
          console.log("PRG %s %s", username, options.offset);
        } else {
          console.log("PRG %s %s", username, ((options.offset / body.blog.total_posts) * 100).toFixed(3) + "%");
        }

        if (getConfig(username, 'dump_media', false)) {
          for (const post of body.posts) {
            const first_trail = post.trail[0]
            const trail_user = first_trail?.blog.name
            const poster_user = post['reblogged_root_name'] || trail_user || post['blog_name']

            if (post.type == "video") {
              try {
                const player = post.player.sort((a: any, b: any) => b.width - a.width)[0].embed_code

                const dom = new JSDOM(player);
                for (const el of dom.window.document.getElementsByTagName('source')) {
                  const source = el.getAttribute('src')
                  if (source) {
                    promises.push(downloadImage(source, username, poster_user));
                  }
                }

                for (const el of dom.window.document.getElementsByTagName('video')) {
                  const source = el.getAttribute('poster')
                  if (source) {
                    promises.push(downloadImage(source, username, poster_user));
                  }
                }
              } catch (error) {
                console.log("Could not download video");
                console.log(error);
              }
            } else if (post.type == "audio" && post.audio_url && post.audio_url.match("tumblr.com")) {
              promises.push(downloadImage(post.audio_url, username, poster_user));
            } else if (post.type == "photo") {
              if (post.photos)
                promises.push(fetchPhotos(post, username));
            } else if (post.type == "link") {
              if (post.photos)
                promises.push(fetchPhotos(post, username));
            }

            for (const trail of post.trail) {
              const content = trail.content_raw.replaceAll('[[MORE]]', '<!-- [[MORE]] -->')
              try {
                const dom = new JSDOM(content);
                for (const el of dom.window.document.getElementsByTagName('img')) {
                  const source = el.getAttribute('src')
                  if (source) {
                    promises.push(downloadImage(source, username, post.blog.name));
                  }
                }
              } catch (error) {
                console.log("Could not download image");
                console.log(error);
              }
            }
          }
        }

        try {
          await Promise.all(promises);
        } catch (error) {
          console.log(error);
        }

        const json = JSON.stringify(body);
        fs.writeFile('dump/' + username + '/dump-' + options.offset + '.json', json, 'utf8', function () { });

        const max_offset = getConfig(username, 'max_offset', null)

        if (body.posts.length >= options.limit && (!max_offset || options.offset < max_offset)) {
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
