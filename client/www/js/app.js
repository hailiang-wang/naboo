// Ionic naboc App

// angular.module is a global place for creating, registering and retrieving Angular modules
// 'naboc' is the name of this angular module example (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'
// 'naboc.services' is found in services.js
// 'naboc.controllers' is found in controllers.js
angular.module('naboc', ['ionic', 'naboc.controllers', 'naboc.services'])

.run(function($ionicPlatform) {
    $ionicPlatform.ready(function() {
        // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
        // for form inputs)
        if (window.cordova && window.cordova.plugins && window.cordova.plugins.Keyboard) {
            cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
        }
        if (window.StatusBar) {
            // org.apache.cordova.statusbar required
            StatusBar.styleLightContent();
        }
    });
})

.config(function($stateProvider, $urlRouterProvider) {

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

    .state('tab.activity', {
        url: '/activity',
        views: {
            'tab-activity': {
                templateUrl: 'templates/tab-activity.html',
                controller: 'ActivityCtrl'
            }
        }
    })

    .state('tab.people', {
            url: '/people',
            views: {
                'tab-people': {
                    templateUrl: 'templates/tab-people.html',
                    controller: 'PeopleCtrl'
                }
            }
        })
        .state('tab.people-detail', {
            url: '/people/:peopleId',
            views: {
                'tab-people': {
                    templateUrl: 'templates/people-detail.html',
                    controller: 'PeopleDetailCtrl'
                }
            }
        })

    .state('tab.account', {
        url: '/account',
        views: {
            'tab-account': {
                templateUrl: 'templates/tab-account.html',
                controller: 'AccountCtrl'
            }
        }
    });

    // if none of the above states are matched, use this as the fallback
    $urlRouterProvider.otherwise('/tab/activity');

});
