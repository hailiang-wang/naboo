'use strict';
angular.module('naboo.filters', [])

.filter('addPlatFormPostFix', function($rootScope) {
    return function(input) {
        console.log(wechatInfo);
        if($rootScope.WILDFIRE_WECHAT_PLATFORM == 'Android') {
            var wechatInfo = navigator.userAgent.match(/MicroMessenger\/([\d\.]+)/i) ;
            if( wechatInfo && wechatInfo[1] < "5.1") {
                input += '#mp.weixin.qq.com';
            }
        }
        return input;
    }
})

.filter('flatternDistance', function() {
    var EARTH_RADIUS = 6378137.0;    //单位M
    var PI = Math.PI;

    function getRad(d){
        return d*PI/180.0;
    }

    function getFlatternDistance(lat1,lng1,lat2,lng2){
        lat1 = parseFloat(lat1);
        lng1 = parseFloat(lng1);
        lat2 = parseFloat(lat2);
        lng2 = parseFloat(lng2);

        var f = getRad((lat1 + lat2)/2);
        var g = getRad((lat1 - lat2)/2);
        var l = getRad((lng1 - lng2)/2);

        var sg = Math.sin(g);
        var sl = Math.sin(l);
        var sf = Math.sin(f);

        var s,c,w,r,d,h1,h2;
        var a = EARTH_RADIUS;
        var fl = 1/298.257;

        sg = sg*sg;
        sl = sl*sl;
        sf = sf*sf;

        s = sg*(1-sl) + (1-sf)*sl;
        c = (1-sg)*(1-sl) + sf*sl;

        w = Math.atan(Math.sqrt(s/c));
        r = Math.sqrt(s*c)/w;
        d = 2*w*a;
        h1 = (3*r -1)/2/c;
        h2 = (3*r +1)/2/s;

        return d*(1 + fl*(h1*sf*(1-sg) - h2*(1-sf)*sg));
    }

    function getKm(distance){
        return ( distance / 1000);
    }

    return function(itemLocation, currentLocation) {
        var distance='';
        if( !itemLocation ){
            return;
        }
        if(currentLocation){
            distance = getFlatternDistance(itemLocation.lat, itemLocation.lng, currentLocation.lat, currentLocation.lng);
            console.log(distance, JSON.stringify(itemLocation), JSON.stringify(currentLocation));
            distance = parseInt(distance);
            if( distance > 1000 ) {
                distance = getKm( distance );
                distance += '千米';
            } else {
                distance += '米';
            }
        }
        return distance;
    };
})

.filter('badge', function() {
  return function(input) {
    input = input || '全新';
    var out;
    var list = {
        '全新' : 'qx',
        '很新' : 'hx',
        '完好' : 'wh',
        '适用' : 'sy',
        '能用' : 'ny'
    };
    if ( list[ input ] ) {
        out = 'goods-badge ' + list[ input ];
    }
    return out;
  };
})

.filter('link', function($sce) {
    return function(content) {
        if (typeof content === 'string') {
            var userLinkRegex = /href="\/user\/([\S]+)"/gi;
            var noProtocolSrcRegex = /src="\/\/([\S]+)"/gi;
            var externalLinkRegex = /href="((?!#\/user\/)[\S]+)"/gi;
            return $sce.trustAsHtml(
                content
                .replace(userLinkRegex, 'href="#/user/$1"')
                .replace(noProtocolSrcRegex, 'src="https://$1"')
                .replace(externalLinkRegex, "onClick=\"window.open('$1', '_blank', 'location=yes')\"")
            );
        }
        return content;
    };
})

.filter('tabName', function(Tabs) {
    return function(tab) {
        for (var i in Tabs) {
            if (Tabs[i].value === tab) {
                return Tabs[i].label;
            }
        }
    };
})

.filter('protocol', function() {
    return function(src) {
        // add https protocol
        if (/^\/\//gi.test(src)) {
            return 'https:' + src;
        } else {
            return src;
        }
    };
})

/**
 * A simple relative timestamp filter
 * http://codepen.io/Samurais/pen/PwwLPK
 * https://gist.github.com/Samurais/0c9e81eb18c3d60db46c
 */
.filter('relativets', function() {

    // ms units
    var second = 1000;
    var minute = 60000;
    var hour = 3600000;
    var day = 86400000;
    var year = 31536000000;
    var month = 2592000000;

    function _formatDateString(val) {
        var date = new Date(val);
        var yyyy = date.getFullYear();
        var mm = date.getMonth() + 1; //January is 0!
        var dd = date.getDate();
        var hh = date.getHours();
        var min = date.getMinutes();
        var sec = date.getSeconds();

        if (mm < 10) {
            mm = '0' + mm;
        }
        if (dd < 10) {
            dd = '0' + dd;
        }
        if (hh < 10) {
            hh = '0' + hh;
        }
        if (min < 10) {
            min = '0' + min;
        }
        if (sec < 10) {
            sec = '0' + sec;
        }
        return '{0}/{1}/{2} {3}:{4}'.f(yyyy, mm, dd, hh, min);
    };

    return function(value) {
        var diff = new Date() - new Date(value);
        var unit = day;
        var unitStr = '分钟前';
        if (diff > year || diff > month || diff > day) {
            // big gap, just return the absolute time
            return _formatDateString(value);
        } else if (diff > hour) {
            unit = hour;
            unitStr = '小时前';
        } else if (diff > minute) {
            unit = minute;
            unitStr = '分钟前';
        } else {
            unit = second;
            unitStr = '秒前';
        }

        var amt = Math.ceil(diff / unit);
        return amt + '' + unitStr;
    };
})

;
