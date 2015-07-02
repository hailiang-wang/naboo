/*
 * Wechat I/O Backend
 */
var wechat = require('wechat');
var EventProxy = require('eventproxy');
var config = require('../config');
var common = require('../common');
var logger = common.loggerUtil.getLogger("connect-wechat");
var superagent = require('superagent');
var u = require('util');
var Q = require('q');
var wxSign = require("weixin-signature").sign;
var redisq = require('../persistence/redisq');
var wxCfg = config.wechat_gzh;
var fileStorage = require('../api/v1/fileStorage');
var UserProxy = require('../proxy').User;
var ReplyProxy = require('../proxy').Reply;
var TopicProxy = require('../proxy').Topic;
var minimatch = require('minimatch');
var S = require('string');

/**
 * download wechat server image with server id
 * @param  {[type]} serverId [description]
 * @return {[type]}          [description]
 */
function _downloadWechatServerImage(userId, serverId) {
    var deferred = Q.defer();

    _getWxAccessTokenFromRedis()
        .then(function(accessToken) {
            var imageUrl = u.format('http://file.api.weixin.qq.com/cgi-bin/media/get?access_token=%s&media_id=%s', accessToken, serverId);
            logger.debug('_downloadWechatServerImage', 'wechat image url:' + imageUrl);

            fileStorage.processWebUrlImageWithUserId(userId, imageUrl, 'jpg')
                .then(function(result) {
                    deferred.resolve({
                        serverId: serverId,
                        imageUrl: '/api/v1/file/image-anonymous/' + result._id
                    });
                });
        });

    return deferred.promise;
}

/**
 * create user account by restrieving user profile data 
 * by msg
 * @param  {[type]} msg [description]
 * @return {[type]}        [description]
 */
function _createUserAccountByOpenId(msg) {
    var openId = msg.FromUserName;
    logger.debug('_saveUserProfileDataByOpenId', 'start to save OpenID: ' + openId);
    var defer = Q.defer();
    _getWxAccessTokenFromRedis()
        .then(function(accessToken) {
            var url = u.format('https://api.weixin.qq.com/cgi-bin/user/info?access_token=%s&&openid=%s',
                accessToken, openId);
            logger.debug('_saveUserProfileDataByOpenId', url);
            superagent.get(url)
                .set('Accept', 'application/json')
                .end(function(err, resp) {
                    if (err) {
                        logger.error('_saveUserProfileDataByOpenId', err);
                        throw new Error('Can not get profile data.');
                    } else {
                        logger.debug(JSON.stringify(resp));
                        // create user account by user proxy
                        logger.debug('_createUserAccountByOpenId', JSON.stringify(resp.body));
                        var userProfile = resp.body;
                        if (minimatch(msg.EventKey, 'qrscene*')) {
                            userProfile.subscribe_type = 'scan_qr';
                            userProfile.subscribe_source_identifier = msg.Ticket;
                        }
                        UserProxy.newOrUpdate(userProfile);
                    }
                });
        })
        .fail(function(err) {
            logger.error(err);
        })
        .done();

    return defer.promise;
}

function onSubscribe(msg, res) {
    // get user profile data with RESt API
    _createUserAccountByOpenId(msg);
    res.reply([{
        title: '欢迎关注北京NodeJS爱好者聚乐部',
        description: '认识朋友，取得活动信息。',
        picurl: 'http://g.hiphotos.baidu.com/baike/c0%3Dbaike150%2C5%2C5%2C150%2C50/sign=278308933bdbb6fd3156ed74684dc07d/42a98226cffc1e17fcdb30594890f603738de976.jpg',
        url: 'https://cnodejs.org/topic/5593b13b6ba28efa30a603cd#5593cd5a6ba28efa30a6041e'
    }]);
}

function onUnsubscribe(msg, res) {
    res.send(200);
}

function onClick(msg, res) {
    // process menu event
    switch (msg.EventKey) {
        case 'click/xx':
            res.reply([{
                title: 'xxxx',
                description: 'xxxx',
                picurl: 'some url for a png',
                url: 'some url for your article'
            }]);
            break;
        default:
            logger.warn('onClick', msg);
            res.send(200);
            break;
    }
}

function onDefault(msg, res) {
    // body...
    logger.warn('onDefault', msg);

    // http://mp.weixin.qq.com/wiki/10/79502792eef98d6e0c6e1739da387346.html
    if (msg.MsgType == 'text') {
        res.reply({
            content: '您有任何问题请留言，我们将会尽快回复，感谢您的支持。',
            type: 'text'
        });
    }

    // 
    // 地理位置消息
    // <xml>
    // <ToUserName><![CDATA[toUser]]></ToUserName>
    // <FromUserName><![CDATA[fromUser]]></FromUserName>
    // <CreateTime>1351776360</CreateTime>
    // <MsgType><![CDATA[location]]></MsgType>
    // <Location_X>23.134521</Location_X>
    // <Location_Y>113.358803</Location_Y>
    // <Scale>20</Scale>
    // <Label><![CDATA[位置信息]]></Label>
    // <MsgId>1234567890123456</MsgId>
    // </xml> 
}

