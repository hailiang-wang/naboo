angular.module('naboc.controllers', [])

.controller('ActivityCtrl', function($scope, $timeout, Msg, webq) {

    $scope.data = null;

    webq.getAllTopics()
        .then(function(result) {
            $scope.data = result.data;
        }, function(err) {
            console.log(err);
            Msg.show('服务器发呆了。');
            $timeout(function() {
                Msg.hide();
            }, 2000);
        });

})

.controller('PeopleCtrl', function($scope, Chats) {
    // With the new view caching in Ionic, Controllers are only called
    // when they are recreated or on app start, instead of every page change.
    // To listen for when this page is active (for example, to refresh data),
    // listen for the $ionicView.enter event:
    //
    //$scope.$on('$ionicView.enter', function(e) {
    //});

    $scope.chats = Chats.all();
    $scope.remove = function(chat) {
        Chats.remove(chat);
    }
})

.controller('PeopleDetailCtrl', function($scope, $stateParams, Chats) {
    $scope.chat = Chats.get($stateParams.chatId);
})

.controller('AccountCtrl', function($scope, store) {
    $scope.data = store.getUserProfile();
})

.controller('BindMobilePhoneCtrl', function($scope,
    $ionicLoading,
    $ionicModal,
    $ionicPopup,
    $state,
    $stateParams,
    $timeout,
    $interval,
    $log,
    Msg,
    webq,
    store) {
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
        // webq.getUserServiceAgreements()
        //     .then(function(data) {
        //         $scope.data.service_agreements = '服务器抽疯了，木有返回数据。';
        //     }, function(err) {
        //         $scope.data.service_agreements = '服务器抽疯了，木有返回数据。';
        //     });
        $scope.data.service_agreements = '没时间写了。Sorry about that, 然并卵 －－！';
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

;
