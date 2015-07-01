angular.module('naboo.controllers', [])

.controller('IndexCtrl', function($scope, $rootScope,
    $stateParams,
    $ionicLoading,
    $ionicModal,
    $ionicPopup,
    $timeout,
    $state,
    $location,
    LocationManager,
    $rootScope,
    $log,
    Msg,
    Topics,
    Topic,
    User,
    webq,
    Tabs,
    cfg
) {
    $scope.sideMenus = Tabs.getList();
    $stateParams.tab = $stateParams.tab || 'all';
    $scope.menuTitle = Tabs.getLabel($stateParams.tab);
    $scope.img_prefix = cfg.server;

    $scope.currentTab = Topics.currentTab();
    // $scope.loadingMsg = '正在获取您的位置...';

    //cheat solution
    // function loadDataAfterGetLocation() {
    $scope.loadingMsg = '正在搜索您附近得二手信息...';
    // check if tab is changed
    if ($stateParams.tab !== Topics.currentTab()) {
        $scope.currentTab = Topics.currentTab($stateParams.tab);
        // reset data if tab is changed
        console.log('reset Data');
        Topics.resetData();
    }

    // $scope.topics = Topics.getTopics();

    // pagination
    // $scope.hasNextPage = Topics.hasNextPage();
    // $scope.loadError = false;
    // $log.debug('page load, has next page ? ', $scope.hasNextPage);
    $scope.doRefresh = function() {
        Topics.currentTab($stateParams.tab);
        $log.debug('do refresh');
        Topics.refresh().$promise.then(function(response) {
            $log.debug('do refresh complete');
            $scope.topics = response.data;
            console.log(response.data.length);
            // console.log(JSON.stringify(response.data));
            $scope.hasNextPage = true;
            $scope.loadError = false;
            if ($scope.topics.length === 0) {
                $scope.loadingMsg = '找不到符合你要求的二手交易信息^_^';
            } else {
                $scope.loadingMsg = '下拉加载更多';
            }
        }, $rootScope.requestErrorHandler({
            noBackdrop: true
        }, function() {
            $scope.loadError = true;
        })).finally(function() {
            $scope.$broadcast('scroll.refreshComplete');
        });
    };
    $scope.loadMore = function() {
        $log.debug('load more');
        Topics.pagination().$promise.then(function(response) {
            console.log(response.data);
            $scope.hasNextPage = false;
            $scope.loadError = false;
            $timeout(function() {
                $scope.hasNextPage = Topics.hasNextPage();
                console.log('hasNextPage', $scope.hasNextPage);
                if ($scope.hasNextPage == false)
                    $scope.loadingMsg = '附近没有其它的二手交易信息^_^，看看别的地方吧!';
                if (!$scope.topics) {
                    $scope.topics = [];
                }
                $scope.topics = $scope.topics.concat(response.data);
                // $scope.$digest();
            }, 100);

        }, $rootScope.requestErrorHandler({
            noBackdrop: true
        }, function() {
            $scope.loadError = true;
        })).finally(function() {
            $scope.$broadcast('scroll.infiniteScrollComplete');
        });
    };

    $scope.changeSelected = function(item) {
            $state.go('tab.index', {
                tab: item.value
            });
            $scope.menuTitle = item.label;
            $stateParams.tab = item.value;

            $scope.currentTab = Topics.currentTab($stateParams.tab);
            $scope.doRefresh();
        }
        // }

    /***********************************
     * Search
     ***********************************/
    $scope.tabTitle = '首页';
    $scope.SearchText = '搜索';
    $scope.showSearch = false;
    $scope.doSearch = function(query) {
        if (!($scope.showSearch)) {
            $scope.showSearch = true;
            $log.debug('showSearch');
            return;
        }
        $log.debug('doSearch');
        if (!query) {
            $scope.showSearch = false;
        }
        Topics.setQuery(query);
        // Topics.setGeom({lng:140,lat:40.4});
        $scope.doRefresh();
        $log.debug('searchText', query);
        // $scope.tabTitle = query || $scope.address;
    }
    $scope.showAddress = function() {
        var location = LocationManager.getLocation();
        var popup = $ionicPopup.alert({
            title: '当前位置',
            template: '<h4 class="text-center">' + location.api_address + '</h4>'
        });
    }

    function loadData() {
        console.log('loadData trigger');
        var location = LocationManager.getLocation();
        $scope.address = location.user_edit_address;
        $scope.tabTitle = location.user_edit_address;
        Topics.setGeom(location);
        $scope.doRefresh();
    }

    LocationManager.getLocationFromAPI().then(loadData).catch(function(err) {
        LocationManager.showLocationSelector();
    });

    $rootScope.$on('location.updated', loadData);

    $scope.collectTopic = function(topic) {
        if (topic.isCollected) {
            console.log(topic.isCollected);
            Topic.deCollectTopic(topic.id).$promise.then(function(response) {
                console.log('done with decollected', JSON.stringify(response));
                if (response.success) {
                    topic.isCollected = false;
                    if (!topic.collect_count) {
                        topic.collect_count = 1;
                    }
                    topic.collect_count = parseInt(topic.collect_count) - 1;
                    User.deCollectTopic(topic.id);
                }
            });
        } else {
            console.log(topic.isCollected);
            Topic.collectTopic(topic.id).$promise.then(function(response) {
                console.log('done with collected', JSON.stringify(response));
                if (response.success) {
                    topic.isCollected = true;
                    if (!topic.collect_count) {
                        topic.collect_count = 0;
                    }
                    topic.collect_count = parseInt(topic.collect_count) + 1;
                    User.collectTopic(topic.id);
                }
            });
        }
    };

})


