var database = require('../../persistence/database');
var User = require('../../proxy/user');
var should = require('should');
var support = require('../support/support');

describe('test/proxy/user.test.js', function() {
	this.timeout(5000);
    it('should update user phone', function(done) {
        database.initPromise.onFulfill(function() {
            User.updateUserPhoneNumber('552ef500f52a81b6bb42f4ac', '111')
                .then(function(doc) {
                    done();
                }, function(err) {
                    done(err);
                });
        });
    });

});
