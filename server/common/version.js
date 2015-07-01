/**
 * The purpose of the "Version" object is to load the version config file and 
 * convert  the version string to a version object for easier version operation
 *  e.g:
 *		compareTo(), isValidVersion(), getDefaultVersion
 *  
 *  Below is a sample of Rest API version config:
 *		{
 *			"versionPrefix": "vnd.tenx.",
 *			"supportedVersions": [
 *				{
 *					"version": "v1.0"
 *				},
 *				{
 *					"version": "v2.0"
 *				}
 *			]
 *		}
 * The version convention is as below:
 *		v<major>.<minor>
 * The version prefix normally we suggest as below:
 *		<vendorName>.tenx.
 * 
 * As a start of the version configuration, we want to keep the config as simple as possible,
 * The version is for all types of tenX Rest APIs.  
 */

var Version = function(version) {
	if (version === undefined || "" === version) return this.getDefaultVersion();
	if (version instanceof Version) return version;
	if (typeof version !== "string") return;
	var separatorIndex = -1;
	// strictly check whether it is a local version string
	if (version.indexOf("v") === 0) {
		// local version string convention is
		// v<major>.<minor>
		separatorIndex = version.indexOf(".");
		this.major = Number(version.substring(1,separatorIndex));
		this.minor = Number(version.substring(separatorIndex + 1));
	}
	// strictly check whether it is a qualified version string
	if (version.indexOf(Version.config.versionPrefix) === 0) {
		// qualified version string convention is
		// <vendor>.<tenx>.v<major>.<minor>
		var localVersionStartPoing = version.indexOf("v", Version.config.versionPrefix.length);
		separatorIndex = version.indexOf(".", localVersionStartPoing);
		this.major = Number(version.substring(localVersionStartPoing+1,separatorIndex));
		this.minor = Number(version.substring(separatorIndex + 1));
	}
	
};

Version.prototype = {
		toLocalString: function() {
			return "v" + this.major + "." + this.minor;
		},
		toQualifiedString: function() {
			return Version.config.versionPrefix + "v" + this.major + "." + this.minor;
		},
		compareTo: function(rightObj) {
			if (this.major > rightObj.major) return 1;
			if (this.major < rightObj.major) return -1;
			if (this.minor > rightObj.minor) return 1;
			if (this.minor < rightObj.minor) return -1;
			return 0;
		},
		getDefaultVersion: function(){
			return Version.config.maxVersion;
		},
		isValidVersion: function(callback) {
			var error = null;
			
			if (this.compareTo(Version.config.maxVersion) > 0) {
				error = new Error("Invalid Rest API version[" + this.toQualifiedString() + 
						"] which is greater than the maximum Rest API version[" + Version.config.maxVersion.toQualifiedString()+"]");
				callback(error);
				return;
			}
			if (this.compareTo(Version.config.minVersion) < 0) {
				error = new Error("Invalid Rest API version[" + this.toQualifiedString() + 
						"] which is less than the minimal Rest API version[" + Version.config.minVersion.toQualifiedString()+"]");
				callback(error);
				return;
			}
			// can find one matched in the supported list
			var matched = false;
			for (var i = 0; i < Version.config.allSupportedVersions.length; i++) {
				if (this.compareTo(Version.config.allSupportedVersions[i]) === 0) {
					matched = true;
					break;
				} 
			}
			if (matched) {
				callback(undefined);
			} else {
				error = new Error("Invalid Rest API version[" + this.toQualifiedString() + 
						"] which is not in the supported version list");
				callback(error);
			}
		}
};

var fs = require('fs');
var file ='./apiVersion.json';

Version.config = JSON.parse(fs.readFileSync(file, 'utf8'));

// private function to parser the supported version to version object
function _getSupportedVersions() {
	if (Version.config.supportedVersions === undefined) return;
	var supportedVersions = [];
	for (var i = 0; i < Version.config.supportedVersions.length; i++) {
		supportedVersions.push(new Version(Version.config.supportedVersions[i].version));
	}
	return supportedVersions;
}

Version.config.allSupportedVersions = _getSupportedVersions();

//private function to get the max version
function _getMaxVersion(versions) {
	if (versions === undefined || versions.length === 0) return;
	var maxVersion = versions[0];
	for (var i = 1; i < versions.length; i ++) {
		if (maxVersion.compareTo(versions[i]) < 0) {
			maxVersion = versions[i];
		}
	}
	return maxVersion;
}

Version.config.maxVersion = _getMaxVersion(Version.config.allSupportedVersions);

//private function to get the min version
function _getMinVersion(versions) {
	if (versions === undefined || versions.length === 0) return;
	var minVersion = versions[0];
	for (var i = 1; i < versions.length; i ++) {
		if (minVersion.compareTo(versions[i]) > 0) {
			minVersion = versions[i];
		}
	}
	return minVersion;
}

Version.config.minVersion = _getMinVersion(Version.config.allSupportedVersions);

/**
 * Parsing the http accept header to generate a proper version object
 * @param accepted, http accept header
 * @returns {Version}
 */
Version.parseAcceptHeader = function(accepted) {
	var apiVersion = new Version();
	
	if (accepted === undefined) {
		return apiVersion;
	}
	
	for (var  i = 0; i < accepted.length; i++) {
		if (accepted[i] === undefined || accepted[i].subtype === undefined) {
			continue;
		}
		
		var subtype = accepted[i].subtype;
		var start = subtype.indexOf(Version.config.versionPrefix);
		if (start === -1) {
			continue;
		}
		var end = subtype.indexOf("+", start);
		var version = subtype.substring(start + Version.config.versionPrefix.length, end);
		apiVersion = new Version(version);
		break;
	}
	
	return apiVersion;
};

module.exports = Version;