.controller('MapsCtrl', function(
    $scope,
    $rootScope,
    $stateParams,
    $ionicLoading,
    $ionicModal,
    $ionicPopup,
    $timeout,
    LocationManager,
    $state,
    Msg,
    webq,
    store,
    $rootScope,
    $location,
    $log,
    Topics,
    Tabs,
    cfg
) {
    $scope.state = $state;

    $scope.sideMenus = Tabs.getList();
    $stateParams.tab = $stateParams.tab || 'all';
    $scope.menuTitle = Tabs.getLabel($stateParams.tab);
    $scope.img_prefix = cfg.server;

    $scope.currentTab = Topics.currentTab();

    $scope.changeSelected = function(item) {
        $state.go('tab.maps', {
            tab: item.value
        });
        $scope.menuTitle = item.label;
        $stateParams.tab = item.value;

        $scope.currentTab = Topics.currentTab($stateParams.tab);
        $scope.doRefresh();
    }

    /***********************************
     * Search
     ***********************************/
    $scope.tabTitle = '首页';
    $scope.SearchText = '搜索';
    $scope.showSearch = false;
    $scope.doSearch = function(query) {
        if (!($scope.showSearch)) {
            $scope.showSearch = true;
            $log.debug('showSearch');
            return;
        }
        $log.debug('doSearch');
        if (!query) {
            $scope.showSearch = false;
        }
        Topics.setQuery(query);
        // Topics.setGeom({lng:140,lat:40.4});
        $scope.doRefresh();
        $log.debug('searchText', query);
        // $scope.tabTitle = query || '首页';
    }

    $scope.showFullAddress = function() {
        var location = LocationManager.getLocation();
        var popup = $ionicPopup.alert({
            title: '当前位置',
            template: '<h4 class="text-center">' + location.api_address + '</h4>'
        });
    }

    // function loadDataAfterGetLocation() {
    //     $scope.loadingMsg = '正在搜索您附近得二手信息...';
    //     if ($stateParams.tab !== Topics.currentTab()) {
    //         $scope.currentTab = Topics.currentTab($stateParams.tab);
    //         Topics.resetData();
    //     }

    //     $scope.topics = Topics.getTopics();
    //     $scope.loadError = false;
    $scope.doRefresh = function() {
        Topics.currentTab($stateParams.tab);
        $log.debug('do refresh');
        Topics.refresh().$promise.then(function(response) {
            $scope.topics = response.data;
            $scope.hasNextPage = true;
            $scope.loadError = false;
            if ($scope.topics.length == 0)
                $scope.loadingMsg = '附近没有其它的二手交易信息^_^，看看别的地方吧!';
            else
                $scope.loadingMsg = '下拉加载更多';
        }, $rootScope.requestErrorHandler({
            noBackdrop: true
        }, function() {
            $scope.loadError = true;
        })).finally(function() {
            $scope.$broadcast('scroll.refreshComplete');
        });
    };
    $scope.loadMore = function() {
        $log.debug('load more');
        Topics.pagination().$promise.then(function(response) {
            $log.debug('load more complete');
            $scope.hasNextPage = false;
            $scope.loadError = false;
            $timeout(function() {
                $scope.hasNextPage = Topics.hasNextPage();
                $log.debug('has next page ? ', $scope.hasNextPage);
                if ($scope.hasNextPage == false)
                    $scope.loadingMsg = '附近没有新的二手交易信息^_^，试试其他地方吧';

            }, 100);
            $scope.topics = $scope.topics.concat(response.data);
        }, $rootScope.requestErrorHandler({
            noBackdrop: true
        }, function() {
            $scope.loadError = true;
        })).finally(function() {
            $scope.$broadcast('scroll.infiniteScrollComplete');
        });
    };
    // }

    if ($stateParams.tab !== Topics.currentTab()) {
        $scope.currentTab = Topics.currentTab($stateParams.tab);
        Topics.resetData();
    }

    $rootScope.$on('location.updated', function() {
        var locationDetail = LocationManager.getLocation();
        $scope.address = locationDetail.user_edit_address;

        $scope.topics = Topics.getTopics();
        $scope.loadError = false;

        Topics.setGeom(locationDetail);
        // loadDataAfterGetLocation();
        $scope.doRefresh();
    });
})

