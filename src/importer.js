import fs from 'fs';
import lodash from 'lodash';
import Zip from 'node-stream-zip';
import Sequelize from 'sequelize';
import crypto from 'crypto';

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
  constructor(database, fileName, options = {}) {
    this.database = database;
    this.fileName = fileName;
    this.options = options;

    this.cachedBlogs = {};
    this.cachedBlogLinks = {};
    this.cachedBlogNames = {};
    this.cachedTags = {};
    this.cachedLanguages = {};

    this.stats = {};

    this.start = false;

    this.currentImport = null;
    this.lastImport = null;
  }

  run() {
    const { birthtime } = fs.statSync(this.fileName);
    const zip = new Zip({file: this.fileName});

    zip.on('ready', async () => {
      const importData = {
        file_date: birthtime,
        file_name: this.fileName,
        phase: 'need_import'
      };

      [this.currentImport, ] = await this.database.Import.findCreateFind({
        where: {
          file_date: birthtime
        },
        defaults: importData
      });

      this.lastImport = await this.database.Import.findByPk(this.currentImport.id - 1);

      let counter = 0;

      for (const entry of Object.values(zip.entries())) {
        if (this.options['skipUntil']) {
          if (entry.name.indexOf(this.options['skipUntil']) != -1) {
            this.start = true;
          }
        } else {
          this.start = true;
        }
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

    // only handle the post if either we haven't saved it, or we saved it in an eariler import and hence we might have to revisit its details
    if (!databasePost || (
          this.lastImport &&
          databasePost.id <= this.lastImport.postId &&
          (!databasePost.meta['archive'] || !databasePost.meta['archive'][this.lastImport.id])
        )
      ) {
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

      // extract useful metadata based on the type of the post
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

      // title is usually short, but in legacy posts made before the trail system was added all content are put in the title. If it's too large hence we will cut it and save it as a separate content
      if (title.length > 132) {
        body = title + "\n" + body;
        title = title.substring(0,132) + "...";
      }

      // if there's a larger body assigned to this post we will save it as belonging to the root's postID. That is because these contents are usually shared between all reblogs of the root, and usually they don't actually change
      // however this is not always the case, especially for legacy posts you could fully edit the root content and later reblogs will see that, instead of the root. That's why we can't really determine who was the posts owner a lot of the times.
      // Do note sometimes even obvious cases can be tricky because a lot of legacy posts have a very broken system
      if (body && body != "") {
        body = this.sanitizeImageUrls(body);
        contentData = [
          rootId || post.id,
          crypto.createHash('sha256').update(this.sanitizeImageUrls(body).replaceAll("\n",""),'utf-8').digest('hex'),
          this.sanitizeImageUrls(body),
          null
        ];
      }

      let tags = post.tags || [];

      const data = {
        tumblr_id: post.id,
        url: post.post_url,
        type: post.type,
        meta: this.sanitizeImageUrls(clearEmpties(meta)),
        title: title || "",
        date: new Date(post.timestamp*1000),
        blogNameId: databaseBlogName.id,
        root_tumblr_id: rootId,
        from_tumblr_id: fromId,
        fromBlogNameId: fromBlogName ? fromBlogName.id : null,
        rootBlogNameId: rootBlogName ? rootBlogName.id : null,
        root: this.determinePostRootType(post, userName)
      }

      if (!databasePost) {
        this.stats['new_posts'] += 1;
        databasePost = await this.database.Post.create(data, { transaction: transaction });
      } else {
        // this means that we have already saved this post in a previous import. We need to go through the data and see if anything has changed.
        // dependent on what has changed we have to a couple of stuff differently
        let newArchive = {};
        let postChanged = false;

        // 1. check if any of the blog names have changed. This can happen is a blog gets renamed so we can use this detail to link blogs together
        // note we do not update these on the post, we keep the original details, unless we obtained new data that was not there yet. This can happen with some legacy posts

        if (data.blogNameId != databasePost.blogNameId) {
          await this.mergeBlogs(transaction, data.blogNameId, databasePost.blogNameId, 'rename', { post_id: databasePost.id });
        }

        if (data.fromBlogNameId != databasePost.fromBlogNameId) {
          await this.mergeBlogs(transaction, data.fromBlogNameId, databasePost.fromBlogNameId, 'rename', { post_id: databasePost.id });
        }

        if (data.rootBlogNameId != databasePost.rootBlogNameId) {
          await this.mergeBlogs(transaction, data.rootBlogNameId, databasePost.rootBlogNameId, 'rename', { post_id: databasePost.id });
        }

        // these should not happen but can occasionally so if we managed to obtain some new information we'll add them
        if (data.fromBlogNameId && !databasePost.fromBlogNameId) {
          databasePost.fromBlogNameId = data.fromBlogNameId;
          postChanged = true;
          newArchive['from_blog'] = 'empty';
          console.log("FROM BLOG ID added " + databasePost.id);
        }

        if (data.rootBlogNameId && !databasePost.rootBlogNameId) {
          databasePost.rootBlogNameId = data.rootBlogNameId;
          postChanged = true;
          newArchive['root_blog'] = 'empty';
          console.log("ROOT BLOG ID added " + databasePost.id);
        }

        if (data.root_tumblr_id && !databasePost.root_tumblr_id) {
          databasePost.root_tumblr_id = data.root_tumblr_id;
          postChanged = true;
          newArchive['root_id'] = 'empty';
          console.log("ROOT TUMBLR ID added " + databasePost.id);
        }

        if (data.from_tumblr_id && !databasePost.from_tumblr_id) {
          databasePost.from_tumblr_id = data.from_tumblr_id;
          postChanged = true;
          newArchive['from_id'] = 'empty';
          console.log("FROM TUMBLR ID added " + databasePost.id);
        }

        if (data.root != databasePost.root) {
          console.log("WARNING: ROOT INFO CHANGED " + databasePost.id);
          if (databasePost.root) {
            // if we obtained this is not a root post anymore we demote it. We will not promote a non-root post to root however
            databasePost.root = data.root;
            postChanged = true;
          }
        }

        if (data.root_tumblr_id && data.root_tumblr_id != databasePost.root_tumblr_id) {
          console.log("WARNING: ROOT IDs DONT MATCH " + databasePost.id + " " + data.root_tumblr_id);
        }

        if (data.from_tumblr_id && data.from_tumblr_id != databasePost.from_tumblr_id) {
          console.log("WARNING: ROOT IDs DONT MATCH " + databasePost.id+ " " + data.from_tumblr_id);
        }

        // 2. check if the tags have been changed. If yes we will clear the old tag list, save it as a metadata for archival and then let the system re-create the tags later
        let [response, ] = await this.database.sequelize.query("SELECT position,tag_id,name FROM post_tags JOIN tags ON tag_id = id WHERE post_id = ? ORDER BY position ASC;",
        {
          replacements: [ databasePost.id ],
          type: Sequelize.QueryTypes.RAW,
          transaction: transaction
        });

        let changed = false;
        tags ||= [];
        if (response.length != tags.length) {
          changed = true;
        } else {
          for (let i = 0; i < response.length; i++) {
            if (response[i]['name'] != tags[i]) {
              changed = true;
              break;
            }
          }
        }

        if (changed) {
          let oldTags = [];
          for (let i = 0; i < response.length; i++) {
            oldTags.push(response[i]['tag_id']);
          }

          newArchive['tags'] = oldTags;

          await this.database.sequelize.query("DELETE FROM post_tags WHERE post_id = ?", {
            replacements: [ databasePost.id ],
            type: Sequelize.QueryTypes.RAW,
            transaction: transaction
          });

          console.log("Tags changed on old post " + databasePost.id);
        }

        // 3. check if the root content has been changed. If yes we will save the old id as an archive and update the link to point to the new one
        // 4. check if the trail has changed. If yes we will clear the old trail (saving it in the metadata), and let the system re-create it later
        // 5. check if the title has been changed. If yes we will archive the old one and update to the new one

        [response, ] = await this.database.sequelize.query("SELECT position,content_id,version FROM post_contents JOIN contents ON content_id = id WHERE post_id = ? ORDER BY position ASC;",
        {
          replacements: [ databasePost.id ],
          type: Sequelize.QueryTypes.RAW,
          transaction: transaction
        });

        // check if the root content matches our new root content information
        if (response[0] && response[0]['position'] == -1) {
          if (contentData) {
            if (response[0]['version'] != contentData[1]) {
              // there was content in the past but it's different now
              newArchive['root'] = response[0]['content_id'];

              await this.database.sequelize.query("DELETE FROM post_contents WHERE position = -1 AND post_id = ?", {
                replacements: [ databasePost.id ],
                type: Sequelize.QueryTypes.RAW,
                transaction: transaction
              });

              console.log("Root content changed on old post " + databasePost.id);
            } else {
              // all good nothing to do
            }
          } else {
            // there was content in the past but there isn't one now
            newArchive['root'] = response[0]['content_id'];

            await this.database.sequelize.query("DELETE FROM post_contents WHERE position = -1 AND post_id = ?", {
              replacements: [ databasePost.id ],
              type: Sequelize.QueryTypes.RAW,
              transaction: transaction
            });

            console.log("Root content removed on old post " + databasePost.id);
          }
          response.shift();
        } else {
          if (contentData) {
            // there was no content in the past but there is one now
            newArchive['root'] = -1;
          } else {
            // all good nothing to do
          }
        }

        // check if the trail has changes
        changed = false;
        post.trail ||= [];
        if (response.length != post.trail.length) {
          changed = true;
        } else {
          for (let i = 0; i < response.length; i++) {
            let contentBody = this.sanitizeImageUrls(post.trail[i]['content_raw']).replaceAll("\n","");
            let contentHash = crypto.createHash('sha256').update(contentBody,'utf-8').digest('hex');
            if (response[i]['version'] != contentHash) {
              changed = true;
              break;
            }
          }
        }

        if (changed) {
          let oldTrail = [];
          for (let i = 0; i < response.length; i++) {
            oldTrail.push(response[i]['content_id']);
          }

          newArchive['trail'] = oldTrail;

          await this.database.sequelize.query("DELETE FROM post_contents WHERE post_id = ? AND position >= 0", {
            replacements: [ databasePost.id ],
            type: Sequelize.QueryTypes.RAW,
            transaction: transaction
          });

          console.log("Trail changed on old post " + databasePost.id);
        }

        // check for title changes
        if (data.title != databasePost.title) {
          newArchive['title'] = databasePost.title;
          databasePost.title = data.title;
          console.log("Title changed on old post " + databasePost.id);
          postChanged = true;
        }

        // 6. check if the metadata has been changed. If yes we save the old one to the archive and update to the new one

        if (!lodash.isEqual(this.normalizeMetadata(data.meta['post']), this.normalizeMetadata(databasePost.meta['post']))) {
          newArchive['meta'] = databasePost.meta['post'] || 'empty';
          databasePost.meta['post'] = data.meta['post'];
          console.log("Metadata changed on old " + post.type + " post " + databasePost.id);
          postChanged = true;
        }

        // 7. check linked resources

        [response, ] = await this.database.sequelize.query("SELECT position,resource_id,url FROM post_resources JOIN resources ON resource_id = id WHERE post_id = ? ORDER BY position ASC;",
        {
          replacements: [ databasePost.id ],
          type: Sequelize.QueryTypes.RAW,
          transaction: transaction
        });

        changed = false;
        post.photos ||= [];
        if (response.length != post.photos.length) {
          changed = true;
        } else {
          for (let i = 0; i < response.length; i++) {
            if (response[i]['url'] != this.sanitizeImageUrls(this.getPhotoUrl(post.photos[i]))) {
              changed = true;
              break;
            }
          }
        }

        if (changed) {
          let oldResources = [];
          for (let i = 0; i < response.length; i++) {
            oldResources.push(response[i]['resource_id']);
          }

          newArchive['resources'] = oldResources;

          await this.database.sequelize.query("DELETE FROM post_resources WHERE post_id = ?", {
            replacements: [ databasePost.id ],
            type: Sequelize.QueryTypes.RAW,
            transaction: transaction
          });

          console.log("Resources changed on old post " + databasePost.id);
        }

        // 8. we expect the remaining data to not change, but let's log if it does nevertheless
        if (data.type != databasePost.type) {
          console.log("WARNING: TYPE CHANGED " + databasePost.id);
        }
        if (data.date.getTime() != databasePost.date.getTime()) {
          console.log("WARNING: DATE CHANGED " + databasePost.id);
        }

        // 9. save the new post if we changed anything
        newArchive = clearEmpties(newArchive);

        if (!lodash.isEmpty(newArchive)) {
          databasePost.meta['archive'] ||= {};
          databasePost.meta['archive'][this.lastImport.id] = newArchive;

          databasePost.meta = this.sanitizeImageUrls(clearEmpties(databasePost.meta));
          databasePost.changed('meta',true);
          postChanged = true;
        }

        if (postChanged) {
          await databasePost.save({ transaction: transaction });
        }
      }

      if (post.post_author) {
        // you can enable showing the post's real author on sub-blogs. If this is eanbled we can actually see who is controlling a sub-blog
        await this.mergeBlogs(transaction, post.post_author, userName, 'author', { post_id: databasePost.id });
      }

      if (contentData) {
        // this is where we save larger text fields related to the post. These posts will have a position of -1 and will never be tied directly to a blog, even
        // if the real owner could be determined. We can potentially back-fill this data later though if we know the full database
        await this.importContentData(transaction, contentData, databasePost, -1, false);
      }

      // do note tags have an ordering as well
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

    // this is where we save the photos linked to a post. This usually happens for photo type posts, but it can also happen for link ones as well
    await this.importPhotos(transaction, post, databasePost);

    // this is where we look at the reblog trail and save all trail elements separately. We can use these separate elements to reconstruct dead/deactivated or non-imported blogs to an extent
    await this.importContent(transaction, post, databasePost, userName);
  }

  async importContent(transaction, post, databasePost, userName) {
    if (post.trail) {
      for (let position = 0; position < post.trail.length; position++) {
        const content = post.trail[position];
        const last = (position == post.trail.length - 1) && content.blog.name == userName;
        const databaseBlogName = await this.getBlogName(transaction, content.blog.name || userName);
        const body = this.sanitizeImageUrls(content['content_raw']);

        const data = [
          content.post.id,
          crypto.createHash('sha256').update(this.sanitizeImageUrls(body).replaceAll("\n",""),'utf-8').digest('hex'),
          this.sanitizeImageUrls(body),
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

      // also track blog renames through contents if possible
      if (content.blogNameId != data[3]) {
        await this.mergeBlogs(transaction, data[3], content.blogNameId, 'rename', { content_id: contentId });
      }
    }

    await this.database.sequelize.query("INSERT INTO post_contents (post_id,content_id,position,is_last) VALUES (?,?,?,?) ON CONFLICT DO NOTHING;",{
      replacements: [ databasePost.id, contentId, position, last ],
      type: Sequelize.QueryTypes.RAW,
      transaction: transaction
    });
  }

  getPhotoUrl(photo) {
    let sizes = photo['alt_sizes'].slice(0);
    if (photo['original_size']) {
      sizes.push(photo['original_size']);
    }
    sizes.sort((a,b) => b.width - a.width);
    return sizes[0].url;
  }

  async importPhotos(transaction, post, databasePost) {
    if (post.photos) {
      for (let position = 0; position < post.photos.length; position++) {
        let photo = post.photos[position];
        let url = this.getPhotoUrl(photo);

        await this.saveResource(transaction, 'photo', url, photo, databasePost, position);
      }
    }
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

  async mergeBlogs(transaction, blogName1, blogName2, type, data) {
    if (blogName1 == blogName2)
      return;

    if (!blogName1) return;
    if (!blogName2) return;

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

  // let's remove the prefix from image links both to conserve space and to make sure we don't differentiate between images on a different mirror server
  sanitizeImageUrls(data) {
    if (typeof data === 'string') {
      return data.replaceAll(/https:\/\/\d+.media.tumblr.com\//g,'t:');
    } else if (Array.isArray(data)) {
      let result = [];
      for (let i = 0; i< data.length; i++) {
        result.push(this.sanitizeImageUrls(data[i]));
      }
      return result;
    } else if (lodash.isObject(data)) {
      let result = {}
      for (var k in data) {
        result[k] = this.sanitizeImageUrls(data[k]);
      }
      return result;
    } else {
      return data;
    }
  }

  // let's not consider the metadata changed if the only change in it was a switch between http and https, and some cleanup in audio and video metas
  normalizeMetadata(data) {
    if (typeof data === 'string') {
      return data.replaceAll(/https?:\/\//g,'https://');
    } else if (Array.isArray(data)) {
      let result = [];
      for (let i = 0; i< data.length; i++) {
        result.push(this.normalizeMetadata(data[i]));
      }
      return result;
    } else if (lodash.isObject(data)) {
      let result = {}
      for (var k in data) {
        if (k!='embed' && k!='player') {
          result[k] = this.normalizeMetadata(data[k]);
        }
      }
      return result;
    } else {
      return data;
    }
  }

  async saveResource(transaction, type, url, metadata, databasePost, position) {
    if (!url) {
      return;
    }
    let meta = Object.assign({}, metadata);
    meta['alt_sizes'] = '';
    meta['original_size'] = '';

    if (url.length>=255) {
      meta['full_url'] = url;
      url = crypto.createHash('sha256').update(url).digest('base64');
    }
    let resource = await this.database.Resource.findOne({ where:{ url: this.sanitizeImageUrls(url) }, transaction: transaction });
    if (!resource) {
      resource = await this.database.Resource.create({
        type: type,
        url: this.sanitizeImageUrls(url),
        local_url: null,
        external: url.indexOf('tumblr.com') == -1,
        meta: clearEmpties(meta)
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
