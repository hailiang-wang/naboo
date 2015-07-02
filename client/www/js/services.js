angular.module('naboc.services', [])


.factory('Msg', function($ionicLoading, $q, $timeout, $ionicPopup) {
    function Msg(msg) {
        if (msg == 'hide') {
            Msg.hide();
            return;
        }

        var d = $q.defer();
        Msg.showOneSecond(msg, d);

        return d.promise;
    }

    Msg.showOneSecond = function(msg, d) {
        msg = '<h4>' + msg + '</h4>';
        $ionicLoading.show({
            template: '<ion-spinner></ion-spinner> ' + msg
        });
        $timeout(function() {
            $ionicLoading.hide();
            d.resolve();
        }, 1000);
    }

    Msg.show = function(msg) {
        msg = '<h4>' + msg + '</h4>';
        $ionicLoading.show({
            template: '<ion-spinner></ion-spinner>' + msg
        });
    }

    Msg.hide = function() {
        $ionicLoading.hide();
    }

    Msg.alert = function(msg) {
        var alertPopup = $ionicPopup.alert({
            title: '',
            template: '<h4 class="text-center">' + msg + '</h4>'
        });
    }

    return Msg;
})


.factory('Chats', function() {
    // Might use a resource here that returns a JSON array

    // Some fake testing data
    var chats = [{
        id: 0,
        name: 'Ben Sparrow',
        lastText: 'You on your way?',
        face: 'https://pbs.twimg.com/profile_images/514549811765211136/9SgAuHeY.png'
    }, {
        id: 1,
        name: 'Max Lynx',
        lastText: 'Hey, it\'s me',
        face: 'https://avatars3.githubusercontent.com/u/11214?v=3&s=460'
    }, {
        id: 2,
        name: 'Adam Bradleyson',
        lastText: 'I should buy a boat',
        face: 'https://pbs.twimg.com/profile_images/479090794058379264/84TKj_qa.jpeg'
    }, {
        id: 3,
        name: 'Perry Governor',
        lastText: 'Look at my mukluks!',
        face: 'https://pbs.twimg.com/profile_images/598205061232103424/3j5HUXMY.png'
    }, {
        id: 4,
        name: 'Mike Harrington',
        lastText: 'This is wicked good ice cream.',
        face: 'https://pbs.twimg.com/profile_images/578237281384841216/R3ae1n61.png'
    }];

    return {
        all: function() {
            return chats;
        },
        remove: function(chat) {
            chats.splice(chats.indexOf(chat), 1);
        },
        get: function(chatId) {
            for (var i = 0; i < chats.length; i++) {
                if (chats[i].id === parseInt(chatId)) {
                    return chats[i];
                }
            }
            return null;
        }
    };
})


/**
 * Manage Topics
 * Creating a CRUD App in Minutes with Angular’s $resource
 * http://www.sitepoint.com/creating-crud-app-minutes-angulars-resource/
 * @param  {[type]} cfg         [description]
 * @param  {[type]} $resource   [description]
 * @param  {Object} $log)       {                   var User [description]
 * @param  {[type]} function(r) {                                               $log.debug('get topics tab:', tab, 'page:', page, 'data:', r.data);                return callback && callback(r [description]
 * @return {[type]}             [description]
 */
.factory('Topics', function(cfg, $resource, $log, $rootScope) {
    var User = {}; //do it later
    var topics = [];
    var currentTab = 'all';
    var nextPage = 1;
    var hasNextPage = true;
    var text = null;
    var lng = null;
    var lat = null;
    var resource = $resource(cfg.api + '/topics', {}, {
        query: {
            method: 'get',
            params: {
                tab: 'all',
                page: 1,
                limit: 10,
                mdrender: true
            },
            timeout: 20000
        }
    });
    var getTopics = function(tab, page, text, callback) {
        return resource.query({
            tab: tab,
            page: page,
            text: text,
            lng: lng,
            lat: lat
        }, function(r) {
            $log.debug('get topics tab:', tab, 'page:', page, 'data:', r.data);
            return callback && callback(r);
        });
    };
    return {
        refresh: function() {
            return getTopics(currentTab, 1, text, function(response) {
                nextPage = 2;
                hasNextPage = true;
                topics = response.data;
            });
        },
        pagination: function() {
            return getTopics(currentTab, nextPage, text, function(response) {
                if (response.data.length < 10) {
                    $log.debug('response data length', response.data.length);
                    hasNextPage = false;
                }
                nextPage++;
                topics = topics.concat(response.data);
            });
        },
        currentTab: function(newTab) {
            if (typeof newTab !== 'undefined') {
                currentTab = newTab;
            }
            return currentTab;
        },
        hasNextPage: function(has) {
            if (typeof has !== 'undefined') {
                hasNextPage = has;
            }
            return hasNextPage;
        },
        resetData: function() {
            topics = [];
            text = {};
            nextPage = 1;
            hasNextPage = true;
        },
        getTopics: function() {
            return topics;
        },
        setQuery: function(query) {
            text = query;
        },
        setGeom: function(geom) {
            $log.debug('setGeom', JSON.stringify(geom));
            lng = geom.lng;
            lat = geom.lat;
        },
        getById: function(id) {

            if (!!topics) {
                for (var i = 0; i < topics.length; i++) {
                    if (topics[i].id === id) {
                        return topics[i];
                    }
                }
            } else {
                return null;
            }
        },
        saveNewTopic: function(newTopicData) {
            var currentUser = User.getCurrentUser();
            return resource.save({
                accesstoken: currentUser.accesstoken
            }, newTopicData);
        }
    };
})


