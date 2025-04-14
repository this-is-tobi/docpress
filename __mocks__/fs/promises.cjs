const { fs, vol } = require('memfs')

fs.cp = async (source, dest) => {
  const volDB = vol.toJSON()

  vol.writeFile(dest, volDB[source], () => {})
  // vol.fromJSON({
  //   ...volDB,
  //   [dest]: volDB[source],
  // })
}

module.exports = fs.promises
