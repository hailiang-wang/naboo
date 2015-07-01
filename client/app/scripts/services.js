angular.module('naboo.services', ['ngResource'])

.factory('L2S', function($resource, cfg) {
  var Log2Server = $resource(cfg.api + '/Log/:id', null, {});

  function L2S(type, content) {
    var arr = [
      'verifycodeErr',
      'uploadImageErr'
    ];
    if (arr.indexOf(type) == -1) {
      return;
    }

    if(!type) {
        return;
    }
    if(!content) {
        content = type;
        type = 'log';
    }
    if(angular.isObject(content)) {
        content = JSON.stringify(content);
    }

    var log = new Log2Server();
    log.type = type;
    log.content = content;
    Log2Server.save(log, function(data){
        console.log('log to server success');
    });
  }

  return L2S;
})

.factory('WeChat', function(cfg, store, $q, $http, L2S) {
  function WeChat() {

  }

  WeChat._data = {
    // networkType: '',
    // signature: ''
  };

  WeChat.getData = function(key) {
    if(WeChat._data[key]) {
      return WeChat._data[key];
    }
    return null;
  }

  WeChat.setData = function(key, value) {
    WeChat._data[key] = value;
  }

  WeChat.getSignature = function() {
    var d = $q.defer();
    var signature = WeChat.getData('signature');
    if(signature) {
      d.resolve(signature);
      return d.promise;
    }

    var app_url = window.location.href.split('#')[0];
    var appUrl = S(cfg.server);
    var isAllow = appUrl.contains('arrking.com') || appUrl.contains('guagua2shou.com');

    if(!isAllow) {
      L2S('error', 'reject ' + cfg.server + 'do not contains arrking.com ');
      d.reject(cfg.server + 'do not contains arrking.com ');

      return d.promise;
    }

    var url = cfg.api + '/ionic/wechat-signature';
    var params = { app_url: app_url };
    var config = {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        };
    $http.post(url, params, config)
      .success(function(data) {
        if (!data || data.rc!=0) {
          d.reject(data);
          return;
        }

        WeChat.setData('signature', data.msg);
        d.resolve(data.msg);
      })
      .error(function(err) {
          L2S('error', err);
          d.reject(err);
      });

    return d.promise;
  }

  WeChat.getWx = function() {
    var d = $q.defer();
    var _wx = WeChat.getData('wx');
    if(_wx) {
      d.resolve(_wx);
      return d.promise;
    }

    WeChat.getSignature().then(function(signature) {
      signature.jsApiList = [
        'chooseImage', 'previewImage', 'uploadImage', 'downloadImage',
        'getLocation', 'openLocation'
        ];
      wx.config(signature);
      wx.ready(function(){
        d.resolve(wx);
        WeChat.setData('wx', wx);
      });

      wx.error(function(err){
        console.log('wx.error', err);
        L2S('error', err);
        d.reject(err);
      });
    }, function(err) {
      console.log('96 err', JSON.stringify(err));
      L2S('error', err);
      d.reject(err);
    });

    return d.promise;
  };

  WeChat.getNetworkType = function() {
    var d = $q.defer();
    var networkType = WeChat.getData('networkType');
    if(networkType) {
      d.resolve(networkType);
      return d.promise;
    }

    WeChat.getWx().then(function(wx){
      wx.getNetworkType({
        success: function (res) {
          var networkType = res.networkType; // 返回网络类型2g，3g，4g，wifi
          console.log(networkType);
          WeChat.setData('networkType', networkType);
          d.resolve(networkType);
        },
        fail: function(res) {
          d.reject(res);
        }
      });
    });

    return d.promise;
  }

  return WeChat;
})