.controller('ItemCtrl', function(
    $scope,
    $rootScope,
    $stateParams,
    $timeout,
    $ionicLoading,
    $ionicPopup,
    $ionicActionSheet,
    LocationManager,
    $ionicScrollDelegate,
    $ionicSlideBoxDelegate,
    $log,
    Topics,
    Topic,
    Msg,
    webq,
    store,
    cfg,
    User
) {
    // 既不是调试，也不存在accesstoken
    // 注意，假设 BindAccessToken 也是成功获取Profile的
    if ((!store.getAccessToken()) && (!cfg.debug)) {
        $ionicLoading.show({
            template: '跳转到登录认证 ...'
        });
        $timeout(function() {
            window.location.href = '{0}/auth/wechat/embedded?redirect={1}'.f(cfg.server,
                JSON.stringify({
                    state: 'item',
                    stateParams: $stateParams
                }));
        }, 2000);
    } else if (store.getAccessToken() && (!cfg.debug)) {
        // 非调试，存在accesstoken
        var userProfile = store.getUserProfile();
        if (userProfile) {
            _renderPage();
            // do nothing
            // if (userProfile.phone_number) {
            //     // 用户已经绑定手机号！
            //     // do nothing
            // } else {
            //     $ionicLoading.show({
            //         template: '发布信息需要绑定手机号码 ...'
            //     });
            //     $timeout(function() {
            //         // 用户未绑定手机号
            //         $state.go('bind-mobile-phone', {
            //             accessToken: store.getAccessToken()
            //         });
            //     }, 2000);
            // }
        } else {
            Msg.alert('错误！无法获得登录用户信息。');
        }
    } else if ((!store.getAccessToken()) && cfg.debug) {
        // 调试，没有accesstoken
        // #TODO set accesstoken and user profile for debug.
        _renderPage();
    } else {
        // 调试, 有accesstoken
        // #TODO set user profile ?
        // 这种情况需要设置 user profile.
    }

    function _renderPage() {
        $log.debug('topic ctrl', $stateParams);
        var id = $stateParams.itemId;
        var topic = Topics.getById(id);
        $scope.topic = topic;
        $scope.img_prefix = cfg.server;
        $scope.avatar_prefix = cfg.api + '/avatar/';
        $scope.isSeller = false;
        $scope.status = {
            action: 'normal',
            showBargains: false
        }

        var location = LocationManager.getLocation();
        if (location && location.lat) {
            $scope.currentLocation = location;
        } else {
            LocationManager.getLocationFromAPI().then(function(location) {
                $scope.currentLocation = location;
            });
        }

        // before enter view event
        $scope.$on('$ionicView.beforeEnter', function() {
            $scope.status = {
                action: 'normal',
                showBargains: false
            }
            $scope.isSeller = false;
            // track view
            if (window.analytics) {
                window.analytics.trackView('topic view');
            }
        });
        $scope.$on('$ionicView.afterLeave', function() {});

        // load topic data
        $scope.loadTopic = function(reload) {
            var topicResource;
            if (reload === true) {
                topicResource = Topic.get(id);
            } else {
                topicResource = Topic.getById(id);
            }
            return topicResource.$promise.then(function(response) {
                $scope.topic = response.data;
                $ionicSlideBoxDelegate.update();
                $scope.isCollected = $scope.topic.in_collection;
                $scope.replies = [];
                $scope.bargains = [];
                $scope.topic.replies.forEach(function(item, i) {
                    if (typeof(item.price) != 'undefined') $scope.bargains.push(item);
                    else $scope.replies.push(item);
                });
                var profile = store.getUserProfile();
                if (profile && (profile.loginname == $scope.topic.author.loginname))
                    $scope.isSeller = true;
            }, $rootScope.requestErrorHandler({
                noBackdrop: true
            }, function() {
                $scope.loadError = true;
            }));
        };
        $scope.loadTopic();

        // detect if user has collected this topic
        var currentUser = User.getCurrentUser();
        $scope.isCollected = false;

        // do refresh
        $scope.doRefresh = function() {
            return $scope.loadTopic(true).then(function(response) {
                $log.debug('do refresh complete');
            }, function() {}).finally(function() {
                $scope.$broadcast('scroll.refreshComplete');
            });
        };

        $scope.replyData = {
            content: ''
        };

        // check if the current login or not.
        // popup the login options if not.
        $scope.isShownReplyInputBox = function() {
            if (!currentUser) {
                $log.warn('isShownReplyInputBox', 'none logged in.');
                $scope.showReply = false;
                // popup the selection to bring the
                // user into login page.
                // A confirm dialog
                $ionicPopup.confirm({
                        title: '提示',
                        template: '仅登陆用户可以回复内容，带我去微信认证登陆？',
                        cancelText: '残忍拒绝',
                        okText: '是'
                    })
                    .then(function(res) {
                        if (res) {
                            window.location.href = '{0}/auth/wechat/embedded'.f(cfg.server);
                        } else {
                            $log.debug('user choose not login.');
                        }
                    });
            } else {
                $scope.showReply = true;
            }
        }

        $scope.bargainTo = function(replyAuthor) {
            console.log(replyAuthor, $scope.topic.author);
            if ($scope.isSeller && replyAuthor && (replyAuthor.loginname == $scope.topic.author.loginname))
                return;
            $scope.status.showBargains = true;
            $scope.status.action = 'bid';
            $scope.replyData = {
                price: $scope.topic.goods_now_price,
                content: '便宜点我就收了'
            };
            if ($scope.isSeller) {
                $scope.replyData.replyTo = replyAuthor;
                $scope.replyData.content = '再加点我就卖了';
            }
        }

        $scope.replyTo = function(replyAuthor) {
            $scope.replyData = {
                content: ''
            };
            $scope.replyData.replyTo = replyAuthor;
            $scope.status.showBargains = false;
            $scope.status.action = 'reply';
        }

        function isPriceValidate(replyPrice, sellPrice) {
            var reg = /(^[-+]?[1-9]\d*(\.\d{1,2})?$)|(^[-+]?[0]{1}(\.\d{1,2})?$)/;
            var isValidate = reg.test(replyPrice);
            if (!isValidate) {
                console.log('503');
                return false;
            }
            replyPrice = parseFloat(replyPrice);
            sellPrice = parseFloat(sellPrice);
            if (replyPrice < 0 || replyPrice > sellPrice) {
                console.log('509');
                return false;
            }
            console.log('512');
            return true;
        }

        // save reply
        $scope.saveReply = function() {
            $log.debug('new reply data:', JSON.stringify($scope.replyData));

            if ($scope.status.action == 'bid') {
                if (!isPriceValidate($scope.replyData.price, $scope.topic.goods_now_price)) {
                    console.log('error');
                    Msg('价格填写有误，必须比售价低！');
                    return;
                }
            }
            if ($scope.replyData.content == '') {
                return $scope.showReply = false;
            }

            Msg.show('提交中，请稍候...');
            if ($scope.replyData.replyTo) {
                $scope.replyData.reply_to = $scope.replyData.replyTo.name;
                $scope.replyData.content = '@' + $scope.replyData.replyTo.loginname + ' ' + $scope.replyData.content;
            }
            Topic.saveReply(id, $scope.replyData).$promise.then(function(response) {
                $scope.replyData = {
                    content: ''
                };
                $log.debug('post reply response:', response);
                $scope.loadTopic(true).then(function() {
                    $ionicScrollDelegate.scrollBottom();
                });

                $scope.status.action = 'normal';
                $scope.showReply = false;
            }, function() {
                $rootScope.requestErrorHandler()
            }).finally(function() {
                Msg('hide');
            });
        };

        // collect topic
        $scope.collectTopic = function() {
            if ($scope.isCollected) {
                Topic.deCollectTopic(id).$promise.then(function(response) {
                    if (response.success) {
                        $scope.isCollected = false;
                        if (!$scope.topic.collect_count) {
                            $scope.topic.collect_count = 1;
                        }
                        $scope.topic.collect_count = parseInt($scope.topic.collect_count) - 1;
                        User.deCollectTopic(id);
                    }
                });
            } else {
                Topic.collectTopic(id).$promise.then(function(response) {
                    if (response.success) {
                        $scope.isCollected = true;
                        if (!$scope.topic.collect_count) {
                            $scope.topic.collect_count = 0;
                        }
                        $scope.topic.collect_count = parseInt($scope.topic.collect_count) + 1;
                        User.collectTopic(id);
                    }
                });
            }
        };

        $scope.showSlidePreview = function(pic) {
            webq.showSlidePreview(pic, $scope.topic.goods_pics);
        }

        // for complian topic
        $scope.complainTopic = function(topic) {
            $scope.popupData = {};
            // An elaborate, custom popup
            var myPopup = $ionicPopup.show({
                template: '<textarea autofocus ng-model="popupData.complainDescription" placeholder="您的举报理由" style="height:120px"></textarea>',
                title: '举报商品',
                // subTitle: '请输入您的举报理由',
                scope: $scope,
                buttons: [{
                    text: '取消'
                }, {
                    text: '<b>提交</b>',
                    type: 'button-assertive',
                    onTap: function(e) {
                        if (!$scope.popupData.complainDescription) {
                            //don't allow the user to close unless he enters wifi password
                            e.preventDefault();
                        } else {
                            return $scope.popupData.complainDescription;
                        }
                    }
                }]
            });

            myPopup.then(function(description) {
                if (description) {
                    $scope.showLoading('提交中，请稍候！');
                    Topic.complainTopic(topic.id, description).$promise.then(function(response) {
                        // console.log(JSON.stringify(response));
                        $scope.hideLoading();
                    });
                }
            });
        }
    }

})

