var models = require('../../models');
var TopicModel = models.Topic;
var TopicProxy = require('../../proxy').Topic;
var TopicCollect = require('../../proxy').TopicCollect;
var TopicComplain = require('../../proxy').TopicComplain;
var UserProxy = require('../../proxy').User;
var UserModel = models.User;
var config = require('../../config');
var eventproxy = require('eventproxy');
var _ = require('lodash');
var at = require('../../common/at');
var renderHelper = require('../../common/render_helper');
var validator = require('validator');
var logger = require('../../common/loggerUtil').getLogger('api/v1/topic');
var requestUtil = require('../../common').requestUtil;

var index = function(req, res, next) {
    var page = parseInt(req.query.page, 10) || 1;
    page = page > 0 ? page : 1;
    var tab = req.query.tab || 'all';
    var limit = Number(req.query.limit) || config.list_topic_count;
    var mdrender = req.query.mdrender === 'false' ? false : true;

    var query = {};
    if (tab && tab !== 'all') {
        if (tab === 'good') {
            query.good = true;
        } else {
            query.tab = tab;
        }
    }

    if (req.query.text) {
        var text = new RegExp(req.query.text);
        query.$or = [{
            title: text
        }, {
            content: text
        }];
    }
    if (req.query.lng && req.query.lat) {
        var lng = parseFloat(req.query.lng);
        var lat = parseFloat(req.query.lat);
        var dist = 3000; //parseFloat(req.query.dist || 3000)

        query.goods_exchange_geom = {
            $nearSphere: {
                $geometry: {
                    type: 'Point',
                    coordinates: [lng, lat]
                },
                $maxDistance: dist
            }
        }
    }
    //console.log('query',query);
    // if the topic is marked as deleted, do not return it.
    query.deleted = false;
    query.goods_status = '在售';
    query.lock = false;
    // set the response data with descending order of topic.udpate_at



    var options = {
        skip: (page - 1) * limit,
        limit: limit,
        sort: '-top -update_at -last_reply_at'
    };

    var ep = new eventproxy();
    ep.fail(next);

    TopicModel.find(query, '', options, ep.done('topics'));
    if (typeof(req.user) === 'object' && req.user._id) {
      TopicCollect.getUserCollectedTopicIds(req.user._id, function (userCollectedTopicIds) {
        console.log('76', userCollectedTopicIds);
        ep.emit('userCollectedTopicIds', userCollectedTopicIds);
      });
    } else {
      process.nextTick(function () {
        ep.emit('userCollectedTopicIds', []);
      });
    }

    ep.all('topics', 'userCollectedTopicIds', function(topics, userCollectedTopicIds) {
        topics.forEach(function(topic) {
          UserModel.findById(topic.author_id, ep.done(function(author) {
              if (mdrender) {
                  topic.content = renderHelper.markdown(at.linkUsers(topic.content));
              }
              topic.author = _.pick(author, ['loginname', 'avatar_url']);
              ep.emit('author');
          }));
        });

        ep.after('author', topics.length, function() {
            topics = topics.map(function(topic) {
              topic = _.pick(topic, ['id', 'author_id', 'tab', 'content', 'title', 'last_reply_at',
                  'collect_count', 'goods_now_price', 'goods_pre_price', 'goods_is_bargain', 'update_at', 'goods_pics', 'goods_quality_degree', 'goods_exchange_location', 'goods_exchange_geom',
                  'good', 'top', 'reply_count', 'visit_count', 'create_at', 'author', 'collect_count'
              ]);
              topic.isCollected = false;
              if (userCollectedTopicIds.length > 0 && userCollectedTopicIds.indeOf(topic.id) !== -1) {
                topic.isCollected = true;
              }

              // console.log('103', topic);
              return topic;
            });

            res.send({
                data: topics
            });
        });
    });
};

exports.index = index;

var show = function(req, res, next) {
    var topicId = req.params.id;
    var mdrender = req.query.mdrender === 'false' ? false : true;

    var ep = new eventproxy();
    ep.fail(next);

    TopicProxy.getFullTopic(topicId, ep.done(function(msg, topic, author, replies) {
        if (!topic) {
            return res.send({
                error_msg: 'topic_id `' + topicId + '` is not exists.'
            });
        }

        var isAuthor = typeof(req.user) == 'object' && req.user._id && req.user._id == topic.author_id;

        if (!isAuthor) {
            topic.visit_count += 1;
        }
        topic.save();

        topic = _.pick(topic, ['_id', 'id', 'author_id', 'tab', 'content', 'title', 'last_reply_at',
            'goods_pre_price', 'goods_now_price', 'goods_pre_price', 'goods_is_bargain', 'update_at', 'goods_pics', 'goods_quality_degree',
            'goods_exchange_location', 'goods_exchange_geom',
            'good', 'top', 'reply_count', 'visit_count', 'collect_count', 'create_at', 'author'
        ]);

        if (mdrender) {
            topic.content = renderHelper.markdown(at.linkUsers(topic.content));
        }
        topic.author = _.pick(author, ['name', 'avatar', 'loginname', 'phone_number']);

        topic.replies = replies.map(function(reply) {
            reply.content = reply.content.replace(/^@[a-z0-9\-_]+\b/igm, '');
            if (mdrender) {
                reply.content = renderHelper.markdown(at.linkUsers(reply.content));
            }
            reply.author = _.pick(reply.author, ['accessToken', 'name', 'avatar', 'loginname', 'phone_number']);
            reply = _.pick(reply, ['id', 'author', 'price', 'reply_to', 'content', 'ups', 'create_at']);
            return reply;
        });

        // 查询当前topic是否被当前用户收藏
        if (typeof(req.user) == 'object' && req.user._id) {
            TopicCollect.getTopicCollect(req.user._id, topic._id, function(doc) {
                topic.in_collection = !!doc;
                res.send({
                    data: topic
                });
            });
        } else {
            res.send({
                data: topic
            });
        }

    }));
};

