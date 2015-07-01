var utf8 = require('utf8');
var FileStorage = require('../proxy').FileStorage;

exports.index = function (req, res, next) {
  var tab = req.query.tab || req.session.tab || 'all';
  FileStorage.getRootDir(function (err, fileStorage) {
    if (err) {
      res.end('error!');
    } else {
      res.render('file/index', {
        rootDir: fileStorage._id,
        tab: tab
      });
    }
  });
};

exports.upload = function (req, res, next) {
  var type = req.body.type,
      file = {},
      dir = req.body.dir,
      task = req.body.task,
      user = req.session.user._id;

  if ('_dir_' === type) { // create directory
    file.type = '_dir_';
    file.name = req.body.name;
  } else { // upload file
    file = req.files.file;
  }

  FileStorage.listFileNames(dir, function (err, names) {
    if (err) {
      res.writeHead(500);
      res.end(JSON.stringify({
        code: '1',
        message: '文件上传失败!'
      }));
    } else {
      if (names.indexOf(file.name) > -1) {
        res.writeHead(500);
        res.end(JSON.stringify({
          code: '2',
          message: '文件名重复!'
        }));
      } else {
        // file, dir, task, user, callback
        FileStorage.writeFile(file, dir, task, user, function (err, fileStorage) {
          FileStorage.updateDir(dir, fileStorage.id, function (err, fileStorage) {
            if (err) {
              res.writeHead(500);
              res.end(JSON.stringify({
                code: '1',
                message: '文件上传失败!'
              }));
            } else {
              res.end(JSON.stringify({
                code: '0',
                message: 'ok'
              }));
            }
          });
        });
      }
    }
  });

};

exports.list = function (req, res, next) {
  var dir = req.body.dir,
      tab = req.body.tab,
      user = req.session.user._id;

  FileStorage.list(dir, user, tab, function (err, fileStorages) {
    res.end(JSON.stringify(fileStorages));
  });
};

exports.readFile = function (req, res, next) {
  var id = req.params.file_id;

  FileStorage.readFileById(id, function (err, filename, readStream) {

    if (err) {
      res.end(err);
    } else {
      res.setHeader('content-disposition', 'attachement;filename=' + utf8.encode(filename));
      readStream.pipe(res);
    }

  });
};

exports.removeFiles = function (req, res, next) {
  var ids, dir = req.body.dir;

  try {
    ids = req.body.ids.split(',');
  } catch (err) {
    ids = [];
  }

  FileStorage.removeFiles(ids, dir, function (err) {
    if (err) {
      res.writeHead(500);
      res.end(JSON.stringify({
        code: '1',
        message: '文件删除失败!'
      }));
    } else {
      res.end(JSON.stringify({
        code: '0',
        message: 'ok'
      }));
    }
  });
};