import { DataTypes, QueryInterface } from "sequelize";
import { Migration } from "../migrate.js";

type MigrationCommand = {
  fn: keyof QueryInterface;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any[];
};

const migrationCommands: MigrationCommand[] = [
  {
    fn: "createTable",
    params: [
      "blogs",
      {
        id: {
          type: DataTypes.INTEGER,
          field: "id",
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },
        name: {
          type: DataTypes.STRING,
          field: "name",
          unique: true,
        },
        type: {
          type: DataTypes.ENUM("active", "deactivated"),
          field: "type",
        },
      },
      {
        charset: "utf8",
      },
    ],
  },
  {
    fn: "createTable",
    params: [
      "resources",
      {
        id: {
          type: DataTypes.INTEGER,
          field: "id",
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },
        type: {
          type: DataTypes.STRING,
          field: "type",
        },
        url: {
          type: DataTypes.STRING,
          field: "url",
        },
        local_url: {
          type: DataTypes.STRING,
          field: "local_url",
        },
        external: {
          type: DataTypes.BOOLEAN,
          field: "external",
        },
        meta: {
          type: DataTypes.JSONB,
          field: "meta",
        },
      },
      {
        charset: "utf8",
      },
    ],
  },
  {
    fn: "createTable",
    params: [
      "tags",
      {
        id: {
          type: DataTypes.INTEGER,
          field: "id",
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },
        name: {
          type: DataTypes.STRING(65535),
          field: "name",
        },
      },
      {
        charset: "utf8",
      },
    ],
  },
  {
    fn: "createTable",
    params: [
      "languages",
      {
        id: {
          type: DataTypes.INTEGER,
          field: "id",
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },
        name: {
          type: DataTypes.STRING,
          field: "name",
        },
      },
      {
        charset: "utf8",
      },
    ],
  },
  {
    fn: "createTable",
    params: [
      "imports",
      {
        id: {
          type: DataTypes.INTEGER,
          field: "id",
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },
        file_date: {
          type: DataTypes.DATE,
          field: "file_date",
        },
        file_name: {
          type: DataTypes.STRING,
          field: "file_name",
        },
        phase: {
          type: DataTypes.ENUM(
            "need_import",
            "import_finished",
            "processed",
            "finalized",
          ),
          field: "phase",
        },
        postId: {
          type: DataTypes.INTEGER,
          field: "post_id",
          allowNull: true,
        },
        contentId: {
          type: DataTypes.INTEGER,
          field: "content_id",
          allowNull: true,
        },
        tagId: {
          type: DataTypes.INTEGER,
          field: "tag_id",
          allowNull: true,
        },
        resourceId: {
          type: DataTypes.INTEGER,
          field: "resource_id",
          allowNull: true,
        },
        blogId: {
          type: DataTypes.INTEGER,
          field: "blog_id",
          allowNull: true,
        },
        blogNameId: {
          type: DataTypes.INTEGER,
          field: "blog_name_id",
          allowNull: true,
        },
        blogLinkId: {
          type: DataTypes.INTEGER,
          field: "blog_link_id",
          allowNull: true,
        },
        languageId: {
          type: DataTypes.INTEGER,
          field: "language_id",
          allowNull: true,
        },
        statId: {
          type: DataTypes.INTEGER,
          field: "stat_id",
          allowNull: true,
        },
      },
      {
        charset: "utf8",
      },
    ],
  },
  {
    fn: "createTable",
    params: [
      "blog_names",
      {
        id: {
          type: DataTypes.INTEGER,
          field: "id",
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },
        name: {
          type: DataTypes.STRING,
          field: "name",
          unique: true,
        },
        blogId: {
          type: DataTypes.INTEGER,
          field: "blog_id",
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
          references: {
            model: "blogs",
            key: "id",
          },
          allowNull: true,
        },
      },
      {
        charset: "utf8",
      },
    ],
  },
  {
    fn: "createTable",
    params: [
      "blog_links",
      {
        id: {
          type: DataTypes.INTEGER,
          field: "id",
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
        },
        type: {
          type: DataTypes.ENUM("author", "manual", "rename"),
          field: "type",
        },
        destinationId: {
          type: DataTypes.INTEGER,
          unique: "blog_links_destinationId_sourceId_unique",
          field: "destination_id",
        },
        importId: {
          type: DataTypes.INTEGER,
          onUpdate: "CASCADE",
          onDelete: "NO ACTION",
          references: {
            model: "imports",
            key: "id",
          },
          allowNull: true,
          field: "import_id",
        },
        meta: {
          type: DataTypes.JSONB,
          field: "meta",
        },
        sourceId: {
          type: DataTypes.INTEGER,
          field: "source_id",
          unique: "blog_links_destinationId_sourceId_unique",
        },
      },
      {
        charset: "utf8",
      },
    ],
  },
  {
    fn: "createTable",
    params: [
      "posts",
      {
        id: {
          type: DataTypes.INTEGER,
          field: "id",
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },
        tumblr_id: {
          type: DataTypes.BIGINT,
          field: "tumblr_id",
          unique: true,
        },
        title: {
          type: DataTypes.STRING,
          field: "title",
        },
        type: {
          type: DataTypes.ENUM(
            "text",
            "link",
            "photo",
            "audio",
            "quote",
            "chat",
            "video",
            "answer",
          ),
          field: "type",
        },
        meta: {
          type: DataTypes.JSONB,
          field: "meta",
        },
        date: {
          type: DataTypes.DATE,
          field: "date",
        },
        url: {
          type: DataTypes.STRING(65535),
          field: "url",
        },
        root: {
          type: DataTypes.BOOLEAN,
          field: "root",
        },
        root_tumblr_id: {
          type: DataTypes.BIGINT,
          field: "root_tumblr_id",
        },
        from_tumblr_id: {
          type: DataTypes.BIGINT,
          field: "from_tumblr_id",
        },
        processed: {
          type: DataTypes.BOOLEAN,
          field: "processed",
          defaultValue: false,
          allowNull: false,
        },
        blogNameId: {
          type: DataTypes.INTEGER,
          field: "blog_name_id",
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
          references: {
            model: "blog_names",
            key: "id",
          },
          allowNull: true,
        },
        fromBlogNameId: {
          type: DataTypes.INTEGER,
          field: "from_blog_name_id",
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
          references: {
            model: "blog_names",
            key: "id",
          },
          allowNull: true,
        },
        rootBlogNameId: {
          type: DataTypes.INTEGER,
          field: "root_blog_name_id",
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
          references: {
            model: "blog_names",
            key: "id",
          },
          allowNull: true,
        },
      },
      {
        charset: "utf8",
      },
    ],
  },
  {
    fn: "createTable",
    params: [
      "contents",
      {
        id: {
          type: DataTypes.INTEGER,
          field: "id",
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },
        tumblr_id: {
          type: DataTypes.BIGINT,
          field: "tumblr_id",
          unique: "tumblr_content_version",
        },
        version: {
          type: DataTypes.STRING(64),
          field: "version",
          unique: "tumblr_content_version",
        },
        text: {
          type: DataTypes.TEXT,
          field: "text",
        },
        processed: {
          type: DataTypes.BOOLEAN,
          field: "processed",
          defaultValue: false,
          allowNull: false,
        },
        blogNameId: {
          type: DataTypes.INTEGER,
          field: "blog_name_id",
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
          references: {
            model: "blog_names",
            key: "id",
          },
          allowNull: true,
        },
      },
      {
        charset: "utf8",
      },
    ],
  },
  {
    fn: "createTable",
    params: [
      "blog_name_pings",
      {
        contentId: {
          type: DataTypes.INTEGER,
          field: "content_id",
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
          references: {
            model: "contents",
            key: "id",
          },
          primaryKey: true,
        },
        blogNameId: {
          type: DataTypes.INTEGER,
          field: "blog_name_id",
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
          references: {
            model: "blog_names",
            key: "id",
          },
          primaryKey: true,
        },
      },
      {
        charset: "utf8",
      },
    ],
  },
  {
    fn: "createTable",
    params: [
      "post_contents",
      {
        position: {
          type: DataTypes.INTEGER,
          field: "position",
        },
        is_last: {
          type: DataTypes.BOOLEAN,
          field: "is_last",
        },
        postId: {
          type: DataTypes.INTEGER,
          field: "post_id",
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
          references: {
            model: "posts",
            key: "id",
          },
          primaryKey: true,
        },
        contentId: {
          type: DataTypes.INTEGER,
          field: "content_id",
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
          references: {
            model: "contents",
            key: "id",
          },
          primaryKey: true,
        },
      },
      {
        charset: "utf8",
      },
    ],
  },
  {
    fn: "createTable",
    params: [
      "post_resources",
      {
        position: {
          type: DataTypes.INTEGER,
          field: "position",
        },
        postId: {
          type: DataTypes.INTEGER,
          field: "post_id",
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
          references: {
            model: "posts",
            key: "id",
          },
          primaryKey: true,
        },
        resourceId: {
          type: DataTypes.INTEGER,
          field: "resource_id",
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
          references: {
            model: "resources",
            key: "id",
          },
          primaryKey: true,
        },
      },
      {
        charset: "utf8",
      },
    ],
  },
  {
    fn: "createTable",
    params: [
      "post_tags",
      {
        position: {
          type: DataTypes.INTEGER,
          field: "position",
        },
        postId: {
          type: DataTypes.INTEGER,
          field: "post_id",
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
          references: {
            model: "posts",
            key: "id",
          },
          primaryKey: true,
        },
        tagId: {
          type: DataTypes.INTEGER,
          field: "tag_id",
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
          references: {
            model: "tags",
            key: "id",
          },
          primaryKey: true,
        },
      },
      {
        charset: "utf8",
      },
    ],
  },
  {
    fn: "createTable",
    params: [
      "post_languages",
      {
        percentage: {
          type: DataTypes.INTEGER,
          field: "percentage",
        },
        score: {
          type: DataTypes.INTEGER,
          field: "score",
        },
        postId: {
          type: DataTypes.INTEGER,
          field: "post_id",
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
          references: {
            model: "posts",
            key: "id",
          },
          primaryKey: true,
        },
        languageId: {
          type: DataTypes.INTEGER,
          field: "language_id",
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
          references: {
            model: "languages",
            key: "id",
          },
          primaryKey: true,
        },
      },
      {
        charset: "utf8",
      },
    ],
  },
  {
    fn: "createTable",
    params: [
      "content_languages",
      {
        percentage: {
          type: DataTypes.INTEGER,
          field: "percentage",
        },
        score: {
          type: DataTypes.INTEGER,
          field: "score",
        },
        contentId: {
          type: DataTypes.INTEGER,
          field: "content_id",
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
          references: {
            model: "contents",
            key: "id",
          },
          primaryKey: true,
        },
        languageId: {
          type: DataTypes.INTEGER,
          field: "language_id",
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
          references: {
            model: "languages",
            key: "id",
          },
          primaryKey: true,
        },
      },
      {
        charset: "utf8",
      },
    ],
  },
  {
    fn: "createTable",
    params: [
      "stats",
      {
        id: {
          type: DataTypes.INTEGER,
          field: "id",
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },
        from: {
          type: DataTypes.DATE,
          field: "from",
        },
        to: {
          type: DataTypes.DATE,
          field: "to",
        },
        name: {
          type: DataTypes.STRING,
          field: "name",
        },
        posts_count: {
          type: DataTypes.BIGINT,
          field: "posts_count",
        },
        contents_count: {
          type: DataTypes.BIGINT,
          field: "contents_count",
        },
        posts_bytes: {
          type: DataTypes.BIGINT,
          field: "posts_bytes",
        },
        contents_bytes: {
          type: DataTypes.BIGINT,
          field: "contents_bytes",
        },
        appearances: {
          type: DataTypes.BIGINT,
          field: "appearances",
        },
        reblog_reach: {
          type: DataTypes.BIGINT,
          field: "reblog_reach",
        },
        root_reach: {
          type: DataTypes.BIGINT,
          field: "root_reach",
        },
        languageId: {
          type: DataTypes.INTEGER,
          field: "language_id",
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
          references: {
            model: "languages",
            key: "id",
          },
          allowNull: true,
        },
        blogNameId: {
          type: DataTypes.INTEGER,
          field: "blog_name_id",
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
          references: {
            model: "blog_names",
            key: "id",
          },
          allowNull: true,
        },
        blogId: {
          type: DataTypes.INTEGER,
          field: "blog_id",
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
          references: {
            model: "blogs",
            key: "id",
          },
          allowNull: true,
        },
        importId: {
          type: DataTypes.INTEGER,
          field: "import_id",
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
          references: {
            model: "imports",
            key: "id",
          },
          allowNull: true,
        },
      },
      {
        charset: "utf8",
      },
    ],
  },
  {
    fn: "addIndex",
    params: [
      "blog_names",
      ["name"],
      {
        indexName: "blog_names_name",
        name: "blog_names_name",
        using: "hash",
      },
    ],
  },
  {
    fn: "addIndex",
    params: [
      "blog_links",
      ["type", "source_id", "destination_id", "import_id"],
      {
        indexName: "blog_links_type_source_id_destination_id_import_id",
        name: "blog_links_type_source_id_destination_id_import_id",
        indicesType: "UNIQUE",
        type: "UNIQUE",
      },
    ],
  },
  {
    fn: "addIndex",
    params: [
      "posts",
      ["processed"],
      {
        indexName: "posts_processed",
        name: "posts_processed",
      },
    ],
  },
  {
    fn: "addIndex",
    params: [
      "posts",
      ["root_blog_name_id"],
      {
        indexName: "posts_root_blog_name_id",
        name: "posts_root_blog_name_id",
      },
    ],
  },
  {
    fn: "addIndex",
    params: [
      "posts",
      ["from_blog_name_id"],
      {
        indexName: "posts_from_blog_name_id",
        name: "posts_from_blog_name_id",
      },
    ],
  },
  {
    fn: "addIndex",
    params: [
      "posts",
      ["from_tumblr_id"],
      {
        indexName: "posts_from_tumblr_id",
        name: "posts_from_tumblr_id",
      },
    ],
  },
  {
    fn: "addIndex",
    params: [
      "posts",
      ["root_tumblr_id"],
      {
        indexName: "posts_root_tumblr_id",
        name: "posts_root_tumblr_id",
      },
    ],
  },
  {
    fn: "addIndex",
    params: [
      "posts",
      ["blog_name_id"],
      {
        indexName: "posts_blog_name_id",
        name: "posts_blog_name_id",
      },
    ],
  },
  {
    fn: "addIndex",
    params: [
      "posts",
      ["root"],
      {
        indexName: "posts_root",
        name: "posts_root",
      },
    ],
  },
  {
    fn: "addIndex",
    params: [
      "posts",
      ["date"],
      {
        indexName: "posts_date",
        name: "posts_date",
      },
    ],
  },
  {
    fn: "addIndex",
    params: [
      "posts",
      ["type"],
      {
        indexName: "posts_type",
        name: "posts_type",
      },
    ],
  },
  {
    fn: "addIndex",
    params: [
      "posts",
      ["tumblr_id"],
      {
        indexName: "posts_tumblr_id",
        name: "posts_tumblr_id",
      },
    ],
  },
  {
    fn: "addIndex",
    params: [
      "contents",
      ["processed"],
      {
        indexName: "contents_processed",
        name: "contents_processed",
      },
    ],
  },
  {
    fn: "addIndex",
    params: [
      "contents",
      ["blog_name_id"],
      {
        indexName: "contents_blog_name_id",
        name: "contents_blog_name_id",
      },
    ],
  },
  {
    fn: "addIndex",
    params: [
      "contents",
      ["version"],
      {
        indexName: "contents_version_hash",
        name: "contents_version_hash",
        using: "hash",
      },
    ],
  },
  {
    fn: "addIndex",
    params: [
      "contents",
      ["tumblr_id", "version"],
      {
        indexName: "tumblr_content_version",
        name: "tumblr_content_version",
        indicesType: "UNIQUE",
        type: "UNIQUE",
      },
    ],
  },
  {
    fn: "addIndex",
    params: [
      "contents",
      ["tumblr_id"],
      {
        indexName: "contents_tumblr_id",
        name: "contents_tumblr_id",
      },
    ],
  },
  {
    fn: "addIndex",
    params: [
      "post_contents",
      ["is_last"],
      {
        indexName: "post_contents_is_last",
        name: "post_contents_is_last",
      },
    ],
  },
  {
    fn: "addIndex",
    params: [
      "post_contents",
      ["position"],
      {
        indexName: "post_contents_position",
        name: "post_contents_position",
      },
    ],
  },
  {
    fn: "addIndex",
    params: [
      "resources",
      ["external"],
      {
        indexName: "resources_external",
        name: "resources_external",
      },
    ],
  },
  {
    fn: "addIndex",
    params: [
      "resources",
      ["type"],
      {
        indexName: "resources_type",
        name: "resources_type",
      },
    ],
  },
  {
    fn: "addIndex",
    params: [
      "resources",
      ["local_url"],
      {
        indexName: "resources_local_url",
        name: "resources_local_url",
      },
    ],
  },
  {
    fn: "addIndex",
    params: [
      "resources",
      ["url"],
      {
        indexName: "resources_url_hash",
        name: "resources_url_hash",
        using: "hash",
      },
    ],
  },
  {
    fn: "addIndex",
    params: [
      "resources",
      ["url"],
      {
        indexName: "resources_url",
        name: "resources_url",
        indicesType: "UNIQUE",
        type: "UNIQUE",
      },
    ],
  },
  {
    fn: "addIndex",
    params: [
      "post_resources",
      ["position"],
      {
        indexName: "post_resources_position",
        name: "post_resources_position",
      },
    ],
  },
  {
    fn: "addIndex",
    params: [
      "tags",
      ["name"],
      {
        indexName: "tags_name",
        name: "tags_name",
      },
    ],
  },
  {
    fn: "addIndex",
    params: [
      "post_tags",
      ["position"],
      {
        indexName: "post_tags_position",
        name: "post_tags_position",
      },
    ],
  },
  {
    fn: "addIndex",
    params: [
      "languages",
      ["name"],
      {
        indexName: "languages_name",
        name: "languages_name",
        indicesType: "UNIQUE",
        type: "UNIQUE",
      },
    ],
  },
  {
    fn: "addIndex",
    params: [
      "post_languages",
      ["score"],
      {
        indexName: "post_languages_score",
        name: "post_languages_score",
      },
    ],
  },
  {
    fn: "addIndex",
    params: [
      "post_languages",
      ["percentage"],
      {
        indexName: "post_languages_percentage",
        name: "post_languages_percentage",
      },
    ],
  },
  {
    fn: "addIndex",
    params: [
      "content_languages",
      ["score"],
      {
        indexName: "content_languages_score",
        name: "content_languages_score",
      },
    ],
  },
  {
    fn: "addIndex",
    params: [
      "content_languages",
      ["percentage"],
      {
        indexName: "content_languages_percentage",
        name: "content_languages_percentage",
      },
    ],
  },
  {
    fn: "addIndex",
    params: [
      "stats",
      ["to"],
      {
        indexName: "stats_to",
        name: "stats_to",
      },
    ],
  },
  {
    fn: "addIndex",
    params: [
      "stats",
      ["from"],
      {
        indexName: "stats_from",
        name: "stats_from",
      },
    ],
  },
];

export const up: Migration = function ({ context: queryInterface }) {
  let index = 0;
  return new Promise<void>(function (resolve, reject) {
    function next() {
      if (index < migrationCommands.length) {
        const command = migrationCommands[index];
        console.log("[#" + index + "] execute: " + command.fn);
        index++;
        const method = queryInterface[command.fn];
        if (typeof method === "function") {
          method.apply(queryInterface, command.params).then(next, reject);
        }
      } else resolve();
    }
    next();
  });
};
