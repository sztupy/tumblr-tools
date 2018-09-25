import Sequelize from 'sequelize';

export default function(databaseString) {
  const sequelize = new Sequelize(databaseString, {
    logging: true,
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
    name: {
      type: Sequelize.STRING,
      unique: true
    }
  });

  const Post = sequelize.define('post', {
    tumblr_id: {
      type: Sequelize.BIGINT,
      unique: true
    },
    title: { type: Sequelize.STRING(65535) },
    type: { type: Sequelize.ENUM, values: ['text','link','photo','audio','quote','chat','video','answer'] },
    meta: { type: Sequelize.JSON },
    date: { type: Sequelize.DATE },
    slug: { type: Sequelize.STRING(65535) },
    url: { type: Sequelize.STRING(65535) },
    root: { type: Sequelize.BOOLEAN },
    state: { type: Sequelize.ENUM, values: ['original','reconstructed'] }
  },{
    indexes: [
      { fields: [ 'tumblr_id' ] },
      { fields: [ 'type' ] },
      { fields: [ 'date' ] },
      { fields: [ 'root' ] },
      { fields: [ 'state' ] },
      { fields: [ 'blog_id' ]},
      { fields: [ 'from_blog_id' ]},
      { fields: [ 'root_blog_id' ]}
    ]
  });

  Post.belongsTo(Blog);
  Blog.hasMany(Post);
  Post.belongsTo(Blog, { as: 'from_blog' } );
  Post.belongsTo(Blog, { as: 'root_blog' } );

  const Content = sequelize.define('content', {
    tumblr_id: { type: Sequelize.BIGINT, unique: 'tumblr_content_version' },
    version: { type: Sequelize.BIGINT, unique: 'tumblr_content_version' },
    text: { type: Sequelize.TEXT },
  },{
    indexes: [
      { fields: [ 'tumblr_id' ] },
      { fields: [ 'blog_id' ] }
    ]
  });

  Content.belongsTo(Blog);
  Blog.hasMany(Content);

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

  const Resource = sequelize.define('resource', {
    type: { type: Sequelize.STRING },
    url: { type: Sequelize.STRING },
    local_url: { type: Sequelize.STRING },
    external: { type: Sequelize.BOOLEAN },
    meta: { type: Sequelize.JSON }
  },{
    indexes: [
      { fields: [ 'url' ], unique: true },
      { fields: [ 'local_url' ] },
      { fields: [ 'type' ] },
      { fields: [ 'external' ] }
    ]
  });

  Post.belongsToMany(Resource, { through: 'post_resources' });
  Resource.belongsToMany(Post, { through: 'post_resources' });
  Content.belongsToMany(Resource, { through: 'content_resources' });
  Resource.belongsToMany(Content, { through: 'content_resources' });

  const Tag = sequelize.define('tag', {
    name: { type: Sequelize.STRING(65535) }
  },{
    indexes: [
      { fields: [ 'name' ] }
    ]
  });

  Post.belongsToMany(Tag, { through: 'post_tags' });
  Tag.belongsToMany(Post, { through: 'post_tags' });

  return {
    sequelize: sequelize,
    Blog: Blog,
    Post: Post,
    Content: Content,
    Resource: Resource,
    Tag: Tag
  }
}
