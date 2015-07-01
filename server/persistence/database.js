/**
 * Database connection management
 */

var mongoose = require('mongoose');
var mongo = mongoose.mongo;
var Types = mongoose.Schema.Types;
var util = require('util');
var logger = require('../common/loggerUtil').getLogger('database');
var config = require('../config');
var appInit = require('../appinit.js');
var _empEvent = null; // EMPEvent instance

appInit.add();

var dbase = null; // our connection

function Database() {}

module.exports = exports = new Database();

/**
 * Promise that is resolved when database initialization is complete. This can
 * be called BEFORE appInit is complete, so caller needs to be aware of this.
 * <p>
 * Add onResolve() to get notified.
 */
Database.prototype.initPromise = new mongoose.Promise();

function connectDB(url, callback) {
    var promise = new mongoose.Promise(callback);

    if (url) {
        mongoose.connect(url, {
            server: {
                auto_reconnect: true,
                poolSize: 4,
                socketOptions: {
                    keepAlive: 1
                }
            }
        });

        var disconnected = false;

        dbase = mongoose.connection;
        dbase.on('error', function(err) {
            if (disconnected)
                return; // We are disconnected, this is the reconnect failed
            // message.
            logger.error("Mongoose Error: " + err);
            logger.error('mongoose connection error:' + err);
            promise.reject(err);
        });

        mongoose.connection.on('disconnected', function() {
            logger.error('Mongoose default connection disconnected');
            exports.databaseStatus = 'Server down due to database error. See logs';
            disconnected = true;
        });

        mongoose.connection.db.on('reconnect', function() {
            logger.warn('Mongo db default connection reconnected');
            // auto_reconnect doesn't work, actually it does for mongo, it is
            // just that mongoose isn't listening for it.
            mongoose.connect(url, {
                server: {
                    auto_reconnect: true,
                    poolSize: 4,
                    socketOptions: {
                        keepAlive: 1
                    }
                }
            }, function(err) {
                if (err) {
                    logger.error("Mongoose reconnect err: " + err);
                } else {
                    logger.error("Mongoose connection reconnected.");
                    exports.databaseStatus = true; // Up and running
                    disconnected = false;
                }
            });
        });

        process.on('SIGINT', function() {
            mongoose.connection.close(function() {
                logger.warn('App received SIGINT, closing Mongoose connection');
                process.exit(0);
            });
        });

        dbase.once('connected', function() {
            logger.info('Mongoose db connection successful');
            promise.fulfill();
        });
    } else
        promise.reject("No database URL supplied. Cannot start.");
    return promise;
}



/**
 * event management program
 * Use node event emits to send events out.
 */
function EMPEvent(collection) {
    this.eventCol = collection;
}
util.inherits(EMPEvent, require('events').EventEmitter);

/**
 * GetAll event history, sorted on date, limited to 1000 ... use since to page
 * 
 * @param {String |
 *            Object | ObjectID} [event] if string event name (must match
 *            exactly). If ObjectID, then that specific event only. If Object
 *            then it is a standard Mongoose Query (to allow more complicated
 *            searches). If not provided, then all events.
 * @param {Date}|{mongo.ObjectID()}
 *            [since] return events that are after this (either time or _id). If
 *            omitted, then all events.
 * @param {boolean}
 *            [asc] sort order. Default is false, descending.
 * @param {function}
 *            [callback] callback. If successful called back with a cursor for
 *            the returned events
 * @returns {mongoose.Promise}
 */
EMPEvent.prototype.getAll = function(event, since, asc, callback) {
    if ('function' == typeof event) {
        callback = event;
        event = since = undefined;
        asc = false;
    } else {
        if (event instanceof Date || event instanceof mongo.ObjectID) {
            since = event;
            event = undefined;
        } else if ('boolean' == typeof event) {
            asc = event;
            event = since = undefined;
        }
    }

    if ('function' == typeof since) {
        callback = since;
        since = undefined;
        asc = false;
    } else if ('boolean' == typeof since) {
        asc = since;
        since = undefined;
    } else if (since && !(since instanceof Date || since instanceof mongo.ObjectID))
        since = undefined;

    if ('function' == typeof asc) {
        callback = asc;
        asc = false;
    } else if (asc && 'boolean' !== typeof asc)
        asc = false;

    var promise = new mongoose.Promise(callback);

    var criteria = {};

    if (event) {
        if ('string' == typeof event || event instanceof mongo.ObjectID)
            criteria.event = event;
        else {
            for (var prop in event) {
                if (event.hasOwnProperty(prop)) {
                    criteria[prop] = event[prop];
                }
            }
        }
    }

    if (since) {
        if (since instanceof Date)
            since = mongo.ObjectID.createFromTime(since.getTime() / 1000);
        criteria._id = {
            $gt: since
        };
    }

    var order = asc ? 1 : -1;
    var options = {
        "limit": 1000,
        "sort": {
            _id: order
        }
    };

    this.eventCol.find(criteria, options, function(err, cursor) {
        if (err)
            promise.reject(err);
        else
            promise.fulfill(cursor);
    });
    return promise;
};

/**
 * Get a specific event by id
 * 
 * @param {id}
 *            events id mongo _id
 * @param {function}
 *            [callback] callback. If successful called back with an _empEvent
 *            if found, else it will be undefined if not found.
 * @returns {mongoose.Promise}
 */
EMPEvent.prototype.get = function(id, callback) {
    var promise = new mongoose.Promise(callback);

    this.eventCol.findOne({
        "_id": id
    }, function(err, event) {
        if (err)
            promise.reject(err);
        else if (event) {
            promise.fulfill(event);
        } else
            promise.fulfill();
    });
    return promise;
};

