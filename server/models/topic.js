/**
 * Topic
 * http://mongoosejs.com/docs/guide.html
 * @type {[type]}
 */
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = Schema.ObjectId;
var config = require('../config');
var _ = require('lodash');

/**
 * Schema Type
 * http://mongoosejs.com/docs/api.html#schematype_SchemaType
 * @type {Schema}
 */
var TopicSchema = new Schema({
  /**
   * 标题
   * 与nodeclub保持一致，对二手物品的简短描述，20字以内
   * @type {String}
   */
  title: { type: String },
  /**
   * 文字描述
   * 与nodeclub保持一致，对交易物品的详细描述
   * @type {String}
   */
  content: { type: String },
  author_id: { type: ObjectId },
  top: { type: Boolean, default: false }, // 置顶帖
  good: {type: Boolean, default: false}, // 精华帖
  lock: {type: Boolean, default: false}, // 被锁定主题
  reply_count: { type: Number, default: 0 },
  /**
   * 帖子浏览的次数
   * @type {Number}
   */
  visit_count: { type: Number, default: 0 },
  /**
   * 帖子的收藏数
   * @type {Number}
   */
  collect_count: { type: Number, default: 0 },
  /**
   * 与nodeclub保持一致，创建这个二手物品的时间
   * @type {Date}
   */
  create_at: { type: Date, default: Date.now },
  update_at: { type: Date, default: Date.now },
  last_reply: { type: ObjectId },
  last_reply_at: { type: Date, default: Date.now },
  content_is_html: { type: Boolean },
  /**
   * 类别
   * @type 
   */
  tab: {type: String},
  deleted: {type: Boolean, default: false},
  /**
   * goods pictures
   */
  act_pics: {type: Schema.Types.Mixed, required: false},
  /**
   * 活动地点
   * @type {Object}
   */
  act_location: {type: Schema.Types.Mixed, required: false},
  act_location_geom: {type: Schema.Types.Mixed, required: false},
  /**
   * 活动状态
   * @type [未开始，进行中，已结束，取消]
   */
  act_status: {type: String, default: '未开始',  required: true}
});

TopicSchema.index({create_at: -1});
TopicSchema.index({top: -1, last_reply_at: -1});
TopicSchema.index({last_reply_at: -1});
TopicSchema.index({author_id: 1, create_at: -1});
TopicSchema.index({act_location_geom: '2dsphere'});

TopicSchema.virtual('tabName').get(function () {
  var tab = this.tab;
  var pair = _.find(config.tabs, function (_pair) {
    return _pair[0] === tab;
  });
  if (pair) {
    return pair[1];
  } else {
    return '';
  }
});

mongoose.model('Topic', TopicSchema);
