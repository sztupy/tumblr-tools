/* eslint-disable no-cond-assign */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { QueryTypes } from "sequelize";
import { BlogName, Post, sequelize } from "../models/index.js";
import { Post as WafrnPost, User as WafrnUser, Media, PostTag } from "../wafrn/models/index.js";
import { PostAttributes as WafrnPostAttributes, Privacy } from "../wafrn/models/post.js";
import { AvlTree } from '@datastructures-js/binary-search-tree';
import { MediaAttributes } from "../wafrn/models/media.js";
import { JSDOM } from "jsdom";

export default class WafrnExport {
  wafnrUserCache: Record<string, WafrnUser>;
  timeLookup: AvlTree<any>;

  constructor() {
    this.wafnrUserCache = {}
    this.timeLookup = new AvlTree((a: any, b: any) => +a.tumblr_id - +b.tumblr_id, { key: 'tumblr_id' });
  }

  async run() {
    const times = await sequelize.query<any>("select distinct date_trunc('hour', date) as m, (select date from posts pp where pp.tumblr_id=max(posts.tumblr_id)) as exact_time, max(tumblr_id) as tumblr_id from posts group by m order by m;",
      {
        type: QueryTypes.SELECT
      },
    );

    for (const time of times) {
      this.timeLookup.insert(time);
    }

    this.timeLookup.insert({ hour: new Date('2006-11-08'), exact_time: new Date('2006-11-08'), tumblr_id: '231' })

    let finished = false;

    while (!finished) {
      const posts = await Post.findAll({
        where: {
          exported: false
        },
        order: ['tumblr_id'],
        include: ["blogName", "rootBlogName", "fromBlogName"],
        limit: 5000,
      });

      if (posts[0]) {
        console.log(`Processing from ${posts[0].date}`);
      }

      finished = posts.length == 0;

      for (const post of posts) {
        const contents = (await post.getContents({ include: ["blogName"] })).sort((a, b) => (a.post_contents.position) - (b.post_contents.position))

        let hierarchyLevel = 1;
        let parentPost: WafrnPost | null = null;

        const rootBlogName = post.rootBlogName || post.fromBlogName || post.blogName;
        const rootId = post.rootTumblrId || post.fromTumblrId || post.tumblrId;

        const rootContents = [];

        if (contents[0]?.post_contents.position == -1) {
          rootContents.push(contents[0]);
        }

        for (const content of contents) {
          if (content.tumblrId == rootId) {
            rootContents.push(content);
          }
        }

        // first create the root post
        let content = '';

        switch (post.type) {
          case 'text':
            if (post.title) {
              content += `<h3><p>${post.title}</p></h3>`;
            }
            break;
          case 'link':
            content += `<p><a class="main_link" href="${post?.meta?.post?.url}">${post.title || post.meta?.post?.url || post.meta?.source?.source_url || "Link"}</a></p>`
            break;
          case 'audio':
            content += `<h3><a href="${post?.meta?.post?.audio_url || post?.meta?.post?.audio_source_url}">${post?.meta?.post?.artist} - ${post?.meta?.post?.track_name} - ${post?.meta?.post?.album}</a></h3>`;
            break;
          case 'video':
            content += `<h3><a href="${post?.meta?.post?.url}">Video: ${post?.meta?.post?.details}</a></h3>`;
            break;
          case 'answer':
            content += `<h3>${post?.meta?.post?.asking_name} asks:</h3>`;
            break;
          case 'quote':
          case 'photo':
            break;
        }

        for (const rootContent of rootContents) {
          content += `<p>${rootContent.text}</p>`;
        }

        let mediaOrder = 0;

        const wafrnUser = await this.getWafrnUser(rootBlogName);

        const potentialTime = this.getPotentialTime(rootId);

        const wafrnPost: WafrnPostAttributes = {
          content,
          remotePostId: `https://${rootBlogName.name}.tumblr.com/post/${rootId}`,
          privacy: Privacy.Public,//rootBlogName.blogId ? Privacy.Unlisted : Privacy.LocalOnly,
          userId: wafrnUser.id,
          hierarchyLevel: hierarchyLevel,
          createdAt: potentialTime,
          updatedAt: potentialTime
        }

        hierarchyLevel++;

        [parentPost,] = await WafrnPost.findCreateFind({
          where: {
            remotePostId: wafrnPost.remotePostId
          },
          defaults: wafrnPost,
          silent: true
        });

        const resources = (await post.getResources()).sort((a, b) => (a.post_resources.position || 0) - (b.post_resources.position || 0));

        for (const resource of resources) {
          const media: MediaAttributes = {
            mediaOrder: mediaOrder,
            postId: parentPost.id,
            userId: wafrnUser.id,
            external: true,
            url: resource.url.replace(/^t:/, "https://64.media.tumblr.com/"),
            ipUpload: 'IMAGE_FROM_OTHER_FEDIVERSE_INSTANCE',
            description: resource.meta?.caption || null
          }

          mediaOrder++;

          await Media.findCreateFind({
            where: {
              url: media.url
            },
            defaults: media,
          });
        }

        // next we'll generate the rest of the reblog trail
        for (const content of contents) {
          const blogName = content.blogName || post.blogName;

          const wafrnUser = await this.getWafrnUser(blogName);

          const potentialTime = this.getPotentialTime(content.tumblrId);

          if (!rootContents.includes(content)) {
            mediaOrder = 0;

            const wafrnPost: WafrnPostAttributes = {
              content: content.text,
              remotePostId: `https://${blogName.name}.tumblr.com/post/${content.tumblrId}`,
              privacy: Privacy.Public, //blogName.blogId ? Privacy.Unlisted : Privacy.LocalOnly,
              userId: wafrnUser.id,
              hierarchyLevel: hierarchyLevel,
              createdAt: potentialTime,
              updatedAt: potentialTime,
              parentId: parentPost?.id
            }

            hierarchyLevel++;

            [parentPost,] = await WafrnPost.findCreateFind(
              {
                where: {
                  remotePostId: wafrnPost.remotePostId
                },
                defaults: wafrnPost,
                silent: true
              }
            );
          }

          const generateMedia = async function (source: string | null, el: HTMLElement) {
            if (source) {
              let alt: string | null | undefined = el.getAttribute("alt")
              if (alt == "image") alt = undefined;
              if (alt === null) alt = undefined;

              const media: MediaAttributes = {
                mediaOrder: mediaOrder,
                postId: parentPost?.id,
                userId: wafrnUser.id,
                external: true,
                url: source.replace(/^t:/, "https://64.media.tumblr.com/"),
                ipUpload: 'IMAGE_FROM_OTHER_FEDIVERSE_INSTANCE',
                description: alt
              }

              if (el.parentElement?.nodeName == "FIGURE" || el.parentElement?.nodeName == "VIDEO") {
                el = el.parentElement;
              }
              el.replaceWith(`![media-${mediaOrder + 1}]`);

              mediaOrder++;

              await Media.findCreateFind({
                where: {
                  url: media.url
                },
                defaults: media,
              });
            } else {
              if (el.parentElement?.nodeName == "FIGURE" || el.parentElement?.nodeName == "VIDEO") {
                el = el.parentElement;
              }
              el.replaceWith('');
            }
          }

          const oldMedia = mediaOrder;
          let changed = false;

          const dom = new JSDOM(content.text.replaceAll('<strike>', '<s>').replaceAll('</strike>', '</s>'));
          let el = null;
          while (el = dom.window.document.getElementsByTagName('img')[0]) {
            const source = el.getAttribute('src')
            await generateMedia(source, el);
          }
          while (el = dom.window.document.getElementsByTagName('source')[0]) {
            const source = el.getAttribute('src')
            await generateMedia(source, el);
          }
          while (el = dom.window.document.getElementsByTagName('video')[0]) {
            const source = el.getAttribute('poster')
            await generateMedia(source, el);
          }

          changed = oldMedia != mediaOrder;

          while (el = dom.window.document.getElementsByTagName('iframe')[0]) {
            const newElement = dom.window.document.createElement('a');
            newElement.setAttribute('src', el.parentElement?.getAttribute('data-url') || el.getAttribute('src') || '#');
            newElement.innerText = el.getAttribute('title') || "Embedded video";

            if (el.parentElement?.nodeName == "FIGURE" || el.parentElement?.nodeName == "VIDEO") {
              el = el.parentElement;
            }
            el.replaceWith(newElement);
            changed = true;
          }

          while (el = dom.window.document.querySelector('span.npf_color_monica')) {
            el.removeAttribute('class');
            el.setAttribute("style", "color: #ff8a00");
          }
          while (el = dom.window.document.querySelector('span.npf_color_ross')) {
            el.removeAttribute('class');
            el.setAttribute("style", "color: #00cf34");
          }
          while (el = dom.window.document.querySelector('span.npf_color_rachel')) {
            el.removeAttribute('class');
            el.setAttribute("style", "color: #00b7ff");
          }
          while (el = dom.window.document.querySelector('span.npf_color_niles')) {
            el.removeAttribute('class');
            el.setAttribute("style", "color: #ff62cd");
          }
          while (el = dom.window.document.querySelector('span.npf_color_chandler')) {
            el.removeAttribute('class');
            el.setAttribute("style", "color: #7d5cff");
          }

          if (changed) {
            await parentPost.update({ content: dom.window.document.body.innerHTML })
          }
        }

        // finally we create a local reblog

        if (parentPost) {
          const postUser = await this.getWafrnUser(post.blogName, true);
          const finalPost = await WafrnPost.create({
            content: '',
            isReblog: true,
            parentId: parentPost.id,
            createdAt: post.date,
            updatedAt: post.date,
            hierarchyLevel: hierarchyLevel,
            userId: postUser.id,
            privacy: Privacy.Public
          }, { silent: true });

          const tagPost = (contents.length > 0 && contents[contents.length - 1].tumblrId == post.tumblrId || post.tumblrId == rootId) ? parentPost : finalPost;

          for (const tag of ((await post.getTags()).sort((a, b) => (a.post_tags.position || 0) - (b.post_tags.position || 0)))) {
            await PostTag.create({
              postId: tagPost.id,
              tagName: tag.name
            })
          };
        }

        await post.update({ exported: true });
      }
    }
  }

