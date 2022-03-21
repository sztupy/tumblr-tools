import fs from 'fs';
import lodash from 'lodash';
import cheerio from 'cheerio';
import Zip from 'node-stream-zip';
import { promisify } from 'util';
import Sequelize from 'sequelize';
import crypto from 'crypto';

const readFileAsync = promisify(fs.readFile);

function clearEmpties(o) {
  for (var k in o) {
    if (o[k] === null || typeof o[k] === 'undefined' || o[k] === "") {
      delete o[k];
    }

    if (typeof o[k] === "array" && o[k].length === 0) {
      delete o[k];
    }

    if (!o[k] || typeof o[k] !== "object") {
      continue
    }

    clearEmpties(o[k]);

    if (Object.keys(o[k]).length === 0) {
      delete o[k];
    }
  }
  return o;
}

export default class Importer {
  constructor(database) {
    this.database = database;
    this.cachedBlogs = {};
    this.cachedBlogLinks = {};
    this.cachedBlogNames = {};
    this.cachedTags = {};
    this.cachedLanguages = {};
    this.stats = {};
    this.start = false;
    this.currentImport = null;
  }

  run() {
    const fileName = "d:/magyar-tumbli-2018.zip";
    const { birthtime } = fs.statSync(fileName);
    const zip = new Zip({file: fileName});

    zip.on('ready', async () => {
      const importData = {
        file_date: birthtime,
        file_name: fileName,
        phase: 'need_import'
      };

      [this.currentImport, ] = await this.database.Import.findCreateFind({
        where: {
          file_date: birthtime
        },
        defaults: importData
      });

      let counter = 0;

      for (const entry of Object.values(zip.entries())) {
        //if (entry.name.indexOf('dump/viiviiennna/dump-5600.json') != -1) {
          this.start = true;
        //}
        if (this.start && entry.isFile) {
          const startTime = Date.now();
          console.log(`Starting ${entry.name}`);
          counter += 1;
          if (counter % 100 == 0) {
            this.cachedBlogs = {};
            this.cachedBlogLinks = {};
            this.cachedBlogNames = {};
            this.cachedTags = {};
            this.cachedLanguages = {};
            counter = 0;
            console.log('Clearing cache');
          }
          const blog = JSON.parse(zip.entryDataSync(entry));

          if (blog.blog && blog.blog.name) {
            const transaction = await this.database.sequelize.transaction();

            const userName = blog.blog.name;
            const databaseBlogName = await this.getBlogName(transaction, userName);

            this.stats['new_posts'] = 0;
            this.stats['new_content'] = 0;
            this.stats['dup_content'] = 0;

            for (const post of blog.posts) {
              await this.importPost(transaction, post, userName, databaseBlogName);
            };

            await transaction.commit();
          } else {
            console.log(`Invalid file ${entry.name}`);
          }
          const endTime = Date.now();
          console.log(this.stats);
          console.log(`Done with ${entry.name} in ${endTime - startTime}ms`);
        }
      }

      console.log("Finished import");

      this.currentImport.postId = (await this.database.sequelize.query("SELECT MAX(id) as id from posts;"))[0][0]['id'];
      this.currentImport.contentId = (await this.database.sequelize.query("SELECT MAX(id) as id from contents;"))[0][0]['id'];
      this.currentImport.tagId = (await this.database.sequelize.query("SELECT MAX(id) as id from tags;"))[0][0]['id'];
      this.currentImport.resourceId = (await this.database.sequelize.query("SELECT MAX(id) as id from resources;"))[0][0]['id'];
      this.currentImport.blogNameId = (await this.database.sequelize.query("SELECT MAX(id) as id from blog_names;"))[0][0]['id'];
      this.currentImport.blogId = (await this.database.sequelize.query("SELECT MAX(id) as id from blogs;"))[0][0]['id'];
      this.currentImport.blogLinkId = (await this.database.sequelize.query("SELECT MAX(id) as id from blog_links;"))[0][0]['id'];
      this.currentImport.languageId = (await this.database.sequelize.query("SELECT MAX(id) as id from languages;"))[0][0]['id'];
      this.currentImport.phase = 'import_finished';
      this.currentImport.save();

      console.log(this.currentImport);
      zip.close();
    });
  }

