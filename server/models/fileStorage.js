var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = Schema.ObjectId;

var FileStorageSchema = new Schema({
  file_id: { type: ObjectId },
  name: { 
    type: String,
    required: true
  },
  file: { type: Schema.Types.ObjectId },
  files: [{
    type: Schema.Types.ObjectId,
    ref: 'FileStorage'
  }],
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  type: { type: String },
  dir: { 
    type: Schema.Types.ObjectId,
    ref: 'FileStorage'
  },
  size: {
    type: Number
  },
  task: { type: Schema.Types.ObjectId },
  update_time: { type: Date, default: Date.now },
});

mongoose.model('FileStorage', FileStorageSchema);