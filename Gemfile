source "https://rubygems.org"

# Use the github-pages gem so local builds match what GitHub Pages actually
# produces. This pins Jekyll and all supported plugins to the versions
# currently running on Pages.
gem "github-pages", group: :jekyll_plugins

# Plugins used by the site (these are allowlisted on GitHub Pages).
group :jekyll_plugins do
  gem "jekyll-feed"
  gem "jekyll-seo-tag"
end

# Windows and JRuby do not include zoneinfo files, so bundle the tzinfo-data gem
# and associated library.
platforms :mingw, :x64_mingw, :mswin, :jruby do
  gem "tzinfo", ">= 1", "< 3"
  gem "tzinfo-data"
end

# Performance-booster for watching directories on Windows
gem "wdm", "~> 0.1.1", :platforms => [:mingw, :x64_mingw, :mswin]

# Lock `http_parser.rb` gem to `v0.6.x` on JRuby builds since newer versions
# of the gem do not have a Java counterpart.
gem "http_parser.rb", "~> 0.6.0", :platforms => [:jruby]

# webrick is no longer bundled with Ruby >= 3.0
gem "webrick", "~> 1.8"

# Ruby 3.4+ removed these from the default gem set, but Jekyll 3.9 (pinned by
# github-pages) still requires them.
gem "csv"
gem "base64"
gem "bigdecimal"
gem "logger"
