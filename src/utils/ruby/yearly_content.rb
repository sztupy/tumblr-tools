#!/usr/bin/env ruby
# Calculate yearly top blogs based on the generated love graph data

YEARS = {}

ARGF.each_line do |line|
  if line =~ /(.*) (.*) (.*) (.*) (.*)/
    from = $1
    to = $2
    year = $3
    total = $4.to_i
    dist = $5.to_i

    YEARS[year] ||= {}
    YEARS[year][to] ||= 0
    YEARS[year][to] += dist
  end
end

TOP_BLOGS = {}

YEARS.sort_by{|a,b| a}.each do |year,blogs|
  blogs.sort_by{|a,b| -b}.take(25).each{|blog,value| TOP_BLOGS[blog] = true}
end

BLOGS = TOP_BLOGS.keys.sort

puts "year," + BLOGS.join(",")+",rest"

YEARS.sort_by{|a,b| a}.each do |year,blogs|
  print year
  BLOGS.each do |blog|
    if blogs[blog]
      print ",#{blogs[blog]}"
    else
      print ",0"
    end
  end
  rest = 0
  blogs.each do |blog, value|
    if !BLOGS.include?(blog)
      rest += value
    end
  end
  puts ",#{rest}"
end