  async importPost(transaction, post, userName, databaseBlogName) {
    let databasePost = await this.database.Post.findOne({ where: { tumblr_id: post.id }, transaction: transaction });

    if (!databasePost) {
      let meta = {};

      meta['source'] = {
        'title': post["source_title"],
        'url': post['source_url']
      }

      let rootId = post['reblogged_root_id'];
      let fromId = post['reblogged_from_id'];
      let rootBlogName = null;
      let fromBlogName = null;

      if (post['reblogged_from_name']) {
        fromBlogName = await this.getBlogName(transaction, post['reblogged_from_name']);
      }

      if (post['reblogged_root_name']) {
        rootBlogName = await this.getBlogName(transaction, post['reblogged_root_name']);
      }

      if (post['post_author']) {
        meta['author'] = await this.getBlogName(transaction, post['post_author']).id;
      }

      let probableRootName = meta['reblogged_root_name'];
      if (!probableRootName && post['trail'] && post['trail'][0]) {
        probableRootName = post['trail'][0]['blog']['name'];
      }
      if (!probableRootName) {
        probableRootName = userName;
      }

      let title = post['title'] || "";
      let body = "";

      if (post['reblogged_root_name']) {
        rootBlogName = await this.getBlogName(transaction, post['reblogged_root_name']);
      } else {
        rootBlogName = await this.getBlogName(transaction, probableRootName);
      }

      switch(post.type) {
        case 'text': break;
        case 'link':
          meta['post'] = {
            author: post["link_author"],
            publisher: post['publisher'],
            url: post['url']
          }
          body = post['excerpt'];
          break;
        case 'photo':
          meta['post'] = {
            layout: post['photoset_layout']
          }
          break;
        case 'audio':
          meta['post'] = {
            'provider': post['provider_url'],
            'artist': post['artist'],
            'album': post['album'],
            'type': post['audio_type'],
            'track': post['track_name'],
            'album_art': post['album_art'],
            'url': post['audio_url'],
            'source_url': post['audio_source_url'],
            'embed': post['embed']
          }

          const audioTitle = lodash.compact([ post['artist'], post['track_name'], post['album'] ]).join(" - ");
          if (audioTitle!='') { title = audioTitle };
          break;
        case 'quote':
          body = "\"" + post['text']+"\"\n"+"\n"+post['source'];
          break;
        case 'chat':
          if (post.dialogue) {
            body = "";
            for (const line of post.dialogue) {
              body = line.label + " " + line.phrase + "\n";
            }
          }
          break;
        case 'video':
          meta['post'] = {
            'type': post['video_type'],
            'player': post.player,
            'embed': post.player.sort((a,b) => b.width - a.width)[0]['embed_code'],
            'details': post['video'],
            'url': post['video_url'] || post['permalink_url']
          }
          break;
        case 'answer':
          meta['post'] = {
            'name': post['asking_name'],
            'url': post['asking_url']
          }
          body = post['question'];
          break;
      }

      let contentData = null;

      if (title.length > 132) {
        body = title + "\n" + body;
        title = title.substring(0,132) + "...";
      }

      if (body && body != "") {
        contentData = [
          rootId || post.id,
          crypto.createHash('sha256').update(body,'utf-8').digest('hex'),
          body,
          null
        ];
      }

      let tags = post.tags || [];

      const data = {
        tumblr_id: post.id,
        url: post.post_url,
        type: post.type,
        meta: clearEmpties(meta),
        title: title || "",
        date: new Date(post.timestamp*1000),
        blogNameId: databaseBlogName.id,
        root_tumblr_id: rootId,
        from_tumblr_id: fromId,
        fromBlogNameId: fromBlogName ? fromBlogName.id : null,
        rootBlogNameId: rootBlogName ? rootBlogName.id : null,
        root: this.determinePostRootType(post, userName)
      }

      this.stats['new_posts'] += 1;
      databasePost = await this.database.Post.create(data, { transaction: transaction });
        
      if (post.post_author) {
        await this.mergeBlogs(transaction, post.post_author, userName, 'author', { post_id: databasePost.id });
      }

      if (contentData) {
        await this.importContentData(transaction, contentData, databasePost, -1, false);
      }

      for (let i = 0; i < tags.length; i++) {
        let databaseTag = this.cachedTags[tags[i]];
        if (!databaseTag) {
          [databaseTag, ] = await this.database.Tag.findCreateFind({
            where: { name: tags[i] },
            defaults: { name: tags[i] },
            transaction: transaction
          });
          this.cachedTags[tags[i]] = databaseTag;
        }
        await this.database.sequelize.query("INSERT INTO post_tags (post_id,tag_id,position) VALUES (?,?,?) ON CONFLICT DO NOTHING;", {
          replacements: [ databasePost.id, databaseTag.id, i],
          type: Sequelize.QueryTypes.RAW,
          transaction: transaction
        });
      }
    }

    await this.importPhotos(transaction, post, databasePost);

    await this.importContent(transaction, post, databasePost, userName);
  }

