'use strict';

var fs = require('fs'),
    http = require('http'),
    path = require('path'),
    semver = require('semver'),
    Q = require('q');

var CustomError = require('./customError'),
    exec = require('./processTools').exec,
    log = require('./log');
    
var node_modules = 'node_modules';
var packageJson = 'package.json';

var installTask;
var installQueue = [];

function getPackageInformation (packageName) {
  var packagePath = path.dirname(require.main.filename);
  if (packageName) {
    packagePath = path.join(packagePath, node_modules, packageName);      
  }
  
  packagePath = path.join(packagePath, packageJson);
  var module = require(packagePath);
  if (!module) {
    throw new Error('Error retrieving information for module: \'' + packageName + '\'.');
  }
  
  return module;
}

function getPackageInformationForModule (dir) {
    
  try {
    if (!dir) {
      dir = require.main.filename;
    }

    var info = fs.statSync(dir);
    if (info.isFile()) {
      dir = path.dirname(dir);
    }
    
    var packagePath = path.join(dir, packageJson);
    return require(packagePath);
  }
  catch (err) {
    if (err.code !== 'MODULE_NOT_FOUND') {
      throw err;
    }
    
    var next = path.resolve(dir, '..');
    if (dir !== next) {
      return getPackageInformationForModule(next);      
    }    
  }
  
  throw new Error('Error retrieving information for module: \'' + dir + '\'.');
} 

function getNpmPackageInfo (packageName, callback) {
  var deferred = Q.defer();
  http.get('http://registry.npmjs.org/' + packageName + '/latest', function (res) {
    var data = '';
    
    res.on('data', function (chunk) {
      data += chunk;
    });
    
    res.on('end', function () {
      try {
        var packageJson = JSON.parse(data);
        deferred.resolve(packageJson);
      } catch (err) {
        deferred.reject(new Error('Error parsing version information for npm package: \'' + packageName + '\'. ' + err.message + '.'));
      }
    });
  }).on('error', function (err) {
    deferred.reject(new Error('Error retrieving version information for npm package: \'' + packageName + '\'. ' + err.message + '.'));
  });
  
  return deferred.promise.nodeify(callback);
}

function getNpmPackageLatestVersion (packageName, callback) {
  return getNpmPackageInfo(packageName).then(function (packageJson) {
    return packageJson.version;
  })
  .nodeify(callback);
}

function checkForUpdate (callback) {
  
  var currentModule = getPackageInformation();
  return getNpmPackageLatestVersion(currentModule.name).then(function (latestVersion) {
    var updateVersion = semver.lt(currentModule.version, latestVersion) ? latestVersion : undefined;
    return Q.resolve(updateVersion);
  })
  .nodeify(callback);
}

function installPackage (packageName, source, callback) {

  log.info('Installing new module: ' + packageName);

  // npm command in Windows is a batch file and needs to include extension to be resolved by spawn call
  var npm = (process.platform === 'win32' ? 'npm.cmd' : 'npm');
  var appRoot = path.dirname(require.main.filename);
  return exec(npm, ['install', source], { cwd: appRoot }).then(function () {
    var module = require(packageName);
    return Q.resolve(module);
  })
  .catch(function (err) {
    return Q.reject(new CustomError('Failed to install module: \'' + packageName + '\'.', err));
  })
  .nodeify(callback);
}

// Returns a promise that is fulfilled when the requested package is installed.
//
// Queued installation is recommended when installing multiple packages. This builds a queue of packages to install and then 
// launches a single npm instance to install all of them in a single operation. Launching multiple npm instances in parallel 
// sometimes runs into issues if an npm instance detects that some dependencies are missing because they are still being installed 
// by a different instance (npm WARN unmet dependency ...)
function queuePackageInstallation (packageName, source, callback) {

  installQueue.push({ packageName: packageName, source: source });
  if (!installTask) {
    installTask = Q.defer();
  }
  
  return installTask.promise.nodeify(callback);
}

// Triggers the installation of all queued packages.
function installQueuedPackages () {

  if (installQueue.length === 0) {
    return;
  }

  var moduleList = installQueue.reduce(function (previous, current) { return previous + (previous ? ', ' : '') + current.packageName; }, '');

  log.info('Installing the following module(s): \'' + moduleList + '\'...');

  // npm command in Windows is a batch file and needs to include extension to be resolved by spawn call
  var npm = (process.platform === 'win32' ? 'npm.cmd' : 'npm');
  var appRoot = path.dirname(require.main.filename);

  // build package list                    
  var sources = installQueue.map(function (item) { 
    return item.source;
  });
  
  // launch npm  
  return exec(npm, ['install'].concat(sources), { cwd: appRoot }).then(function () {
    // signal completion
    installTask.resolve(installQueue);
  })
  .catch(function (err) {
    return installTask.reject(new CustomError('Failed to install the following module(s): \'' + moduleList + '\'.', err));
  })
  .finally(function () {
    // clear queue
    installTask = undefined;
    installQueue = [];      
  });
}

module.exports = {
  getPackageInformation: getPackageInformation,
  getPackageInformationForModule: getPackageInformationForModule,
  getNpmPackageInfo: getNpmPackageInfo,
  getNpmPackageLatestVersion: getNpmPackageLatestVersion,
  checkForUpdate: checkForUpdate,
  installPackage: installPackage,
  queuePackageInstallation: queuePackageInstallation,
  installQueuedPackages: installQueuedPackages
};