/**
 * create Goods item in backend
 * Implementation: https://github.com/arrking/wildfire/issues/17
 * Task: https://github.com/arrking/wildfire/issues/55
 * Depend API: https://github.com/arrking/wildfire/issues/53
 * @param  {[type]} $scope           [description]
 * @param  {[type]} $log             [description]
 * @param  {[type]} wechat_signature [description]
 * @return {[type]}                  [description]
 */
.controller('PostCtrl', function($scope,
    $rootScope,
    $state,
    $stateParams,
    $ionicModal,
    $ionicPopup,
    $ionicLoading,
    LocationManager,
    $timeout,
    $log,
    $q,
    cfg,
    Msg,
    store,
    webq,
    WeChat,
    // wxWrapper,
    Tabs) {
    // 既不是调试，也不存在accesstoken
    // 注意，假设 BindAccessToken 也是成功获取Profile的
    if ((!store.getAccessToken()) && (!cfg.debug)) {
        console.log('redirect to login');
        $ionicLoading.show({
            template: '跳转到登录认证 ...'
        });
        $timeout(function() {
            window.location.href = '{0}/auth/wechat/embedded?redirect={1}'.f(cfg.server, encodeURIComponent('post'));
        }, 2000);
    } else if (store.getAccessToken() && (!cfg.debug)) {
        // 非调试，存在accesstoken
        var userProfile = store.getUserProfile();
        if (userProfile) {
            if (userProfile.phone_number) {
                // 用户已经绑定手机号！
                // do nothing
            } else {
                $ionicLoading.show({
                    template: '发布信息需要绑定手机号码 ...',
                    duration: '3000'
                });
                $timeout(function() {
                    // 用户未绑定手机号
                    $state.go('bind-mobile-phone', {
                        accessToken: store.getAccessToken(),
                        md5: 'null-md5'
                    });
                }, 2000);
            }
        } else {
            Msg.alert('错误！无法获得登录用户信息。');
        }
    }

    $scope.params = {
        // 标题5到10个字
        title: null,
        content: null,
        tab: null,
        quality: null,
        goods_pics: [],
        goods_pre_price: null,
        goods_now_price: null,
        goods_is_bargain: true,
        // dummy data
        goods_exchange_location: {
            user_edit_address: null,
            api_address: null,
            lat: null, // latitude
            lng: null // longitude
        },
        goods_status: '在售'
    };

    // #Todo this is dummy data for debugging
    // $scope.params = {
    //     // 标题5到10个字
    //     title: 'testtitle',
    //     content: 'test contenet',
    //     tab: 'electronics',
    //     quality: '全新',
    //     goods_pics: [],
    //     goods_pre_price: null,
    //     goods_now_price: null,
    //     goods_is_bargain: true,
    //     // dummy data
    //     goods_exchange_location: {
    //         user_edit_address: null,
    //         api_address: null,
    //         lat: null, // latitude
    //         lng: null // longitude
    //     },
    //     goods_status: '在售'
    // };


    $scope.pageModel = {};
    $scope.pageModel.tagValue = 'books';
    $scope.pageModel.quality = '全新';

    $scope.tagList = _.filter(Tabs.getList(), function(x) {
        return x.value !== 'all';
    });

    $scope.qualityList = ['全新', '很新', '完好', '适用', '能用'];

    $scope.changeTab = function(value) {
        $scope.params.tab = value;
        $log.debug('params: {0}'.f(JSON.stringify($scope.params)));
    };

    $scope.changeQuality = function(value) {
        $scope.params.quality = value;
        $log.debug('params: {0}'.f(JSON.stringify($scope.params)));
    }

    /**
     * upload wechat images in loop
     * must be called after wx ready and the
     * jsApiList has uploadImage.
     * @param  {[type]} resIds [description]
     * @return {[type]}        [description]
     */
    function _processWxImages(resIds, results, deferred) {
        try {
            if (!results) {
                results = [];
            }
            var resId = resIds.pop();
            if (resId) {
                $timeout(function() {
                    WeChat.getWx().then(function(wx) {
                        wx.uploadImage({
                            localId: resId, // 需要上传的图片的本地ID，由chooseImage接口获得
                            isShowProgressTips: 1, // 默认为1，显示进度提示
                            success: function(res) {
                                results.push(res.serverId); // 返回图片的服务器端ID
                                _processWxImages(resIds, results, deferred);
                            }
                        });
                    });
                }, 100);
            } else {
                deferred.resolve(results);
            }
        } catch (e) {
            deferred.reject(e);
        }
    }

    /**
     * https://github.com/arrking/wildfire/issues/228
     * @param  {[type]} localIds [description]
     * @return {[type]}          [description]
     */
    function _processImagesForAndroid(localIds) {
        // can not upload multi-images at the same time.
        var deferred = $q.defer();
        _processWxImages(localIds, null, deferred);
        deferred.promise.then(function(data) {
                /**
                 * data is the serverIds array
                 * ServerIds can be used to download
                 * images from wechat server to local
                 * server, by default, the images are
                 * expired in three days.
                 * http://mp.weixin.qq.com/wiki/12/58bfcfabbd501c7cd77c19bd9cfa8354.html
                 * @param  {[type]} err [description]
                 * @return {[type]}     [description]
                 */
                return webq.uploadWechatImages(data)
            }, function(err) {
                Msg.alert('Opps，图片上传好像有误，再传一次吧');
                // Msg.alert(JSON.stringify(err));
            })
            .then(function(result) {
                //Msg.alert('succ:' + JSON.stringify(result));
                _.each(result, function(value, index) {
                    // insert the image url into goods metadata
                    $scope.params.goods_pics.push(value.imageUrl);
                });
            }, function(err) {
                Msg.alert('fail:' + JSON.stringify(err));
            });
    }

    function _processImagesForIOS(localIds) {
        // can not upload multi-images at the same time.
        var deferred = $q.defer();
        _processWxImages(localIds, null, deferred);
        deferred.promise.then(function(data) {
                /**
                 * data is the serverIds array
                 * ServerIds can be used to download
                 * images from wechat server to local
                 * server, by default, the images are
                 * expired in three days.
                 * http://mp.weixin.qq.com/wiki/12/58bfcfabbd501c7cd77c19bd9cfa8354.html
                 * @param  {[type]} err [description]
                 * @return {[type]}     [description]
                 */
                return webq.uploadWechatImages(data)
            }, function(err) {
                Msg.alert('Opps，图片上传好像有误，再传一次吧');
                // Msg.alert(JSON.stringify(err));
            })
            .then(function(result) {
                //Msg.alert('succ:' + JSON.stringify(result));
                _.each(result, function(value, index) {
                    // insert the image url into goods metadata
                    $scope.params.goods_pics.push(cfg.server + value.imageUrl);
                });
            }, function(err) {
                Msg.alert('fail:' + JSON.stringify(err));
            });
    }

    $scope.uploadImage = function() {
        WeChat.getWx().then(function(wx) {
            wx.chooseImage({
                success: function(res) {
                    var localIds = res.localIds; // 返回选定照片的本地ID列表，localId可以作为img标签的src属性显示图片
                    switch ($rootScope.WILDFIRE_WECHAT_PLATFORM) {
                        case 'Android':
                            _processImagesForAndroid(localIds);
                            break;
                        case 'iOS':
                            _processImagesForIOS(localIds);
                            break;
                        default:
                            Msg.alert('目前仅支持iOS和Android设备！');
                            break;
                    }
                }
            });
        });
    };

    /**
     * 删除 goods pic
     *
     * @param  {[type]} srcValue [description]
     * @return {[type]}          [description]
     */
    $scope.removeGoodsPic = function(srcValue) {
        // A confirm dialog
        var confirmPopup = $ionicPopup.confirm({
            title: '提示',
            template: '确定删除这张配图?',
            okText: '是',
            okType: 'button-balanced',
            cancelText: '否',
            cancelType: 'button-default'
        });
        confirmPopup.then(function(res) {
            if (res) {
                $scope.params.goods_pics = _.filter($scope.params.goods_pics,
                    function(x) {
                        return x !== srcValue;
                    });

                $log.debug('Goods Pics ' + JSON.stringify($scope.params.goods_pics));
            } else {
                // cancelled
            }
        });

    }


    /**
     * 验证表单字段
     */
    function isFormValidate(params) {
        if (params.goods_pics.length < 1) {
            Msg.alert('至少上传一张图片!');
            return false;
        }
        if (!params.tab) {
            Msg.alert('请选择一个类别!');
            return false;
        }
        if (!params.quality) {
            Msg.alert('请设置成色!');
            return false;
        }
        if (params.goods_pre_price && isPriceValidate(params.goods_pre_price)) {
            Msg.alert('原价必须为合法数字(正数，最多两位小数)');
            return false;
        }
        if (isPriceValidate(params.goods_now_price)) {
            Msg.alert('转让价必须为合法数字(正数，最多两位小数)');
            document.querySelector('#gprice').focus();
            return false;
        }
        if (params.goods_pre_price) {
            if (parseFloat(params.goods_pre_price) < parseFloat(params.goods_now_price)) {
                Msg.alert('原价应该大于等于转让价！');
                document.querySelector('#gprice').focus();
                return false;
            }
        }
        if (!params.title || params.title.length < 5) {
            Msg.alert('请输入大于五个字的标题!');
            document.querySelector('#gtitle').focus();
            return false;
        }
        if (!params.content) {
            Msg.alert('请输入宝贝描述!');
            return false;
        }

        return true;
    }

    function isPriceValidate(price) {
        var reg = /(^[-+]?[1-9]\d*(\.\d{1,2})?$)|(^[-+]?[0]{1}(\.\d{1,2})?$)/;
        var isValidate = !reg.test(price);

        return isValidate;
    }

    /**
     * 提交二手物品创建信息
     * @return {[type]} [description]
     */
    $scope.submitGoods = function() {
        if (!isFormValidate($scope.params)) {
            return;
        }
        Msg.show('提交中，请稍候...');
        webq.createNewGoods($scope.params)
            .then(function(result) {
                /**
                 * success: true
                 * topic_id: xxxx
                 * @param  {[type]} result.success [description]
                 * @return {[type]}                [description]
                 */
                if (result.success) {
                    // create record successfully.
                    $state.go('item', {
                        itemId: result.topic_id
                    });
                    // $ionicPopup.alert({
                    //         title: '发布商品',
                    //         template: '发布成功！'
                    //     })
                    //     .then(function(res) {
                    //         $state.go('item', {
                    //             itemId: result.topic_id
                    //         });
                    //     });
                } else {
                    // fail to create record.
                    $ionicPopup.alert({
                            title: '发布商品',
                            template: '发布失败！'
                        })
                        .then(function(res) {
                            // # TODO
                            console.error('发布失败！');
                        });
                }
            }, function(err) {
                console.log('lyman 566', JSON.stringify(err));
                Msg.alert(err.error_msg);
            }).finally(function() {
                Msg.hide();
            });
    }

    /*******************************************
     * Modal View to input description of goods
     *******************************************/
    $ionicModal.fromTemplateUrl('templates/modal-post-goods-desp.html', {
        scope: $scope,
        animation: 'slide-in-up'
    }).then(function(modal) {
        $scope.GoodsDespModal = modal;
    });

    $scope.openGoodsDespModal = function() {
        $scope.GoodsDespModal.show();
    };
    $scope.closeGoodsDespModal = function() {
        $scope.GoodsDespModal.hide();
    };

    /*******************************************
     * End of Modal View to input description of goods
     *******************************************/

    /*******************************************
     * Modal View to input detail of exchange location
     *******************************************/

    /**
     * Store the exchange location information
     * @type {Object}
     */
    $scope.showChangeLocationModal = function() {
        if ($scope.changeLocationModal) {
            $scope.changeLocationModal.show();
        } else {
            initLocationSelector(null, true);
        }
    }

    $scope.closeChangeLocationModal = function(isSubmit) {
        if (isSubmit) {
            $timeout(function() {
                $scope.params.goods_exchange_location.api_address = $scope.locationDetail.api_address;
                $scope.params.goods_exchange_location.user_edit_address = $scope.locationDetail.user_edit_address;
                $scope.params.goods_exchange_location.lat = $scope.locationDetail.lat;
                $scope.params.goods_exchange_location.lng = $scope.locationDetail.lng;
                console.log('lyman 498', JSON.stringify($scope.locationDetail));
                console.log('lyman 499', JSON.stringify($scope.params.goods_exchange_location));
            });
        }
        $scope.changeLocationModal.hide();
    }

    function initLocationSelector(data, isShow) {
        console.log('initLocationSelector');
        var data = LocationManager.getLocation();
        $scope.locationDetail = data;
        $scope.params.goods_exchange_location = data;
        $scope.showEdit = false;

        $ionicModal.fromTemplateUrl('templates/modal-change-location.html', {
            scope: $scope
        }).then(function(modal) {
            $scope.changeLocationModal = modal;
            if (isShow) {
                modal.show();
            }
        });
    }

    $rootScope.$on('location.updated', initLocationSelector);
    LocationManager.getLocationFromAPI().then(initLocationSelector).catch(function(err) {
        LocationManager.showLocationSelector();
    });

    /*******************************************
     * End Modal View to input detail of exchange location
     *******************************************/

    //Cleanup the modal when we're done with it!
    $scope.$on('$destroy', function() {

        if ($scope.GoodsDespModal)
            $scope.GoodsDespModal.remove();

        if ($scope.changeLocationModal)
            $scope.changeLocationModal.remove()
    });

})

