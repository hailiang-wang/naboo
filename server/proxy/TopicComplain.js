var TopicComplain = require('../models').TopicComplain;
var EventProxy = require('eventproxy');

var models = require('../models');
var Topic = models.Topic;
var TopicComplain = models.TopicComplain;
var User = require('./user');
var Reply = require('./reply');
var tools = require('../common/tools');
var at = require('../common/at');
var _ = require('lodash');

/**
 * 根据主题ID获取主题
 * Callback:
 * - err, 数据库错误
 * - topic, 主题
 * - author, 作者
 * - lastReply, 最后回复
 * @param {String} id 主题ID
 * @param {Function} callback 回调函数
 */
exports.getTopicById = function(id, callback) {
    var proxy = new EventProxy();
    var events = ['topic', 'author', 'last_reply'];
    proxy.assign(events, function(topic, author, last_reply) {
        if (!author) {
            return callback(null, null, null, null);
        }
        return callback(null, topic, author, last_reply);
    }).fail(callback);

    Topic.findOne({
        _id: id
    }, proxy.done(function(topic) {
        if (!topic) {
            proxy.emit('topic', null);
            proxy.emit('author', null);
            proxy.emit('last_reply', null);
            return;
        }
        proxy.emit('topic', topic);

        User.getUserById(topic.author_id, proxy.done('author'));

        if (topic.last_reply) {
            Reply.getReplyById(topic.last_reply, proxy.done(function(last_reply) {
                proxy.emit('last_reply', last_reply);
            }));
        } else {
            proxy.emit('last_reply', null);
        }
    }));
};

/**
 * 获取关键词能搜索到的主题数量
 * Callback:
 * - err, 数据库错误
 * - count, 主题数量
 * @param {String} query 搜索关键词
 * @param {Function} callback 回调函数
 */
exports.getCountByQuery = function(query, callback) {
    TopicComplain.count(query, callback);
};

/**
 * 根据关键词，获取主题列表
 * Callback:
 * - err, 数据库错误
 * - count, 主题列表
 * @param {String} query 搜索关键词
 * @param {Object} opt 搜索选项
 * @param {Function} callback 回调函数
 */
exports.getTopicsByQuery = function(query, opt, callback) {
    query.isProcessed = false;
    TopicComplain.find(query, '', opt, function(err, docs) {
        if (err) {
            return callback(err);
        }
        if (docs.length === 0) {
            return callback(null, []);
        }

        // var topics_id = _.pluck(docs, 'id');
        var topicComplainList = docs;

        var proxy = new EventProxy();
        proxy.after('topic_ready', topicComplainList.length, function(topics) {
            // 过滤掉空值
            var filtered = topics.filter(function(item) {
                return !!item;
            });
            return callback(null, filtered);
        });
        proxy.fail(callback);

        topicComplainList.forEach(function(item, i) {
            var id = item.topicId;
            exports.getTopicById(id, proxy.group('topic_ready', function(topic, author, last_reply) {
                // 当id查询出来之后，进一步查询列表时，文章可能已经被删除了
                // 所以这里有可能是null
                if (topic) {
                    topic.author = author;
                    topic.complainDesc = item.description;
                    topic.complainUserId = item.userId;
                    topic.complainTime = tools.formatDate(item.createAt, true);
                    topic.reply = last_reply;
                    topic.friendly_create_at = tools.formatDate(topic.create_at, true);
                }
                return topic;
            }));
        });
    });
};


/**
 * 根据关键词，获取主题列表
 * Callback:
 * - err, 数据库错误
 * - count, 主题列表
 * Note, the maximum size is 1000 records,
 * here is enough for a single user.
 * When you have to load all data, think about optimize your query
 * Because user just need records around 200.
 * http://stackoverflow.com/questions/12643195/mongoose-limiting-query-to-1000-results-when-i-want-more-all-migrating-from-2-6
 * @param {String} query 搜索关键词
 * @param {Object} opt 搜索选项
 * @param {Function} callback 回调函数
 */
