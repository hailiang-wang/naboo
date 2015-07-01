
var common = require('../../common');
var validator = require('validator');

exports.save = function(req, res, next) {
    var type = validator.trim(req.body.type);
    var content = validator.trim(req.body.content);
    var log = common.loggerUtil.getLogger(type);
    log.error(type, content);
};