.controller('InboxCtrl', function($scope, $ionicLoading, Messages, $log, store, $rootScope, $timeout, cfg, Msg) {
    console.log('zzzzz');
    $scope.doNotHaveMessage = false;
    // 既不是调试，也不存在accesstoken
    if ((!store.getAccessToken()) && (!cfg.debug)) {
        $ionicLoading.show({
            template: '跳转到登录认证 ...'
        });
        $timeout(function() {
            // change to wechat uaa page
            window.location.href = '{0}/auth/wechat/embedded?redirect={1}'.f(cfg.server, encodeURIComponent('tab.inbox'));
        }, 2000);
    } else {
        Messages.getMessages().$promise.then(function(response) {
            $scope.messages = response.data;
            console.log(JSON.stringify($scope.messages));
            if ($scope.messages.hasnot_read_messages.length === 0) {
                $rootScope.$broadcast('messagesMarkedAsRead');
            } else {
                Messages.markAll().$promise.then(function(response) {
                    $log.debug('mark all response:', response);
                    if (response.success) {
                        $rootScope.$broadcast('messagesMarkedAsRead');
                    }
                }, function(response) {
                    $log.debug('mark all response error:', response);
                });
            }

            if ($scope.messages.hasnot_read_messages.length == 0 && $scope.messages.has_read_messages.length == 0) {
                $scope.doNotHaveMessage = true;
            }
        }, function(response) {
            $log.debug('get messages response error:', response);
        });

    }


})