exports.show = show;

/**
 * Create Topic
 * @param  {[type]}   req  [description]
 * @param  {[type]}   res  [description]
 * @param  {Function} next [description]
 * @return {[type]}        [description]
 */
var create = function(req, res, next) {
    var title = validator.trim(req.body.title);
    title = validator.escape(title);
    var tab = validator.trim(req.body.tab);
    tab = validator.escape(tab);
    var content = validator.trim(req.body.content);

    // start to resolve goods parameters
    var goods_pics = req.body.goods_pics;
    var goods_pre_price = req.body.goods_pre_price;
    var goods_now_price = req.body.goods_now_price;
    var goods_is_bargain = req.body.goods_is_bargain;
    var goods_quality_degree = req.body.goods_quality_degree;
    var goods_exchange_location = req.body.goods_exchange_location;
    var goods_status = req.body.goods_status;
    // end resolve goods parameters


    // 得到所有的 tab, e.g. ['ask', 'share', ..]
    var allTabs = config.tabs.map(function(tPair) {
        return tPair[0];
    });

    // 验证
    var editError;
    if (title === '') {
        editError = '标题不能是空的。';
    } else if (title.length < 5 || title.length > 100) {
        editError = '标题字数太多或太少。';
    } else if (!tab || allTabs.indexOf(tab) === -1) {
        editError = '必须选择一个类别。';
    } else if (content === '') {
        editError = '内容不可为空';
    }

    // TODO validate goods parameters
    if (_.some([goods_pics, goods_now_price,
            goods_exchange_location, goods_quality_degree,
            goods_status
        ], function(x) {
            return x == null;
        })) {
        editError = "创建交易物品，缺少参数！";
    };

    // END 验证

    if (editError) {
        res.status(422);
        return res.send({
            error_msg: editError,
        });
    }

    var goods_exchange_geom = {
        type: 'Point',
        coordinates: [goods_exchange_location.lng, goods_exchange_location.lat]
    };

    TopicProxy.newAndSave(title,
        content,
        tab,
        req.user.id,
        // goods parameters
        goods_pics,
        goods_pre_price,
        goods_now_price,
        goods_is_bargain,
        goods_quality_degree,
        goods_exchange_location,
        goods_exchange_geom,
        goods_status,
        function(err, topic) {
            if (err) {
                return next(err);
            }

            var proxy = new eventproxy();
            proxy.fail(next);

            proxy.all('score_saved', function() {
                res.send({
                    success: true,
                    topic_id: topic.id,
                });
            });
            UserProxy.getUserById(req.user.id, proxy.done(function(user) {
                user.score += 5;
                user.topic_count += 1;
                user.save();
                req.user = user;
                proxy.emit('score_saved');
            }));

            //发送at消息
            at.sendMessageToMentionUsers(content, topic.id, req.user.id);
        });
};

exports.create = create;

exports.collect = function(req, res, next) {
    var topic_id = req.body.topic_id;
    TopicProxy.getTopic(topic_id, function(err, topic) {
        if (err) {
            return next(err);
        }
        if (!topic) {
            return res.json({
                error_msg: '主题不存在'
            });
        }

        TopicCollect.getTopicCollect(req.user.id, topic._id, function(err, doc) {
            if (err) {
                return next(err);
            }
            if (doc) {
                res.json({
                    success: true
                });
                return;
            }

            TopicCollect.newAndSave(req.user.id, topic._id, function(err) {
                if (err) {
                    return next(err);
                }
                res.json({
                    success: true
                });
            });
            UserProxy.getUserById(req.user.id, function(err, user) {
                if (err) {
                    return next(err);
                }
                user.collect_topic_count += 1;
                user.save();
            });

            req.user.collect_topic_count += 1;
            topic.collect_count += 1;
            topic.save();
        });
    });
};

exports.de_collect = function(req, res, next) {
    var topic_id = req.body.topic_id;
    TopicProxy.getTopic(topic_id, function(err, topic) {
        if (err) {
            return next(err);
        }
        if (!topic) {
            return res.json({
                error_msg: '主题不存在'
            });
        }
        TopicCollect.remove(req.user.id, topic._id, function(err) {
            if (err) {
                return next(err);
            }
            res.json({
                success: true
            });
        });

        UserProxy.getUserById(req.user.id, function(err, user) {
            if (err) {
                return next(err);
            }
            user.collect_topic_count -= 1;
            user.save();
        });

        topic.collect_count -= 1;
        topic.save();

        req.user.collect_topic_count -= 1;
    });
};

