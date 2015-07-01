/*
*/
/**
 * Application init MultiPromise.
 * <p>
 * Every module that needs to wait for application to be initialized will need to do:
 * 
 * <pre>
 * var appPromise = require('appinit.js').appPromise;
 * 
 * appPromise.onResolve(function(err) {...});
 * </pre>
 * 
 * <p>
 * When the promise is resolved with no err then the application has been initialized.
 * 
 * <p>
 * If a module wants to contribute to appPromise such that appPromise will not be resolved
 * until at least this module is completed initialization then it must be a module that is 
 * required either directly from app.js, or from one of the modules that app.js requires.
 * If not then the appPromise would already be resolved by the time the module was loaded.
 * To be hooked in to the initialization do:
 *  
 * <pre>
 * var appInit = require('appinit.js');
 * appInit.add();
 * 
 * ...
 * 
 * And when completed initialization then do:
 * appInit.resolve();
 * 
 * ...
 * 
 * Or if there was an error then do:
 * appInit.reject(err);
 * </pre>
 * <p>
 * This MUST be the first require with app.js or things will not work correctly.
 */
var mongoose = require('mongoose');
var MultiPromise = require('./persistence/multipromise.js');

module.exports = exports = new MultiPromise(new mongoose.Promise());
exports.appPromise = exports.promise;