  getPotentialTime(tumblrId: string) {
    let floor = this.timeLookup.floorKey(tumblrId);
    let ceil = this.timeLookup.ceilKey(tumblrId);
    if (!floor) {
      floor = this.timeLookup.min();
    }
    if (!ceil) {
      ceil = this.timeLookup.max();
    }

    const floorMs = floor?.getValue().exact_time.getTime();
    const ceilMs = ceil?.getValue().exact_time.getTime();
    const floorId = +floor?.getValue().tumblr_id;
    const ceilId = +ceil?.getValue().tumblr_id;

    let potentialMs = floorMs;

    if (floorId != ceilId) {
      potentialMs = floorMs + (+tumblrId - floorId) * ((ceilMs - floorMs) / (ceilId - floorId));
    }

    return new Date(Math.floor(potentialMs / 1000) * 1000);
  }

  async getWafrnUser(blogName: BlogName, local: boolean = false) {
    const url = (blogName.blogId && local) ? blogName.name : `@${blogName.name}.tumblr.com`;

    if (this.wafnrUserCache[url]) {
      return this.wafnrUserCache[url];
    }

    const [databaseUser,] = await WafrnUser.findCreateFind({
      where: { url },
      defaults: {
        name: blogName.name,
        url,
        avatar: `https://api.tumblr.com/v2/blog/${blogName.name}/avatar/128`,
        activated: true,
      },
    });

    this.wafnrUserCache[url] = databaseUser;

    return databaseUser;
  }
}