/**
 * Update topic as the author
 * @param  {[type]}   req  [description]
 * @param  {[type]}   res  [description]
 * @param  {Function} next [description]
 * @return {[type]}        [description]
 */
exports.update = function(req, res, next) {
    var topicId = req.params.id;
    var topicInRequest = req.body.topic;

    // validate properties of topic
    function _validateTopic(t) {
        // topic is object
        if (!(typeof(t) === 'object')) {
            return false;
        }
        // 标题字数限制
        if (t.title.length < 5 || t.title.length > 100) {
            return false;
        }
        // #TODO should add more validation
        return true;
    }

    if (!(topicId || topicInRequest)) {
        requestUtil.okJsonResponse({
            rc: 1,
            msg: 'Parameters are wanted.'
        }, res);
    } else if (!_validateTopic(topicInRequest)) {
        requestUtil.okJsonResponse({
            rc: 2,
            msg: 'Topic properties are set properly.'
        }, res);
    } else {
        TopicProxy.getTopic(topicId, function(err, topic) {
            if (err) {
                requestUtil.okJsonResponse({
                    rc: 3,
                    msg: 'Can not get doc by this id.',
                    err: err
                }, res);
            } else if ( // if user is not the author and not an admin
                (!topic.author_id.equals(req.user._id)) &&
                (!req.user.is_admin)) {
                requestUtil.okJsonResponse({
                    rc: 4,
                    msg: 'Permission Error, the request must be sent by admin or author.'
                }, res);
            } else {
                topic.tab = topicInRequest.tab;
                topic.title = topicInRequest.title;
                topic.content = topicInRequest.content;
                topic.update_at = Date.now();
                // mark this topic as deleted.
                topic.deleted = topicInRequest.deleted;
                topic.goods_pics = topicInRequest.goods_pics;
                topic.markModified('goods_pics');
                topic.goods_pre_price = topicInRequest.goods_pre_price;
                topic.goods_now_price = topicInRequest.goods_now_price;
                topic.goods_is_bargain = topicInRequest.goods_is_bargain;
                topic.goods_quality_degree = topicInRequest.goods_quality_degree;
                topic.goods_exchange_location = topicInRequest.goods_exchange_location;
                topic.goods_exchange_geom = {
                    type: 'Point',
                    coordinates: [topicInRequest.goods_exchange_location.lng, topicInRequest.goods_exchange_location.lat]
                };
                topic.markModified('goods_exchange_location');
                topic.goods_status = topicInRequest.goods_status;
                topic.save(function(err, doc) {
                    if (err) {
                        requestUtil.okJsonResponse({
                            rc: 5,
                            msg: 'Can not save doc by this id.',
                            err: err
                        }, res);
                    } else {
                        requestUtil.okJsonResponse({
                            rc: 0,
                            msg: 'topic is saved.',
                            latest: doc
                        }, res);
                    }
                });
            }
        });
    }
}



/**
 * Ding my topic
 */
exports.ding = function(req, res, next) {
    var topicId = req.body.topicId;
    if (topicId) {
        TopicProxy.getFullTopic(topicId, function(err, messages, topic, author, replies) {
            if (err) {
                logger.debug('ding', err);
                requestUtil.okJsonResponse({
                    rc: 2,
                    msg: err
                }, res);
            } else if (typeof(topic) !== 'object') {
                requestUtil.okJsonResponse({
                    rc: 5,
                    msg: 'Topic is null.'
                }, res);
            } else if (
                // if user is not the author and not an admin
                (!topic.author_id.equals(req.user._id)) &&
                (!req.user.is_admin)) {
                requestUtil.okJsonResponse({
                    rc: 3,
                    msg: 'Permission Error, the request must be sent by admin or author.'
                }, res);
            } else {
                topic.update_at = Date.now();
                topic.save(function(err, doc) {
                    if (err) {
                        requestUtil.okJsonResponse({
                            rc: 4,
                            msg: err
                        }, res);
                    } else {
                        requestUtil.okJsonResponse({
                            rc: 0,
                            msg: 'success.'
                        }, res);
                    }
                });
            }
        });
    } else {
        requestUtil.okJsonResponse({
            rc: 1,
            msg: 'topicId is required.'
        }, res);
    }
}

exports.addComplain = function(req, res, next) {
    var topicId = req.body.topicId;
    console.log('topicId', topicId);
    var args = {
        userId: req.user.id,
        topicId: topicId,
        description: req.body.description
    };

    TopicProxy.getTopic(topicId, function(err, topic) {
        if (err) {
            return next(err);
        }
        if (!topic) {
            return res.json({
                error_msg: '主题不存在'
            });
        }
        args.tab = topic.tab;

        TopicComplain.newAndSave(args, function(err) {
            if (err) {
                return next(err);
            }
            res.json({
                success: true
            });
        });
    });
};
