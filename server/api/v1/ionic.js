/**
 * API for ionic app
 */
var common = require('../../common'),
    logger = common.loggerUtil.getLogger("/api/v1/ionic"),
    requestUtil = common.requestUtil,
    u = require('util'),
    User = require('../../proxy').User,
    Q = require('q'),
    _ = require('lodash'),
    minimatch = require("minimatch"),
    wx = require('../../middlewares/connect-wechat'),
    Feedback = require('../../models').Feedback,
    config = require('../../config'),
    wxConfig = config.wechat_gzh,
    request = require('superagent');

function _saveFeedback(userId, content, callback) {
    var feedback = new Feedback();
    feedback.author = userId;
    feedback.content = content;
    feedback.save(callback);
}

/**
 * get wechat signature
 * @param  {[type]}   req  [description]
 * @param  {[type]}   res  [description]
 * @param  {Function} next [description]
 * @return {[type]}        [description]
 */
exports.getWechatSignature = function(req, res, next) {
    if (typeof(req.body) != 'object' || req.body.app_url) {
        logger.debug('getWechatSignature', 'APP URL ' + req.body.app_url);
        wx.getWxJsapiTicketFromRedis()
            .then(function(jspApiTicket) {
                return wx.getSignatureByJspApiTicketAndUrl(jspApiTicket, req.body.app_url);
            })
            .then(function(wxCredentials) {
                var params = {
                    debug: wxConfig.debug,
                    appId: wxConfig.appId,
                    timestamp: wxCredentials.timestamp,
                    nonceStr: wxCredentials.noncestr,
                    signature: wxCredentials.signature,
                    // 附录2-所有JS接口列表
                    // http://mp.weixin.qq.com/wiki/7/aaa137b55fb2e0456bf8dd9148dd613f.html#.E6.8B.8D.E7.85.A7.E6.88.96.E4.BB.8E.E6.89.8B.E6.9C.BA.E7.9B.B8.E5.86.8C.E4.B8.AD.E9.80.89.E5.9B.BE.E6.8E.A5.E5.8F.A3
                    // jsApiList可以在客户端用的时候再调整
                    jsApiList: ['chooseImage',
                        'previewImage', 'uploadImage',
                        'downloadImage', 'getLocation',
                        'openLocation'
                    ]
                };
                logger.debug('wxCredentials', JSON.stringify(params));
                requestUtil.okJsonResponse({
                    rc: 0,
                    msg: params
                }, res);
            })
            .fail(function(err) {
                logger.error(err);
                requestUtil.okJsonResponse({
                    rc: 2,
                    msg: 'Fail to get signature with app url and jsp api ticket.',
                    error: err
                }, res);
            });
    } else {
        requestUtil.okJsonResponse({
            rc: 1,
            msg: 'app url is required.'
        }, res);
    }
}

/**
 * download wechat images in with a promise array.
 * @param  {[type]} serverIds [description]
 * @return {[type]}           [description]
 */
function _downloadWechatImages(userId, serverIds) {
    logger.debug('_downloadWechatImages', 'ServerIds ' + JSON.stringify(serverIds));
    var promises = [];

    _.each(serverIds, function(serverId) {
        promises.push(wx.downloadWechatServerImage(userId, serverId));
    });

    return promises;
}

/**
 * download images from wechat server.
 * @return {[type]} [description]
 */
exports.getWechatImages = function(req, res, next) {
    if (req.body.serverIds && typeof(req.body.serverIds) &&
        req.body.serverIds.length > 0) {
        Q.allSettled(_downloadWechatImages(req.user._id, req.body.serverIds))
            .then(function(results) {
                var returns = [];
                results.forEach(function(result) {
                    if (result.state === 'fulfilled') {
                        var value = result.value;
                        returns.push(value);
                    } else {
                        var reason = result.reason;
                        logger.debug('getWechatImages', 'error ' + JSON.stringify(reason));
                    }
                });
                requestUtil.okJsonResponse({
                    rc: 0,
                    msg: returns
                }, res);
            });
    } else {
        requestUtil.okJsonResponse({
            rc: 1,
            msg: 'serverIds are required.'
        }, res);
    }
}

/**
 * handle feedback events
 */
exports.saveFeedback = function(req, res, next) {
    var content = req.body.content;
    if (content) {
        _saveFeedback(req.user._id, content, function(err, doc) {
            if (err) {
                requestUtil.okJsonResponse({
                    rc: 2,
                    msg: err
                }, res);
            } else {
                requestUtil.okJsonResponse({
                    rc: 0,
                    msg: 'Success.'
                }, res);
            }
        });
    } else {
        requestUtil.okJsonResponse({
            rc: 1,
            msg: 'Feedback content is required.'
        }, res);
    }
}

/**
 * Get app build number
 */
exports.getAppGitRevision = function(req, res, next) {
    requestUtil.okJsonResponse({
        rc: 1,
        revision: process.env['naboo_git_revision']
    }, res);
}

/**
 * Get user service level agreements
 */
exports.getSLA = function(req, res, next) {
    request.get(u.format('http://%s:%d/public/markdowns/user-service-agreements.md', config.host, config.port))
        .end(function(err, result) {
            if (result.ok) {
                res.send(result.text);
            } else {
                res.send('无法获取数据。')
            }
        });
}
