/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs';
import { createClient } from './lib/tumblr.js';
import { environment } from './environment.js';
import archiver from 'archiver';
import { fileURLToPath } from 'url';
import path from 'path';
import YAML from 'yaml'
import { getConfig } from './lib/mediaExport.js';
import { apiDownloader } from './lib/apiDownloader.js';

const client = createClient(environment.tumblrKeys);
const config = YAML.parse(fs.readFileSync(process.argv[2] || 'backup_config.yaml').toString())

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename);

if (!fs.existsSync(getConfig(config, 'default', 'export_dir_root', __dirname + "/dump"))) {
  fs.mkdirSync(getConfig(config, 'default', 'export_dir_root', __dirname + "/dump"), { recursive: true });
}

const logger = console.log;

const initScript = function (config: any, username: string) {
  if (!fs.existsSync(getConfig(config, username, 'export_dir', __dirname + "/dump/" + username))) {
    fs.mkdirSync(getConfig(config, username, 'export_dir', __dirname + "/dump/" + username), { recursive: true });
  }
}

const mainScript = function (config: any, username: string, options: any, body: any) {
  const json = JSON.stringify(body);
  fs.writeFile('dump/' + username + '/dump-' + options.offset + '.json', json, 'utf8', function () { });
}

await apiDownloader(config, client, logger, initScript, mainScript)

const output = fs.createWriteStream(__dirname + `/backup-${Date.now()}.zip`);
const archive = archiver('zip', {
  zlib: { level: 9 } // Sets the compression level.
});

output.on('close', function () {
  console.log(archive.pointer() + ' total bytes written');
});

archive.on('error', function (err) {
  console.log(err);
});

archive.pipe(output);

archive.directory(getConfig(config, 'default', 'export_dir_root', __dirname + "/dump"), 'dump');

archive.finalize();
