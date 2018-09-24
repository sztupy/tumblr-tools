import fs from 'fs';
import lodash from 'lodash';
import cheerio from 'cheerio';
import AdmZip from 'adm-zip';
import { promisify } from 'util';

const readFileAsync = promisify(fs.readFile);

export default class Importer {
  constructor(database) {
    this.database = database;
  }

  async run() {
    const zip = new AdmZip("./magyar-tumbli.zip");
    const zipEntries = zip.getEntries();

    for (const entry of zipEntries) {
      console.log(entry.entryName);

      blog = JSON.parse(entry.getData());

      if (blog.blog && blog.blog.name) {
        const transaction = await this.database.sequelize.transaction();

        const userName = blog.blog.name;
        const databaseBlog = await this.getBlog(transaction, userName);

        for (const post of blog.posts) {
          await this.importPost(transaction, post, userName, databaseBlog);
        };

        await transaction.commit();
      } else {
        console.log("Invalid file");
      }
    }
  }

  async importPost(transaction, post, userName, databaseBlog) {
    let meta = {};

    meta['source'] = {
      'title': post["source_title"],
      'url': post['source_url']
    }

    meta['from'] = {
      'id': post['reblogged_from_id'],
      'url': post['reblogged_from_url'],
      'name': post['reblogged_from_name']
    }

    meta['root'] = {
      'id': post['reblogged_root_id'],
      'url': post['reblogged_root_url'],
      'name': post['reblogged_root_name']
    }

    let rootBlog = null;
    let fromBlog = null;

    if (meta['from']['name']) {
      fromBlog = await this.getBlog(transaction, meta['from']['name']);
    }

    if (meta['root']['name']) {
      rootBlog = await this.getBlog(transaction, meta['root']['name']);
    }

    let title = post['title'] || ""
    if (title == "") { title = post['summary'] || "" }
    if (title == "") { title = post['source_title'] || "" }
    if (title == "") { title = post['source_url'] || "" }
    if (title == "") { title = `${lodash.capitalize(post['type'])} ${post['id']}` }

    let probableRootName = meta['reblogged_root_name'];
    if (!probableRootName && post['trail'] && post['trail'][0]) {
      probableRootName = post['trail'][0]['blog']['name'];
    }
    if (!probableRootName) {
      probableRootName = userName;
    }

    switch(post.type) {
      case 'text': break;
      case 'link':
        meta['post'] = {
          author: post["link_author"],
          publisher: post['publisher'],
          url: post['url'],
          excerpt: post['excerpt']
        }
        title = post["title"] || post["url"] || title;
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
        meta['post'] = {
          source: post['source'],
          text: post['text']
        }
        break;
      case 'chat':
        meta['post'] = {
          dialogue: post.dialogue.map(line => ({
            label: line.label,
            phrase: line.phrase
          }))
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
          'question': post['question'],
          'name': post['asking_name'],
          'url': post['asking_url']
        }
        title = post['question']
        break;
    }

    let slug = post.id.toString();

    if (post.slug && post.slug.trim() != '') {
      slug = post.slug;
    } else if (title.trim() != '' && title != 'no title' && title.toLowerCase().replace(/[^a-z0-9-]/g, '') != '') {
      slug = title.toLowerCase().trim().replace(' ','-').replace(/[^a-z0-9-]/g, '')
      if (slug.length>200) {
        slug = slug.slice(0, 200);
      }
    }

    const removeEmpty = (obj) => {
      Object.entries(obj).forEach(([key, val])  =>
        (val && typeof val === 'object') && removeEmpty(val) && Object.keys(val).length !== 0 ||
        (val === null || val === "") && delete obj[key]
      );
      return obj;
    };

    let tags = post.tags || [];

    const data = {
      tumblrId: post.id,
      url: post.post_url,
      type: post.type,
      meta: removeEmpty(meta),
      title: title,
      date: new Date(post.timestamp*1000),
      slug: slug,
      blog: databaseBlog.id,
      state: 'original',
      fromBlogId: fromBlog ? fromBlog.id : null,
      rootBlogId: rootBlog ? rootBlog.id : null,
      root: this.determinePostRootType(post, userName)
    }

    const [databasePost, created] = await this.database.Post.findOrCreate({
      where: { tumblrId: post.id },
      defaults: data,
      transaction: transaction
    });

    if (!created) {
      console.log(`Post already exist, updating: ${post.id}`);
      await databasePost.update(data, { transaction: transaction });
    }

    await this.importPhotos(transaction, post, databasePost, probableRootName);

    if (post.type == 'video' && meta.post.url && meta.post.type == 'tumblr') {
      await this.saveResource(transaction, 'video', meta.post.url, meta.post, databasePost, probableRootName);
    }

    if (post.type == 'audio' && meta.post.url && meta.post.type == 'tumblr') {
      await this.saveResource(transaction, 'audio', meta.post.url, meta.post, databasePost, probableRootName);
    }

    for (let i = 0; i < tags.length; i++) {
      const [databaseTag, ] = await this.database.Tag.findOrCreate({
        where: { name: tags[i] },
        defaults: { name: tags[i] },
        transaction: transaction
      });
      await databaseTag.addPost(databasePost, { transaction: transaction });
    }

    await this.importContent(transaction, post, databasePost);
  }

