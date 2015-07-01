var express = require('express');

var LogController = require('./api/v1/Log');
var topicController = require('./api/v1/topic');
var userController = require('./api/v1/user');
var toolsController = require('./api/v1/tools');
var replyController = require('./api/v1/reply');
var messageController = require('./api/v1/message');
var ionicController = require('./api/v1/ionic');
var middleware = require('./api/v1/middleware');
var fileStorageController = require('./api/v1/fileStorage');
var limit = require('./middlewares/limit');
var config = require('./config');

var router = express.Router();

// Log
router.post('/Log', LogController.save);

// 主题
router.get('/topics', topicController.index);
router.get('/topic/:id', middleware.auth, topicController.show);
router.post('/topic/ding', middleware.auth, topicController.ding);
router.put('/topic/:id', middleware.auth, topicController.update);
router.post('/topics', middleware.auth, limit.peruserperday('create_topic', config.create_post_per_day), topicController.create);
router.post('/topic/collect', middleware.auth, topicController.collect); // 关注某话题
router.post('/topic/de_collect', middleware.auth, topicController.de_collect); // 取消关注某话题
router.post('/topic/complain', middleware.auth, topicController.addComplain); // 举报某话题


// 用户
router.get('/user/my_topics', middleware.auth, userController.getMyTopics);
router.get('/user/my_collection', middleware.auth, userController.getMyCollections);
router.get('/user/:loginname', middleware.auth, userController.show);

// accessToken 测试
router.post('/accesstoken', middleware.auth, toolsController.accesstoken);
router.get('/accesstoken', toolsController.getAccessToken);

// 评论
router.post('/topic/:topic_id/replies', middleware.auth, limit.peruserperday('create_reply', config.create_reply_per_day), replyController.create);
router.post('/reply/:reply_id/ups', middleware.auth, replyController.ups);

// 通知
router.get('/messages', middleware.auth, messageController.index);
router.get('/message/count', middleware.auth, messageController.count);
router.post('/message/mark_all', middleware.auth, messageController.markAll);


// 发送手机验证码
router.post('/user/bind_phone_number', middleware.auth, userController.bindPhoneNumber);
router.post('/user/check_phone_verifycode', middleware.auth, userController.checkPhoneVerifyCode);

// wechat 消息开关
router.post('/user/wechat-notify-enable', middleware.auth, userController.enableWechatNotify);
router.post('/user/wechat-notify-disable', middleware.auth, userController.disableWechatNotify);

/**
 * 文件
 */
router.post('/file/image-web-url', middleware.auth, fileStorageController.uploadWebUrlImage);
router.get('/file/image-anonymous/:id', fileStorageController.displayAnonymousImage);

/**
 * 获取微信JS SDK 签名
 */
router.post('/ionic/wechat-signature', ionicController.getWechatSignature);
router.post('/ionic/wechat-images', middleware.auth, ionicController.getWechatImages);

/**
 * Save user feedback
 */
router.post('/ionic/feedback', middleware.auth, ionicController.saveFeedback);
router.get('/ionic/user-service-agreements', ionicController.getSLA);
/**
 * get state url
 */
router.post('/ionic/state', toolsController.getHashStateByMd5);
router.get('/ionic/app-revision', ionicController.getAppGitRevision);

/**
 * get statistics of subscriptions
 */
router.post('/statistics/subscription', toolsController.getSubscriptionStatistics);

module.exports = router;
