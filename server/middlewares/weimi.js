/**
 * Weimi SMS Service
 */

var Q = require('q');
var request = require('superagent');
var querystring = require('querystring');
var logger = require('../common/loggerUtil').getLogger('weimi');
var config = require('../config');
var weimiCfg = config.weimi_api;
var redisq = require('../persistence/redisq');

/**
 * Create Verify Code with expiration and phone number
 */
function _createVerifyCodeWithExpirationAndPhoneNumberInRedis(userId, phoneNumber) {
    var deferred = Q.defer();
    
    // 四位数字验证码
    var code = Math.floor(Math.random() * (9999 - 1000) + 1000);

    // expiration in five minutes.
    var expiration = 300;

    redisq.createVerifyCodeWithExpirationAndPhoneNumber(userId, phoneNumber, code, expiration)
        .then(function(reply) {
            deferred.resolve({
                userId: userId,
                phoneNumber: phoneNumber,
                code: code
            });
        })
        .fail(function(err) {
            deferred.reject(err);
        });

    return deferred.promise;
}



/**
 * send verify code for register account
 * @param  {array} mobiles recipients list
 * @return {promise}         [description]
 */
function _sendVerifyCodeByPhoneNumberAndCode(mobilePhoneNumber, verifyCode) {
    var deferred = Q.defer();

    var postData = {
        uid: weimiCfg.uid,
        pas: weimiCfg.pas,
        cid: weimiCfg.cid,
        p1: verifyCode,
        mob: mobilePhoneNumber,
        // use cid instead.
        // con: '【微米】您的验证码是：610912，3分钟内有效。如非您本人操作，可忽略本消息。',
        type: 'json'
    };

    var content = querystring.stringify(postData);

    /**
     * 短信下发接口二详情
     * http://www.weimi.cc/dev-sms.html
     * @param  {[type]} err  [description]
     * @param  {[type]} res) {                       if (err) {                deferred.reject(err);            } else {                console.log(res);                deferred.resolve();            }        } [description]
     * @return {[type]}      [description]
     */
    request.post('http://api.weimi.cc/2/sms/send.html')
        .send(content)
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .set('Content-Length', content.length)
        .end(function(err, res) {
            if (err) {
                logger.error('_sendVerifyCodeForRegisterAccount', err);
                deferred.reject(err);
            } else {
                logger.debug('_sendVerifyCodeForRegisterAccount', res.status);
                deferred.resolve();
            }
        });

    return deferred.promise;
}

exports.sendVerifyCodeToRegisterAccount = function(userId, mobilePhoneNumber) {
    var deferred = Q.defer();
    _createVerifyCodeWithExpirationAndPhoneNumberInRedis(userId, mobilePhoneNumber)
        .then(function(result) {
            return _sendVerifyCodeByPhoneNumberAndCode(result.phoneNumber, result.code);
        })
        .then(function(result2) {
            deferred.resolve();
        })
        .fail(function(err) {
            deferred.reject(err);
        });

    return deferred.promise;
}