.factory('Topic', function(cfg, $resource, $log, $q, store) {
    //var User = {};
    // make sure the user is logged in
    // before using saveReply.

    /**
     * Get current user from local store or resolve from server.
     * But if there is no accessToken in store.getAccessToken(),
     * it means there is none logged in user in current session.
     *
     * @type {Object}
     */
    var Settings = {};
    var topic;
    var resource = $resource(cfg.api + '/topic/:id?accesstoken=' + store.getAccessToken(), {
        id: '@id'
    }, {
        complain: {
            method: 'post',
            url: cfg.api + '/topic/complain'
        },
        collect: {
            method: 'post',
            url: cfg.api + '/topic/collect'
        },
        deCollect: {
            method: 'post',
            url: cfg.api + '/topic/de_collect'
        },
        reply: {
            method: 'post',
            url: cfg.api + '/topic/:topicId/replies',
            timeout: 2000
        },
        upReply: {
            method: 'post',
            url: cfg.api + '/reply/:replyId/ups'
        }
    });
    return {
        getById: function(id) {
            if (topic !== undefined && topic.id === id) {
                var topicDefer = $q.defer();
                topicDefer.resolve({
                    data: topic
                });
                return {
                    $promise: topicDefer.promise
                };
            }
            return this.get(id);
        },
        get: function(id) {
            return resource.get({
                id: id
            }, function(response) {
                topic = response.data;
            });
        },
        saveReply: function(topicId, replyData) {
            var reply = angular.extend({}, replyData);
            return resource.reply({
                topicId: topicId,
                accesstoken: store.getAccessToken()
                    //accesstoken: '5447b4c3-0006-4a3c-9903-ac5a803bc17e'
            }, reply);
        },
        upReply: function(replyId) {
            var currentUser = User.getCurrentUser();
            return resource.upReply({
                replyId: replyId,
                accesstoken: store.getAccessToken()
            }, null, function(response) {
                if (response.success) {
                    angular.forEach(topic.replies, function(reply, key) {
                        if (reply.id === replyId) {
                            if (response.action === 'up') {
                                reply.ups.push(currentUser.id);
                            } else {
                                reply.ups.pop();
                            }
                        }
                    });
                } else {
                    $log(response);
                }
            });
        },
        complainTopic: function(topicId, description) {
            return resource.complain({
                topicId: topicId,
                description: description,
                accesstoken: store.getAccessToken()
            });
        },
        collectTopic: function(topicId) {
            console.log(topicId, store.getAccessToken());
            return resource.collect({
                topic_id: topicId,
                accesstoken: store.getAccessToken()
            });
        },
        deCollectTopic: function(topicId) {
            return resource.deCollect({
                topic_id: topicId,
                accesstoken: store.getAccessToken()
            });
        }
    };
})


/**
 * HTML5 Local Storage
 * http://www.w3schools.com/html/html5_webstorage.asp
 *
 * With local storage, web applications can store data locally within the user's browser.

Before HTML5, application data had to be stored in cookies, included in every server request. Local storage is more secure, and large amounts of data can be stored locally, without affecting website performance.

Unlike cookies, the storage limit is far larger (at least 5MB) and information is never transferred to the server.

Local storage is per domain. All pages, from one domain, can store and access the same data.
 *
 * window.localStorage - stores data with no expiration date
 * window.sessionStorage - stores data for one session (data is lost when the tab is closed)
 *
 * http://www.w3schools.com/html/html5_webstorage.asp
 * In wechat, the localStorage/sessionStorage may be clean up
 * in days.
 */