exports.setup = function(app, path) {
    app.use(path, wechat(wxCfg.developer_token, function(req, res, next) {
        // message is located in req.weixin
        var message = req.weixin;
        // _postWXEvent(message);
        // TODO
        // post the data into database
        // superagent.post()

        switch (message.Event) {
            case 'CLICK':
                onClick(message, res);
                break;
            case 'subscribe':
                onSubscribe(message, res);
                break;
            case 'unsubscribe':
                onUnsubscribe(message, res);
                break;
            default:
                // other events, check out
                // http://mp.weixin.qq.com/wiki/2/5baf56ce4947d35003b86a9805634b1e.html
                onDefault(message, res);
                break;
        }
    }));
}

function _getWxAccessToken() {
    var defer = Q.defer();
    superagent.get(u.format('https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=%s&secret=%s',
            wxCfg.appId, wxCfg.appSecret))
        .end(function(err, res) {
            if (err) {
                defer.reject(err);
            } else if (res.statusCode !== 200) {
                defer.reject(res);
            } else {
                // res format
                // { access_token: 'xxx',
                // expires_in: 7200 }
                defer.resolve(res.body);
            }
        });
    return defer.promise;
}

function _getWxJsapiTicketByAccessToken(accessToken) {
    var defer = Q.defer();
    superagent.get(u.format('https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=%s&type=jsapi', accessToken))
        .end(function(err, res) {
            if (err) {
                defer.reject(err);
            } else if (res.statusCode !== 200) {
                /**
                 * res format
                 * {"errcode":0,"errmsg":"ok",
                 * "ticket":"xxxx","expires_in":7200}
                 */
                defer.reject(res);
            } else {
                defer.resolve(res.body);
            }
        })
    return defer.promise;
}

function _getSignatureByJspApiTicketAndUrl(jsapi_ticket, url) {
    return wxSign({
        noncestr: noncestr = 'xxxxxxxxyyyyy'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0,
                v = c == 'x' ? r : r & 0x3 | 0x8;
            return v.toString(16);
        }),
        timestamp: Math.floor(Date.now() / 1000).toString(),
        jsapi_ticket: jsapi_ticket,
        url: url
    });
}

function _getWxAccessTokenFromRedis() {
    var defer = Q.defer();
    redisq.getWxAccessToken()
        .then(function(data) {
            logger.debug('getWxAccessTokenFromRedis', 'access_token is retrieved from redis.');
            if (logger.isLevelEnabled('DEBUG')) {
                redisq.getWxAccessTokenTTL()
                    .then(function(ttl) {
                        logger.debug(u.format('accessToken time to live %d seconds.', ttl));
                    }, function(err) {
                        logger.warn(err);
                    })
            }
            return data;
        }, function(err) {
            return _getWxAccessToken();
        })
        .then(function(v) {
            if (typeof v == 'object' && v.access_token && v.expires_in) {
                // retrieved from WX and save into redis
                return redisq.setWxAccessToken(v);
            } else {
                defer.resolve(v);
                return;
            }
        }, function(err) {
            // _getWxAccessToken throws an err
            defer.reject(err);
            return;
        }).then(function(result) {
            /**
             * redisq setWxAccessToken get fullfiled.
             * @param  {string} result accessToken value
             * @return {string} result accessToken value
             */
            if (result) {
                logger.debug('getWxAccessTokenFromRedis', 'accessToken is updated.');
                defer.resolve(result);
            }
        })
        .fail(function(e) {
            /**
             * redisq.setWxAccessToken throw err
             * print to logging.
             * @param  {[type]}
             * @return {[type]}
             */
            if (!(defer.isFulfilled() || defer.isRejected())) {
                logger.error(e);
                defer.reject(e);
            }
        });

    return defer.promise;
}


function _getWxJsapiTicketFromRedis() {
    var defer = Q.defer();
    redisq.getWxJsapiTicket()
        .then(function(jsApiTicket) {
            logger.debug('getWxJsapiTicketFromRedis', u.format('%s is retrieved from redis.', jsApiTicket));
            if (logger.isLevelEnabled('DEBUG')) {
                redisq.getWxJsapiTicketTTL()
                    .then(function(ttl) {
                        logger.debug(u.format('jspApiTicket time to live %d seconds.', ttl));
                    }, function(err) {
                        logger.error('getWxJsapiTicketFromRedis', err);
                    })
            }
            defer.resolve(jsApiTicket);
            return;
        }, function(err) {
            // no jsApiTicket in redis ?
            return _getWxAccessTokenFromRedis();
        })
        .then(function(accessToken) {
            if (accessToken)
                return _getWxJsapiTicketByAccessToken(accessToken);
            return;
        }, function(err2) {
            // _getWxAccessTokenFromRedis throw an error
            logger.error('getWxJsapiTicketFromRedis', err2);
            defer.reject('_getWxAccessTokenFromRedis fail to resolve accessToken.');
            return;
        })
        .then(function(result) {
            if (result) {
                // get new jsApiTicket
                // TODO save into redis
                // defer.resolve(result.ticket);
                return redisq.setWxJsapiTicket(result);
            }
        }, function(err3) {
            // _getWxJsapiTicketByAccessToken throw an error
            logger.error(err3);
            defer.reject(err3);
            return;
        })
        .then(function(val) {
            /**
             * redisq.setWxJsapiTicket(result) fullfiled
             * @param  {string}
             * @return {}
             */
            if (val) {
                defer.resolve(val);
            }
        }, function(err4) {
            // setWxJsapiTicket throw an error
            logger.error(err4);
            defer.reject(err4);
        })
        .done();

    return defer.promise;
}

