/**
 * Hash State to store wechat state value
 * 1. wechat passport support state parameters but it 
 * has many restrictions.
 * http://mp.weixin.qq.com/wiki/17/c0f37d5704f0b64713d5d2c37b468d75.html
 * 2. state value can be used for navigate url after auth successfully.
 * 3. should enable these key-value pairs cross nodes.
 *
 * State is md5 string
 * Callback Url is page bring user to when auth successfully.
 */

var HashState = require('../models').HashState;
var crypto = require('crypto');
var logger = require('../common/loggerUtil').getLogger('proxy/hashState');
var Q = require('q');

exports.getHashStateByValue = function(val) {
    var deferred = Q.defer();

    HashState.findOne({
        value: val
    }, function(err, doc) {
        if (err) {
            deferred.reject(err);
        } else if (doc) {
            deferred.resolve(doc);
        } else {
            var newDoc = new HashState();
            newDoc.md5 = crypto.createHash('md5').update(val).digest('hex');
            newDoc.value = val;
            newDoc.save(function(err, result) {
                if (err)
                    return deferred.reject(err);
                deferred.resolve(result);
            })
        }
    });

    return deferred.promise;
}

exports.getHashStateByMD5 = function(md5) {
    var deferred = Q.defer();

    HashState.findOne({
        md5: md5
    }, function(err, doc) {
        if (err) {
            deferred.reject(err);
        } else if (doc) {
            deferred.resolve(doc);
        } else {
            deferred.reject();
        }
    });

    return deferred.promise;
}