.service('store', function($log, cfg) {

    var self = this;
    var itemsService = {};

    function _setItem(key, value) {
        _removeItem(key);
        itemsService[key] = value;
    }

    function _getItem(key) {
        return itemsService[key];
    }

    function _removeItem(key) {
        delete itemsService[key];
    }

    this.setAccessToken = function(data) {
        _setItem('NABOO_ACCESS_TOKEN', data);
    };

    this.getAccessToken = function() {
        return _getItem('NABOO_ACCESS_TOKEN');
    };

    this.deleteAccessToken = function() {
        _removeItem('NABOO_ACCESS_TOKEN');
    };

    /**
     * save user profile data into sessionStorage
     * @param {json} data json object of this user
     */
    this.setUserProfile = function(data) {
        _setItem('NABOO_USER_PROFILE', data);
    };

    this.getUserProfile = function() {
        return _getItem('NABOO_USER_PROFILE');
    };

    this.deleteUserProfile = function() {
        _removeItem('NABOO_USER_PROFILE');
    };

    /**
     * get the cached location detail
     * @return {[type]} [description]
     */
    this.getLocationDetail = function() {
        return _getItem('NABOO_LOCATION_DETAIL');
    };

    /**
     * set location into cache
     * @param {[type]} data [description]
     * use sessionStorage to drop the data.
     */
    this.setLocationDetail = function(data) {
        _setItem('NABOO_LOCATION_DETAIL', data);
    };

    this.deleteLocationDetail = function() {
        _removeItem('NABOO_LOCATION_DETAIL');
    }

    this.setWechatSignature = function(data) {
        _setItem('NABOO_WECHAT_SIGNATURE', data);
    }

    this.getWechatSignature = function() {
        return _getItem('NABOO_WECHAT_SIGNATURE');
    }

    this.deleteWechatSignature = function() {
        _removeItem('NABOO_WECHAT_SIGNATURE');
    }

    this.clear = function() {
        var keys = _.keys(itemsService);
        keys.forEach(function(x) {
            if (key !== 'NABOO_ACCESS_TOKEN') {
                _removeItem(x);
            }
        });
    }
})

/**
 * communicate with server, post/get request, return promise.
 * @param  {[type]} $http [description]
 * @param  {[type]} $q    [description]
 * @param  {[type]} $log  [description]
 * @param  {[type]} cfg)  {               this.sendVerifyCode [description]
 * @return {[type]}       [description]
 */
