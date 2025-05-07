/* eslint-disable @typescript-eslint/no-unsafe-function-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { downloadImagesFromBodyData, getConfig } from './mediaExport.js';
import { TumblrClientAsync } from './tumblr.js';

export async function apiDownloader(config: any, client: TumblrClientAsync, logger: Function, initScript: Function, mainScript: Function ) {
  try {
    for (const username in config.users) {
      try {
        await initScript(config, username);

        logger("START %s", username);
        const options: Record<string, any> = {
          limit: 50,
          offset: getConfig(config, username, 'offset', 0),
          reblog_info: true,
        }
        if (getConfig(config, username, 'type', null)) {
          options.type = getConfig(config, username, 'type', null)
        }

        while (true) {
          const [body,] = username == 'dashboard' ? await client.userDashboardAsync(options) : await client.blogPostsAsync(username, options);

          if (options.offset === 0) {
            logger("BLOG %s", username);
          }

          if (username == 'dashboard') {
            logger("PRG %s %s", username, options.offset);
          } else {
            logger("PRG %s %s", username, ((options.offset / body.blog.total_posts) * 100).toFixed(3) + "%");
          }

          if (getConfig(config, username, 'dump_media', false)) {
            await downloadImagesFromBodyData(config, body, username)
          }

          await mainScript(config, username, options, body);

          const max_offset = getConfig(config, username, 'max_offset', null)

          if (body.posts.length >= options.limit && (!max_offset || options.offset < max_offset)) {
            options.offset += options.limit;
          } else {
            logger("DONE %s", username);
            break;
          }
        }
      } catch (error) {
        logger(error);
      }
    };
  } catch (error) {
    logger(error);
  }
}
