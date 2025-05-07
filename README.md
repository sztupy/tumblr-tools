# Tumblr Tools

Various tools and resources to back-up your Tumblr data.

## Prerequisites

Make sure you have `node >= 20` installed, and get the packages:

```bash
npm i
```

Afterwards you will need to register a Tumblr App to use these tools. You can do that over at https://www.tumblr.com/oauth/apps

When registering fill in "Application Name", and "Application Dexcription" as you'd like. You can enter "http://localhost:3000" for any website and required URL detail.

Once your app is created make note of the "OAuth Consumer Key" and "Secret key" values.

Next copy over `environment.ts.example` to `environment.ts`. Edit the `tumblrKeys` section it so it looks like the following:

```js
{
  tumblrKeys: [
    {
      consumer_key: 'CONSUMER_KEY',
      consumer_secret: 'CONSUMER_SECRET',
    },
  ]
}
```

Make sure to add your own `CONSUMER_KEY` and `CONSUMER_SECRET` values.

> **Note:** Tumblr's default API limit is 1,000 requests/hour, which allows 50,000 posts to be saved (one requests gets you 50 posts). If your blog has more than that you can create a few more API keys if you want and add them to the list. Do note there are other API Limits as well tied to your IP address / computer, so there is likely no point in creating more than 4, which would be enough to backup a blog that has 200,000 posts in an hour, or a blog with 400,000 posts in 2 hours.

## Login

Once you have your key set up you need to log in. Start the login server:

```bash
npm exec tsx login.ts
```

You will get a URL that you will need to open in the same browser you are logged in on Tumblr.

> **Note:** If you have enabled more than one API key, you will get a separate URL for each API key. You need to login with each of them.

> **Warning:** Make sure you login to the exact same user with each of the separate API Keys, otherwise you will get into issues during backup and other activities

After successful login you will get all of the required details on the console. Replace the `tumblrKeys` value in your `environment.ts` with the new settings:

```js
{
  tumblrKeys: [
    { "consumer_key": "abcd", "consumer_secret": "efgh", "token": "iklm", "token_secret": "nopq" },
  ]
}
```

## Backup to file

To backup a blog to a file you need to create a backup config. For example if your blog is named `awesomeblog`, here are a couple examples:

This will download all posts you have made and dump them in JSON. It will not download the media files:

```yaml
concurrency: 1
defaults:
users:
  awesomeblog:
```

This will not just download all posts intop JSON, but also all of the media files you have made:

```yaml
concurrency: 1
defaults:
users:
  awesomeblog:
    dump_media: true
```

This will download all posts, and the media files you and all other people you reblogged from have made and dump them in JSON. This is the most complete backup you can do with this tool:

```yaml
concurrency: 1
defaults:
users:
  awesomeblog:
    dump_media: true
    dump_all_media: true
```

You can also dump the last 1000 posts on your dashboard:

```yaml
concurrency: 1
defaults:
  dump_media: true
  dump_all_media: true
users:
  dashboard:
    max_offset: 1000
```

## Import to database

Once you have a dump you can import it to a database. Tumblr-tools support postgresql databases. Anything above version 14 should be fine.

### Init

First create a new database:

```sql
CREATE DATABASE tumblr;
```

Then edit your config in `environment.ts`:

```js
{
  databaseConnectionString: "postgres://<username>:<password>@<host>:<port>/<database_name>"
}
```

Example:

```js
{
  databaseConnectionString: "postgres://postgres:root@localhost:5432/tumblr"
}
```

Next run the migrations:

```bash
npm run db:migrate
```

### Import

Create a new importer file `import.ts` with the following contents:

```js
import Processor from "./lib/processor.js";
import Finalizer from "./lib/finalizer.js";
import ZipFileImporter from "./lib/zipFileImporter.js";

async function run() {
  const importer = new ZipFileImporter("<backup_location>");
  await importer.run();

  const processor = new Processor();
  await processor.run();

  const finalizer = new Finalizer({
    createBlogs: ['<your_blog_name>']
  });
  await finalizer.run();
}

run();
```

Update `<backup_location>` to point to a backup file you generated earlier, and `<your_blog_name>` to the blog(s) you wish to mark as "relevant" in the database. Generally these should be your main and side blogs.

> **Note:: you can also check the `import.ts.example` file for more options

Next run

```bash
npm exec tsx import.ts
```

This will import the dump into the database, run some analytics on it.

## Notes

### Import steps

The database import has the following steps:

* `Importer`: This will load up JSON files either from a ZIP or the API and insert the data to the database
* `Processor`: This will check the uploaded content and finds language information in the posts present. It will also find all of the pings between blogs
* `Finalizer`: Runs statistics on the uploaded data. Will determine "relevant" blogs based on the pre-set languge qualifier if needed. Will also handle merging of blogs where the blog's name was changed in the past.

### Database structure

The main structure of the database is the following:

* `Blog`: this contains the list of blogs that are deemed "relevant". Unless created manually, the `Finalizer` will fill in this list based on the pre-set language settings, and mark any blog that posts in the marked language as "relevant". Each `Blog` can have multiple `BlogNames` which describes all of the blog renames that the dump has found during it's processing.
* `BlogName`: this contains all of the blog names that appear in the import dump. Names are kept as-is during the import.
* `Post`: this contains a specific post in the system - either an original post, or a reblog.
* `Content`: this contains the textual representation of either the main post or any of the reblog trail's contents. To save space in the database `Content` objects are re-used between posts whenever the text is the exaxt same. `Posts` and `Contents` are linked using the `PostContent` join table which also includes which reblog a specific content is on the post to.

Note that any links to tumblr's image server are shortened to `t:` to save space.

In order to reconstruct a specific post from the database you would need to:

1. Obtain the post, for example by it's `tumblr_id`. The post will contains the `title` and some metadata which is usually relevant for non-text posts (like `audio_src` for `audio` posts)

2. Consult the `post_contents` table for the entire reblog thread. Make sure to order this by the `position` field in order

3. Get each of the `contents` object in order. This will contain the textual part of the entire reblog trail

4. Convert each of the links, and replace `t:` with `https://64.media.tumblr.com/`

You now have the post reconstructed

### Limitations

The database currently cannot properly handle cases where a blog that is marked "relevant" was renamed, and then the old name was re-registered by someone else, and might believe the two blogs are one and the same.

## License

Licensed under the AGPLv3
