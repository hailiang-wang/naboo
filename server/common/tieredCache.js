/**
 * TieredCache
 * <p>
 * TieredCache is composed of two levels, primary and secondary. When an entry is added it is put into primary or secondary depending on promote.
 * <p>
 *  What happens on get depends on promote.
 * <p>
 * If promote and the entry is in the secondary it will be moved back to the primary.
 * If not promote and the entry is in the secondary it will be left in the secondary.
 * <p>
 * On set.
 * <p>
 * If promote then put entry in primary and remove from secondary if there.
 * If not promote then put entry in secondary if entry already in secondary, else put in primary.
 * <p>
 * On each access the current time is compared to the last cacheTimeout process time.
 * If the time is less than one cacheTimeout nothing happens.
 * If the time is between one cacheTimeout and two cacheTimeouts then primary is moved to secondary and a
 * new clean primary is created. This is how entries get into the secondary, a cache timeout they all of primary is moved to secondary.
 * If the time is over two cacheTimeouts then the entire cache (primary and secondary) are cleared.
 * 
 * @param {Number} [cacheTimeout] in ms, how long is a time out interval. Defaults to 5 minutes.
 * @param {Boolean} [promote] true - when accessed promote back to primary, false - do not promote back to primary. Default is true.
 */
function TieredCache(cacheTimeout, promote) {
	if ('boolean' == typeof cacheTimeout) {
		promote = cacheTimeout;
		cacheTimeout = 5*60*1000;
	}
		
	if (cacheTimeout && 'number' != typeof cacheTimeout)
		cacheTimeout = 5*60*1000;
	
	if (promote && 'boolean' != typeof promote)
		promote = true;
	
	this.promote = promote;
	this.cacheTimeout = cacheTimeout;
	_setNextTimeout.call(this);
	this.primary = {};
	this.secondary = {};
}

function _setNextTimeout() {
	var lastTimeout = Date.now();
	this.nextPush = lastTimeout+this.cacheTimeout;
	this.nextClear = this.nextPush+this.cacheTimeout;
}

/**
 * Get the value from the cache.
 * @param {String} key the key of the value.
 * @returns the value set (which may be undefined if that was set).
 */
TieredCache.prototype.get = function(key) {
	_processTimeout.call(this);
	
	if (this.primary.hasOwnProperty(key))
		return this.primary[key];
	else if (this.secondary.hasOwnProperty(key)) {
		var v = this.secondary[key];
		if (this.promote) {
			delete this.secondary[key];
			this.primary[key] = v;
		}
		return v;
	}
};

/**
 * Set the value into the cache.
 * 
 * @param {String} key the key of the value to set
 * @param {Object} value the value to set.
 */
TieredCache.prototype.set = function(key, value) {
	_processTimeout.call(this);
	
	if (this.promote) {
		// Auto promote to primary
		this.primary[key] = value;
		delete this.secondary[key];
	} else {
		// Don't promote if found in secondary.
		if (this.secondary.hasOwnProperty(key))
			this.secondary[key] = value;
		else
			this.primary[key] = value;
	}
};

function _processTimeout() {
	var now = Date.now();
	if (now > this.nextClear) {
		this.primary = {};
		this.secondary = {};
		_setNextTimeout.call(this);
	} else if (now > this.nextPush) {
		this.secondary = this.primary;
		this.primary = {};
		_setNextTimeout.call(this);
	}
}

module.exports = exports = TieredCache;