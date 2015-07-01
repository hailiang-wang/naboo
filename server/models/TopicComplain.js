var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = Schema.ObjectId;

var TopicComplainSchema = new Schema({
  userId: { type: ObjectId },
  topicId: { type: ObjectId },
  tab: {type: String},
  description: {type: String}, // 举报理由
  isProcessed: { type: Boolean, default: false }, // 后台运营人员是否已经处理
  createAt: { type: Date, default: Date.now }
});

mongoose.model('TopicComplain', TopicComplainSchema);