.service('webq', function($http, $q, $log, cfg, store, Msg, $timeout) {

    var self = this;

    /**
     * upload wechat images
     * @return {[type]} [description]
     */
    this.uploadWechatImages = function(serverIds) {
        var deferred = $q.defer();
        $http.post('{0}/ionic/wechat-images'.f(cfg.api), {
                accesstoken: store.getAccessToken(),
                serverIds: serverIds
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            })
            .success(function(result) {
                // get the result in
                // https://github.com/arrking/NABOO/issues/54
                if (result.rc == 0) {
                    /**
                     * msg
                     * [{serverId, imageUrl}]
                     */
                    deferred.resolve(result.msg);
                } else {
                    deferred.reject(result);
                }
            })
            .error(function(err) {
                deferred.reject(err);
            });

        return deferred.promise;
    }

    this.sendVerifyCode = function(phoneNumber) {
        var deferred = $q.defer();

        $http.post('{0}/user/bind_phone_number'.f(cfg.api), {
                phoneNumber: phoneNumber,
                accesstoken: store.getAccessToken()
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            })
            .success(function(data) {
                if (typeof data === 'object' && data.rc === 0) {
                    deferred.resolve(data);
                } else {
                    deferred.reject(data);
                }
            })
            .error(function(err) {
                deferred.reject(err);
            });

        return deferred.promise;
    }

    this.checkVerifyCode = function(phoneNumber, verifyCode) {
        var deferred = $q.defer();

        $http.post('{0}/user/check_phone_verifycode'.f(cfg.api), {
                accesstoken: store.getAccessToken(),
                code: verifyCode,
                phoneNumber: phoneNumber
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            })
            .success(function(result) {
                if (typeof result == 'object' && result.rc == 0) {
                    deferred.resolve(result);
                } else {
                    deferred.reject(result);
                }
            })
            .error(function(err) {
                deferred.reject(err);
            });
        return deferred.promise;
    }

    this.getUserProfile = function() {
        var deferred = $q.defer();
        $http.post('{0}/accesstoken'.f(cfg.api), {
                accesstoken: store.getAccessToken()
            })
            .success(function(data) {
                if (data.success) {
                    deferred.resolve(data.profile);
                } else {
                    deferred.reject(data);
                }
            })
            .error(function(err) {
                deferred.reject(err);
            });
        return deferred.promise;
    }

    this.createNewGoods = function(params) {
        var deferred = $q.defer();
        // https://github.com/arrking/NABOO/issues/53
        var postData = {
            /*debug*/
            // accesstoken: 'd8e60e1f-b4ba-4a1b-9eaa-56e9f6a8d5f0',
            accesstoken: store.getAccessToken(),
            title: params.title,
            tab: params.tab,
            content: params.content,
            goods_pics: params.goods_pics,
            goods_quality_degree: params.quality,
            goods_pre_price: params.goods_pre_price,
            goods_now_price: params.goods_now_price,
            goods_is_bargain: params.goods_is_bargain,
            goods_exchange_location: params.goods_exchange_location,
            goods_status: params.goods_status
        };
        $http.post('{0}/topics'.f(cfg.api), postData)
            .success(function(data) {
                deferred.resolve(data);
            })
            .error(function(err) {
                $log.debug(JSON.stringify(err));
                deferred.reject(err);
            });
        return deferred.promise;
    }

    /**
     * retrieve topics by userId from backend service.
     * Should always return as resolve, even has error.
     * because the controller is depended on the resolve
     * state, when get an error, resolve as undefined.
     * See AccountCtrl
     * @return {[type]} [description]
     */
    this.getMyTopicsResolve = function() {
        var deferred = $q.defer();

        $http.get('{0}/user/my_topics?accesstoken={1}'.f(cfg.api,
                store.getAccessToken()
                // for debug usage in local machine
                // 'e26b54f0-6ca2-4eb7-97ae-a52c6af268dc'
            ))
            .success(function(data) {
                if (data.rc === 1) {
                    deferred.resolve(data.msg);
                } else {
                    deferred.resolve();
                }
            })
            .error(function(err) {
                deferred.resolve();
            });

        return deferred.promise;
    }

    /**
     * getMyCollectionResolve() returns current user's collection
     *
     * @author Lyman
     * @return collectionList
     */
    this.getMyCollectionResolve = function() {
        var deferred = $q.defer();
        // TODO: add pagination function
        var page = 1;
        $http.get('{0}/user/my_collection/?accesstoken={1}&page={2}'.f(cfg.api,
                store.getAccessToken(),
                page
            ))
            .success(function(data) {
                // console.log(data);
                if (data.rc === 1) {
                    deferred.resolve(data.msg.topics);
                } else {
                    deferred.resolve();
                }
            })
            .error(function(err) {
                deferred.resolve();
            });

        return deferred.promise;
    }

    /**
     * put my topic into off shelf status
     * @param  {[type]} item [description]
     * @return {[type]}      [description]
     */
    this.updateMyTopic = function(topic) {
        var deferred = $q.defer();
        $http.put('{0}/topic/{1}'.f(cfg.api, topic._id), {
                accesstoken: store.getAccessToken(),
                // for debug usage in local machine
                // accesstoken: 'e26b54f0-6ca2-4eb7-97ae-a52c6af268dc',
                topic: topic
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            })
            .success(function(data) {
                if (typeof(data) === 'object' && data.rc === 0) {
                    deferred.resolve(data.latest);
                } else {
                    // https://github.com/arrking/NABOO/issues/75
                    // Get more details about failure response
                    deferred.reject(data);
                }
            })
            .error(function(err) {
                deferred.reject(err);
            });
        return deferred.promise;
    }

    /**
     * get user profile as resolve state
     * @return {[type]} [description]
     */
    this.getMyProfileResolve = function() {
        var deferred = $q.defer();
        // attempt to get user profile data with cookie
        this.getUserProfile()
            .then(function(data2) {
                store.setUserProfile(data2);
                deferred.resolve(data2);
            })
            .catch(function(err) {
                $log.warn('getUserProfileResolve');
                $log.warn(err);
                deferred.resolve();
            });

        return deferred.promise;
    }


    /**
     * submit feedback
     */
    this.submitFeedback = function(content) {
        var deferred = $q.defer();
        $http.post('{0}/ionic/feedback'.f(cfg.api), {
                accesstoken: store.getAccessToken(),
                content: content
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            })
            .success(function(data) {
                $log.debug('Get feedback response: ' + JSON.stringify(data));
                if (data && data.rc === 0) {
                    deferred.resolve();
                } else {
                    deferred.reject();
                }
            })
            .error(function(err) {
                $log.error('Get error response when submitting feedback.');
                $log.error(err);
                deferred.reject();
            });

        return deferred.promise;
    }

    // get user service agreements in markdown format
    this.getUserServiceAgreements = function() {
        var defer = $q.defer();
        $http({
            method: 'GET',
            url: '{0}/ionic/user-service-agreements'.f(cfg.api)
        }).success(function(data, status, headers, config) {
            var converter = new Showdown.converter();
            defer.resolve(converter.makeHtml(data));
        }).error(function(err, status) {
            $log.error('Can not get /ionic/user-service-agreements from server.');
            defer.reject(err);
        });
        return defer.promise;
    };


    /**
     * Ding my topic
     * Update update_at value, so the record would
     * display at top in index page.
     */
    this.dingMyTopic = function(topic) {
        var deferred = $q.defer();

        $http.post('{0}/topic/ding'.f(cfg.api), {
                accesstoken: store.getAccessToken(),
                // accesstoken: 'e26b54f0-6ca2-4eb7-97ae-a52c6af268dc',
                topicId: topic._id
            })
            .success(function(data) {
                if (typeof(data) == 'object' &&
                    data.rc == 0) {
                    deferred.resolve();
                } else {
                    deferred.reject();
                }
            })
            .error(function(err) {
                deferred.reject();
            });

        return deferred.promise;
    };

    this.showSlidePreview = function(current, urls) {
        Msg.show('加载中...');

        var newArr = urls.slice(0);
        current = cfg.server + current;
        for (var i in newArr) {
            newArr[i] = cfg.server + newArr[i];
        }
        WeChat.getWx()
            .then(function(wxWrapper) {
                wxWrapper.previewImage({
                    current: current, // 当前显示的图片链接
                    urls: newArr // 需要预览的图片链接列表
                });
            }, function(err) {
                Msg('加载错误');
            }).finally(function() {
                Msg('hide');
            });
    };


    this.setPostGoodsLocation = function(postGoodsLocationDetail) {
        $log.debug('set post goods location detail', JSON.stringify(postGoodsLocationDetail));
        self._postGoodsLocationDetail = postGoodsLocationDetail;
    };

    this.getPostGoodsLocation = function() {
        $log.debug('get post goods location detail', JSON.stringify(this._postGoodsLocationDetail));
        return self._postGoodsLocationDetail;
    };

    /**
     * Support provide Callback URL in user authentication service
     * https://github.com/arrking/NABOO/issues/128
     * get hash state value by md5
     */
    this.getHashStateValByMd5 = function(md5) {
        var deferred = $q.defer();

        $http.post('{0}/ionic/state'.f(cfg.api), {
                md5: md5
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            })
            .success(function(data) {
                if (data && data.rc === 0) {
                    console.log('Get state value ' + data.msg);
                    deferred.resolve(data.msg);
                } else {
                    console.error('Get state request ' + JSON.stringify(data))
                    deferred.reject(data);
                }
            })
            .error(function(err) {
                deferred.reject(err);
            });

        return deferred.promise;
    }

    /**
     * Get app git revision as build number
     * @return {[type]} [description]
     */
    this.getAppGitRevision = function() {
        var deferred = $q.defer();
        $http.get('{0}/ionic/app-revision'.f(cfg.api))
            .success(function(data) {
                if (data && data.rc === 1) {
                    deferred.resolve(data.revision);
                } else {
                    deferred.reject();
                }
            })
            .error(function(err) {
                deferred.reject(err);
            })

        return deferred.promise;
    }

    /**
     * [enableWechatNotify description]
     * @return {[type]} [description]
     */
    this.enableWechatNotify = function() {
        var deferred = $q.defer();
        $http.post('{0}/user/wechat-notify-enable'.f(cfg.api), {
                accesstoken: store.getAccessToken()
            })
            .success(function(data) {
                if (data && data.rc === 3) {
                    deferred.resolve();
                } else {
                    deferred.reject();
                }
            })
            .error(function(err) {
                deferred.reject();
            });

        return deferred.promise;
    }

    /**
     * disable wechat notify
     * @return {[type]} [description]
     */
    this.disableWechatNotify = function() {
        var deferred = $q.defer();
        $http.post('{0}/user/wechat-notify-disable'.f(cfg.api), {
                accesstoken: store.getAccessToken()
            })
            .success(function(data) {
                if (data && data.rc === 3) {
                    deferred.resolve();
                } else {
                    deferred.reject();
                }
            })
            .error(function(err) {
                deferred.reject();
            });

        return deferred.promise;
    }
});
