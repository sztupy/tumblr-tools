/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs';
import Axios from 'axios';
import * as stream from 'stream';
import { promisify } from 'util';
import { JSDOM } from "jsdom";
import { fileURLToPath } from 'url';
import pathUtil from 'path';

const finished = promisify(stream.finished);
const recentFiles: Record<string, boolean> = {}

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = pathUtil.dirname(__filename);

export function getConfig(config: any, username: string, key: string, defaultValue: any = null) {
  return config.users[username]?.[key] || config.defaults[key] || defaultValue
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

async function downloadImage(config: any, url: string, blogName: string, postBlogName: string) {
  if (getConfig(config, blogName, 'dump_media', false) && (blogName == postBlogName || getConfig(config, blogName, 'dump_all_media', false))) {
    let name = "";
    let path = "";
    if (url.match("tumblr.com")) {
      const fragments = url.split('/')
      while (name.length < 8)
        name = name + fragments.pop()

      name = name.replaceAll(/[^a-zA-Z0-9._-]/g, '_')
      path = getConfig(config, blogName, 'media_export_dir', `${__dirname}/../dump/tumblr_files`) + '/' + name;
    } else {
      name = url.replaceAll(/[^a-zA-Z0-9._-]/g, '_')
      path = getConfig(config, blogName, 'external_media_export_dir', `${__dirname}/../dump/tumblr_files/external`) + '/' + name;
    }

    if (!fs.existsSync(pathUtil.dirname(path))) {
      fs.mkdirSync(pathUtil.dirname(path), { recursive: true });
    }

    if (!fs.existsSync(path) || !fs.statSync(path).size) {
      await downloadFile(url, path);
    }
  }
}

async function fetchPhotos(config: any, post: any, blogName: string) {
  const firstTrail = post.trail.first
  const trailUser = firstTrail?.blog.name

  for (const element of post.photos) {
    await fetchPhoto(config, element, blogName, post.reblogged_root_name || trailUser || post.blog_name);
  };
}

async function fetchPhoto(config: any, photo: any, blogName: string, postBlogName: string) {
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
      await downloadImage(config, url, blogName, postBlogName);
      return;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) { /* empty */ }
  }
}

export async function downloadImagesFromBodyData(config: any, body: any, username: string) {
  const promises: Promise<any>[] = [];

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
            promises.push(downloadImage(config, source, username, poster_user));
          }
        }

        for (const el of dom.window.document.getElementsByTagName('video')) {
          const source = el.getAttribute('poster')
          if (source) {
            promises.push(downloadImage(config, source, username, poster_user));
          }
        }
      } catch (error) {
        console.log("Could not download video");
        console.log(error);
      }
    } else if (post.type == "audio" && post.audio_url && post.audio_url.match("tumblr.com")) {
      promises.push(downloadImage(config, post.audio_url, username, poster_user));
    } else if (post.type == "photo") {
      if (post.photos)
        promises.push(fetchPhotos(config, post, username));
    } else if (post.type == "link") {
      if (post.photos)
        promises.push(fetchPhotos(config, post, username));
    }

    for (const trail of post.trail) {
      const content = trail.content_raw.replaceAll('[[MORE]]', '<!-- [[MORE]] -->')
      try {
        const dom = new JSDOM(content);
        for (const el of dom.window.document.getElementsByTagName('img')) {
          const source = el.getAttribute('src')
          if (source) {
            promises.push(downloadImage(config, source, username, post.blog.name));
          }
        }
      } catch (error) {
        console.log("Could not download image");
        console.log(error);
      }
    }
  }

  try {
    await Promise.all(promises);
  } catch (error) {
    console.log(error);
  }
}