  async importPhotos(transaction, post, databasePost, rootName) {
    if (post.photos) {
      for (const photo of post.photos) {
        let sizes = photo['alt_sizes'].slice(0);
        if (photo['original_size']) {
          sizes.push(photo['original_size']);
        }
        sizes.sort((a,b) => b.width - a.width);

        let url = sizes[0].url;

        await this.saveResource(transaction, 'photo', url, photo, databasePost, rootName);
      }
    }
  }

  async importContent(transaction, post, databasePost, userName) {
    if (post.trail) {
      for (let position = 0; position < post.trail.length; position++) {
        const content = post.trail[position];
        const last = (position == post.trail.length - 1) && content.blog.name == userName;
        const oldContents = await this.database.Content.findAll({where: { tumblrId: content.post.id }, include: [this.database.Blog], transaction: transaction });

        let databaseContent = null;
        for (let contentIdx = 0; contentIdx < oldContents.length; contentIdx++) {
          if (content['content_raw'] == oldContents[contentIdx].text && oldContents[contentIdx].blog.name == content.blog.name) {
            databaseContent = oldContents[contentIdx];
          }
        }

        if (!databaseContent) {
          const databaseBlog = await this.getBlog(transaction, content.blog.name || userName);

          const data = {
            tumblrId: content.post.id,
            version: oldContents.length + 1,
            text: content['content_raw'],
            blogId: databaseBlog.id
          }

          databaseContent = await this.database.Content.create(data, { transaction: transaction });

          let inlineImages = [];

          cheerio.load(content['content_raw'])('img').each((_,el) => {
            inlineImages.push(cheerio(el).attr('src'));
          });

          for (const url of inlineImages) {
            await this.saveResource(transaction, 'inline_photo', url, {}, databaseContent);
          }
        }

        await databasePost.addContent(databaseContent, { through: { position: position, isLast: last }, transaction: transaction });
      }
    }
  }

  async saveResource(transaction, type, url, metadata, resourceOwner) {
    let resource = await this.database.Resource.findOne({ where:{ url: url }, transaction: transaction });
    if (!resource) {
      resource = await this.database.Resource.create({
        type: type,
        url: url,
        localUrl: null,
        external: url.indexOf('tumblr.com') == -1,
        meta: metadata
      }, { transaction: transaction });
    }
    await resourceOwner.addResource(resource, { transaction: transaction });
    return resource;
  }

  async getBlog(transaction, userName) {
    const [databaseUser, ] = await this.database.User.findOrCreate({where: { name: userName }, defaults: { name: userName }, transaction: transaction });
    const [databaseBlog, ] = await this.database.Blog.findOrCreate({where: { name: userName }, defaults: { name: userName, userId: databaseUser.id }, transaction: transaction});
    return databaseBlog;
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
