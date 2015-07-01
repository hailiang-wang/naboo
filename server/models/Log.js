var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = Schema.ObjectId;

var LogSchema = new Schema({
  type: { type: String },
  content: { type: String },
  create_at: { type: Date, default: Date.now }
});

LogSchema.index({type: 1});

mongoose.model('Log', LogSchema);
module.exports = exports = LogSchema;