.service('LocationManager', function($rootScope, webq, Msg, $q, L2S, WeChat, $ionicPopup, $timeout){
    var _this = this;
    _this.addressDetailList = {
      'bj': {"api_address":"北京市朝阳区惠新东街10号","user_edit_address":"惠新东街10号","lat":39.979505,"lng":116.429},
      'chd': {"api_address":"河北省秦皇岛市河北大街西段438号","user_edit_address":"河北大街西段438号","lat":39.910598,"lng":119.54266}
    };

    _this.addressDetail = null;

    this.showLocationSelector = function() {
      var d = $q.defer();
      var tpl = '<ion-radio ng-model="cityData.location" ng-value="\'bj\'" selected="selected">北京</ion-radio>';
      tpl += '<ion-radio ng-model="cityData.location" ng-value="\'chd\'">秦皇岛</ion-radio>';

      var scope = $rootScope.$new();
      scope.cityData = {};

      var myPopup = $ionicPopup.show({
          template: tpl,
          title: '请选择您的城市',
          scope: scope,
          buttons: [
            {
              text: '<b>保存</b>',
              type: 'button-positive',
              onTap: function(e) {
                if (!scope.cityData.location) {
                  e.preventDefault();
                } else {
                  return scope.cityData.location;
                }
              }
            }
          ]
        });
        myPopup.then(function(city) {
          var addressDetail = _this.addressDetailList['bj'];
          if(_this.addressDetailList[city]) {
            addressDetail = _this.addressDetailList[city];
          }
          _this.setLocation(addressDetail);
          d.resolve(addressDetail);
        });

      return d.promise;
    }

    this.getLatLngFromAPI = function(wx) {
      var d = $q.defer();
      wx.getLocation({
        success: function(location) {
          // location = {
          //     longitude,
          //     latitude,
          //     accuracy,
          //     speed,
          //     errMsg,
          // }
          console.log('21 getLatLngFromAPI', location);
          d.resolve(location);
        }, fail: function (res) {
          console.dir(res);
          d.reject(res);
        }, cancel: function (res) {
          console.log('用户拒绝授权获取地理位置');
          // alert('用户拒绝授权获取地理位置');
          d.reject('user rejected to get location');
        }
      });

      return d.promise;
    }

    this.getAddressDetailFromAPI = function(location) {
      var d = $q.defer();

      var addressDetail = {};
      var geocoder;
      var center = new qq.maps.LatLng(location.latitude, location.longitude);
      var geocoder = new qq.maps.Geocoder();
      geocoder.getAddress(center);
      geocoder.setComplete(function(result) {
        console.log('41 getAddressDetailFromAPI', result);
        var c = result.detail.addressComponents;
        var full_address = c.country + c.province + c.city + c.district + c.street + c.streetNumber + c.town + c.village;
        // var address = c.streetNumber;
        // if(!address) {
        //     address =  c.town + c.village;
        // }
        var address = c.district + c.street + c.streetNumber;

        addressDetail.api_address = full_address;
        addressDetail.user_edit_address = address;
        addressDetail.lat = location.latitude;
        addressDetail.lng = location.longitude;

        d.resolve(addressDetail);
      });
      geocoder.setError(function() {
        console.log('无法从地图API获得您所在经纬度的地址详细信息');
        d.reject('get addressDetail from geocoder faild');
      });

      return d.promise;
    }

    // this.getLocationFromAPIPromise = null;
    this.getLocationFromAPI = function() {
      // if(_this.getLocationFromAPIPromise) {
      //   return _this.getLocationFromAPIPromise;
      // }

      var d = $q.defer();

      if(this.getLocation()) {
        console.log(JSON.stringify(this.getLocation()));
        d.resolve(this.getLocation());
        return d.promise;
      }
      // this.getLocationFromAPIPromise = d.promise;
      // this is not iOS, tooooo bad for location service, just rejected!
      // if($rootScope.WILDFIRE_WECHAT_PLATFORM != 'iOS') {
      //   d.reject('not iOS, just choose location by popup');
      //   return d.promise;
      // }

      // Msg.show('定位中，请稍候...');
      // WeChat.getNetworkType()
      //   .then(function(networkType){
      //     if(networkType !== 'wifi') {
      //       console.log('not wifi network, just choose location by popup');
      //       d.reject('not wifi network');
      //     }
      //   })
      //   .then(WeChat.getWx)
      this.getLocationTimeout(d);

      WeChat.getWx()
        .then(this.getLatLngFromAPI)
        .then(this.getAddressDetailFromAPI)
        .then(function(addressDetail){
            console.log('get addressDetail', addressDetail);
            _this.setLocation(addressDetail);
            d.resolve(addressDetail);
        }).catch(function(err){
            console.log('error while getLocationFromAPI, error from', err);
            d.reject('212');
        }).finally(function(){
          Msg('hide');
          // _this.getLocationFromAPIPromise = null;
        });

      return d.promise;
    }

    this.getLocationTimeout = function(d) {
      $timeout(function(){
        var location = _this.getLocation();
        if(location && location.lat) {
          return;
        }
        d.reject('timeout for 5 seconds');
      }, 10000);
    }

    this.getLocation = function() {
        return this.addressDetail;
    }

    this.setLocation = function(addressDetail) {
        this.addressDetail = addressDetail;
        console.log(addressDetail);
        $rootScope.$broadcast('location.updated');
    }
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
        _setItem('WILDFIRE_ACCESS_TOKEN', data);
    };

    this.getAccessToken = function() {
        return _getItem('WILDFIRE_ACCESS_TOKEN');
    };

    this.deleteAccessToken = function() {
        _removeItem('WILDFIRE_ACCESS_TOKEN');
    };

    /**
     * save user profile data into sessionStorage
     * @param {json} data json object of this user
     */
    this.setUserProfile = function(data) {
        _setItem('WILDFIRE_USER_PROFILE', data);
    };

    this.getUserProfile = function() {
        return _getItem('WILDFIRE_USER_PROFILE');
    };

    this.deleteUserProfile = function() {
        _removeItem('WILDFIRE_USER_PROFILE');
    };

    /**
     * get the cached location detail
     * @return {[type]} [description]
     */
    this.getLocationDetail = function() {
        return _getItem('WILDFIRE_LOCATION_DETAIL');
    };

    /**
     * set location into cache
     * @param {[type]} data [description]
     * use sessionStorage to drop the data.
     */
    this.setLocationDetail = function(data) {
        _setItem('WILDFIRE_LOCATION_DETAIL', data);
    };

    this.deleteLocationDetail = function() {
        _removeItem('WILDFIRE_LOCATION_DETAIL');
    }

    this.setWechatSignature = function(data) {
        _setItem('WILDFIRE_WECHAT_SIGNATURE', data);
    }

    this.getWechatSignature = function() {
        return _getItem('WILDFIRE_WECHAT_SIGNATURE');
    }

    this.deleteWechatSignature = function() {
        _removeItem('WILDFIRE_WECHAT_SIGNATURE');
    }

    this.clear = function() {
        var keys = _.keys(itemsService);
        keys.forEach(function(x) {
            if (key !== 'WILDFIRE_ACCESS_TOKEN') {
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
.service('webq', function($http, $q, $log, cfg, store, Msg, L2S, WeChat, $timeout) {

    var self = this;

    // this.getWechatSignature = function() {
    //     var deferred = $q.defer();
    //     // should not use encodeURIComponent
    //     var app_url = window.location.href.split('#')[0];

    //     // when the server domain is registered in
    //     // wechat plaform. If not, the signature can be
    //     // generated with this app url.
    //     // #TODO set this domian properly is very important.
    //     var appUrl = S(cfg.server);
    //     var isAllow = appUrl.contains('arrking.com') || appUrl.contains('guagua2shou.com');
    //     if (!isAllow) {
    //         console.log('reject ' + cfg.server + 'do not contains arrking.com ');
    //         deferred.reject(cfg.server + 'do not contains arrking.com ');
    //         return deferred.promise;
    //     }

    //     $http.post('{0}/ionic/wechat-signature'.f(cfg.api), {
    //             app_url: app_url
    //         }, {
    //             headers: {
    //                 'Content-Type': 'application/json',
    //                 'Accept': 'application/json'
    //             }
    //         })
    //         .success(function(data) {
    //             /**
    //              * data.rc: 0 --> succ; others --> fail
    //              * data.msg
    //              * >>
    //              * {
    //                 debug: wxConfig.debug,
    //                 appId: wxConfig.appId,
    //                 timestamp: wxCredentials.timestamp,
    //                 nonceStr: wxCredentials.noncestr,
    //                 signature: wxCredentials.signature,
    //                 // 附录2-所有JS接口列表
    //                 // http://mp.weixin.qq.com/wiki/7/aaa137b55fb2e0456bf8dd9148dd613f.html#.E6.8B.8D.E7.85.A7.E6.88.96.E4.BB.8E.E6.89.8B.E6.9C.BA.E7.9B.B8.E5.86.8C.E4.B8.AD.E9.80.89.E5.9B.BE.E6.8E.A5.E5.8F.A3
    //                 // jsApiList可以在客户端用的时候再调整
    //                 jsApiList: ['scanQRCode', 'chooseImage', 'getLocation', 'openLocation']
    //             };
    //              * <<
    //              * jsApiList和debug 可以在客户端修改
    //              */
    //             if (typeof(data) == 'object' && data.rc == 0) {
    //                 console.log('get wechatSingnature the first time', JSON.stringify(data));
    //                 store.setWechatSignature(data.msg);
    //                 deferred.resolve(data.msg);
    //             } else {
    //                 console.log('rejected!', data);
    //                 deferred.reject(data);
    //             }
    //         })
    //         .error(function(err) {
    //             console.dir(arguments);
    //             console.log('error: 597 get wechatSingnature from wx api server', err);
    //             L2S('error', err);
    //             deferred.reject(err);
    //         });

    //     return deferred.promise;
    // }

    // /**
    //  * inject wechat signature and return the wx object as
    //  * a wrapper after wechat config ready event.
    //  * Any thing bad happens, just resolve as undefined.
    //  * @param  {[type]} $log [description]
    //  * @param  {[type]} $q   [description]
    //  * @param  {[type]} webq [description]
    //  * @return {[type]}      [description]
    //  */
    // this.getWxWrapper = function() {
    //     var deferred = $q.defer();
    //     self.getWechatSignature()
    //         .then(function(wechat_signature) {
    //             wechat_signature.jsApiList = ['chooseImage',
    //                 'previewImage', 'uploadImage',
    //                 'downloadImage', 'getLocation',
    //                 'openLocation'
    //             ];
    //             wx.config(wechat_signature);
    //             wx.error(function(err) {
    //                 alert('wx.error');
    //                 console.log('wx.error', JSON.stringify(err));
    //                 deferred.reject(err);
    //             });
    //             wx.ready(function() {
    //                 deferred.resolve(wx);
    //             });
    //         }, function(err) {
    //             console.log(err);
    //             deferred.reject(err);
    //         })

    //     return deferred.promise;
    // };

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
                // https://github.com/arrking/wildfire/issues/54
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
        // https://github.com/arrking/wildfire/issues/53
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
        $log.debug('lyman service 322', JSON.stringify(postData));
        $http.post('{0}/topics'.f(cfg.api), postData)
            .success(function(data) {
                $log.debug('lyman  success 325', JSON.stringify(data));
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
                    // https://github.com/arrking/wildfire/issues/75
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
        for(var i in newArr) {
            newArr[i] = cfg.server + newArr[i];
        }
        WeChat.getWx()
            .then(function(wxWrapper) {
                wxWrapper.previewImage({
                    current: current, // 当前显示的图片链接
                    urls: newArr// 需要预览的图片链接列表
                });
            }, function(err) {
                Msg('加载错误');
            }).finally(function(){
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
     * https://github.com/arrking/wildfire/issues/128
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
 * Provide utilities to access current login user.
 *
 * @param  {[type]} cfg                [description]
 * @param  {[type]} $resource          [description]
 * @param  {[type]} $log               [description]
 * @param  {[type]} $q                 [description]
 * @param  {[type]} store)             {                 var resource [description]
 * @param  {[type]} null               [description]
 * @param  {[type]} function(response) {                                                                      $log.debug('post accesstoken:', response);                user.accesstoken [description]
 * @param  {Object} logout:            function()    {                                    user [description]
 * @return {[type]}                    [description]
 */
.factory('User', function(cfg, $resource, $log, $q, store) {
    var resource = $resource(cfg.api + '/accesstoken');
    var userResource = $resource(cfg.api + '/user/:loginname', {
        loginname: ''
    });
    var user = store.getUserProfile();
    return {
        /**
         * accessToken can be passed from wechat uaa
         * or get locally by store.getAccessToken.
         * @param  {[type]} accesstoken [description]
         * @return {[type]}             [description]
         */
        login: function(accesstoken) {
            var $this = this;
            return resource.save({
                accesstoken: accesstoken
            }, null, function(response) {
                $log.debug('post accesstoken:', response);
                user.accesstoken = accesstoken;
                $this.getByLoginName(response.loginname).$promise.then(function(r) {
                    user = r.profile;
                    store.setUserProfile(user);
                });
                user.loginname = response.loginname;
            });
        },
        /**
         * delete local user data
         * @return {[type]} [description]
         */
        logout: function() {
            user = {};
            store.deleteUserProfile();
            store.deleteAccessToken();
        },
        /**
         * return the profile data if it exists, or null for none login user.
         * {
              "_id": "553b43df49232fd36bccf847",
              "profile": {
                "openid": "ogWfMt5hcNzXXX",
                "nickname": "王海良",
                "sex": 1,
                "language": "en",
                "city": "Haidian",
                "province": "Beijing",
                "country": "China",
                "headimgurl": "http://wx.qlogo.cn/mmopen/ajNVdqHZLLChxqXiauTD4ewLXOeicBzgQrlwK6f8xfTZ40eDLQmIam7sK7jm6FffhUHcRxpMUSub1wWIqDqhwJibQ/0",
                "privilege": [],
                "unionid": "XXXX"
              },
              "accessToken": "xxxx",
              "avatar": "http://wx.qlogo.cn/mmopen/ajNVdqHZLLChxqXiauTD4ewLXOeicBzgQrlwK6f8xfTZ40eDLQmIam7sK7jm6FffhUHcRxpMUSub1wWIqDqhwJibQ/0",
              "email": "xx@foo.cn",
              "pass": "xxxx",
              "loginname": "xxx",
              "name": "王海良",
              "__v": 0,
              "phone_number": "xxx",
              "passport": "wechat",
              "receive_at_mail": false,
              "receive_reply_mail": false,
              "active": true,
              "update_at": "2015-04-25T07:35:59.393Z",
              "create_at": "2015-04-25T07:35:59.393Z",
              "collect_topic_count": 0,
              "collect_tag_count": 0,
              "following_count": 0,
              "follower_count": 0,
              "reply_count": 0,
              "topic_count": 13,
              "score": 65,
              "is_block": false
            }
         * @return {[type]} [description]
         */
        getCurrentUser: function() {
            $log.debug('current user:', user);
            return user;
        },
        getByLoginName: function(loginName) {
            if (user && loginName === user.loginname) {
                var userDefer = $q.defer();
                $log.debug('get user info from storage:', user);
                userDefer.resolve({
                    data: user
                });
                return {
                    $promise: userDefer.promise
                };
            }
            return this.get(loginName);
        },
        get: function(loginName) {
            return userResource.get({
                loginname: loginName
            }, function(response) {
                $log.debug('get user info:', response);
                if (user && user.loginname === loginName) {
                    angular.extend(user, response.data);

                    store.setUserProfile(user);
                }
            });
        },
        collectTopic: function(topicId) {
            if (typeof(user['collect_topics']) == 'undefined') {
                user['collect_topics'] = [];
                console.log(user.collect_topics);
            }
            console.log(typeof(user['collect_topics']));
            user.collect_topics.push({
                id: topicId
            });
            store.setUserProfile(user);
        },
        deCollectTopic: function(topicId) {
            angular.forEach(user.collect_topics, function(topic, key) {
                if (topic.id === topicId) {
                    user.collect_topics.splice(key, 1);
                }
            });
            store.setUserProfile(user);
        }
    };
})

.factory('Msg', function($ionicLoading, $q, $timeout, $ionicPopup) {
  function Msg(msg) {
    if( msg == 'hide' ) {
      Msg.hide();
      return;
    }

    var d = $q.defer();
    Msg.showOneSecond(msg, d);

    return d.promise;
  }

  Msg.showOneSecond = function(msg, d) {
    msg = '<h4>' + msg + '</h4>';
    $ionicLoading.show({template: '<ion-spinner></ion-spinner> ' + msg });
    $timeout(function(){
      $ionicLoading.hide();
      d.resolve();
    }, 1000);
  }

  Msg.show = function(msg) {
    msg = '<h4>' + msg + '</h4>';
    $ionicLoading.show({template: '<ion-spinner></ion-spinner>' + msg});
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

.factory('Tabs', function() {
    var _Tabs = {};
    var list = [{
        value: 'all',
        label: '全部'
    }, {
        value: 'books',
        label: '教材书籍'
    }, {
        value: 'transports',
        label: '代步工具'
    }, {
        value: 'electronics',
        label: '数码电器'
    }, {
        value: 'supplies',
        label: '生活用品'
    }, {
        value: 'healthcare',
        label: '运动健身'
    }, {
        value: 'clothes',
        label: '衣帽饰物'
    }, {
        value: 'others',
        label: '其它'
    }];

    _Tabs.getList = function() {
        return list;
    };

    _Tabs.getLabel = function(value) {
        for (i in list) {
            if (list[i]['value'] == value) {
                return list[i]['label'];
            }
        }
    };

    return _Tabs;
})

.factory('Messages', function(cfg, store, $resource, $log) {
    var messages = {};
    var messagesCount = 0;
    var resource = $resource(cfg.api + '/messages', null, {
        count: {
            method: 'get',
            url: cfg.api + '/message/count'
        },
        markAll: {
            method: 'post',
            url: cfg.api + '/message/mark_all'
        }
    });
    return {
        currentMessageCount: function() {
            return messagesCount;
        },
        getMessageCount: function() {
            return resource.count({
                accesstoken: store.getAccessToken()
            });
        },
        getMessages: function() {
            $log.debug('get messages');
            return resource.get({
                accesstoken: store.getAccessToken()
            });
            return messages;
        },
        markAll: function() {
            $log.debug('mark all as read');
            return resource.markAll({
                accesstoken: store.getAccessToken()
            }, function(response) {
                $log.debug('marked messages as read:', response);
                messagesCount = 0;
            });
        }
    };
})

