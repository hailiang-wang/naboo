/**
 * File Proxy
 */
var models = require('../models');
var mongoose = require('mongoose');
var fs = require('fs');
var db = mongoose.db;
var FileStorage = models.FileStorage;
var connection = mongoose.connection;
var Grid = require('gridfs-stream');
var gfs = new Grid(connection.db, mongoose.mongo);

function createRootDirIfNotExist() {
  var query = FileStorage.find({type: '_root_'});
  var promise = query.exec();

  promise.then(function (fileStorages) {
    if (fileStorages.length === 0) {
      var fileStorage = new FileStorage();

      fileStorage.name = '_root_';
      fileStorage.type = '_root_';
      fileStorage.update_time = new Date();
      fileStorage.dir = null;
      fileStorage.user = null;
      fileStorage.task = null;
      fileStorage.save(function (err) {});
      
    }
  });
}

connection.on('connected', function () {
  createRootDirIfNotExist();
});


exports.updateDir = function (dir, file, callback) {
  var query = FileStorage.findById(dir),
      promise = query.exec();

  promise.then(function (fileStorage) {
    fileStorage.files.push(file);
    fileStorage.save(function (err) {
      if (err) {
        callback(err);
      } else {
        callback(err, fileStorage);
      }
    });
  }, function (err) {
    callback(err);
  });
};

exports.writeFile = function (file, dir, task, user, callback) {
  var writeStream, fileStorage = new FileStorage();

  fileStorage.type = file.type;

  if (!task) {
    task = null;
  }

  if (!user) {
    user = null;
  }

  fileStorage.name = file.name;
  fileStorage.update_time = new Date();
  fileStorage.user = user;
  fileStorage.dir = dir;
  if (fileStorage.type !== '_dir_') {
    fileStorage.size = file.size;
  }
  // file, dir, ext, task, user, callback
  fileStorage.save(function (err) {
    callback(err, fileStorage);
    if (fileStorage.type === '_dir_') {
      return true;
    }
    
    writeStream = gfs.createWriteStream({
      filename: file.name,
      mode: 'w'
    });

    fs.createReadStream(file.path).pipe(writeStream);

    writeStream.on('close', function (fsFile) {
      // file, dir, ext, task, user, callback
      fileStorage.file = fsFile._id;
      fileStorage.save(function (err) {});
    });

    writeStream.on('error', function (err) {});
  });

};

exports.listFileNames = function (dir, callback) {
  var query = FileStorage.findById(dir, 'files').populate({path: 'files'}),
      promise = query.exec();

  promise.then(function (fileStorage) {
    var names = fileStorage.files.map(function (file) {
      return file.name;
    });
    callback(null, names);
  }, function (err) {
    callback(err);
  });

};

exports.list = function (dir, user, tab, callback) {
  var params = {}, query, promise;

  switch (tab) {
  case 'all': 
    params.dir = dir;
    break;
  case 'my':
    params.dir = dir;
    params.user = user;
    break;
  case 'category':
    break;
  default:
    break;
  }

  if ('category' === tab) {
    query = FileStorage.find({
      type: {
        $nin: ['_dir_', '_root_']
      }
    });

    promise = query.exec();
    promise.then(function (fileStorages) {
      callback(null, fileStorages);
    }, function (err) {
      callback(null, []);
    });
  } else {
    query = FileStorage.findById(dir, 'files');
    promise = query.exec();
    promise.then(function (fileStorage) {
      var query = FileStorage.find({
        _id: {
          $in: fileStorage.files
        }
      }).populate({path: 'user'});
      promise = query.exec();
      promise.then(function (fileStorages) {
        callback(null, fileStorages);
      }, function (err) {
        callback(null, []);
      });
    }, function (err) {
      callback(null, []);
    });
  }
};

exports.getRootDir = function (callback) {
  var query = FileStorage.where({type: '_root_'}).findOne(),
      promise = query.exec();

  promise.then(function (fileStorage) {
    callback(null, fileStorage);
  }, function (err) {
    callback(err);
  });
};

exports.removeFiles = function (ids, dir, callback) {
  var query = FileStorage.findOne({
    _id: dir
  }), promise = query.exec();

  promise.then(function (fileStorage) {
    ids.forEach(function (id) {
      fileStorage.files.pull(id);
    });

    fileStorage.save(function (err) {
      if (err) {
        callback(err);
      } else {
        callback(null);
      }
    });

    FileStorage.remove({
      _id: {
        $in: ids
      }
    }, function (err) {});

  }, function (err) {
    callback(err);
  });
};

exports.rename = function (id, newname) {
  var query = FileStorage.findOneAndUpdate({
    _id: id
  }, {
    name: newname
  }, function (err, fileStorage) {
    db.fs.files.find(fileStorage.id).update({filename: newname});
  });
};

exports.readFileById = function (id, callback) {

  var buffer = '';

  FileStorage.findById(id, function (err, fileStorage) {
    if (err) {
      callback(err);
    } else {
      var filename = fileStorage.name;
      var readStream = gfs.createReadStream({
        _id: fileStorage.file
      });

      callback(null, filename, readStream);
    }
  });
};