#! /bin/bash

# NOTE: from
# https://bharathvaj.me/blog/how-to-publish-your-nodejs-project-on-homebrew

# https://github.com/vercel/pkg#readme
pkg package.json
cd release/
mv privatize-macos privatize
tar -czf privatize.tar.gz privatize
shasum -a 256 privatize.tar.gz
