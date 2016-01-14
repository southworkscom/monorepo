﻿'use strict';

var platformTools = require('./platformTools');

function platformsValid(platforms) {
  var availablePlatforms = platformTools.listPlatformsSync();

  for (var i = 0; i < platforms.length; i++) {
    if (availablePlatforms.indexOf(platforms[i].toLowerCase()) < 0) {
      return false;
    }
  }

  return true;
}

function platformToRunValid(platform) {
  var platformsToRun = ['windows', 'android'];

  if (!platform || platformsToRun.indexOf(platform.toLowerCase()) < 0) {
    return false;
  }

  return true;
}

function logLevelValid(level) {
  var availableLevels = ['debug', 'info', 'warn', 'error'];
  return availableLevels.indexOf(level.toLowerCase()) >= 0;
}

module.exports = {
  platformsValid: platformsValid,
  platformToRunValid: platformToRunValid,
  logLevelValid: logLevelValid
};
