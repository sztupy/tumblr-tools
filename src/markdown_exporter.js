import fs from 'fs';
import lodash from 'lodash';
import cheerio from 'cheerio';
import { promisify } from 'util';

export default class MarkdownExporter {
  constructor(database) {
    this.database = database;
  }

  async run() {

  }

  async savePost(post, content) {
/*
    c = Kramdown::Document.new(content, input: 'html').to_kramdown
    FileUtils.mkdir_p "_posts/tumblr/#{post[:date]}"
    File.open("_posts/tumblr/#{post[:date]}/#{post[:date]}-#{post[:id]}-#{post[:name]}.md", "w") do |f|
      f.puts post[:header].to_yaml + "---\n" + c
    end*/
  }
}
