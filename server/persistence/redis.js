/**
 * Redis connection management
 * @type {[type]}
 */
var common = require('../common');
var logger = common.loggerUtil.getLogger('redis');
var config = require('../config');
var redis = require('redis');
var u = require('util');

var client = redis.createClient(config.redis_port, config.redis_host);
client.auth(config.redis_pass);
logger.debug(u.format('Using Redis %s:%d pass: %s', config.redis_host, config.redis_port, config.redis_pass));

exports = module.exports = client;