/**
 * Create an event.
 * 
 * @param {String}
 *            event event name. Name has a name-space, semi-colon separated ...
 *            e.g., collection:_shape or script:onDate
 * @param {Profile}
 *            user the user that caused the event to occur.
 * @param {Any}
 *            args... variable list of arguments that will be added to the
 *            event.
 * @param {function}
 *            [callback] callback. If successful called back with the inserted
 *            event as the result argument.
 * @returns {mongoose.Promise}
 */
EMPEvent.prototype.create = function(event, user, argN, callback) { // event has a name space, column separated ... e.g., collection:_shape or script:onDate
    var promise = new mongoose.Promise();

    if (Array.isArray(argN)) {
        if ('function' == typeof callback)
            promise.onResolve(callback);
    } else if (arguments.length > 1) {
        var last = arguments[arguments.length - 1];
        if ('function' == typeof last) {
            promise.onResolve(last);
            argN = Array.prototype.slice.call(arguments, 2, arguments.length - 1);
        } else
            argN = Array.prototype.slice.call(arguments, 2);
    } else
        argN = [];

    if (!user) {
        // Rare case that user was not sent in. Should not happen. Use Anonymous
        // in this case.
        user = {
            provider: 'local',
            id: "allusers",
            displayName: "Everyone",
            user: false,
            _id: 'xxx'
        }
    }

    var date = new Date();
    var e = {
        _id: new mongo.ObjectID(date.getTime() / 1000), // ObjectId is within seconds, while date is milliseconds.
        event: event,
        date: date,
        // stringify the args to avoid error message like below.
        // Uncaught RangeError: Maximum call stack size exceeded
        args: JSON.stringify(argN)
    };

    if (!user.onBehalf) {
        e.user = user.displayName;
        e.userId = user._id.toString();
        if (user.emails)
            e.userEmails = user.emails.toString();
    } else {
        // Swap them. If this is an onBehalf, then the user coming in is the 'delegate' for the 'onbehalf' user.
        // So the real 'user' of the event is actually the 'onbehalf' user since the delegate did it on behalf of that user.
        e.delegate = user.displayName;
        e.delegateId = user._id.toString();
        e.user = user.onBehalf.user;
        e.userId = user.onBehalf.userId;
        if (user.onBehalf.emails)
            e.userEmails = user.onBehalf.emails.toString();
    }

    this.eventCol.insert(e, function(err, inserted) {
        if (err) {
            promise.reject(err);
            logger.error('EMPEvent ' + event, err);
        } else {
            // TODO this will only work on a single server deployment.
            // see
            // http://stackoverflow.com/questions/10014839/get-notification-for-changed-documents-in-mongo
            logger.debug('EMPEvent ' + event, e);
            _empEvent.emit(event, e);
            _empEvent.emit('*', e); // TODO workaround for now given that we do not have pattern search on registration to events
            if (event.indexOf('adapter') === 0) // TODO Support for adapter
                _empEvent.emit('adapter', e);
            promise.fulfill(inserted);
        }
    });
    return promise;
};


function _registerEMP(schema, mname, callback) {

    logger.info("registerEMPEvents", "create listeners for " + mname);
    // #TODO check permissions
    // schema.pre('save', _preSavePermit);
    try {
        schema.pre('save', function(next) {
            this.wasNew = this.isNew;
            next();
        });

    } catch (e) {
        console.log(e);
    }

    schema.post('save', function(doc) {
        if (this.wasNew) {
            // if (doc._mUser)
            logger.debug('EMPEvent', 'post : ' + JSON.stringify(doc));
            pCallback(mname, ":post", doc); // this is a valid created with our restricted model. If not set then don't create the event, it will be created afterwards with the user.
        } else
            logger.debug('EMPEvent', 'put : ' + JSON.stringify(doc));
            pCallback(mname, ":put", doc);
        delete this.wasNew;
    });

    schema.post('remove', function(doc) {
        pCallback(mname, ":del", doc);
    });


    callback();
}

function pCallback(name, suffix, doc) {
    var eName = "collection:" + name + suffix;
    _empEvent.create(eName, doc._mUser, doc).onReject(function(err) {
        console.error("Can not persist event: ", err);
        if (err.stack)
            logger.error(err.stack);
    });
}


function init() {
    connectDB(config.db)
        .then(function() {
            var promise = new mongoose.Promise();
            dbase.db.createCollection("_events", {}, function(err, col) {
                if (err) {
                    logger.error(err);
                    promise.reject(err);
                } else {
                    // It is assumed that if there is an entry, then no need to create any other, indexes are ok.
                    _empEvent = new EMPEvent(col);

                    col.stats(function(err, stats) {
                        if (err)
                            promise.reject(err);
                        else {
                            if (stats.nindexes < 2) {
                                // arrking assets management
                                _empEvent.create("naboo:created", null, function(err) {
                                    if (err)
                                        promise.reject(err);
                                    else {
                                        col.ensureIndex({
                                            "event": 1
                                        }, function(err) {
                                            promise.reject(err);
                                        });
                                    }
                                });
                            }
                            promise.resolve();
                        }
                    });
                }
            });
            return promise;
        })
        .then(function() {
            var promise = new mongoose.Promise();
            _registerEMP(require('../models/message'), 'messages', function() {
                logger.info('EMPEvent', 'collection:messages:* is enrolled.');
                promise.resolve();
            });
            logger.info('EMPEvent', 'service is started.');
            return promise;
        })
        .then(function() {
            Database.prototype.connection = dbase;
            Database.prototype.empEvent = _empEvent;
            Database.prototype.registerEMP = _registerEMP;
            exports.databaseStatus = true;
            exports.initPromise.resolve();
            appInit.resolve();
        });
}

/**
 * prepare mongodb connection
 */
init();
