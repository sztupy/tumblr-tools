import Sequelize from 'sequelize';

export default function(databaseString, options = {}) {
  const sequelize = new Sequelize(databaseString, {
    // logging: false,
    logging: (sql, timingMs) => { if (timingMs>100) console.log(`SLOW QUERY: ${sql} - Elapsed time: ${timingMs}ms`); },
    benchmark: true,
    define: {
      underscored: true,
      timestamps: false,
      charset: 'utf8',
      dialectOptions: {
        collate: 'utf8_general_ci'
      }
    }
  });

  const Blog = sequelize.define('blog', {
    name: { type: Sequelize.STRING, unique: true },
    type: { type: Sequelize.ENUM, values: ['active','deactivated']}
  });

  // name of the blog as it appears in the data
  const BlogName = sequelize.define('blog_name', {
    name: {
      type: Sequelize.STRING,
      unique: true
    }
  },{
    indexes: [{
      using: 'hash',
      fields: ['name']
    }]
  });

  BlogName.belongsTo(Blog);
  Blog.hasMany(BlogName);

  const BlogLinks = sequelize.define('blog_links', {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    type: {
      type: Sequelize.ENUM,
      values: ['author', 'manual', 'rename']
    },
    sourceId: {
      type: Sequelize.INTEGER
    },
    destinationId: {
      type: Sequelize.INTEGER
    },
    importId: {
      type: Sequelize.INTEGER
    },
    meta: {
      type: Sequelize.JSONB
    }
  },{
    indexes: [{
      unique: true,
      fields: ['type','source_id','destination_id','import_id']
    }]
  });

  BlogName.belongsToMany(BlogName, { through: BlogLinks, as: 'source', foreignKey: 'sourceId', constraints: false });
  BlogName.belongsToMany(BlogName, { through: BlogLinks, as: 'destination', foreignKey: 'destinationId', constraints: false });

  // a particular post that we are importing
  const Post = sequelize.define('post', {
    tumblr_id: {
      type: Sequelize.BIGINT,
      unique: true
    },
    title: { type: Sequelize.STRING() },
    type: { type: Sequelize.ENUM, values: ['text','link','photo','audio','quote','chat','video','answer'] },
    meta: { type: Sequelize.JSONB },
    date: { type: Sequelize.DATE },
    url: { type: Sequelize.STRING(65535) },
    root: { type: Sequelize.BOOLEAN },
    root_tumblr_id: { type: Sequelize.BIGINT },
    from_tumblr_id: { type: Sequelize.BIGINT },
    processed: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
  },{
    indexes: [
      { fields: [ 'tumblr_id' ] },
      { fields: [ 'type' ] },
      { fields: [ 'date' ] },
      { fields: [ 'root' ] },
      { fields: [ 'blog_name_id' ]},
      { fields: [ 'root_tumblr_id' ]},
      { fields: [ 'from_tumblr_id' ]},
      { fields: [ 'from_blog_name_id' ]},
      { fields: [ 'root_blog_name_id' ]},
      { fields: [ 'processed' ]}
    ]
  });

  Post.belongsTo(BlogName);
  BlogName.hasMany(Post);
  Post.belongsTo(BlogName, { as: 'from_blog_name' } );
  Post.belongsTo(BlogName, { as: 'root_blog_name' } );

  // the content of the post above, including it's trail
  let contentOptions = {
    tumblr_id: { type: Sequelize.BIGINT, unique: 'tumblr_content_version' },
    version: { type: Sequelize.STRING(64), unique: 'tumblr_content_version' },
    text: { type: Sequelize.TEXT },
    processed: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
  };


  const Content = sequelize.define('content', contentOptions, {
    indexes: [
      { fields: [ 'tumblr_id' ] },
      { fields: [ 'version' ] },
      { fields: [ 'version' ], using: 'hash', name: 'contents_version_hash' },
      { fields: [ 'blog_name_id' ] },
      { fields: [ 'processed' ]}
    ]
  });

  Content.belongsTo(BlogName);
  BlogName.hasMany(Content);

  Content.belongsToMany(BlogName, { through: 'blog_name_pings' });
  BlogName.belongsToMany(Content, { through: 'blog_name_pings' });

  // The link between the posts and the content values. position=-1 refers to the posts internal comment (usually the title field), while the others are referring to the trail. Is_last is the field that says whether this content is the one that was added recently
  const PostContents = sequelize.define('post_contents', {
    position: { type: Sequelize.INTEGER },
    is_last: { type: Sequelize.BOOLEAN },
  },{
    indexes: [
      { fields: [ 'position' ] },
      { fields: [ 'is_last' ] }
    ]
  });

  Post.belongsToMany(Content, { through: PostContents });
  Content.belongsToMany(Post, { through: PostContents });

  // a resource that is linked to a post. Usually these are the images linked to n image post type
  const Resource = sequelize.define('resource', {
    type: { type: Sequelize.STRING },
    url: { type: Sequelize.STRING },
    local_url: { type: Sequelize.STRING },
    external: { type: Sequelize.BOOLEAN },
    meta: { type: Sequelize.JSONB }
  },{
    indexes: [
      { fields: [ 'url' ], unique: true },
      { fields: [ 'url' ], using: 'hash', name: 'resources_url_hash' },
      { fields: [ 'local_url' ] },
      { fields: [ 'type' ] },
      { fields: [ 'external' ] }
    ]
  });

  const PostResource = sequelize.define('post_resources', {
    position: { type: Sequelize.INTEGER }
  },{
    indexes: [
      { fields: [ 'position' ]} // which resource is this in the post
    ]
  });

  Post.belongsToMany(Resource, { through: 'post_resources' });
  Resource.belongsToMany(Post, { through: 'post_resources' });

  // the tags of the posts
  const Tag = sequelize.define('tag', {
    name: { type: Sequelize.STRING(65535) }
  },{
    indexes: [
      { fields: [ 'name' ] }
    ]
  });

  const PostTag = sequelize.define('post_tags', {
    position: { type: Sequelize.INTEGER }
  },{
    indexes: [
      { fields: [ 'position' ]} // which tag is this in the post
    ]
  });

  Post.belongsToMany(Tag, { through: 'post_tags' });
  Tag.belongsToMany(Post, { through: 'post_tags' });

  const Language = sequelize.define('languages', {
    name: { type: Sequelize.STRING }
  },{
    indexes: [
      { fields: [ 'name' ], unique: true }
    ]
  });

  const PostLanguage = sequelize.define('post_languages', {
    percentage: { type: Sequelize.INTEGER },
    score: { type: Sequelize.INTEGER }
  },{
    indexes: [
      { fields: [ 'percentage' ]}, // values from CLD
      { fields: [ 'score' ]} // values from CLD
    ]
  });

  const ContentLanguage = sequelize.define('content_languages', {
    percentage: { type: Sequelize.INTEGER },
    score: { type: Sequelize.INTEGER }
  },{
    indexes: [
      { fields: [ 'percentage' ]}, // values from CLD
      { fields: [ 'score' ]} // values from CLD
    ]
  });

  Post.belongsToMany(Language, { through: PostLanguage});
  Language.belongsToMany(Post, { through: PostLanguage});

  Content.belongsToMany(Language, { through: ContentLanguage});
  Language.belongsToMany(Content, { through: ContentLanguage});

  const Stats = sequelize.define('stats', {
    from: { type: Sequelize.DATE },
    to: { type: Sequelize.DATE },
    name: { type: Sequelize.STRING },
    posts_count: { type: Sequelize.BIGINT }, // the number of posts in the interval matching the language
    contents_count: { type: Sequelize.BIGINT }, // the number of contents in the interval matching the language
    posts_bytes: { type: Sequelize.BIGINT }, // the number of bytes in total for the posts in the interval matching the language
    contents_bytes: { type: Sequelize.BIGINT }, // the number of bytes in total for the contents in the interval matching the language
    appearances: { type: Sequelize.BIGINT }, // the number of times the user appears in other people's trails for this language
    reblog_reach: { type: Sequelize. BIGINT }, // the number of times the user has been reblogged directly for this language
    root_reach: { type: Sequelize.BIGINT }, // the number of times the user's root content appears in other people's trails for this language
  },{
    indexes: [
      { fields: [ 'from' ] },
      { fields: [ 'to' ] }
    ]
  });

  Stats.belongsTo(Language);
  Stats.belongsTo(BlogName);
  Stats.belongsTo(Blog);
  BlogName.hasMany(Stats);
  Blog.hasMany(Stats);

  // the specific import we are doing, including the last IDs that we imported during this batch
  const Import = sequelize.define('imports', {
    file_date: { type: Sequelize.DATE },
    file_name: { type: Sequelize.STRING },
    phase: { type : Sequelize.ENUM, values: ['need_import','import_finished','processed','finalized'] }
  },{});

  // these will store the last IDs in the database after the import
  Import.belongsTo(Post, { constraints: false });
  Import.belongsTo(Content, { constraints: false });
  Import.belongsTo(Tag, { constraints: false });
  Import.belongsTo(Resource, { constraints: false });
  Import.belongsTo(Blog, { constraints: false });
  Import.belongsTo(BlogName, { constraints: false });
  Import.belongsTo(BlogLinks, { constraints: false });
  Import.belongsTo(Language, { constraints: false } );
  Import.belongsTo(Stats, { constraints: false } );

  BlogLinks.belongsTo(Import);
  Stats.belongsTo(Import);

  return {
    sequelize: sequelize,
    Blog: Blog,
    BlogLinks: BlogLinks,
    BlogName: BlogName,
    Post: Post,
    Language: Language,
    Content: Content,
    Resource: Resource,
    Tag: Tag,
    Import: Import,
    Stats: Stats
  }
}
