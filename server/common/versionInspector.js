// The version indicator will be included in HTTP accept header, using below convention:
//		Accept: <type>/<vendor>.tenx.<localVersion>+<subType>
//		e.g: 
//			Accept: application/vnd.tenx.v1.0+json

var Version = require("./version");
var util = require("./requestUtils");
var logger = require("./loggerUtil").getLogger("versionInspector");

function _getSupportedVersions() {
	var supportedVersions = Version.config.allSupportedVersions;
	var  supportedVersionFullNames = "[";
	for (var i = 0; i < supportedVersions.length; i++) {
		supportedVersionFullNames = supportedVersionFullNames + supportedVersions[i].toQualifiedString() + ",";
	}
	supportedVersionFullNames = supportedVersionFullNames.substring(0, supportedVersionFullNames.length) + "]";
	return supportedVersionFullNames;
}

exports.inspect = function inspect(req, res, next) {
	var accepted = req.accepted;
	var methodName = "inspect()";

	if (accepted === undefined || accepted.length === 0 ) {
		return next();
	}
	
	var apiVersion = Version.parseAcceptHeader(accepted);
	apiVersion.isValidVersion(function(error) {
		if (error === null || error === undefined) {
			return next();
		} 
		
		logger.error(methodName, "Failed with API version validation", error);
		util.unifiedErrorResponse(req, 
				"CDVR0001E", 
				[apiVersion.toQualifiedString(), _getSupportedVersions()], 
				error, 
				util.httpcode.NOT_ACCEPTABLE, 
				res);
	});
};
