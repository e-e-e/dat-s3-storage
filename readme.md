# dat-s3-storage

A readonly storage interface for [dat-node](https://www.npmjs.com/package/dat-node) and [hyperdrive](https://www.npmjs.com/package/hyperdrive). This package is a modified version of [dat-storage](https://www.npmjs.com/package/dat-storage) which uses [random-access-s3](https://www.npmjs.com/package/random-access-s3) instead of [random-access-file](https://www.npmjs.com/package/random-access-file).

## Installation

```
npm install dat-s3-storage
```

## Why?

This was initially intended as an experiment to see if it is possible to serve a dat archive's content via AWS S3. My thinking around this is that AWS could be a cheep alternative for adding redundancy to a dat network. AWS also has a number of public data sets which could also be exposed through dat - https://aws.amazon.com/public-datasets/.

### Downside

**TLDR;** Latency is a killer. And requests can be costly.

Hyperdrive makes numerous byte sized requests to the metadata store. Amazon AWS can be slow, which makes loading a hyperdrive *really* slow. AWS also charges per request, so making lots of small requests could end up being costly.
Being readonly you are responsible for syncing changes to the dat via AWS cli.

### Future

**TLDR;** Perhaps a hybrid storage model.

Some of the downsides of using aws for readonly storage could perhaps be avoided by developing a hybrid storage system, one where metadata is stored and served locally while content is served from an S3 bucket.

## Usage
To use dat-s3-storage you first need to clone your dat to an s3 bucket.

For example:
```sh
# using the aws cli
aws s3 sync ./your-local-dat s3://your-dat-bucket/
```

It is recommended to set up a new AWS user with restricted readonly access to the your dat bucket.

### Basic Example

```js
var storage = require('dat-s3-storage')
var hyperdrive = require('hyperdrive')

var AWS = require('aws-sdk')
// you will need to get permission credentials for aws
AWS.config.loadFromPath('./config.json')

var s3 = new AWS.S3({apiVersion: '2006-03-01'})
var s3Storage = storage('/', { s3, bucket: 'your-dat-bucket', verbose: true })

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
```