exports.getFullTopicsByQuery = function(query, opt, callback) {
    query.deleted = false;
    Topic.find(query, opt, function(err, docs) {
        if (err) {
            return callback(err);
        }
        if (docs.length === 0) {
            return callback(null, []);
        }

        var topics_id = _.pluck(docs, 'id');

        var proxy = new EventProxy();
        proxy.after('topic_ready', topics_id.length, function(topics) {
            // 过滤掉空值
            var filtered = topics.filter(function(item) {
                return !!item;
            });
            return callback(null, filtered);
        });
        proxy.fail(callback);

        topics_id.forEach(function(id, i) {
            Topic.getTopicById(id, proxy.group('topic_ready', function(topic, author, last_reply) {
                // 当id查询出来之后，进一步查询列表时，文章可能已经被删除了
                // 所以这里有可能是null
                if (topic) {
                    topic.author = author;
                    topic.reply = last_reply;
                    topic.friendly_create_at = tools.formatDate(topic.create_at, true);
                }
                return topic;
            }));
        });
    });
};

// for sitemap
exports.getLimit5w = function(callback) {
    Topic.find({
        deleted: false
    }, '_id', {
        limit: 50000,
        sort: '-create_at'
    }, callback);
};

/**
 * 获取所有信息的主题
 * Callback:
 * - err, 数据库异常
 * - message, 消息
 * - topic, 主题
 * - author, 主题作者
 * - replies, 主题的回复
 * @param {String} id 主题ID
 * @param {Function} callback 回调函数
 */
exports.getFullTopic = function(id, callback) {
    var proxy = new EventProxy();
    var events = ['topic', 'author', 'replies'];
    proxy
        .assign(events, function(topic, author, replies) {
            callback(null, '', topic, author, replies);
        })
        .fail(callback);

    Topic.findOne({
        _id: id
    }, proxy.done(function(topic) {
        if (!topic) {
            proxy.unbind();
            return callback(null, '此话题不存在或已被删除。');
        }
        at.linkUsers(topic.content, proxy.done('topic', function(str) {
            topic.linkedContent = str;
            return topic;
        }));

        User.getUserById(topic.author_id, proxy.done(function(author) {
            if (!author) {
                proxy.unbind();
                return callback(null, '话题的作者丢了。');
            }
            proxy.emit('author', author);
        }));

        Reply.getRepliesByTopicId(topic._id, proxy.done('replies'));
    }));
};

/**
 * 更新主题的最后回复信息
 * @param {String} topicId 主题ID
 * @param {String} replyId 回复ID
 * @param {Function} callback 回调函数
 */
exports.updateLastReply = function(topicId, replyId, callback) {
    Topic.findOne({
        _id: topicId
    }, function(err, topic) {
        if (err || !topic) {
            return callback(err);
        }
        topic.last_reply = replyId;
        topic.last_reply_at = new Date();
        topic.reply_count += 1;
        topic.save(callback);
    });
};

/**
 * 根据主题ID，查找一条主题
 * @param {String} id 主题ID
 * @param {Function} callback 回调函数
 */
exports.getTopic = function(id, callback) {
    Topic.findOne({
        _id: id
    }, callback);
};

/**
 * 将当前主题的回复计数减1，删除回复时用到
 * @param {String} id 主题ID
 * @param {Function} callback 回调函数
 */
exports.reduceCount = function(id, callback) {
    Topic.findOne({
        _id: id
    }, function(err, topic) {
        if (err) {
            return callback(err);
        }

        if (!topic) {
            return callback(new Error('该主题不存在'));
        }

        topic.reply_count -= 1;
        topic.save(callback);
    });
};

exports.newAndSave = function (args, callback) {
  var topicComplain = new TopicComplain();
  console.log(topicComplain);
  topicComplain.userId = args.userId;
  topicComplain.tab = args.tab;
  topicComplain.topicId = args.topicId;
  topicComplain.description = args.description;
  // topicComplain.isProcessed = false;
  topicComplain.save(callback);
};
