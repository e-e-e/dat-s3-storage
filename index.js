var ras3 = require('random-access-s3')
var AWS = require('aws-sdk')
var secretStorage = require('./readonly-secret-store')
var multi = require('multi-random-access')
var Stat = require('hyperdrive/lib/messages').Stat
var messages = require('append-tree/messages')
var path = require('path')

module.exports = function (dir, options) {
  if (!options.s3) options.s3 = new AWS.S3({apiVersion: '2006-03-01'});
  return {
    metadata: function (name, opts) {
      // console.log('accessing metadata', name)
      if (name === 'secret_key')
        return secretStorage(null, options)(path.join(dir, '.dat/metadata.ogd'), { key: opts.key, discoveryKey: opts.discoveryKey })
      return ras3(path.join(dir, '.dat/metadata.' + name), options)
    },
    content: function (name, opts, archive) {
      // console.log('accessing content', name)
      if (!archive) archive = opts
      if (name === 'data') return createStorage(archive, dir, options)
      return ras3(path.join(dir, '.dat/content.' + name), options)
    }
  }
}

function createStorage (archive, dir, options) {
  if (!archive.latest) throw new Error('Currently only "latest" mode is supported.')

  var latest = archive.latest
  var head = null
  var storage = multi({limit: 128}, locate)

  // TODO: this should be split into two events, 'appending' and 'append'
  archive.on('appending', onappending)
  archive.on('append', onappend)

  return storage

  function onappend (name, opts) {
    if (head) head.end = archive.content.byteLength
  }

  function onappending (name, opts) {
    if (head) head.end = archive.content.byteLength

    var v = latest ? '' : '.' + archive.metadata.length

    head = {
      start: archive.content.byteLength,
      end: Infinity,
      storage: ras3(name + v, options)
    }

    storage.add(head)
  }

  function locate (offset, cb) {
    archive.ready(function (err) {
      if (err) return cb(err)

      find(archive.metadata, offset, function (err, node, st, index) {
        if (err) return cb(err)
        if (!node) return cb(new Error('Could not locate data'))

        var v = latest ? '' : '.' + index

        cb(null, {
          start: st.byteOffset,
          end: st.byteOffset + st.size,
          storage: ras3(node.name + v, options)
        })
      })
    })
  }
}

function get (metadata, btm, seq, cb) {
  if (seq < btm) return cb(null, -1, null)

  // TODO: this can be done a lot faster using the hypercore internal iterators, expose!
  var i = seq
  while (!metadata.has(i) && i > btm) i--
  if (!metadata.has(i)) return cb(null, -1, null)
  metadata.get(i, { valueEncoding: messages.Node }, function (err, node) {
    if (err) return cb(err)
    var st = node.value && Stat.decode(node.value)

    if (!node.value || (!st.offset && !st.blocks) || (!st.byteOffset && !st.blocks)) {
      return get(metadata, btm, i - 1, cb) // TODO: check the index instead for fast lookup
    }

    cb(null, i, node, st)
  })
}

function find (metadata, bytes, cb) {
  var top = metadata.length - 1
  var btm = 1
  var mid = Math.floor((top + btm) / 2)

  get(metadata, btm, mid, function loop (err, actual, node, st) {
    if (err) return cb(err)

    var oldMid = mid

    if (!node) {
      btm = mid
      mid = Math.floor((top + btm) / 2)
    } else {
      var start = st.byteOffset
      var end = st.byteOffset + st.size

      if (start <= bytes && bytes < end) return cb(null, node, st, actual)
      if (top <= btm) return cb(null, null, null, -1)

      if (bytes < start) {
        top = mid
        mid = Math.floor((top + btm) / 2)
      } else {
        btm = mid
        mid = Math.floor((top + btm) / 2)
      }
    }

    if (mid === oldMid) {
      if (btm < top) mid++
      else return cb(null, null, null, -1)
    }

    get(metadata, btm, mid, loop)
  })
}
