import Sequelize from 'sequelize';

export default function(databaseString, options = {}) {
  // Skip some indices that would speed up the processing work. Note if these indices have already been created they should be deleted manually, this options just ensures they are not re-created automatically at startup
  const skipProcessingIndices = options['skipProcessingIndices'];

  const sequelize = new Sequelize(databaseString, {
    logging: false,
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
    indexes: skipProcessingIndices ? [] : [
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
    tumblr_id: { type: Sequelize.BIGINT },
    version: { type: Sequelize.STRING(64) },
    text: { type: Sequelize.TEXT },
    processed: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
  };

  if (!skipProcessingIndices) {
    contentOptions.tumblr_id.unique = 'tumblr_content_version';
    contentOptions.version.unique = 'tumblr_content_version';
  }

  const Content = sequelize.define('content', contentOptions, {
    indexes: skipProcessingIndices ? [] :
    [
      { fields: [ 'tumblr_id' ] },
      { fields: [ 'version' ] },
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
      { fields: [ 'local_url' ] },
      { fields: [ 'type' ] },
      { fields: [ 'external' ] }
    ]
  });

  const PostResource = sequelize.define('post_resources', {
    position: { type: Sequelize.INTEGER }
  },{
    indexes: [
      { fields: [ 'position' ]}
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
      { fields: [ 'position' ]}
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
      { fields: [ 'percentage' ]},
      { fields: [ 'score' ]}
    ]
  });

  const ContentLanguage = sequelize.define('content_languages', {
    percentage: { type: Sequelize.INTEGER },
    score: { type: Sequelize.INTEGER }
  },{
    indexes: [
      { fields: [ 'percentage' ]},
      { fields: [ 'score' ]}
    ]
  });

  Post.belongsToMany(Language, { through: PostLanguage});
  Language.belongsToMany(Post, { through: PostLanguage});

  Content.belongsToMany(Language, { through: ContentLanguage});
  Language.belongsToMany(Content, { through: ContentLanguage});

  const Stats = sequelize.define('stats', {
    from: { type: Sequelize.DATE },
    to: { type: Sequelize.DATE },
    posts_count: { type: Sequelize.BIGINT,  },
    contents_count: { type: Sequelize.BIGINT },
    posts_bytes: { type: Sequelize.BIGINT },
    contents_bytes: { type: Sequelize.BIGINT },
    reblogs: { type: Sequelize.BIGINT },

  },{
    indexes: [
      { fields: [ 'from' ] },
      { field: [ 'to' ] }
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

  BlogLinks.belongsTo(Import);

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