  async importContent(transaction, post, databasePost, userName) {
    if (post.trail) {
      for (let position = 0; position < post.trail.length; position++) {
        const content = post.trail[position];
        const last = (position == post.trail.length - 1) && content.blog.name == userName;
        const databaseBlogName = await this.getBlogName(transaction, content.blog.name || userName);        

        const data = [
          content.post.id,
          crypto.createHash('sha256').update(content['content_raw'],'utf-8').digest('hex'),
          content['content_raw'],
          databaseBlogName.id
        ];

        await this.importContentData(transaction, data, databasePost, position, last);
      }
    }
  }

  async importContentData(transaction, data, databasePost, position, last) {
    let contentId = await this.database.sequelize.query("INSERT INTO contents (tumblr_id,version,text,blog_name_id) VALUES (?,?,?,?) ON CONFLICT DO NOTHING RETURNING id;",{
      replacements: data,
      type: Sequelize.QueryTypes.RAW,
      transaction: transaction
    });

    if (contentId && contentId[0] && contentId[0][0] && contentId[0][0]['id']) {
      this.stats['new_content'] += 1
      contentId = contentId[0][0]['id'];
    } else {
      let content = await this.database.Content.findOne({where: { tumblr_id: data[0], version: data[1] }, transaction: transaction });
      contentId = content.id;
      this.stats['dup_content'] += 1;
    }

    await this.database.sequelize.query("INSERT INTO post_contents (post_id,content_id,position,is_last) VALUES (?,?,?,?) ON CONFLICT DO NOTHING;",{
      replacements: [ databasePost.id, contentId, position, last ],
      type: Sequelize.QueryTypes.RAW,
      transaction: transaction
    });
  }

  async importPhotos(transaction, post, databasePost) {
    if (post.photos) {
      for (let position = 0; position < post.photos.length; position++) {
        let photo = post.photos[position];
        let sizes = photo['alt_sizes'].slice(0);
        if (photo['original_size']) {
          sizes.push(photo['original_size']);
        }
        sizes.sort((a,b) => b.width - a.width);

        let url = sizes[0].url;

        await this.saveResource(transaction, 'photo', url, photo, databasePost, position);
      }
    }
  }

  async getBlogName(transaction, userName) {
    userName = userName.substring(0,32);
    let databaseBlogName = this.cachedBlogNames[userName];

    if (!databaseBlogName) {
      [databaseBlogName, ] = await this.database.BlogName.findCreateFind({where: { name: userName }, defaults: { name: userName }, transaction: transaction});
      this.cachedBlogNames[userName] = databaseBlogName;
    }

    return databaseBlogName;
  }

  async mergeBlogs(transaction, blogName1, blogName2, type, data) {
    if (blogName1 == blogName2)
      return;

    if (this.cachedBlogLinks[blogName1] && this.cachedBlogLinks[blogName1][blogName2] == type)
      return;

    let blog1 = await this.getBlogName(transaction, blogName1);
    let blog2 = await this.getBlogName(transaction, blogName2);

    await this.database.sequelize.query("INSERT INTO blog_links (source_id, destination_id, import_id, type, meta) VALUES (?,?,?,?,?) ON CONFLICT DO NOTHING;", {
      replacements: [blog1.id, blog2.id, this.currentImport.id, type, JSON.stringify(data)],
      type: Sequelize.QueryTypes.RAW,
      transaction: transaction
    });

    this.cachedBlogLinks[blogName1] = {}
    this.cachedBlogLinks[blogName1][blogName2] = type;
  }

  async saveResource(transaction, type, url, metadata, databasePost, position) {
    if (!url) {
      return;
    }
    if (url.length>=255) {
      metadata['full_url'] = url;
      url = crypto.createHash('sha256').update(url).digest('base64');
    }
    let resource = await this.database.Resource.findOne({ where:{ url: url }, transaction: transaction });
    if (!resource) {
      resource = await this.database.Resource.create({
        type: type,
        url: url,
        local_url: null,
        external: url.indexOf('tumblr.com') == -1,
        meta: metadata
      }, { transaction: transaction });
    }

    await this.database.sequelize.query("INSERT INTO post_resources (post_id,resource_id,position) VALUES (?,?,?) ON CONFLICT DO NOTHING;", {
      replacements: [ databasePost.id, resource.id, position ],
      type: Sequelize.QueryTypes.RAW,
      transaction: transaction
    });
  
    return resource;
  }

  determinePostRootType(post, userName) {
    if (!post['reblogged_root_name']) {
      if (!post['trail'] ||
           post['trail'].length==0 ||
           (post['trail'].length == 1 && post['trail'][0]['blog']['name'] == userName)) {
        return true;
      }
    }
    return false;
  }
}