// .controller('InboxDetailCtrl', function($scope, $stateParams, Messages) {
//     $scope.items = [{
//         id: 0,
//         price: '￥ 1000.00 （含运费0.00元）',
//         desc: '交易前聊一聊',
//         img: 'templates/tab-inbox-imgs/1.jpg'
//     }];
//     var userId = '00002'
//     $scope.itemClass = function(item) {
//         var itemClass = 'item-remove-animate item-avatar chat';
//         if (item.userId == userId) {
//             itemClass = 'item-remove-animate item-avatar-right chat  chat-right';
//         }
//         return itemClass;
//     }
//     $scope.messages = Messages.all();
// })

.controller('AccountCtrl', function($scope,
    $ionicModal,
    $ionicLoading,
    $log,
    store,
    cfg,
    webq,
    Msg,
    myProfile,
    myTopics,
    $q,
    $timeout,
    Topic) {
    $log.debug("myProfile" + JSON.stringify(myProfile));
    $log.debug("myTopics: " + JSON.stringify(myTopics));
    // load user profile from localStorage
    var onGoingStuffs = [];
    var offShelfStuffs = [];
    var favoritesStuffs = [];
    $scope.isFavoriteTab = false;

    // 既不是调试，也不存在accesstoken
    if (!myProfile && !cfg.debug) {
        // Just to avoid myProfile = null
        // In that case, the script would throw an error. Even
        // it does not crash the app, but it is not friendly.
        myProfile = {};
        $ionicLoading.show({
            template: '跳转到登录认证 ...'
        });
        $timeout(function() {
            // change to wechat uaa page
            window.location = '{0}/auth/wechat/embedded?redirect={1}'.f(cfg.server, encodeURIComponent('tab.account'));
        }, 2000);
    } else if (cfg.debug) {
        // ensure dummy data for local debugging
        myProfile = {};
    }

    /**
     * Separate topics into each category
     * @param  {[boolean]} update whether fetch data from backend
     * @return {[type]}          [description]
     */
    function _separateMyTopics(update, callback) {
        if (update) {
            $q.all([
                webq.getMyTopicsResolve(),
                webq.getMyCollectionResolve()
            ]).then(function(results) {
                var latestMyTopics = results[0];

                if (latestMyTopics) {
                    myTopics = latestMyTopics;
                    onGoingStuffs = _.filter(myTopics, function(x) {
                        return x.goods_status === '在售';
                    });

                    offShelfStuffs = _.filter(myTopics, function(x) {
                        return x.goods_status === '下架';
                    });

                }

                // avoid results is null or undefined.
                // fix https://github.com/arrking/wildfire/issues/159
                if (results[1]) {
                    favoritesStuffs = results[1];
                }

                if (callback) callback();
            });
        } else if (myTopics) {
            onGoingStuffs = _.filter(myTopics, function(x) {
                return x.goods_status === '在售';
            });

            offShelfStuffs = _.filter(myTopics, function(x) {
                return x.goods_status === '下架';
            });

            if (callback) callback();
        }
    }

    function _resetScopeData() {
        $scope.data = {
            name: myProfile.name || '未登录' /* the default values for debugging usage.*/ ,
            avatar: myProfile.avatar || 'images/dummy/avatar.jpg',
            phone: myProfile.phone_number || '未绑定',
            title: '我的呱呱',
            onGoingStuffs: onGoingStuffs,
            onGoingStuffsBadge: onGoingStuffs.length,
            offShelfStuffs: offShelfStuffs,
            offShelfStuffsBadge: offShelfStuffs.length,
            favoritesStuffs: favoritesStuffs,
            favoritesStuffsBadge: favoritesStuffs.length,
            // by default, render 在售 as content
            stuffs: onGoingStuffs
        };
    }

    _separateMyTopics();
    _resetScopeData();

    $scope.onTabSelected = function(category) {
        switch (category) {
            case 'onGoingStuffs':
                _separateMyTopics(true, function() {
                    $scope.stuffs = onGoingStuffs;
                    _resetScopeData();
                });
                $scope.isFavoriteTab = false;
                break;
            case 'offShelfStuffs':
                _separateMyTopics(true, function() {
                    $scope.stuffs = offShelfStuffs;
                    _resetScopeData();
                });
                $scope.isFavoriteTab = false;
                break;
            case 'favoritesStuffs':
                _separateMyTopics(true, function() {
                    $scope.stuffs = favoritesStuffs;
                    _resetScopeData();
                });
                $scope.isFavoriteTab = true;
                break;
            default:
                break;
        }
    }

    /**
     * 顶
     * 更新topic的 update_at 值
     * @param  {[type]} topic [description]
     * @return {[type]}       [description]
     */
    $scope.editDingOnShelf = function(topic) {
        webq.dingMyTopic(topic)
            .then(function() {
                Msg.alert('恭喜，成功置顶！');
            }, function() {
                Msg.alert('没有成功，什么情况，稍候再试 ?');
            });
    }

    /**
     * 取消收藏
     * tab: favoritesStuffs
     * @param  {[type]} topic [description]
     * @return {[type]}       [description]
     */
    $scope.editUnCollected = function(topic) {
        Topic.deCollectTopic(topic._id).$promise.then(function(response) {
            console.log(response);
            if (response.success) {
                console.log('success uncollected topic');
                _separateMyTopics(true, function() {
                    $scope.stuffs = favoritesStuffs;
                    _resetScopeData();
                });
            }
        });
    }

    /**
     * 下架
     * tab: onGoingStuffs
     * @param  {[type]} topic [description]
     * @return {[type]}       [description]
     */
    $scope.editOffShelf = function(topic) {
        $log.debug('profile: {0} 下架'.f(topic.title));
        topic.goods_status = '下架';
        webq.updateMyTopic(topic)
            .then(function(data) {
                //Msg.alert('{0} 成功下架'.f(topic.title));
                _separateMyTopics(true, function() {
                    $scope.stuffs = onGoingStuffs;
                    _resetScopeData();
                });
            }, function(err) {
                Msg.alert(JSON.stringify(err));
            });
    }

    /**
     * 售出
     * tab: onGoingStuffs
     * @param  {[type]} topic [description]
     * @return {[type]}       [description]
     */
    $scope.editSoldOut = function(topic) {
        $log.debug('profile: {0} 售出'.f(topic.title));
        topic.goods_status = '售出';
        webq.updateMyTopic(topic)
            .then(function(data) {
                //Msg.alert('{0} 成功下架'.f(topic.title));
                _separateMyTopics(true, function() {

                    $scope.stuffs = onGoingStuffs;
                    _resetScopeData();
                });
            }, function(err) {
                Msg.alert(JSON.stringify(err));
            });
    }

    /**
     * 删除
     * tab: offShelfStuffs
     * @param  {[type]} topic [description]
     * @return {[type]}       [description]
     */
    $scope.editDelete = function(topic) {
        $log.debug('profile: {0} 删除'.f(topic.title));
        topic.deleted = true;
        webq.updateMyTopic(topic)
            .then(function(data) {
                //Msg.alert('{0} 成功下架'.f(topic.title));
                _separateMyTopics(true, function() {
                    $scope.stuffs = offShelfStuffs;
                    _resetScopeData();
                });
            }, function(err) {
                Msg.alert(JSON.stringify(err));
            });
    }

    /**
     * 上架
     * tab: offShelfStuffs
     * @param  {[type]} topic [description]
     * @return {[type]}       [description]
     */
    $scope.editOnShelf = function(topic) {
        $log.debug('profile: {0} 上架'.f(topic.title));
        topic.goods_status = '在售';
        webq.updateMyTopic(topic)
            .then(function(data) {
                //Msg.alert('{0} 成功下架'.f(topic.title));
                _separateMyTopics(true, function() {
                    $scope.stuffs = offShelfStuffs;
                    _resetScopeData();
                });
            }, function(err) {
                Msg.alert(JSON.stringify(err));
            });
    }

    //Cleanup the modal when we're done with it!
    $scope.$on('$destroy', function() {
        $scope.settingsModal.remove();
    });
})

