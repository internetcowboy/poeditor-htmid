/*
 * poeditor-htmid
 * 
 *  This is an adaptation of a plugin found https://github.com/Philoozushi/grunt-poeditor-pz . This plugin will download the localizations for a particular project ID and then get all of the string associated with the project. This plugin is to be used in combination with the other htmid plugins.
 *
 * Copyright (c) 2016 Codin Pangell
 * Licensed under the MIT license.
 */

'use strict';


var fs = require('fs'),
  wget = require('wget'),
  https = require('https'),
  colors = require('colors'),
  request = require('request'),
  querystring = require('querystring');

var grunt;

module.exports = function(grunt) {

  // Please see the Grunt documentation for more information regarding task
  // creation: http://gruntjs.com/creating-tasks

  grunt.registerMultiTask('poeditor_htmid', 'This is an adaptation of a plugin found https://github.com/Philoozushi/grunt-poeditor-pz . This plugin will download the localizations for a particular project ID and then get all of the string associated with the project. This plugin is to be used in combination with the other htmid plugins.', function() {
    
    var data = this.data;
    var opts = this.options();
    download( data.download, this, opts, this.async() );

  });

};

function getLanguages(_scope,opts,data,_cb) {
  
  var done = _scope.async();
  var config ={
          action: 'list_languages',
          id: opts.project_id,
          api_token: opts.api_token
        };
  grunt.log.writeln("Request Language Information...");
  callAPI (config, function(res) {
    data.projectLanguages = res.list;
    grunt.log.writeln('->'.green, "Complete");
    _cb();
  });

}

function download(data, _scope, opts, done) {
  
  getLanguages(_scope,opts,data, function(){

    grunt.log.writeln("Download Localization Files...");
    
    data.api_token = opts.api_token;
    data.numLanguages = 0;

    for (var i in data.projectLanguages)
      data.numLanguages++;

    for (var i in data.projectLanguages) {

      //download file
      callAPI({
        api_token: data.api_token,
        action: 'export',
        id: data.project_id,
        language: data.projectLanguages[i]['code'],
        type: data.type
      },
      function(res, command) {
        if (res.item)
          exports[command.language] = res.item;
        if (--data.numLanguages == 0) {
          for (var polang in exports) {
            grunt.log.writeln('->'.green, polang+':', exports[polang]);
            downloadExports(exports, data, opts, function(paths) {
              done();
            });
          }
        }
      });

    }
  });

}

function downloadExports(exports, data, opts, handler) {
  
  var numDownloads = 0;
  for (var polang in exports)
    numDownloads++;
  
  var paths = [];
  for (var polang in exports) {
    
    var url = exports[polang];
    var lang = data.projectLanguages[polang];
    var path = data.dest.replace('?', lang);
    
    //add file name
    paths.push(path);

    //create closure to pass variables into scope we need.
    (function(_url,_path,_polang) {
          request(_url, function(err, res, body) {
              
              //just save the stuff we want in the format we want.
        var json = JSON.parse(body);
        var jsonData = {};
        var webfilename = "";
        for (var item in json) {
          var terms = json[item];
          
          //parse file name out (website file name). _term is something like this: 'index_ Title'
          var _term = terms.term;
          var webfilename = _term.split(" ")[0];
          _term = _term.split(" ")[1];
          webfilename = webfilename.split("_").join("");

          //add data to object
          jsonData[_term] = terms.definition;
        }

        //determine if the localization name has a force replacement.
        var _name = _polang;
        for (var key in opts.rewriteLangs) {
          if (key == _name) {
            _name = opts.rewriteLangs[key];
          }
        }
        //replace all dashes with underscores
        _name = _name.split("-").join("_");

        //save this data in place of the downloaded file. index--en_gb.json
        _path = _path + webfilename + "--" + _name.toLowerCase() + ".json";
        grunt.file.write(_path, JSON.stringify(jsonData));

        //keep track of completion
        if (--numDownloads == 0)
        handler(paths);

          });
      })( url, path, polang );

  }
}

function downloadExport(url, path, handler) {
  
  wget.download(url, path)
    .on('end', function(output) {
      handler(path,output);
    });
}

function callAPI(command, handler) {
  
  var postData = querystring.stringify(command);
  
  var req = https.request({
    host: 'poeditor.com',
    port: 443,
    path: '/api/',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': postData.length
    }
  },
  function(res) {
    res.setEncoding('utf8');
    res.on('data', function(data) {
      var res = JSON.parse(data);
      handler(res, command);
    });
  });
  
  req.write(postData);
  req.end();
}

function postAPI(data, handler) {
  
  request.post({
    url: 'https://poeditor.com/api/',
    formData: data
  }, handler);

}