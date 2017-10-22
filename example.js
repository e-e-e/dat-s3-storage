var storage = require('./')
var hyperdrive = require('hyperdrive')

var AWS = require('aws-sdk')
AWS.config.loadFromPath('./config.json')

var s3 = new AWS.S3({apiVersion: '2006-03-01'})
var s3Storage = storage('/', { s3, bucket: 'an-s3-dat-bucket', verbose: true })

console.log('Starting S3 Dat')
var archive = hyperdrive(s3Storage, {
  live: false, // keep replicating
  download: false, // download data from peers?
  upload: true, // upload data to peers?
  latest: true,
  timeout: 0
})

archive.on('ready', () => {
  console.log('S3 Dat is READY')
  archive.readdir('/', (err, list) => {
    if (err) throw err
    console.log('S3 Dat base directory:', list)
    archive.readFile(list[0], 'utf-8', (err, data) => {
      if (err) throw err
      console.log(list[0], 'from S3 Dat:')
      console.log(data)
    })
  })
})
