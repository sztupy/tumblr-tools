import Sequelize from 'sequelize';

export default function(databaseString) {
  const sequelize = new Sequelize(databaseString, {
    logging: false,
    define: {
      timestamps: false,
      charset: 'utf8',
      dialectOptions: {
        collate: 'utf8_general_ci'
      }
    }
  });

  const User = sequelize.define('user', {
    name: {
      type: Sequelize.STRING,
      unique: true
    }
  });

  const Blog = sequelize.define('blog', {
    name: {
      type: Sequelize.STRING,
      unique: true
    }
  }, {
    indexes: [
      { fields: [ 'userId' ] },
    ]
  });

  Blog.belongsTo(User);
  User.hasMany(Blog);

  const Post = sequelize.define('post', {
    tumblrId: {
      type: Sequelize.INTEGER,
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
      { fields: [ 'tumblrId' ] },
      { fields: [ 'type' ] },
      { fields: [ 'date' ] },
      { fields: [ 'root' ] },
      { fields: [ 'state' ] },
      { fields: [ 'blogId' ]},
      { fields: [ 'fromBlogId' ]},
      { fields: [ 'rootBlogId' ]}
    ]
  });

  Post.belongsTo(Blog);
  Blog.hasMany(Post);
  Post.belongsTo(Blog, { as: 'fromBlog' } );
  Post.belongsTo(Blog, { as: 'rootBlog' } );

  const Content = sequelize.define('content', {
    tumblrId: { type: Sequelize.INTEGER, unique: 'tumblrContentVersion' },
    version: { type: Sequelize.INTEGER, unique: 'tumblrContentVersion' },
    text: { type: Sequelize.TEXT },
  },{
    indexes: [
      { fields: [ 'tumblrId' ] },
      { fields: [ 'blogId' ] }
    ]
  });

  Content.belongsTo(Blog);
  Blog.hasMany(Content);

  const PostContents = sequelize.define('postContents', {
    position: { type: Sequelize.INTEGER },
    isLast: { type: Sequelize.BOOLEAN }
  });

  Post.belongsToMany(Content, { through: PostContents });
  Content.belongsToMany(Post, { through: PostContents });

  const Resource = sequelize.define('resource', {
    type: { type: Sequelize.STRING },
    url: { type: Sequelize.STRING(65535) },
    localUrl: { type: Sequelize.STRING(65535) },
    external: { type: Sequelize.BOOLEAN },
    meta: { type: Sequelize.JSON }
  },{
    indexes: [
      { fields: [ 'url' ], unique: true },
      { fields: [ 'localUrl' ] },
      { fields: [ 'type' ] },
      { fields: [ 'external' ] }
    ]
  });

  Post.belongsToMany(Resource, { through: 'PostResources' });
  Resource.belongsToMany(Post, { through: 'PostResources' });
  Content.belongsToMany(Resource, { through: 'ContentResources' });
  Resource.belongsToMany(Content, { through: 'ContentResources' });

  const Tag = sequelize.define('tag', {
    name: { type: Sequelize.STRING(65535) }
  },{
    indexes: [
      { fields: [ 'name' ] }
    ]
  });

  Post.belongsToMany(Tag, { through: 'PostTags' });
  Tag.belongsToMany(Post, { through: 'PostTags' });

  return {
    sequelize: sequelize,
    User: User,
    Blog: Blog,
    Post: Post,
    Content: Content,
    Resource: Resource,
    Tag: Tag
  }
}
