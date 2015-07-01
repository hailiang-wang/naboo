/**
 * save state cross nodes by database
 */

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = Schema.ObjectId;

var HashStateSchema = new Schema({
    md5: {
        type: String,
        required: true,
        unique: true
    },
    value: {
        type: String,
        required: true,
        unique: true
    }
});

HashStateSchema.index({
    md5: 1,
    value: 1
});


mongoose.model('HashState', HashStateSchema);
module.exports = exports = HashStateSchema;
