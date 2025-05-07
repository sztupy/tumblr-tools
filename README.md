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

```json
  tumblrKeys: [
    {
      consumer_key: 'CONSUMER_KEY',
      consumer_secret: 'CONSUMER_SECRET',
    },
  ]
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

```json
tumblrKeys: [
  { "consumer_key": "abcd", "consumer_secret": "efgh", "token": "iklm", "token_secret": "nopq" },
]
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

```json
databaseConnectionString: "postgres://<username>:<password>@<host>:<port>/<database_name>",
```

Example:

```json
databaseConnectionString: "postgres://postgres:root@localhost:5432/tumblr"
```

Next run the migrations:

```bash
npm run db:migrate
```

### Backup

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

  const finalizer = new Finalizer("ENGLISH");
  await finalizer.run();
}

run();
```

Update `<backup_location>` to point to a backup file you generated earlier.

Next run

```bash
npm exec tsx import.ts
```

This will import the dump into the database, run some analytics on it, and specifically highlight blogs that are done in the target language (`ENGLISH` in this example)