.controller('BindMobilePhoneCtrl', function($scope, $state, $stateParams, Msg, $ionicModal,
    $ionicPopup, $ionicLoading, $timeout, $log, webq, store, $interval, L2S) {
    var phonenoPattern = /^\(?([0-9]{11})\)?$/;
    var accessToken = $stateParams.accessToken;
    var md5 = $stateParams.md5;
    store.setAccessToken(accessToken);
    var currentPhoneNumber;

    $scope.data = {
        phoneNumber: null,
        verifyCode: null
    };

    // JavaScript to validate the phone number
    function isPhonenumber(val) {
        if (val.match(phonenoPattern)) {
            return true;
        } else {
            return false;
        }
    }

    function _showLoadingSpin(txt, callback) {
        $ionicLoading.show({
            template: txt
        });
        callback();
    };

    function _hideLoadingSpin() {
        $ionicLoading.hide();
    };

    function _fixPhoneNumberInputPlaceholder(txt) {
        $scope.data.phoneNumber = null;
        angular.element(document.getElementById('phoneNumber')).attr('placeholder', txt);
    }

    function _fixVerifyCodeInputPlaceholder(txt) {
        $scope.data.verifyCode = null;
        angular.element(document.getElementById('verifyCode')).attr('placeholder', txt);
    }

    $scope.submitTxt = '发送验证码';
    $scope.sendVerifyCode = function() {
        // verify the input nubmer is a phone number
        //Msg.alert('sendVerifyCode' + JSON.stringify($scope.data));
        if (!$scope.data.phoneNumber || !isPhonenumber($scope.data.phoneNumber)) {
            _fixPhoneNumberInputPlaceholder('输入正确的手机号码');
            return;
        }
        // user has input a phone number
        // post request to send the api
        currentPhoneNumber = $scope.data.phoneNumber;
        Msg.show('发送验证码 ...');
        $scope.submitTxt = '等待60秒';
        var seconds = 60;
        var timeer = $interval(function() {
            seconds--;
            $scope.submitTxt = ' 等待 ' + seconds + ' 秒';
        }, 1000, seconds);

        $timeout(function() {
            $scope.submitTxt = '发送验证码';
            $scope.waitFor60Seconds = false;
            $scope.data.phoneNumber = currentPhoneNumber;
        }, 1000 * seconds + 1000);

        $scope.waitFor60Seconds = true;
        webq.sendVerifyCode($scope.data.phoneNumber)
            .then(function(result) {
                // send code sucessfully, just close loading
                // spin in finally.
                _fixPhoneNumberInputPlaceholder('已发送至 {0}.'.f($scope.data.phoneNumber));
            }, function(err) {
                // get an error, now alert it.
                // TODO process err in a user friendly way.
                Msg.alert(JSON.stringify(err));
            })
            .finally(function() {
                Msg('hide');
            });
    };

    $ionicModal.fromTemplateUrl('modal-service-agreements.html', {
        scope: $scope,
        animation: 'slide-in-up'
    }).then(function(modal) {
        $scope.modal = modal;
    });
    $scope.openModal = function($event) {
        $event.preventDefault();
        console.log('message');
        webq.getUserServiceAgreements()
            .then(function(data) {
                $scope.data.service_agreements = data;
            }, function(err) {
                $scope.data.service_agreements = '服务器抽疯了，木有返回数据。';
            });
        $scope.modal.show();
    };
    $scope.closeModal = function() {
        $scope.modal.hide();
    };

    $scope.bindPhoneNumber = function() {
        if ($scope.data.verifyCode && $scope.data.verifyCode.length == 4) {
            // check the verify code
            _showLoadingSpin('验证中 ...', function() {
                webq.checkVerifyCode(currentPhoneNumber, $scope.data.verifyCode)
                    .then(function(result) {
                        // register successfully.
                        if (result.user) {
                            store.setUserProfile(result.user);
                        }
                        // get the state value
                        //
                        if (md5 && (md5 !== 'null-md5')) {
                            webq.getHashStateValByMd5(md5)
                                .then(function(data) {
                                    console.log('BindMobilePhoneCtrl Redirect to ' + data);
                                    // check if the data is a state string or state object
                                    if (data.startsWith('{')) {
                                        var stateObj = JSON.parse(data);
                                        $state.go(stateObj.state, stateObj.stateParams);
                                    } else {
                                        $state.go(data);
                                    }
                                }, function(err) {
                                    console.log('BindAccessTokenCtrl Get an error, redirect to tab.index');
                                    $state.go('tab.index');
                                });
                        } else {
                            $state.go('tab.index');
                        }
                    }, function(err) {
                        L2S('verifycodeErr', err);
                        _fixVerifyCodeInputPlaceholder('验证码错误，重新输入');
                    })
                    .finally(function() {
                        _hideLoadingSpin();
                    });
            });
        } else {
            // error
            _fixVerifyCodeInputPlaceholder('验证码格式不正确，重新输入');
        }
    }
})

