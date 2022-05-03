#!/usr/bin/env ruby
# reorder SVG so the red edges are put after the black ones

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
  else
    puts line
  end
end
