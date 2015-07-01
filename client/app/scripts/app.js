// Ionic Starter App

// angular.module is a global place for creating, registering and retrieving Angular modules
// 'starter' is the name of this angular module example (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'
// 'starter.services' is found in services.js
// 'starter.controllers' is found in controllers.js
angular.module('naboo', ['ionic', 
    'naboo.controllers', 
    'naboo.services', 
    'naboo.directives', 
    'naboo.filters', 
    'naboo.templates', 
    'config', 
    'angularMoment'])

.run(function($ionicPlatform, $rootScope, LocationManager, $log, store, webq, $ionicLoading, amMoment, Messages, $timeout, Msg) {

    amMoment.changeLocale('zh-cn');

    $rootScope.showLoading = function(msg) {
        if (!msg) {
            msg = '加载中...';
        }

        var content = '<ion-spinner></ion-spinner>';
        content += '<h3>';
        content += msg;
        content += '</h3>';
        $ionicLoading.show({
            template: msg
        });
    };

    /**
     * check the wechat installation env
     */
    $rootScope.WILDFIRE_WECHAT_PLATFORM = (function() {
        var u = navigator.userAgent,
            app = navigator.appVersion;
        if (u.indexOf('Android') > -1 || u.indexOf('Linux') > -1) {
            return 'Android';
        } else if (!!u.match(/\(i[^;]+;( U;)? CPU.+Mac OS X/)) {
            return 'iOS';
        } else {
            return 'UNKNOWN';
        }
    })();

    $rootScope.hideLoading = function() {
        $ionicLoading.hide();
    };

    // error handler
    var errorMsg = {
        0: '网络出错啦，请再试一下',
        'wrong accessToken': '授权失败'
    };
    $rootScope.requestErrorHandler = function(options, callback) {
        return function(response) {
            var error;
            if (response.data && response.data.error_msg) {
                error = errorMsg[response.data.error_msg];
            } else {
                error = errorMsg[response.status] || 'Error: ' + response.status + ' ' + response.statusText;
            }
            var o = options || {};
            angular.extend(o, {
                template: error,
                duration: 1000
            });
            $ionicLoading.show(o);
            return callback && callback();
        };
    };
    $rootScope.message_not_read_count = 0;
    if (store.getAccessToken()) {
        Msg.alert(store.getAccessToken());
        Messages.getMessageCount().$promise.then(function(response) {
            $timeout(function() {
                // console.log(response.data);
                $rootScope.message_not_read_count = response.data;
            });
        });
    }
})

.config(function($compileProvider) {
    $compileProvider.imgSrcSanitizationWhitelist(/^\s*(https?|local|data):/);
    $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|mailto|tel|sms|chrome-extension):/);
})

// global config for uniform ui for different platform
.config(function($ionicConfigProvider) {
    $ionicConfigProvider.scrolling.jsScrolling('false');
    $ionicConfigProvider.views.transition('ios');
    $ionicConfigProvider.tabs.style('standard');
    $ionicConfigProvider.tabs.position('bottom');
    $ionicConfigProvider.navBar.alignTitle('center');
    $ionicConfigProvider.form.checkbox('square');
    $ionicConfigProvider.form.toggle('small');
    $ionicConfigProvider.backButton.text('');
    $ionicConfigProvider.backButton.previousTitleText('false');
})

.config(function($stateProvider, $urlRouterProvider, $logProvider) {
    $logProvider.debugEnabled(false); // turn off log
    /**
     * more about ui-router
     * http://angular-ui.github.io/ui-router/site/
     */


    // Ionic uses AngularUI Router which uses the concept of states
    // Learn more here: https://github.com/angular-ui/ui-router
    // Set up the various states which the app can be in.
    // Each state's controller can be found in controllers.js
    $stateProvider

    // setup an abstract state for the tabs directive
        .state('tab', {
        url: "/tab",
        abstract: true,
        templateUrl: "templates/tabs.html"
    })

    // Each tab has its own nav history stack:
    .state('tab.index', {
        url: '/index/:tab',
        views: {
            'tab-index': {
                templateUrl: 'templates/tab-index.html',
                controller: 'IndexCtrl'
            }
        }
    })

    .state('tab.maps', {
        url: '/maps/:tab',
        views: {
            'tab-maps': {
                templateUrl: 'templates/tab-maps.html',
                controller: 'MapsCtrl'
            }
        }
    })

    .state('item', {
        url: '/item/:itemId',
        cache: false,
        templateUrl: 'templates/item.html',
        controller: 'ItemCtrl'
    })

    .state('post', {
        cache: false,
        url: '/post',
        templateUrl: 'templates/tab-post.html',
        controller: 'PostCtrl'
        // ,
        // resolve: {
        //     wxWrapper: function(WeChat) {
        //         return WeChat.getWx();
        //     }
        // }
    })

    .state('tab.inbox', {
        url: '/inbox',
        views: {
            'tab-inbox': {
                templateUrl: 'templates/tab-inbox.html',
                controller: 'InboxCtrl'
            }
        }
    })

    .state('tab.account', {
        url: '/account',
        views: {
            'tab-account': {
                templateUrl: 'templates/tab-account.html',
                controller: 'AccountCtrl',
                resolve: {
                    myProfile: function(webq) {
                        return webq.getMyProfileResolve();
                    },
                    myTopics: function(webq) {
                        return webq.getMyTopicsResolve();
                    }
                }
            }
        }
    })

    .state('settings', {
        cache: false,
        url: '/settings',
        templateUrl: 'templates/settings/index.html',
        controller: 'SettingsCtrl'
    })

    .state('service-agreement', {
        cache: false,
        url: '/service-agreement',
        templateUrl: 'templates/settings/service-agreement.html',
        controller: 'SettingsCtrl'
    })

    .state('feedback', {
        cache: false,
        url: '/feedback',
        templateUrl: 'templates/settings/feedback.html',
        controller: 'SettingsCtrl'
    })

    .state('about', {
        cache: false,
        url: '/about',
        templateUrl: 'templates/settings/about.html',
        controller: 'SettingsCtrl'
    })

    .state('help', {
        cache: false,
        url: '/help',
        templateUrl: 'templates/settings/help.html',
        controller: 'SettingsCtrl'
    })

    .state('bind-mobile-phone', {
        cache: false,
        url: '/bind-mobile-phone/:accessToken/:md5',
        templateUrl: 'templates/bind-mobile-phone.html',
        controller: 'BindMobilePhoneCtrl'
    })

    .state('bind-access-token', {
        cache: false,
        url: '/bind-access-token/:accessToken/:md5',
        templateUrl: 'templates/bind-access-token.html',
        controller: 'BindAccessTokenCtrl'
    });

    // if none of the above states are matched, use this as the fallback
    $urlRouterProvider.otherwise('/tab/index/');

});