/**
 * Add loading spinner when requesting user profile
 * @IMPORTANT@ the accesstoken is passed in here.
 * @param  {[type]} $log           [description]
 * @param  {[type]} $stateParams   [description]
 * @param  {[type]} $scope         [description]
 * @param  {[type]} $ionicLoading) {               } [description]
 * @return {[type]}                [description]
 */
.controller('BindAccessTokenCtrl', function($log, $stateParams,
    $scope,
    $state,
    store,
    Msg,
    webq) {
    console.log('Get stateParams: ' + JSON.stringify($stateParams));
    var accesstoken = $stateParams.accessToken;
    if (accesstoken) {
        store.setAccessToken($stateParams.accessToken);
        webq.getMyProfileResolve()
            .then(function() {
                if ($stateParams.md5 && ($stateParams.md5 !== 'null-md5')) {
                    webq.getHashStateValByMd5($stateParams.md5)
                        .then(function(data) {
                            console.log('BindAccessTokenCtrl Redirect to ' + data);
                            // check if the data is a state string or state object
                            if (data.startsWith('{')) {
                                var stateObj = JSON.parse(data);
                                $state.go(stateObj.state, stateObj.stateParams);
                            } else {
                                $state.go(data);
                            }
                        }, function(err) {
                            console.log('BindAccessTokenCtrl Get an error, redirect to tab.index');
                            $state.go('tab.index');
                        });
                } else {
                    console.log()
                    $state.go('tab.index');
                }
            }, function(err) {
                console.error('getMyProfileResolve should not happen.');
            });
    } else {
        Msg.alert('服务异常，运维人员玩命恢复中，认证失败!');
    }
})

.controller('SettingsCtrl', function($log, $scope,
    $timeout,
    $ionicPopup,
    $state,
    store,
    Msg,
    webq) {
    $log.debug('SettingsCtrl ...');


    // resolve user phone
    function _getUserPhone() {
        var userProfile = store.getUserProfile();
        if (userProfile) {
            return userProfile.phone_number;
        }
        return '未绑定';
    }

    // resolve user notify
    function _getIsUserWechatNotify() {
        var userProfile = store.getUserProfile();
        if (userProfile) {
            return userProfile.is_wechat_notify;
        }
        return false;
    }


    $scope.data = {
        feedback: {
            title: '我要吐槽',
            content: ''
        },
        phone: _getUserPhone(),
        is_wechat_notify: _getIsUserWechatNotify()
    };

    $scope.goBackProfile = function() {
        $state.go('tab.account');
    }

    $scope.goBackSettings = function() {
        $state.go('settings');
    }

    $scope.submitFeedback = function() {
        $log.debug('feedbackTxt:' + $scope.data.feedback.content);
        if ($scope.data.feedback.content) {
            webq.submitFeedback($scope.data.feedback.content)
                .then(function() {
                    Msg.alert('感谢您对我们的支持，一直在努力，不放弃治疗。');
                    $scope.goBackSettings();
                }, function() {
                    Msg.alert('吐槽失败，看来是槽点太多。');
                });
        } else {
            $scope.data.feedback.title = '反馈内容不可为空';
            $timeout(function() {
                $scope.data.feedback.title = '我要吐槽';
            }, 3000);
        }
    }

    $scope.toggleIsWechatNotify = function() {
        if ($scope.data.is_wechat_notify) {
            webq.enableWechatNotify()
                .then(function() {
                    // done
                }, function() {
                    // oops, error happens
                    $scope.data.is_wechat_notify = false;
                    $ionicPopup.alert({
                        title: '提示',
                        template: 'Duang, 开启微信通知服务失败 &#% ... !'
                    });
                });
        } else {
            webq.disableWechatNotify()
                .then(function() {
                    // done
                }, function() {
                    // oops, error happens
                    $scope.data.is_wechat_notify = true;
                    $ionicPopup.alert({
                        title: '提示',
                        template: 'Duang, 关闭微信通知服务失败 &#% ... !'
                    });
                });
        }
    }

    if ($state.is('service-agreement')) {
        webq.getUserServiceAgreements()
            .then(function(data) {
                $scope.data.service_agreements = data;
            }, function(err) {
                $scope.data.service_agreements = '服务器抽疯了，木有返回数据。';
            });
    } else if ($state.is('about')) {
        webq.getAppGitRevision()
            .then(function(data) {
                $scope.data.build = data;
            }, function() {
                $scope.data.build = 'N/A'
            });
    }
})

;
