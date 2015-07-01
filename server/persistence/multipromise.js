/**
 * MultiPromise promise
 */

module.exports = MultiPromise;

/**
 * MultiPromise.
 * 
 * @param {mongoose.Promise}|{function} promise the promise that will be resolved when all of intermediate steps are resolved. It fulfill arguments will be returned
 * from resultFn. If a function is will be a standard callback with err and args.
 * @param {Function | Object} [resultFn] function to call with arguments when all of intermediate steps are resolved. If it returns an array
 * then the arguments to the promise resolve will be individual arguments in that order. If it returns undefined then no arguments will be sent. 
 * If this is an Object then the object will be returned as the result. If the object is an array then it will be returned as fulfill with
 * multiple arguments. If you want to return an array as the one arg then use [[...]].
 * If omitted then the promise will be resolved with no args. 
 * @param {Number} [cnt] starting count. If not set then starts with count of one.
 */
function MultiPromise(promise, resultFn, cnt) {
	this.promise = promise;
	if ('number' == typeof resultFn) {
		cnt = resultFn;
		resultFn = undefined;
	} else if ('function' == typeof resultFn)
		this.resultFn = resultFn;
	else if (resultFn)
		this.resultFn = objectResultFn.bind(undefined, resultFn);
	this.cnt = cnt ? cnt : 1;
}

/**
 * Add to the count.
 * 
 * @param {Number} [cnt] the number to add to count. If not set then incremented by one.
 */
MultiPromise.prototype.add = function(cnt) {
	this.cnt = this.cnt + (cnt ? cnt : 1);
};

/**
 * Resolve one count. 
 * <p>
 * Resolve one count or reject with error. When after resolve the count is decremented below one then fulfill on the promise is called.
 * 
 * @param {Object} [err] the error object for reject. If not set then this is a fulfill of one count.
 */
MultiPromise.prototype.resolve = function(err) {
	if (err)
		this.reject(err);
	else
		this.fulfill();	
};

/**
 * Reject 
 * 
 * @param {Object} [err] the error object for reject.
 */
MultiPromise.prototype.reject = function(err) {
	if (isPromise(this))
		this.promise.reject(err);
	else if (!rejected)
		this.promise.call(undefined, err);
	
	this.rejected = true;
};

function objectResultFn(object) {
	return object;
}

/**
 * Resolve one count. 
 * <p>
 * Resolve one count. When after the resolve count is decremented below one then fulfill on the promise is called.
 * 
 */
MultiPromise.prototype.fulfill = function() {
	if (--this.cnt <= 0) {
		if (this.resultFn) {
			if (isPromise(this))
				this.promise.fulfill.apply(this.promise, getArgs(this.resultFn.call(undefined)));
			else if (!this.rejected)
				this.promise.apply(undefined, [undefined].concat(getArgs(this.resultFn.call(undefined))));
		} else if (isPromise(this))
			this.promise.fulfill();
		else if (!this.rejected)
			this.promise.call(undefined);
	}
};

function isPromise(mp) {
	return mp.promise.then !== undefined; 
}

function getArgs(a) {
	if (a === undefined)
		return [];
	else if (!Array.isArray(a))
		return [a];	// Didn't return an array
	else
		return a;
}