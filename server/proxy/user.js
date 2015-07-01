var models = require('../models');
var User = models.User;
var utility = require('utility');
var uuid = require('node-uuid');
var Q = require('q');
var logger = require('../common/loggerUtil').getLogger('proxy/user');
/**
 * 根据用户名列表查找用户列表
 * Callback:
 * - err, 数据库异常
 * - users, 用户列表
 * @param {Array} names 用户名列表
 * @param {Function} callback 回调函数
 */
exports.getUsersByNames = function(names, callback) {
    if (names.length === 0) {
        return callback(null, []);
    }
    User.find({
        loginname: {
            $in: names
        }
    }, callback);
};

/**
 * 根据登录名查找用户
 * Callback:
 * - err, 数据库异常
 * - user, 用户
 * @param {String} loginName 登录名
 * @param {Function} callback 回调函数
 */
exports.getUserByLoginName = function(loginName, callback) {
    User.findOne({
        'loginname': loginName
    }, callback);
};

/**
 * 根据用户ID，查找用户
 * Callback:
 * - err, 数据库异常
 * - user, 用户
 * @param {String} id 用户ID
 * @param {Function} callback 回调函数
 */
exports.getUserById = function(id, callback) {
    User.findOne({
        _id: id
    }, callback);
};

/**
 * 根据邮箱，查找用户
 * Callback:
 * - err, 数据库异常
 * - user, 用户
 * @param {String} email 邮箱地址
 * @param {Function} callback 回调函数
 */
exports.getUserByMail = function(email, callback) {
    User.findOne({
        email: email
    }, callback);
};

/**
 * 根据用户ID列表，获取一组用户
 * Callback:
 * - err, 数据库异常
 * - users, 用户列表
 * @param {Array} ids 用户ID列表
 * @param {Function} callback 回调函数
 */
exports.getUsersByIds = function(ids, callback) {
    User.find({
        '_id': {
            '$in': ids
        }
    }, callback);
};

/**
 * 根据关键字，获取一组用户
 * Callback:
 * - err, 数据库异常
 * - users, 用户列表
 * @param {String} query 关键字
 * @param {Object} opt 选项
 * @param {Function} callback 回调函数
 */
exports.getUsersByQuery = function(query, opt, callback) {
    User.find(query, '', opt, callback);
};

/**
 * 根据查询条件，获取一个用户
 * Callback:
 * - err, 数据库异常
 * - user, 用户
 * @param {String} name 用户名
 * @param {String} key 激活码
 * @param {Function} callback 回调函数
 */
exports.getUserByNameAndKey = function(loginname, key, callback) {
    User.findOne({
        loginname: loginname,
        retrieve_key: key
    }, callback);
};

exports.newAndSave = function(name, loginname, pass, email, avatar_url, active, callback) {
    var user = new User();
    user.name = loginname;
    user.loginname = loginname;
    user.pass = pass;
    user.email = email;
    user.avatar = avatar_url;
    user.active = active || false;
    user.accessToken = uuid.v4();
    user.save(callback);
};

var makeGravatar = function(email) {
    return 'http://www.gravatar.com/avatar/' + utility.md5(email.toLowerCase()) + '?size=48';
};
exports.makeGravatar = makeGravatar;

exports.getGravatar = function(user) {
    return user.avatar || makeGravatar(user);
};

/**
 * Find user by unionid, if not exist, create a new record.
 * @param  {[type]} profile {
  {
    "openid": "ogWfMt5hcNzyPu2BRHjGj4CZmGqo",
    "nickname": "王海良",
    "sex": 1,
    "language": "en",
    "city": "Haidian",
    "province": "Beijing",
    "country": "China",
    "headimgurl": "http://wx.qlogo.cn/mmopen/Q3auHgzwzM4K3X0qF1xm0lH7MWFobvcge14aBibJbeV78z9TwWjicb5gOwVbQ7QO0CiaIBGv1DrJibDL0tacJM6VZw/0",
    "privilege": [],
    "unionid": "o0DaijgmdOUuAIRQ1QNZzuTizOT8"
  }
 * @return {user}         new user model record.
 */
exports.newOrUpdate = function(profile) {
    var deferred = Q.defer();
    User.findOne({
        loginname: profile.unionid,
    }, function(err, doc) {
        if (doc) {
            // user exists, just update profile
            doc.name = profile.nickname;
            doc.avatar = profile.headimgurl;
            doc.profile = profile;
            doc.markModified('profile');
            doc.save(function(err) {
                if (err) {
                    deferred.reject({
                        rc: 1,
                        msg: 'can not save exist user.',
                        error: err
                    });
                } else {
                    deferred.resolve(doc);
                }
            });
        } else {
            // create new user
            var user = new User();
            user.name = profile.nickname;
            user.loginname = profile.unionid;
            // just a placeholder for email and pass
            user.pass = uuid.v4();
            user.email = profile.unionid + "@foo.cn";
            user.avatar = profile.headimgurl;
            user.active = true;
            user.accessToken = uuid.v4();
            user.passport = 'wechat';
            user.profile = profile;
            user.subscribe_type = profile.subscribe_type;
            user.subscribe_source_identifier = profile.subscribe_source_identifier;
            user.save(function(err, doc) {
                if (err) {
                    deferred.reject({
                        rc: 2,
                        msg: 'can not save new user.',
                        error: err
                    });
                } else {
                    deferred.resolve(doc);
                }
            });
        }
    });
    return deferred.promise;
}

exports.updateUserPhoneNumber = function(userId, phoneNumber) {
    var deferred = Q.defer();
    // Model.findOneAndUpdate([conditions], [update], [options], [callback])
    logger.debug('updateUserPhoneNumber', userId + " " + phoneNumber);
    User.findOneAndUpdate({
        _id: userId
    }, {
        phone_number: phoneNumber
    }, function(err, doc) {
        logger.debug('updateUserPhoneNumber', JSON.stringify(doc));
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(doc);
        }
    });

    return deferred.promise;
}
