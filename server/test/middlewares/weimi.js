/**
 * Test Weimi Service to send SMS
 */

var request = require('superagent');
var should = require('should');
var cfg = require('../../config').weimi_api;
var querystring = require('querystring');
var weimi = require('../../middlewares/weimi');

var postData = {
    uid: cfg.uid,
    pas: cfg.pas,
    cid: cfg.cid,
    p1: '1234',
    mob: '15801213126',
    // use cid instead.
    // con: '【微米】您的验证码是：610912，3分钟内有效。如非您本人操作，可忽略本消息。',
    type: 'json'
};

var content = querystring.stringify(postData);

describe('Weimi Service', function() {
    this.timeout(5000);
    // it('should send message to 15801213126', function(done) {
    //     request.post('http://api.weimi.cc/2/sms/send.html')
    //         .send(content)
    //         .set('Content-Type', 'application/x-www-form-urlencoded')
    //         .set('Content-Length', content.length)
    //         .end(function(err, res) {
    //             if (err) {
    //                 done(err);
    //             } else {
    //                 console.log(res);
    //                 done();
    //             }
    //         });
    // });

    it('should send verify code to 15801213126', function(done) {
        weimi.sendVerifyCodeToRegisterAccount(
            /*userId*/
            'foo',
            /*phoneNumber*/
            '15801213126'
        ).then(function(reply) {
            console.log(reply);
            done();
        }).fail(function(err) {
            done(err);
        });
    });

});
