#!/usr/bin/env ruby
# generate JSON file from the relation data generated by `generate_relation_data`

require 'json'

BLOGS = {}
YEARS = {}

ARGF.each_line do |line|
  if line =~ /^(.*) (.*) (.*) (.*) (.*)$/
    blog1name = $1
    blog2name = $2
    year = $3
    weight = $4
    total = $5

    BLOGS[blog1name] ||= { id: nil, links: {}}
    BLOGS[blog2name] ||= { id: nil, links: {} }

    BLOGS[blog1name][:links][blog2name] ||= {}
    BLOGS[blog1name][:links][blog2name][year] ||= [weight, total]

    YEARS[year] ||= {}
    YEARS[year][blog1name] ||= {}
    YEARS[year][blog1name][blog2name] ||= [weight, total]
  end
end

RESULT = {
  nodes: [],
  years: {}
}

id = 0
BLOGS.sort_by{|a,b| a}.each do |name, data|
  data[:id] = id
  RESULT[:nodes] << name
  id += 1
end

YEARS.sort_by{|a,b| a}.each do |year, data|
  RESULT[:years][year] = {}
  data.each do |blog1name, data2|
    blog1 = BLOGS[blog1name][:id]
    data2.each do |blog2name, data3|
      blog2 = BLOGS[blog2name][:id]
      RESULT[:years][year][blog1] ||= {}
      RESULT[:years][year][blog1][blog2] = data3
    end
  end
end

puts RESULT.to_json
