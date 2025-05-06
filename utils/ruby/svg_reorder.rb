#!/usr/bin/env ruby
# reorder SVG so the red edges are put after the black ones so they appear on top

pos = nil
edge_type = nil

saved_edge = nil
saved = []

ARGF.each_line do |line|
  if line =~ /id="edge/
    pos = :edge
    edge_type = nil
    saved_edge = [line];
  elsif line =~ /<\/g/ && pos == :edge
    saved_edge << line
    pos = nil
    if edge_type == :save
      saved << saved_edge
    else
      saved_edge.each do |s|
        puts s
      end
    end
    saved_edge = nil
  elsif line =~ /id="node/ && !saved.nil?
    saved.each do |s|
      s.each do |ss|
        puts ss
      end
    end
    saved = nil
    puts line
  elsif pos == :edge
    saved_edge << line
    if line =~ /#660000/
      edge_type = :save
    end
  elsif line =~ /<polygon fill="#000000" stroke="#000000"/
    puts line.gsub(/<polygon fill="#000000" stroke="#000000"/,'<polygon fill="#dddddd" stroke="#dddddd"')
  else
    puts line
  end
end
