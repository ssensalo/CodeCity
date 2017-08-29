/**
 * @license
 * Code City: Minimal code editor.
 *
 * Copyright 2017 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Code editor for Code City.
 * @author cpcallen@google.com (Christopher Allen)
 */

$.editor = { objs: [] };

$.editor.edit = function(obj, name, key) {
  /* Return a (valid) URL for a web editing session editing obj[key],
   * where obj might more commonly be known as name.
   */
  if (typeof obj !== 'object' && typeof obj !== 'function') {
    throw TypeError('Can only edit objects');
  }
  var objId = this.objIdFor(obj);
  var url = '/web/edit?objId=' + objId;
  if (name) {
    url += '&name=' + encodeURIComponent(name);
  }
  if (key) {
    url += '&key=' + encodeURIComponent(key);
  }
  return url;
};

$.editor.objIdFor = function(obj) {
  /* Find index of obj in this.objs, adding it if it's not already there.
   */
  for (var i = 0; i < this.objs.length; i++) {
    if (this.objs[i] === obj) {
      return i;
    }
  }
  var id = this.objs.length;
  this.objs.push(obj);
  return id;
};

$.editor.load = function(obj, key) {
  /* Return string containing initial editor contents for editing
   * obj[key].
   */
  // TODO(cpcallen): This should call toSource, once we have such a
  // function.
  var pd = Object.getOwnPropertyDescriptor(obj, key);
  var v = pd ? pd.value : undefined;
  return (typeof v === 'string' ?
      "'" + v.replace(/[\\']/g, '\$&') + "'" :
      String(v));
};

$.editor.save = function(obj, key, src) {
  /* Eval the string src and (if successful) save the resulting value
   * as obj[key].  If the value produced from src and the existing
   * value of obj[key] are both objects, then an attempt will be made
   * to copy any properties from the old value to the new one.
   */
  // Use Acorn to trim source to first expression.
  var ast = $.utils.acorn.parseExpressionAt(src, 0, { ecmaVersion: 5 });
  src = src.substring(ast.start, ast.end);
  // Evaluate src in global scope (eval by any other name, literally).
  // TODO: don't use eval - prefer Function constructor for
  // functions; generate other values from an Acorn parse tree.
  var evalGlobal = eval;
  var old = obj[key];
  var val = evalGlobal('(' + src + ')');
  if ($.utils.isObject(val) && $.utils.isObject(old)) {
    var keys = Object.getOwnPropertyNames(old);
    for (var i = 0, k; k = keys[i], i < keys.length; i++) {
      if (k === 'length' && typeof val === 'function') {
        continue;
      }
      var pd = Object.getOwnPropertyDescriptor(old, k);
      try {
        Object.defineProperty(val, k, pd);
      } catch (e) {
        try {
          // If defineProperty fails, try simple assignment.
          // TODO(cpcallen): remove this when server allows
          // (non-effective) redefinition of nonconfigurable
          // properties?
          val[k] = pd.value;
        } catch (e) {
          // Ignore failed attempt to copy properties.
        }
      }
    }
  }
  obj[key] = val;
  return src;
};


$.www.web.edit = function(path, params) {
  var objId = params.objId;
  var obj = $.editor.objs[params.objId];
  if (!$.utils.isObject(obj)) {
    // Bad edit URL.
    this.default();
    return;
  }
  var name = params.name, key = params.key, src = params.src;
  var status = '';
  if (src) {
    try {
      // Use Acorn to trim source to first expression.
      var ast = $.utils.acorn.parseExpressionAt(src, 0, { ecmaVersion: 5 });
      src = src.substring(ast.start, ast.end);
      src = $.editor.save(obj, key, src);
      status = '(saved)';
    } catch (e) {
      status = '(ERROR: ' + String(e) + ')';
    }
  } else {
    src = $.editor.load(obj, key);
  }
  var body = '<form action="/web/edit" method="get">';
  body += '<button type="submit" class="jfk-button-submit" id="submit"' +
      ' onclick="document.getElementById(\'src\').value = editor.getValue()">Save</button>';
  body += '<h1>Editing ' + $.utils.htmlEscape(name) + '.' +
      $.utils.htmlEscape(key) + ' <span id="status">' + status + '</span></h1>';
  body += '<input name="objId" type="hidden" value="' +
      $.utils.htmlEscape(objId) + '">';
  body += '<input name="name" type="hidden" value="' +
      $.utils.htmlEscape(name) + '">';
  body += '<input name="key" type="hidden" value="' +
      $.utils.htmlEscape(key) + '">';
  body += '<textarea name="src" id="src">' + $.utils.htmlEscape(src) + '\n</textarea>';
  body += '</form>';
  body += '<script>';
  body += '  var editor = CodeMirror.fromTextArea(document.getElementById("src"), {';
  body += '    lineNumbers: true,';
  body += '    matchBrackets: true,';
  body += '    viewportMargin: Infinity,';
  body += '  });';
  body += '  editor.on("change", function() {document.getElementById("status").innerText = "(modified)"});';
  body += '</script>';

  this.write('<!DOCTYPE html>');
  this.write('<html><head>');
  this.write('<title>Code Editor for ' +
      $.utils.htmlEscape(name) + '.' + $.utils.htmlEscape(key) + '</title>');
  this.write('<link href="/client/jfk.css" rel="stylesheet">');
  this.write('<link rel="stylesheet" href="/CodeMirror/codemirror.css">');
  this.write('<style>');
  this.write('  body {margin: 0; font-family: sans-serif}');
  this.write('  h1 {margin-bottom: 5; font-size: small}');
  this.write('  #submit {position: fixed; bottom: 1ex; right: 2ex; z-index: 9}');
  this.write('  .CodeMirror {height: auto; border: 1px solid #eee}');
  this.write('</style>');
  this.write('<script src="/CodeMirror/codemirror.js"></script>');
  this.write('<script src="/CodeMirror/javascript.js"></script>');

  this.write('</head><body>');
  this.write(body);
  this.write('</body></html>');
};
