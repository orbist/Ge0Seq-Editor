# xbrew for x64
# install under "arch --x86_64 zsh"
# npm run release_x64

# install Mac Xcode
brew install nvm
brew install node

source ~/.nvm/nvm.sh
nvm install "$NODE_VERSION"
nvm use --delete-prefix "$NODE_VERSION"

npm i
#npm run start
npm run release
