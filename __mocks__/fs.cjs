const { fs, vol } = require('memfs')

fs.cpSync = (source, dest) => {
  const volDB = vol.toJSON()

  vol.writeFileSync(dest, volDB[source])
  // vol.fromJSON({
  //   ...volDB,
  //   [dest]: volDB[source],
  // })
}

module.exports = fs
