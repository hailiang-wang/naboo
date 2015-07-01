/**
 * subsribe EMPEvent and process triggers
 */

var Database = require('../persistence/database');
var logger = require('../common/loggerUtil').getLogger('eventq');
var appInit = require('../appinit.js');
var minimatch = require("minimatch");
var config = require('../config');
var _ = require('lodash');
var connect_wechat = require('../middlewares/connect-wechat');

appInit.add();

/**
 * send reply message with notify api of wechat industry template
 * @param  {[type]} payload [description]
 * @return {[type]}         [description]
 */
function _sendReplyNotifyWithWechatTemplateAPI(payload) {
    try {
        var reply_id = payload[0].reply_id;
        var from_user_id = payload[0].author_id;
        var to_user_id = payload[0].master_id;
        var topic_id = payload[0].topic_id;
        connect_wechat.pushReplyWithWechatTemplateAPI(to_user_id,
                from_user_id,
                topic_id,
                reply_id)
            .then(function() {
                logger.debug('_sendReplyNotifyWithWechatTemplateAPI', 'Notify is send out.');
            }, function(err) {
                logger.error('_sendReplyNotifyWithWechatTemplateAPI', err);
            });
    } catch (e) {
        logger.error('_sendReplyNotifyWithWechatTemplateAPI', e);
    }
}

/**
 * handle arrival events
 * @param  {[type]} event [description]
 * @return {[type]}       [description]
 */
function _handleOnBehalf(event) {
    logger.debug('_handleOnBehalf', event);
    // check event pattern and publish out.
    // 
    if (minimatch(event.event, "collection:messages:post")) {
        logger.debug('_handleOnBehalf', 'process collection:messages ...');
        logger.debug('_handleOnBehalf', JSON.stringify(event));
        _sendReplyNotifyWithWechatTemplateAPI(JSON.parse(event.args));
    }
}

Database.initPromise.onFulfill(function() {
    try {

        // listening all patterns
        Database.empEvent.on('*', function(event) {
            // logger.debug('on', event);
            setImmediate(_handleOnBehalf, event);
        });

        // eventq is started
        logger.info('eventq service is started.');
        appInit.resolve();
    } catch (err) {
        logger.error(err);
        appInit.reject(err);
    }

});
