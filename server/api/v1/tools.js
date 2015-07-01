require('date-util');
var eventproxy = require('eventproxy');
var logger = require('../../common/loggerUtil').getLogger('/api/v1/tools');
var HashState = require('../../proxy').HashState;
var wechat_permanent_qrcodes = require('../../wechat_permanent_qrcodes.json');
var _ = require('lodash');
var S = require('string');
var Q = require('q');
var util = require('util');
var models = require('../../models');
var User = models.User;

var accesstoken = function(req, res, next) {
    var ep = new eventproxy();
    ep.fail(next);

    res.send({
        success: true,
        loginname: req.user.loginname,
        avatar_url: req.user.avatar_url,
        id: req.user.id,
        profile: req.user
    });
};

exports.getAccessToken = function(req, res, next) {
    if (req.session.user) {
        res.send({
            rc: 0,
            loginname: req.session.user.loginname,
            avatar_url: req.session.user.avatar_url,
            id: req.session.user.id,
            accesstoken: req.session.user.accessToken
        });
    } else {
        res.send({
            rc: 1,
            msg: 'session does not exist, maybe cookie is expired.'
        });
    }
}

/**
 * get state value by md5
 * @param  {[type]}   req  [description]
 * @param  {[type]}   res  [description]
 * @param  {Function} next [description]
 * @return {[type]}        [description]
 */
exports.getHashStateByMd5 = function(req, res, next) {
    if (req.body && req.body.md5 && req.body.md5 !== '') {
        HashState.getHashStateByMD5(req.body.md5)
            .then(function(doc) {
                if (doc && doc.value) {
                    res.send({
                        rc: 0,
                        msg: doc.value
                    });

                } else {
                    res.send({
                        rc: 1,
                        msg: 'state does not exist.'
                    });
                }
            }, function(err) {
                res.send({
                    rc: 2,
                    msg: err
                });
            });
    } else {
        res.send({
            rc: 3,
            msg: 'required parameter in body.'
        });
    }
}

/**
 * Get Date window
 * @return {[type]} [description]
 */
function _getDateWindow() {
    var between = [];
    var date = new Date();
    date.setHours(0, 0, 0, 0);
    // var date1 = date.strtotime("+2 day");
    for (var i = 31; i > 1; i--) {
        between.unshift(date.strtotime(util.format('%d day', i - 30)));
    }

    console.log('between ' + JSON.stringify(between));
    return between;
}


function _computeSubscriptionStatisticsByDate(source_qr_codes, index, time_window, result, deferred) {

    if (index == 0) {
        console.log('resolve ..');
        return deferred.resolve(result);
    }

    if (index == null) {
        index = time_window.length - 1;
    }

    var date = time_window[index];
    var pre_date = time_window[index - 1];
    // there is no date for parsing.
    User.count({
        "subscribe_type": "scan_qr",
        "subscribe_source_identifier": {
            "$in": source_qr_codes
        },
        "create_at": {
            "$gte": pre_date,
            "$lt": date
        }
    }, function(err, num) {
        if (err) {
            deferred.reject(err);
        } else {
            // logger.debug('_computeSubscriptionStatisticsByDate', util.format('%s ~ %s : %d', date, pre_date, num));
            result.data[pre_date] = num;
            _computeSubscriptionStatisticsByDate(source_qr_codes, index - 1, time_window, result, deferred);
        }
    });
}


/**
 * [_computeSubscriptionStatistics description]
 * @return {[type]} [description]
 */
function _computeSubscriptionStatistics(res, source) {
    var result = {
        total: null,
        data: {}
    };
    // time period
    var time_window = _getDateWindow();

    // marketing channels
    var source_qr_codes = [];
    var qrcodekeys = _.keys(wechat_permanent_qrcodes);
    _.each(wechat_permanent_qrcodes, function(n, key) {
        if (S(n.channel_key).startsWith(source))
            source_qr_codes.push(key);
    });

    return Q.fcall(function() {
            var d = Q.defer();
            User.count({
                "subscribe_type": "scan_qr",
                "subscribe_source_identifier": {
                    "$in": source_qr_codes
                }
            }, function(err, count) {
                if (err) {
                    d.reject(err);
                } else {
                    d.resolve(count);
                }
            });
            return d.promise;
        })
        .then(function(count) {
            result.total = count;
            var d = Q.defer();
            var time_window_length = time_window.length;

            _computeSubscriptionStatisticsByDate(source_qr_codes, null, time_window, result, d);

            return d.promise;
        })
        .then(function(result) {
            var data = {
                labels: time_window.splice(1, 29),
                datasets: [{
                    label: source,
                    fillColor: "rgba(220,220,220,0.2)",
                    strokeColor: "rgba(220,220,220,1)",
                    pointColor: "rgba(220,220,220,1)",
                    pointStrokeColor: "#fff",
                    pointHighlightFill: "#fff",
                    pointHighlightStroke: "rgba(220,220,220,1)",
                    data: _.values(result.data).reverse()
                }],
                total: result.total
            };

            res.send({
                rc: 4,
                msg: data
            });
        })
        .fail(function(err) {
            res.send({
                rc: 3,
                msg: err
            });
        });
}

/**
 * [getSubscriptionStatistics description]
 * @param  {[type]}   req  [description]
 * @param  {[type]}   res  [description]
 * @param  {Function} next [description]
 * @return {[type]}        [description]
 */
exports.getSubscriptionStatistics = function(req, res, next) {
    if (req.body.source) {
        switch (req.body.source) {
            case '燕大':
                _computeSubscriptionStatistics(res, '燕大');
                break;
            case '贸大':
                _computeSubscriptionStatistics(res, '贸大');
                break;
            default:
                res.send({
                    rc: 2,
                    msg: 'not a valid source.'
                });
                break;
        }

    } else {
        res.send({
            rc: 1,
            msg: 'no source defined.'
        });
    }
}

exports.accesstoken = accesstoken;
