/*
 * Redis Qs and other Service
 */

var Q = require('q'),
    common = require('../common'),
    logger = common.loggerUtil.getLogger('redisq'),
    u = require('util'),
    redisClient = require('./redis');


var WX_ACCESS_TOKEN_KEY = 'NABOO_WX_ACCESS_TOKEN';
var WX_JSPAPI_TICKET_KEY = 'NABOO_WX_JSPAPI_TICKET';

exports.getWxAccessToken = function() {
    var defer = Q.defer();
    redisClient.get(WX_ACCESS_TOKEN_KEY, function(err, reply) {
        if (err) {
            defer.reject(err);
        } else if (reply) {
            defer.resolve(reply);
        } else {
            // reply is null, undefined
            defer.reject();
        }
    })
    return defer.promise;
}

exports.setWxAccessToken = function(v) {
    var defer = Q.defer();
    if (v.access_token && v.expires_in) {
        var duration = v.expires_in - 200;
        logger.debug('setWxAccessToken', u.format('%s expires in %d seconds.', v.access_token, duration));
        redisClient.set(WX_ACCESS_TOKEN_KEY, v.access_token, function(err, reply) {
            if (err) {
                defer.reject(err);
            } else {
                redisClient.expire(WX_ACCESS_TOKEN_KEY, duration, function(err2, reply2) {
                    if (err2) {
                        defer.reject(err2);
                    } else {
                        defer.resolve(v.access_token);
                    }
                });
            }
        });
    } else {
        defer.reject(new Error('Unexpected data format.'));
    }
    return defer.promise;
}

exports.getWxAccessTokenTTL = function() {
    var defer = Q.defer();
    redisClient.ttl(WX_ACCESS_TOKEN_KEY, function(err, ttl) {
        if (err) {
            defer.reject(err);
        } else if (ttl == -1) {
            defer.reject(new Error(u.format("%s does not exist.", WX_ACCESS_TOKEN_KEY)));
        } else {
            defer.resolve(ttl);
        }
    });

    return defer.promise;
}

exports.getWxJsapiTicket = function() {
    var defer = Q.defer();
    redisClient.get(WX_JSPAPI_TICKET_KEY, function(err, reply) {
        if (err) {
            defer.reject(err);
        } else if (reply) {
            defer.resolve(reply);
        } else {
            // reply is null, undefined
            defer.reject();
        }
    })
    return defer.promise;
}


exports.setWxJsapiTicket = function(v) {
    var defer = Q.defer();
    if (v.ticket && v.expires_in) {
        var duration = v.expires_in - 200;
        logger.debug('setWxJsapiTicket', u.format('%s expires in %d seconds.', v.ticket, duration));
        redisClient.set(WX_JSPAPI_TICKET_KEY, v.ticket, function(err, reply) {
            if (err) {
                defer.reject(err);
            } else {
                redisClient.expire(WX_JSPAPI_TICKET_KEY, duration, function(err2, reply2) {
                    if (err2) {
                        defer.reject(err2);
                    } else {
                        defer.resolve(v.ticket);
                    }
                });
            }
        });
    } else {
        defer.reject(new Error('Unexpected data format.'));
    }
    return defer.promise;
}

exports.getWxJsapiTicketTTL = function() {
    var defer = Q.defer();
    redisClient.ttl(WX_JSPAPI_TICKET_KEY, function(err, ttl) {
        if (err) {
            defer.reject(err);
        } else if (ttl == -1) {
            defer.reject(new Error(u.format("%s does not exist.", WX_JSPAPI_TICKET_KEY)));
        } else {
            defer.resolve(ttl);
        }
    });

    return defer.promise;
}

/**
 * create verify code by userId, phone number, code, exp
 * @param  {[type]} userId      [_id for this user]
 * @param  {[type]} phoneNumber [description]
 * @param  {[type]} code        [description]
 * @param  {[type]} expiration  [description]
 * @return {[type]}             [description]
 */
exports.createVerifyCodeWithExpirationAndPhoneNumber = function(userId, phoneNumber, code, expiration) {
    var deferred = Q.defer();
    var key = u.format('verify-phone-number:%s', phoneNumber);
    console.log('key', key);
    redisClient.hmset(key, {
        phone: phoneNumber,
        code: code,
        userId: userId,
        attempt: 0,
        // predefined max attempts
        maxAttempt: 3
    }, function(err, reply) {
        if (!err) {
            redisClient.expire(key, expiration, function(err2, reply2) {
                if (!err) {
                    deferred.resolve();
                } else {
                    deferred.reject(err);
                }
            });
        } else {
            deferred.reject(err);
        }
    });

    return deferred.promise;
}

exports.checkPhoneVerifyCode = function(userId, phone, code) {
    var deferred = Q.defer();
    var key = u.format('verify-phone-number:%s', phone);
    logger.debug('key ' + key);
    redisClient.hgetall(key, function(err, obj) {
        logger.debug(obj);
        if (err) {
            logger.error('checkPhoneVerifyCode', 'internal error');
            deferred.reject({
                error: err,
                rc: 0,
                msg: 'internal error'
            });
        } else if (obj && obj.code === code && obj.attempt < obj.maxAttempt) {
            redisClient.del(key, function(err2, replies) {
                if (!err2) {
                    logger.debug('checkPhoneVerifyCode', 'the code is valid.');
                    deferred.resolve({
                        rc: 1,
                        msg: obj
                    });
                } else {
                    logger.error('checkPhoneVerifyCode', 'fail to delete key.');
                    deferred.reject({
                        rc: 5,
                        msg: err2
                    });
                }
            })
        } else if (obj && obj.attempt < obj.maxAttempt) {
            logger.warn('checkPhoneVerifyCode', 'wrong code');
            redisClient.hincrby(key, 'attempt', 1, function(err, replies) {
                deferred.reject({
                    rc: 2,
                    msg: 'wrong code'
                });
            });
        } else if (obj && obj.attempt >= obj.maxAttempt) {
            deferred.reject({
                rc: 3,
                msg: 'try too many times, the signup is discarded.'
            });
        } else {
            // the key is deleted from hash
            deferred.reject({
                rc: 4,
                msg: 'invalid signup request.'
            });
        }
    });
    return deferred.promise;

}
