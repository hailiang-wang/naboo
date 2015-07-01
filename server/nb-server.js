/*!
 * nodeclub - app.js
 */

/**
 * Module dependencies.
 */
var config = require('./config');
var appInit = require('./appinit.js');
var revision = require('git-rev');
// Date add-ons for Node.js
// https://www.npmjs.com/package/date-utils
require('date-utils');
//always use newrelic
//require('newrelic');

// get git reverison for better tracking builds
revision.short(function(gitRevision) {

    process.env['naboo_git_revision'] = gitRevision;

    var util = require('util');
    var path = require('path');
    var Loader = require('loader');
    var express = require('express');
    var session = require('express-session');
    var passport = require('passport');
    require('./persistence/database');
    require('./models');
    // start eventq as event subscriptions
    require('./logic/eventq');

    var GitHubStrategy = require('passport-github').Strategy;
    var githubStrategyMiddleware = require('./middlewares/github_strategy');
    var WechatStrategy = require('passport-wechat-auth').OAuth2Strategy;
    var webRouter = require('./web_router');
    var apiRouterV1 = require('./api_router_v1');
    var auth = require('./middlewares/auth');
    var proxyMiddleware = require('./middlewares/proxy');
    var MongoStore = require('connect-mongo')(session);
    var _ = require('lodash');
    var csurf = require('csurf');
    var compress = require('compression');
    var bodyParser = require('body-parser');
    var busboy = require('connect-busboy');
    var errorhandler = require('errorhandler');
    var cors = require('cors');
    var limitMiddleware = require('./middlewares/limit');
    var logger = require('./common/loggerUtil').getLogger('app');
    var wechat = require('./middlewares/connect-wechat');
    var wxConfig = config.wechat_gzh;
    var UserProxy = require('./proxy/user');
    var HashStateProxy = require('./proxy/hashState');

    // 静态文件目录
    var staticDir = path.join(__dirname, 'public');

    // assets
    var assets = {};
    if (config.mini_assets) {
        try {
            assets = require('./assets.json');
        } catch (e) {
            console.log('You must execute `make build` before start app when mini_assets is true.');
            throw e;
        }
    }

    var urlinfo = require('url').parse(config.host);
    config.hostname = urlinfo.hostname || config.host;

    var app = express();

    // configuration in all env
    app.set('views', path.join(__dirname, 'views'));
    app.set('view engine', 'html');
    app.engine('html', require('ejs-mate'));
    /**
     * Need to support wechat entry, disable the default layout.
     * Specific layout in each partial views.
     * <%- layout( 'layout.html') %>
     * http://yijiebuyi.com/blog/08cf14e904325c19814465689453b3aa.html
     */
    // app.locals._layoutFile = 'layout.html';
    app.enable('trust proxy');


    // 静态资源
    app.use(Loader.less(__dirname));
    app.use('/public', cors(), express.static(staticDir));
    app.use('/agent', proxyMiddleware.proxy);

    // 每日访问限制
    // app.use(limitMiddleware.peripperday('all', config.visit_per_day));

    app.use(require('response-time')());
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({
        extended: true
    }));
    app.use(require('method-override')());
    app.use(require('cookie-parser')(config.session_secret));
    app.use(compress());
    app.use(session({
        secret: config.session_secret,
        store: new MongoStore({
            url: config.db
        }),
        resave: true,
        saveUninitialized: true,
    }));

    app.use(passport.initialize());

    // custom middleware
    app.use(auth.authUser);
    app.use(auth.blockUser());


    if (!config.debug) {
        app.use(function(req, res, next) {
            if (req.path.indexOf('/api') === -1) {
                csurf()(req, res, next);
                return;
            }
            next();
        });
        app.set('view cache', true);
    }

    // for debug
    // app.get('/err', function (req, res, next) {
    //   next(new Error('haha'))
    // });

    // set static, dynamic helpers
    _.extend(app.locals, {
        config: config,
        Loader: Loader,
        assets: assets
    });

    _.extend(app.locals, require('./common/render_helper'));
    app.use(function(req, res, next) {
        res.locals.csrf = req.csrfToken ? req.csrfToken() : '';
        next();
    });

    // github oauth
    passport.serializeUser(function(user, done) {
        done(null, user);
    });
    passport.deserializeUser(function(user, done) {
        done(null, user);
    });

    passport.use(new GitHubStrategy(config.GITHUB_OAUTH, githubStrategyMiddleware));

    /**
     * Wechat UAA Service for ionic app embedded wechat
     * @param  {[type]} req           [description]
     * @param  {[type]} openid        [description]
     * @param  {[type]} profile       [description]
     * @param  {[type]} params        [description]
     * @param  {[type]} done)         {               req.session.wechat_params [description]
     * @param  {[type]} function(err) {                                                         console.log("Error logging in user");        console.log(err [description]
     * @return {[type]}               [description]
     */
    passport.use(new WechatStrategy({
        appId: wxConfig.appId,
        appSecret: wxConfig.appSecret,
        callbackURL: util.format('http://%s/auth/wechat/embedded/callback', config.host),
        scope: 'snsapi_userinfo',
        passReqToCallback: true
            // state: true
            // }, function (openid, profile, token, done) {
    }, function(req, accessToken, refreshToken, profile, done) {
        req.session.wechat_params = {
            accessToken: accessToken,
            refreshToken: refreshToken
        };

        logger.debug('snsapi_userinfo', JSON.stringify(profile));

        /**
         * {
  "provider": "wechat",
  "id": "ogWfMt5hcNzyPu2BRHjGj4CZmGqo",
  "displayName": "王海良",
  "username": "王海良",
  "_raw": "{\"openid\":\"ogWfMt5hcNzyPu2BRHjGj4CZmGqo\",\"nickname\":\"王海良\",\"sex\":1,\"language\":\"en\",\"city\":\"海淀\",\"province\":\"北京\",\"country\":\"中国\",\"headimgurl\":\"http:\\/\\/wx.qlogo.cn\\/mmopen\\/ajNVdqHZLLChxqXiauTD4ewLXOeicBzgQrlwK6f8xfTZ40eDLQmIam7sK7jm6FffhUHcRxpMUSub1wWIqDqhwJibQ\\/0\",\"privilege\":[],\"unionid\":\"o0DaijgmdOUuAIRQ1QNZzuTizOT8\"}",
  "_json": {
    "openid": "ogWfMt5hcNzyPu2BRHjGj4CZmGqo",
    "nickname": "王海良",
    "sex": 1,
    "language": "en",
    "city": "海淀",
    "province": "北京",
    "country": "中国",
    "headimgurl": "http://wx.qlogo.cn/mmopen/ajNVdqHZLLChxqXiauTD4ewLXOeicBzgQrlwK6f8xfTZ40eDLQmIam7sK7jm6FffhUHcRxpMUSub1wWIqDqhwJibQ/0",
    "privilege": [],
    "unionid": "o0DaijgmdOUuAIRQ1QNZzuTizOT8"
  }
}
         */
        // create user profile
        UserProxy.newOrUpdate(profile._json)
            .then(function(user) {
                logger.debug('WechatStrategy', 'login user.');
                // When the login operation completes, user will be assigned to req.user.
                req.logIn(user, function(err) {
                    return done(null, user);
                });
            })
            .fail(function(err) {
                return done(err);
            });


        // return done(null, openid, profile);
    }));

    app.get('/auth/wechat/embedded', function(req, res, next) {
        var redirect = req.query.redirect;
        if (redirect) {
            HashStateProxy.getHashStateByValue(redirect)
                .then(function(result) {
                    passport.authenticate('wechat', {
                        scope: 'snsapi_userinfo',
                        state: result.md5
                    })(req, res, next);
                }, function(err) {
                    logger.warn('/auth/wechat/embedded', 'can not get state from db, just navigate to index page.');
                    passport.authenticate('wechat', {
                        scope: 'snsapi_userinfo',
                        state: ''
                    })(req, res, next);
                });
        } else {
            passport.authenticate('wechat', {
                scope: 'snsapi_userinfo',
                state: ''
            })(req, res, next);
        }
    });

    // app.get('/auth/wechat/embedded/callback', passport.authenticate('wechat', {
    //     failureRedirect: '/auth/wechat/embedded/err',
    //     successRedirect: '/auth/wechat/embedded/success'
    // }));

    app.get('/auth/wechat/embedded/callback', function(req, res, next) {
        logger.debug('/auth/wechat/embedded/callback query', JSON.stringify(req.query));
        passport.authenticate('wechat', function(err, user, info) {
            if (err) {
                logger.error('wechat uaa', err);
            } else {
                logger.debug('wechat uaa', JSON.stringify(user));
            }
            // node passport login user as req.user, but in nodeclub,
            // req.session.user should also be signed.
            if (user) {
                res.locals.current_user = req.session.user = user;
            }

            if (req.query && req.query.state !== '') {
                HashStateProxy.getHashStateByMD5(req.query.state)
                    .then(function(doc) {
                        if (doc.value === 'post' && !user.phone_number) {
                            res.redirect(util.format('http://%s/#/bind-mobile-phone/%s/%s', config.client_host, user.accessToken, req.query.state));
                        } else {
                            // pass user accesstoken into client
                            var redirectUrl = util.format('http://%s/#/bind-access-token/%s/%s', config.client_host, user.accessToken, req.query.state);
                            logger.debug('/auth/wechat/embedded/callback hashState', redirectUrl);
                            res.redirect(redirectUrl);
                        }
                    }, function() {
                        res.redirect(util.format('http://%s/#/bind-mobile-phone/%s/null-md5', config.client_host, user.accessToken));
                    });
            } else {
                var redirectUrl = util.format('http://%s/#/bind-access-token/%s/null-md5', config.client_host, user.accessToken);
                logger.debug('/auth/wechat/embedded/callback redirectUrl', redirectUrl);
                res.redirect(redirectUrl);
            }
        })(req, res, next);
    });

    //endof auth/wechat/embedded

    app.use(busboy({
        limits: {
            fileSize: 10 * 1024 * 1024 // 10MB
        }
    }));

    // routes
    app.use('/api/v1', cors(), apiRouterV1);
    app.use('/', webRouter);
    wechat.setup(app, '/connect-wechat');

    // error handler
    if (config.debug) {
        app.use(errorhandler());
    } else {
        app.use(function(err, req, res, next) {
            console.error('server 500 error:', err);
            return res.status(500).send('500 status');
        });
    }

    app.listen(config.port, function() {
        logger.info("naboo listening on port %d", config.port);
        logger.info("God bless love....");
        logger.info("You can debug your app with http://" + config.hostname + ':' + config.port);
    });


    module.exports = app;


});
