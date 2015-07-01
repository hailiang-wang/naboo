var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var FeedbackSchema = new Schema({
    // creation time
    create_at: {
        type: Date,
        default: Date.now,
        require: true
    },
    // app version, better use git
    git_revision: {
        type: String,
        default: process.env['naboo_git_revision'],
        require: true
    },
    author: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        require: true
    },
    content: {
        type: String,
        require: true
    }
});
mongoose.model('Feedback', FeedbackSchema);
