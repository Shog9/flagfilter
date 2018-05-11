// ==UserScript==
// @name          FlagFilter
// @namespace  http://rubberduck.echoreply.us/
// @version       2.4
// @include       http*://stackoverflow.com/*
// @include       http*://meta.stackoverflow.com/*
// @include       http*://dev.stackoverflow.com/*
// @include       http*://askubuntu.com/*
// @include       http*://meta.askubuntu.com/*
// @include       http*://superuser.com/*
// @include       http*://meta.superuser.com/*
// @include       http*://serverfault.com/*
// @include       http*://meta.serverfault.com/*
// @include       http*://mathoverflow.net/*
// @include       http*://meta.mathoverflow.net/*
// @include       http*://*.stackexchange.com/*
// ==/UserScript==

// this serves only to avoid embarassing mistakes caused by inadvertently loading this script onto a page that isn't a Stack Exchange page
var isSEsite = false;
for (var s of document.querySelectorAll("script")) isSEsite = isSEsite||/StackExchange\.ready\(/.test(s.textContent);

// don't bother running this if the user isn't a moderator on the current site
if (!isSEsite || typeof StackExchange === "undefined" || !StackExchange.options.user.isModerator)
{
   return;
}
 
var baseUrl = "https://shog9.github.io/flagfilter/";

var defScript = document.createElement("script");
defScript.type = "text/javascript";
defScript.textContent = "(" + defines.toString() + ")(jQuery,'" + baseUrl + "')";
document.body.appendChild(defScript);

function defines(jQuery, baseUrl)
{
   window.FlagFilter = {
      baseUrl: baseUrl,
      version: 2
   };
}

var scripts = ['doT', 'flagTemplates', 'flagfilter'];
for (var i=0; i<scripts.length; ++i)
{
   var script = document.createElement("script");
   script.type = "text/javascript";
   script.src = baseUrl + scripts[i] + ".js?" + Date.now();
   document.body.appendChild(script);
}

function reqListener () {
  console.log(this.responseText);
}

var styles = document.createElement("link");
styles.type = "text/css";
styles.rel = "stylesheet";
styles.href = baseUrl + "styles.css?" + Date.now();
document.head.appendChild(styles);

