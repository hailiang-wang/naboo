/**
 * test redis q
 */

var should = require('should');
var redisq = require('../../persistence/redisq');

describe('Test Redis Q', function() {
    this.timeout(5000);

    it('should create verify phone number code.', function(done) {
        redisq.createVerifyCodeWithExpirationAndPhoneNumber(
        		/*userId*/ 'foo',
        		/*phoneNumber*/ '15801213126',
        		/*code*/ '99ss',
        		/*experiation*/ 20
        	)
            .then(function() {
                done()
            })
            .fail(function(err) {
                done(err);
            });
    });
})