/**
 * Get a access token for debugging wechat API
 * @param  {[type]} doc){                 console.log('wechat access token: ' + doc);} [description]
 * @return {[type]}        [description]
 */
// comment out for production usage, becuase the accesstoken should always cached.
_getWxAccessTokenFromRedis().then(function(doc) {
    console.log('wechat access token: ' + doc);
});

/**
 * provide method to send notification with message templates
 * @param  {[type]} fromUserId [description]
 * @param  {[type]} toUserId   [description]
 * @param  {[type]} replyId    [description]
 * @param  {[type]} link       [description]
 * @param  {[type]} title      [description]
 * @param  {[type]} date       [description]
 * @return {[type]}            [description]
 */
function _pushReplyWithWechatTemplateAPI(toUserId, fromUserId, topicId, replyId) {
    var proxy = new EventProxy();
    var deferred = Q.defer();

    proxy.all('fromUser', 'toUser', 'topic', 'reply', function(fromUser, toUser, topic, reply) {

        if (toUser.is_wechat_notify) {
            // Post Data
            _getWxAccessTokenFromRedis().then(function(doc) {
                logger.debug('_pushReplyWithWechatTemplateAPI', 'get access token ' + doc);
                var keyword3 = S(reply.content).replaceAll(u.format('@%s', toUser.loginname), u.format('对 @%s 说：', toUser.name)).s;
                keyword3 = keyword3.replace(/^@[a-z0-9\-_]+\b/igm, '');
                var payload = {
                    touser: toUser.profile.openid,
                    template_id: config.wechat_gzh.api.notify_template_id,
                    url: u.format("http://%s/#/item/%s", config.client_host, topicId),
                    topcolor: "#FF0000",
                    data: {
                        first: {
                            value: topic.title,
                            color: "#173177"
                        },
                        keyword1: {
                            value: fromUser.name,
                            color: "#173177"
                        },
                        keyword2: {
                            value: reply.create_at.toFormat('YYYY-MM-DD HH:MI PP'),
                            color: "#173177"
                        },
                        keyword3: {
                            // replace push content via wechat
                            // value: S(reply.content).replaceAll(u.format('[@%s](/user/%s)', toUser.loginname, toUser.loginname), u.format('对 @%s 说：', toUser.name)).s,
                            value: keyword3,
                            color: "#173177"
                        }
                        // ,
                        // remark: {
                        //     value: "尾部文字！",
                        //     color: "#173177"
                        // }
                    }
                };
                logger.debug('_pushReplyWithWechatTemplateAPI', "send body " + JSON.stringify(payload));
                superagent.post(u.format('https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=%s', doc))
                    .send(payload)
                    .set('Content-Type', 'application/json')
                    .set('Accept', 'application/json')
                    .end(function(err, res) {
                        if (res.ok) {
                            logger.debug('_pushReplyWithWechatTemplateAPI', 'send wechat message by api template successfully.');
                            deferred.resolve(res.body);
                        } else {
                            logger.warn('_pushReplyWithWechatTemplateAPI', err);
                            deferred.reject(err);
                        }
                    });
            });
        } else {
            logger.debug('_pushReplyWithWechatTemplateAPI', u.format('%s disable is_wechat_notify.', toUser.name));
            deferred.resolve();
        }
    });

    proxy.fail(function(err) {
        logger.warn('_pushReplyWithWechatTemplateAPI', err);
        deferred.reject(err);
    });

    UserProxy.getUserById(fromUserId, proxy.done(function(user) {
        proxy.emit('fromUser', user);
    }));

    UserProxy.getUserById(toUserId, proxy.done(function(user) {
        proxy.emit('toUser', user);
    }));

    TopicProxy.getTopicById(topicId, proxy.done(function(topic) {
        proxy.emit('topic', topic);
    }));

    ReplyProxy.getReplyById(replyId, proxy.done(function(reply) {
        proxy.emit('reply', reply);
    }));

    return deferred.promise;
}

exports.getWxAccessTokenFromRedis = _getWxAccessTokenFromRedis;
exports.getWxJsapiTicketFromRedis = _getWxJsapiTicketFromRedis;
exports.getSignatureByJspApiTicketAndUrl = _getSignatureByJspApiTicketAndUrl;
exports.downloadWechatServerImage = _downloadWechatServerImage;
exports.pushReplyWithWechatTemplateAPI = _pushReplyWithWechatTemplateAPI;
