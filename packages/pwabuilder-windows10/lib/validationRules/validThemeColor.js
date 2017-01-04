'use strict';

var manifoldjsLib = require('manifoldjs-lib');

var validationConstants = manifoldjsLib.constants.validation;

var Color = require('color');
var constants = require('../constants');

module.exports = function (manifestContent, callback) {
  if (manifestContent.theme_color) {
    try {
      var color = Color(w3cManifest.theme_color);
    } catch(error) {
      return callback(undefined, {
            'description': 'The theme color is not a valid color (' + manifestContent.theme_color + ')',
            'platform': constants.platform.id,
            'level': validationConstants.levels.warning,
            'members': validationConstants.manifestMembers.theme_color,
            'code': validationConstants.codes.invalidValue
          });
    }
  }
  return callback();
};