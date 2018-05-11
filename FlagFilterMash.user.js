// ==UserScript==
// @name          FlagFilter Mashup
// @description   Alternate flag UI scratchpad
// @author        Shog9
// @namespace     https://github.com/Shog9/flagfilter/
// @updateURL https://github.com/Shog9/flagtools/raw/master/FlagFilter.user.js
// @downloadURL https://github.com/Shog9/flagtools/raw/master/FlagFilter.user.js
// @version       3.11
// @include       http*://stackoverflow.com/*
// @include       http*://*.stackoverflow.com/*
// @include       http*://dev.stackoverflow.com/*
// @include       http*://askubuntu.com/*
// @include       http*://superuser.com/*
// @include       http*://serverfault.com/*
// @include       http*://mathoverflow.net/*
// @include       http*://*.stackexchange.com/*
// @exclude       http*://chat.*.com/*
// ==/UserScript==

// this serves only to avoid embarassing mistakes caused by inadvertently loading this script onto a page that isn't a Stack Exchange page
var isSEsite = false;
for (var s of document.querySelectorAll("script")) isSEsite = isSEsite||/StackExchange\.ready\(/.test(s.textContent);

// don't bother running this if the user isn't a moderator on the current site
if (!isSEsite || typeof StackExchange === "undefined" || !StackExchange.options.user.isModerator)
{
   return;
}

function with_jquery(f) 
{
  var script = document.createElement("script");
  script.type = "text/javascript";
  script.textContent = "if (window.jQuery) (" + f.toString() + ")(window.jQuery)" + "\n\n//# sourceURL=FlagFilter.userscript";
  document.body.appendChild(script);
}


with_jquery(function()
{
   FlagFilter = {};
   // crap I'd normally load separately
// doT.js
// 2011, Laura Doktorova, https://github.com/olado/doT
// Licensed under the MIT license.

(function() {
	"use strict";

	var doT = {
		version: '1.0.1',
		templateSettings: {
			evaluate:    /\{\{([\s\S]+?(\}?)+)\}\}/g,
			interpolate: /\{\{=([\s\S]+?)\}\}/g,
			encode:      /\{\{!([\s\S]+?)\}\}/g,
			use:         /\{\{#([\s\S]+?)\}\}/g,
			useParams:   /(^|[^\w$])def(?:\.|\[[\'\"])([\w$\.]+)(?:[\'\"]\])?\s*\:\s*([\w$\.]+|\"[^\"]+\"|\'[^\']+\'|\{[^\}]+\})/g,
			define:      /\{\{##\s*([\w\.$]+)\s*(\:|=)([\s\S]+?)#\}\}/g,
			defineParams:/^\s*([\w$]+):([\s\S]+)/,
			conditional: /\{\{\?(\?)?\s*([\s\S]*?)\s*\}\}/g,
			iterate:     /\{\{~\s*(?:\}\}|([\s\S]+?)\s*\:\s*([\w$]+)\s*(?:\:\s*([\w$]+))?\s*\}\})/g,
			varname:	'it',
			strip:		true,
			append:		true,
			selfcontained: false
		},
		template: undefined, //fn, compile template
		compile:  undefined  //fn, for express
	}, global;

	if (typeof module !== 'undefined' && module.exports) {
		module.exports = doT;
	} else if (typeof define === 'function' && define.amd) {
		define(function(){return doT;});
	} else {
		global = (function(){ return this || (0,eval)('this'); }());
		global.doT = doT;
	}

	function encodeHTMLSource() {
		var encodeHTMLRules = { "&": "&#38;", "<": "&#60;", ">": "&#62;", '"': '&#34;', "'": '&#39;', "/": '&#47;' },
			matchHTML = /&(?!#?\w+;)|<|>|"|'|\//g;
		return function() {
			return this ? this.replace(matchHTML, function(m) {return encodeHTMLRules[m] || m;}) : this;
		};
	}
	String.prototype.encodeHTML = encodeHTMLSource();

	var startend = {
		append: { start: "'+(",      end: ")+'",      endencode: "||'').toString().encodeHTML()+'" },
		split:  { start: "';out+=(", end: ");out+='", endencode: "||'').toString().encodeHTML();out+='"}
	}, skip = /$^/;

	function resolveDefs(c, block, def) {
		return ((typeof block === 'string') ? block : block.toString())
		.replace(c.define || skip, function(m, code, assign, value) {
			if (code.indexOf('def.') === 0) {
				code = code.substring(4);
			}
			if (!(code in def)) {
				if (assign === ':') {
					if (c.defineParams) value.replace(c.defineParams, function(m, param, v) {
						def[code] = {arg: param, text: v};
					});
					if (!(code in def)) def[code]= value;
				} else {
					new Function("def", "def['"+code+"']=" + value)(def);
				}
			}
			return '';
		})
		.replace(c.use || skip, function(m, code) {
			if (c.useParams) code = code.replace(c.useParams, function(m, s, d, param) {
				if (def[d] && def[d].arg && param) {
					var rw = (d+":"+param).replace(/'|\\/g, '_');
					def.__exp = def.__exp || {};
					def.__exp[rw] = def[d].text.replace(new RegExp("(^|[^\\w$])" + def[d].arg + "([^\\w$])", "g"), "$1" + param + "$2");
					return s + "def.__exp['"+rw+"']";
				}
			});
			var v = new Function("def", "return " + code)(def);
			return v ? resolveDefs(c, v, def) : v;
		});
	}

	function unescape(code) {
		return code.replace(/\\('|\\)/g, "$1").replace(/[\r\t\n]/g, ' ');
	}

	doT.template = function(tmpl, c, def) {
		c = c || doT.templateSettings;
		var cse = c.append ? startend.append : startend.split, needhtmlencode, sid = 0, indv,
			str  = (c.use || c.define) ? resolveDefs(c, tmpl, def || {}) : tmpl;

		str = ("var out='" + (c.strip ? str.replace(/(^|\r|\n)\t* +| +\t*(\r|\n|$)/g,' ')
					.replace(/\r|\n|\t|\/\*[\s\S]*?\*\//g,''): str)
			.replace(/'|\\/g, '\\$&')
			.replace(c.interpolate || skip, function(m, code) {
				return cse.start + unescape(code) + cse.end;
			})
			.replace(c.encode || skip, function(m, code) {
				needhtmlencode = true;
				return cse.start + unescape(code) + cse.endencode;
			})
			.replace(c.conditional || skip, function(m, elsecase, code) {
				return elsecase ?
					(code ? "';}else if(" + unescape(code) + "){out+='" : "';}else{out+='") :
					(code ? "';if(" + unescape(code) + "){out+='" : "';}out+='");
			})
			.replace(c.iterate || skip, function(m, iterate, vname, iname) {
				if (!iterate) return "';} } out+='";
				sid+=1; indv=iname || "i"+sid; iterate=unescape(iterate);
				return "';var arr"+sid+"="+iterate+";if(arr"+sid+"){var "+vname+","+indv+"=-1,l"+sid+"=arr"+sid+".length-1;while("+indv+"<l"+sid+"){"
					+vname+"=arr"+sid+"["+indv+"+=1];out+='";
			})
			.replace(c.evaluate || skip, function(m, code) {
				return "';" + unescape(code) + "out+='";
			})
			+ "';return out;")
			.replace(/\n/g, '\\n').replace(/\t/g, '\\t').replace(/\r/g, '\\r')
			.replace(/(\s|;|\}|^|\{)out\+='';/g, '$1').replace(/\+''/g, '')
			.replace(/(\s|;|\}|^|\{)out\+=''\+/g,'$1out+=');

		if (needhtmlencode && c.selfcontained) {
			str = "String.prototype.encodeHTML=(" + encodeHTMLSource.toString() + "());" + str;
		}
		try {
			return new Function(c.varname, str);
		} catch (e) {
			if (typeof console !== 'undefined') console.log("Could not create a template function: " + str);
			throw e;
		}
	};

	doT.compile = function(tmpl, def) {
		return doT.template(tmpl, null, def);
	};
}());

/////////////////////////
// Templates
FlagFilter.templates = {"flag": function(it
/**/) {
var out='<h3><a href=\''+(it.url||'').toString().encodeHTML()+'\'>'+(it.title||'').toString().encodeHTML()+'</a></h3><div class="tags">';var arr1=it.tags;if(arr1){var tag,i1=-1,l1=arr1.length-1;while(i1<l1){tag=arr1[i1+=1];out+=' <a href="/questions/tagged/'+(tag||'').toString().encodeHTML()+'" class="post-tag" title="show questions tagged \''+(tag||'').toString().encodeHTML()+'\'" rel="tag">'+(tag||'').toString().encodeHTML()+'</a>';} } out+='</div><div class="author"> created <span title="'+(it.created)+'" class="relativetime"> '+(FlagFilter.tools.formatDate(it.created)||'').toString().encodeHTML()+' </span>';if(it.author){out+=' <a href=\''+(it.author.url||'').toString().encodeHTML()+'\'>'+(it.author.name||'').toString().encodeHTML()+'</a>';}else{out+=' unknown';}out+='</div><ul class="flagList">';var arr2=it.flags;if(arr2){var flag,i2=-1,l2=arr2.length-1;while(i2<l2){flag=arr2[i2+=1];out+=' <li>'+(flag.description)+' ';if(flag.relatedPosts){out+=' <ul> ';var arr3=flag.relatedPosts;if(arr3){var rpost,i3=-1,l3=arr3.length-1;while(i3<l3){rpost=arr3[i3+=1];out+=' <li><a href=\''+(rpost.url||'').toString().encodeHTML()+'\'>'+(rpost.title||'').toString().encodeHTML()+'</a></li> ';} } out+=' </ul> ';}out+=' - ';var arr4=flag.flaggers;if(arr4){var flagger,i=-1,l4=arr4.length-1;while(i<l4){flagger=arr4[i+=1];out+=' <a href=\''+(flagger.url||'').toString().encodeHTML()+'\'>'+(flagger.name||'').toString().encodeHTML()+'</a> ('+(flagger.helpfulFlags||0)+'/'+(flagger.declinedFlags||0)+'), ';} } out+=' <span title="'+(flag.created)+'" class="relativetime"> '+(FlagFilter.tools.formatDate(flag.created)||'').toString().encodeHTML()+' </span> </li>';} } out+='</ul>';return out;
},
"flagFilter": function(it
/**/) {
var out='';var arr1=it;if(arr1){var cat,i1=-1,l1=arr1.length-1;while(i1<l1){cat=arr1[i1+=1];out+='<h3>'+(cat.category||'').toString().encodeHTML()+'</h3><div class="flagFilterCategory"> <ul> ';var arr2=cat.filters;if(arr2){var filter,i2=-1,l2=arr2.length-1;while(i2<l2){filter=arr2[i2+=1];out+=' <li class="flagFilter"> <b>'+(filter.count)+'</b> &times; <a href=\'?filter='+(filter.search||'').toString().encodeHTML()+'\' class=\''+(filter.cssClass||"")+'\'>'+(filter.name||'').toString().encodeHTML()+'</a> </li> ';} } out+=' </ul></div>';} } return out;
},
"flagsLayout": function(it
/**/) {
var out='<div id="mainbar-full"> <div class="subheader"> <h1>Moderator Tools</h1> <div id="tabs"> <a href="/admin/links" title="moderator utilities and links">links</a> <a href="/admin" title="summary of moderator activity">history</a> <a href="/admin/dashboard" title="summary of current moderator alerts">flags</a> <a class="youarehere" href="/admin/flags" title="a simple list of all pending flags with fast filtering">filtered flags</a> <a href="/admin/posts/migrated/here" title="recently migrated posts">migrated</a> <a href="/admin/users" title="users with flags, user messages, suspended users, annotations">users</a> <a href="/admin/posts" title="locked posts, auto-flagged posts">posts</a> <a href="/admin/analytics" title="site usage metrics">analytics</a> </div> </div></div><div id="flagSort"><label>Sort:</label><label><input type="radio" name="sort" value="postDesc">post creation (desc)</label><label><input type="radio" name="sort" value="postAsc">post creation (asc)</label><label><input type="radio" name="sort" value="flagDesc" checked="checked">first flag (desc)</label><label><input type="radio" name="sort" value="flagAsc">first flag (asc)</label><label><input type="radio" name="sort" value="netHelpfulDesc">flagger hist (desc)</label><label><input type="radio" name="sort" value="netHelpfulAsc">flagger hist (asc)</label></div><div id=\'flaggedPosts\'> <h1>Loading Flags <img src=\'//sstatic.net/img/progress-dots.gif\'></h1></div><div id=\'flagFilters\'></div>';return out;
}};

/////////////////////////////
// CSS
var flagStyles = document.createElement("style");
flagStyles.textContent = `#flaggedPosts
{
	width: 640px;
	overflow: hidden;
	padding-right: 20px;
	float: left;
}

.FlaggedPost
{
	padding: .25em;
}

.FlaggedPost:nth-child(2n)
{
	background-color: rgba(0,0,0,0.025);
}

.FlaggedPost h3
{
   font-family: Arial;
   font-weight: normal;
   font-size: 16px;
}

#postflag-bar .nav-button.filtered-nav
{
   width: 30px;
   background-color: #33a030;
}

#postflag-bar .migration-link
{
	float: right;
}

ul.flagList
{
	clear: both;
	padding-top: 1em;
}

.author
{
	float: right;
}

#flagFilters
{
	width:320px;
	overflow:hidden;
}

.flagFilterCategory
{
	max-height: 200px;
	overflow: auto;
}

.flagFilterCategory ul
{
	list-style: none;
	margin-left: 1em;
}

#flagSort
{
	margin-bottom: 1em;
}

#flagSort label
{
	margin-right: 1em;
}
`;

document.head.appendChild(flagStyles);


$(function()
{
   initTools();
   initRoute();

function initRoute()
{
   if (/^\/admin/.test(window.location.pathname))
   {
      // add tab so we can find this thing
      $("#tabs a[href='/admin/dashboard']")
         .after('<a href="/admin/flags" title="a simple list of all pending flags with fast filtering">filtered flags</a>');
   }

   if (/^\/admin\/flags\/?$/.test(window.location.pathname) )
   {
      initFlagFilter();
   }

   if (/^\/questions\//.test(window.location.pathname))
   {
      initQuestionPage()
         .then(initKeyboard);
   }

}

//
// Misc utils
//

function getQSVal(name)
{
   var val = [];
   window.location.search.substr(1).split('&').forEach(function(p)
   {
      var kv = p.split('=');
      if ( kv[0] === name && kv.length > 1 )
         val.push(decodeURIComponent(kv[1]));
   });

   return val;
}

function goToFilteredFlag(delta)
{
   var filtered = localStorage.flaaaaags.split(',');
   var index = filtered.indexOf(location.pathname.match(/\/questions\/(\d+)/)[1]);
   if ( index+delta >= 0 && index+delta < filtered.length )
      window.location.pathname = "/questions/" + filtered[index+delta];
}


function predictMigrationDest(flagText)
{
   return loadMigrationSites()
      .then(function(sites)
      {
         var ret = {baseHostAddress: '', name: ''};
         
         if ( !/belongs|moved? to|migrat|better fit|stackexchange/.test(flagText) )
            return ret;
         
         sites.forEach(function(site)
         {
            var baseHost = site.site_url.replace(/^https?:\/\//, '');
            if ( (RegExp(baseHost.replace('.stackexchange.com', ''), 'i').test(flagText)
               || RegExp(site.name.replace(' ', '\\s?'), 'i').test(flagText))
               && ret.baseHostAddress.length < baseHost.length )
               ret = { baseHostAddress: baseHost, name: site.name };
         });
         return ret;
      });

   function loadMigrationSites()
   {
      var ret = $.Deferred();
      var cachekey = "flaaaaags.site-cache";
      var cacheExpiration = new Date();
      cacheExpiration = cacheExpiration.setHours(cacheExpiration.getHours()-24);
      var siteCache = localStorage.getItem(cachekey);
      if (siteCache) siteCache = JSON.parse(siteCache);
      if (siteCache && siteCache.age > cacheExpiration)
      {
         ret.resolve(siteCache.sites);
         return ret;
      }


      return $.get('https://api.stackexchange.com/2.2/sites?pagesize=500')
         .then(function(data)
         {
            var sites = [];
            var siteArray = data.items;
            if ( siteArray && siteArray.length && siteArray[0].name )
            {
               sites = siteArray;
               localStorage.setItem(cachekey, JSON.stringify({age: Date.now(), sites: sites}));
            }
            return sites;
         });
   }
}

//
// Generally-useful moderation routines
//
function initTools()
{
   FlagFilter.tools = {
      CloseReasons: { Duplicate: 'Duplicate', OffTopic: 'OffTopic', Unclear: 'Unclear', TooBroad: 'TooBroad', OpinionBased: 'OpinionBased' },
      UniversalOTReasons: { Default: 1, BelongsOnSite: 2, Other: 3 },

      // format for close options:
      // { closeReasonId            string - one of the close reasons above
      // duplicateOfQuestionId      number - question id for duplicate, otherwise not set
      // closeAsOffTopicReasonId    number - site-specific reason ID for OT, otherwise not set
      // belongsOnBaseHostAddress   string - host domain for destination site for OT, otherwise not set
      // offTopicOtherText          string - custom OT text for when the OT reason is "other"
      //                                     and offTopicOtherCommentId is not set
      // offTopicOtherCommentId     string - reference to an existing comment on the post describing
      //                                     why the question is off-topic for when the OT reason is "other"
      //                                     and offTopicOtherText is not specified.
      // originalOffTopicOtherText  string - the placeholder / prefix text used to prompt for the OT other reason,
      //                                     used when offTopicOtherText is specified, otherwise not set
      // }

      closeQuestion: function(postId, closeOptions)
      {
         closeOptions.fkey = StackExchange.options.user.fkey;
         return $.post('/flags/questions/' + postId + '/close/add', closeOptions)
      },

      migrateTo: function(postId, destinationHost)
      {
         return FlagFilter.tools.closeQuestion(postId,
            {
               closeReasonId: FlagFilter.tools.CloseReasons.OffTopic,
               closeAsOffTopicReasonId: FlagFilter.tools.UniversalOTReasons.BelongsOnSite,
               belongsOnBaseHostAddress: destinationHost
            });
      },

      annotateUser: function(userId, annotation)
      {
         return $.post('/admin/users/' + userId + '/annotate',
            {
               "mod-actions": "annotate",
               annotation: annotation,
               fkey: StackExchange.options.user.fkey
            });
      },

      reviewBanUser: function(userId, days, explanation)
      {
         var params = {
               userId: userId,
               reviewBanDays: days,
               fkey: StackExchange.options.user.fkey
            };
         if ( explanation )
            params.explanation = explanation;
         return $.post('/admin/review/ban-user', params);
      },


      formatDate: function(isoDate)
      {
         return (new Date(isoDate.replace(/\s/,'T')))
            .toLocaleDateString(undefined, {year: "numeric", month: "short", day: "numeric", timeZone: "UTC"});
      },

      dismissAllCommentFlags: function(commentId, flagId)
      {
         // although the UI implies it's possible, we can't currently dismiss individual comment flags
        return $.post('/admin/comment/' + commentId+ '/clear-flags', {fkey:StackExchange.options.user.fkey});
      },


      dismissFlag: function(postId, flagIds, helpful, declineId, comment)
      {
         var ticks = window.renderTimeTicks||(Date.now()*10000+621355968000000000);
         return $.post('/messages/delete-moderator-messages/' + postId + '/'
            + ticks + '?valid=' + helpful + '&flagIdsSemiColonDelimited=' + (flagIds.join ? flagIds.join(';') : flagIds),
            {comment: comment||declineId||'', fkey:StackExchange.options.user.fkey});
      },

      dismissAllFlags: function(postId, helpful, declineId, comment)
      {
         var ticks = window.renderTimeTicks||(Date.now()*10000+621355968000000000);
         return $.post('/messages/delete-moderator-messages/' + postId + '/'
            + ticks+ '?valid=' + helpful,
            {comment: comment||declineId||'', fkey:StackExchange.options.user.fkey});
      },

      moveCommentsToChat: function(postId)
      {
         return $.post('/admin/posts/' + postId + '/move-comments-to-chat', {fkey:StackExchange.options.user.fkey});
      },
      
      makeWait: function(msecs)
      {
         return function()
         {
            var args = arguments;
            var result = $.Deferred();
            setTimeout(function() { result.resolve.apply(result, args) }, msecs);
            return result.promise();
         }
      },
      
      
      flagDismissUI: function(uiParent)
      {
         var result = $.Deferred();
         var dismissTools = $('<div class="dismiss-flags-popup"><input type="text" maxlength="200" style="width:98%" placeholder="optional feedback (visible to the user)"><br><br><input type="button" value="helpful" title="the flags have merit but no further action is required"> &nbsp; &nbsp; <input type="button" value="decline: technical" title="errors are not mod biz"> <input type="button" value="decline: no evidence" title="to support these flags"> <input type="button" value="decline: no mods needed"  title="to handle these flags"> <input type="button" value="decline: standard flags"  title="Using standard flags helps us prioritize problems and resolve them faster. Please familiarize yourself with the list of standard flags"></div>');

         dismissTools
            .appendTo(uiParent)
            .slideDown();

         dismissTools.find("input[value='helpful']").click(function()
         {
            // dismiss as helpful
            dismissTools.remove();
            result.resolve({helpful: true, declineId: 0, comment: dismissTools.find("input[type=text]").val()});
         });
         dismissTools.find("input[value='decline: technical']").click(function()
         {
            dismissTools.remove();
            result.resolve({helpful: false, declineId: 1, comment: dismissTools.find("input[type=text]").val()});
         });
         dismissTools.find("input[value='decline: no evidence']").click(function()
         {
            dismissTools.remove();
            result.resolve({helpful: false, declineId: 2, comment: dismissTools.find("input[type=text]").val()});
         });
         dismissTools.find("input[value='decline: no mods needed']").click(function()
         {
            dismissTools.remove();
            result.resolve({helpful: false, declineId: 3, comment: dismissTools.find("input[type=text]").val()});
         });
         dismissTools.find("input[value='decline: standard flags']").click(function()
         {
            dismissTools.remove();
            result.resolve({helpful: false, declineId: 4, comment: dismissTools.find("input[type=text]").val()});
         });
         
         return result.promise();
      }

   };
}

//
// coopt a 404 to provide an easily-filterable list of flags
//

function initFlagFilter()
{
   var flaggedPosts = [];
   var initializing = true;

   document.title = "Flaaaaaags!";
   $('#content').html(FlagFilter.templates.flagsLayout());

   $("<div id='filterbox' style='position:fixed;bottom:0;left:0;width:100%;z-index:10000;background:white;'><hr><span style='float:right;padding-right:10em;' id='flagCount'></span> Filter: <input id='flagfilter' style='width:50%'></div>")
         .appendTo('body')

   $.get('/admin/all-flags')
      .done(function(fp)
      {
         FlagFilter.flaggedPosts = flaggedPosts = fp.sort(function(a,b){return b.flags.length-a.flags.length;});

         initializing = false;

         renderFilters(flaggedPosts, $('#flagFilters'));

         restoreFilter();

         var filterDelay;
         $("#flagfilter").keyup(function()
         {
           var filter = $(this).val();

           if ( filterDelay)
               clearTimeout(filterDelay);

           filterDelay = setTimeout(function()
            {
               filterDelay=null;
               setFilter(filter);
            }, 600);
         });

      });

   $("#flagFilters").on("click", ".flagFilter a", function(ev)
      {
         ev.preventDefault();
         history.pushState(this.href, '', this.href);
         restoreFilter();
      });

   $(window).on('popstate', restoreFilter);

   $("#flagSort input[name=sort]").click(restoreFilter);
      
   function restoreFilter()
   {
      var filter = getQSVal("filter")[0] || '';

      $("#flagfilter").val(filter);
      filterFlags(filter);
   }

   function setFilter(filter)
   {
      if ( filter === getQSVal("filter")[0] || '' )
         return;

      history.pushState(filter, '', filter ? '?filter=' + encodeURIComponent(filter) : location.pathname);
      filterFlags(filter);
   }

   function filterFlags(filter)
   {
      if ( initializing ) return;

      var filterFn = buildFilterFunction(filter);
      var sortFn = getSortFunction();
      var filteredFlaggedPosts = flaggedPosts.filter(filterFn);
      var collaspedFilteredFlaggedPosts = collapseFlags(filteredFlaggedPosts);
      var sortedCollapsedFilteredFlaggedPosts = collaspedFilteredFlaggedPosts.sort(sortFn);

      localStorage.setItem("flaaaaags",
         unique(sortedCollapsedFilteredFlaggedPosts.map(function(p) { return p.questionId; })).join(','));
      localStorage.setItem("flaaaaags.lastFilter", location.toString());

      $('#flaggedPosts').empty();
      renderFlags(sortedCollapsedFilteredFlaggedPosts).then(function()
      {
         $("<a>Dismiss all of these flags</a>")
            .appendTo('#flaggedPosts')
            .click(function() { dismissAllFilteredFlags($('#flaggedPosts'), unique(sortedCollapsedFilteredFlaggedPosts.map(function(p) { return p.postId; })), filter) });
      });

      $("#flagCount").text(filteredFlaggedPosts.length + " flagged posts");

      function getSortFunction()
      {
         var sortFuncs = {
            postDesc: function(a,b)
            {
               return new Date(a.created.replace(/\s/,'T'))-new Date(b.created.replace(/\s/,'T'));
            },
            postAsc: function(b,a)
            {
               return new Date(a.created.replace(/\s/,'T'))-new Date(b.created.replace(/\s/,'T'));
            },
            flagDesc: function(a,b)
            {
               return new Date(a.flags[0].created.replace(/\s/,'T'))-new Date(b.flags[0].created.replace(/\s/,'T'));
            },
            flagAsc: function(b,a)
            {
               return new Date(a.flags[0].created.replace(/\s/,'T'))-new Date(b.flags[0].created.replace(/\s/,'T'));
            },
            netHelpfulDesc: function(b,a)
            {
              var aHelpful = Math.max.apply(null,a.flags.map(function(f){return f.flagger.helpfulFlags-f.flagger.declinedFlags;}));
              var bHelpful = Math.max.apply(null,b.flags.map(function(f){return f.flagger.helpfulFlags-f.flagger.declinedFlags;}));
              return aHelpful-bHelpful;
            },
            netHelpfulAsc: function(a,b)
            {
              var aHelpful = Math.max.apply(null,a.flags.map(function(f){return f.flagger.helpfulFlags-f.flagger.declinedFlags;}));
              var bHelpful = Math.max.apply(null,b.flags.map(function(f){return f.flagger.helpfulFlags-f.flagger.declinedFlags;}));
              return aHelpful-bHelpful;
            }
         };

         return sortFuncs[$("#flagSort input[name=sort]:checked").val()] || sortFuncs.flagDesc;
      }

      function collapseFlags(flaggedPosts)
      {
         return flaggedPosts.map(function(fp)
         {
            var collapsedFlags = fp.flags
               .sort(function(a,b) { return new Date(a.created.replace(/\s/,'T'))-new Date(b.created.replace(/\s/,'T')); }) // oldest flag in a group wins
               .reduce(function(cf, flag)
               {
                  if ( !cf[flag.description] )
                  {
                     cf[flag.description] = flag;
                     flag.flaggers = [];
                  }
                  cf[flag.description].flaggers.push(flag.flagger);
                  return cf;
               }, {});
            collapsedFlags = $.map(collapsedFlags, function(flag) { return flag; });

            return $.extend({}, fp, {flags:collapsedFlags});
         });
      }

      function renderFlags(flaggedPosts, startAt)
      {
         var result = $.Deferred();
         
         // don't let these overlap
         clearTimeout(window.renderTimer);
         window.renderTimer = null; // debugging

         startAt = startAt||0;
         var startTime = Date.now();
         var maxRunTime = 150;

         var container = $('#flaggedPosts');

         for (; startAt<flaggedPosts.length && Date.now()-startTime < maxRunTime; ++startAt)
         {
            $("<div class='FlaggedPost'>")
               .html(FlagFilter.templates.flag(flaggedPosts[startAt]))
               .appendTo(container);
         }

         StackExchange.realtime.updateRelativeDates(); // render dates in the standard fashion

         // finish rendering after letting the display update
         if ( startAt<flaggedPosts.length )
            window.renderTimer = setTimeout(function() { renderFlags(flaggedPosts, startAt).then(function(){result.resolve()}); }, 100);
         else
            result.resolve();
            
         return result.promise();
      }
      
   }

   function buildFilterFunction(filter)
   {
      var filters = [];

      var filterOperators = {
         user: function(userId)
         {
            return this.author
               && (this.author.url == userId || this.author.url.indexOf("/users/"+userId+"/") == 0);
         },

         tag: function(tag)
         {
            return this.tags.some(function(t)
            {
               return t == tag;
            });
         },

         flagger: function(userId)
         {
            return this.flags.some(function(f)
            {
               return f.flagger
                  &&  (f.flagger.url == userId || f.flagger.url.indexOf("/users/"+userId+"/") == 0);
            });
         },

         type: function(type)
         {
            return this.flags.some(function(f)
            {
               return f.flagType + (f.flagReason||'')==type;
            });
         },

         selfflagged: function()
         {
            var author = this.author;
            return this.flags.some(function(f)
            {
               return f.flagger && author && f.flagger.url==author.url;
            });
         },

         not: function(filter)
         {
            var fn = buildFilterFunction(filter);
            return !fn(this);
         },

         isquestion: function() { return this.questionId==this.postId; },
         isanswer: function() { return this.questionId!=this.postId; },
         isdeleted: function() { return this.deleted; },
         isclosed: function() { return this.closed; },
         isanswered: function() { return this.hasAcceptedAnswer; },
         isaccepted: function() { return this.isAcceptedAnswer; }
      };

      $.each(filterOperators, function(name, fn)
      {
         filter = filter.replace(new RegExp("(?:fn)?\\:" + name + "(?:\\(("
            + "('((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\")|" // stolen from sizzle 'cause my eyes hurt to look at it
            + "[^\\)]*"
            + ")\\))", "g"),
            function()
            {
               var arg, i;
               for (i=4; !arg && i>0; --i)
                  arg = arguments[i];

               filters.push(function(fp)
               {
                  return fn.call(fp, arg);
               });
               return '';
            });
            return filter !== '';
      });

      if ( $.trim(filter).length || !filters.length )
      {
         filters.push(function(fp)
         {
            return fp.flags.some(function (f)
            {
               return new RegExp(filter||'', 'i').test(f.description);
            });
         });
      }

      return function(fp) { return filters.every(function(f) { return f(fp); }); }
   }

   function buildFilters(flaggedPosts)
   {
      var filters = {};
      function addFilter(category, name, search, cssClass)
      {
         var cat = filters[category] = filters[category]||{};
         var filter = cat[search] = cat[search]
            ||{name:name,search:encodeURIComponent(search), cssClass: cssClass, count:0};
         filter.count++;
      }
      function addSearchFilter(category, name, search, cssClass)
      {
         var count = flaggedPosts.filter(buildFilterFunction(search)).length;
         if ( !count ) return;

         var cat = filters[category] = filters[category]||{};
         var filter = cat[search] = cat[search]
            ||{name:name,search:encodeURIComponent(search), cssClass: cssClass, count:0};
         filter.count = count;
      }

      flaggedPosts.forEach(function(p)
      {
         // flaggers
         p.flags.forEach(function(f)
         {
            if ( f.flagger )
               addFilter("Users with flags", f.flagger.name, "fn:flagger("+f.flagger.url.match(/-?\d+/)[0]+")");
         });

         // flaggees
         if ( p.author )
            addFilter("Users with flagged posts", p.author.name, "fn:user("+p.author.url.match(/-?\d+/)[0]+")");

         // tags
         p.tags.forEach(function(tag)
         {
               addFilter("Tags", tag, "fn:tag("+tag+")", "post-tag");
         });

         // flag types
         p.flags.forEach(function(f)
         {
            addFilter("Flag types",
               f.flagType=="PostOther" || f.flagType=="CommentOther"
                  ? "Other"
                  : f.description + (f.flagReason ? ' (' + f.flagReason + ')' : ''),
               "fn:type("+f.flagType + (f.flagReason||'') +")");
         });
      });


      // ad-hoc
      addSearchFilter("Low-hanging fruit", "Plagiarism", "plagia|copied.{1,16}from");
      addSearchFilter("Low-hanging fruit", "Dead links", "dead");
      addSearchFilter("Low-hanging fruit", "Owner requests post deletion", "fn:selfflagged()delet");
      addSearchFilter("Low-hanging fruit", "Migration requests", "belongs|moved? to|migrat|better fit|stackexchange");
      addSearchFilter("Low-hanging fruit", "Reopen requests", "fn:isclosed()reopen|not.{1,4}duplicate");
      addSearchFilter("Low-hanging fruit", "Link-only answer", "fn:isanswer()link.?only");
      addSearchFilter("Low-hanging fruit", "Closed", "fn:isclosed()");
      addSearchFilter("Low-hanging fruit", "Deleted", "fn:isdeleted()");
      addSearchFilter("Low-hanging fruit", "Merge requests", "merge");
      addSearchFilter("Low-hanging fruit", "Duplicates", "duplicate:not(':isclosed()'):isquestion()");

      // convert objects to arrays, sort
      return $.map(filters, function(f, cat)
      {
         return {
            category: cat,
            filters: $.map(f, function(filter)
            {
               return filter;
            })
            .sort(function(a,b) { return b.count-a.count; })
         };
      })
      .sort(function(a,b) { return a.filters.length-b.filters.length; });
   }

   function renderFilters(flaggedPosts, container)
   {
      container.html(FlagFilter.templates.flagFilter(buildFilters(flaggedPosts)));
   }

   function unique(arr)
   {
      var check = {};
      return arr.slice()
         .filter(function(el)
         {
            var dup = check[el];
            check[el] = true;
            return !dup;
         });
   }
   
   function dismissAllFilteredFlags(parentContainer, postIdsToDismiss, filter)
   {       
      if ( !filter.length || postIdsToDismiss.length > 200 )
      {
         alert("Too many flags - filter it.")
         return;
      }

      var DoDismiss = function(helpful, declineId, comment)
      {
         if (!postIdsToDismiss.length)
            return;
         
         var flaggedPostId = postIdsToDismiss.pop();
         
         FlagFilter.tools.dismissAllFlags(flaggedPostId, helpful, declineId, comment)
         .then(FlagFilter.tools.makeWait(1000))
         .then(function() 
         { 
            FlagFilter.flaggedPosts = flaggedPosts = FlagFilter.flaggedPosts.filter(f => f.postId != flaggedPostId);
            filterFlags(filter);
            DoDismiss(helpful, declineId, comment)
         });
      };
      
      flagFilter.tools.flagDismissUI(parentContainer).then(function(dismissal)
      {
         if (!confirm("ARE YOU SURE you want to dismiss ALL FLAGS on these " + postIdsToDismiss.length + " posts all at once??"))
            return;
         
         DoDismiss(dismissal.helpful, dismissal.declineId, dismissal.comment);
      });

   }
   
}


function initQuestionPage()
{
   var loaded = $.Deferred();
   
   var flagCache = {};
   GetFlagInfoFromWaffleBar();
   $('#postflag-bar').remove();
   
   // depending on when this gets injected, these *may* already be loaded
   if ( $(".post-issue-display").length )
      loaded.resolve();
   
   loaded.then(function()
   {
      initFlags();
   
      if ( localStorage.flaaaaags )
      {
         $(".nav-button.next")
            .addClass("filtered-nav")
            .attr("title", "go to the next filtered flag")
            .off("click")
            .click(function(e) { goToFilteredFlag(1) });
         $(".nav-button.prev")
            .addClass("filtered-nav")
            .attr("title", "go to the previous filtered flag")
            .off("click")
            .click(function(e) { goToFilteredFlag(-1) });

         // show progress
         var filtered = localStorage.flaaaaags.split(',');
         var index = filtered.indexOf(location.pathname.match(/\/questions\/(\d+)/)[1]);
         $("#postflag-bar>div").append("<a href='" + localStorage.getItem("flaaaaags.lastFilter") + "' style='position:absolute;left: 40px;top:5px;'>" + (index+1) + " of " + filtered.length + "</div>");
      }

      // add a migrate options, if appropriate
      $(".mod-message .active-flag")
         .each(function()
         {
            var el = this;
            predictMigrationDest(this.innerText)
               .done(function(site)
               {
                  if (!site.name) return;
                  $("<a>")
                     .attr("href", "#")
                     .addClass("migration-link")
                     .html("belongs on " + site.name + "?")
                     .click(function()
                     {
                        var questionId = location.pathname.match(/\/questions\/(\d+)/)[1];
                        if ( confirm("Really migrate this question to " + site.name + "?") )
                           FlagFilter.tools.migrateTo(questionId, site.baseHostAddress)
                              .done(function() { location.reload() })
                              .fail(function() { alert("something went wrong") });
                     })
                     .insertBefore(el)
               })
         });
         
         

      //  Wire up prototype mod tools
      $("#content")
         // Comment flag dismissal
         .on("click", ".mod-tools .mod-tools-comment .flag-dismiss", function(ev)
         {
            ev.preventDefault();

            var commentId = $(this).parents(".comment").attr("id").match(/comment-(\d+)/)[1];
            var flagId = $(this).parents(".flag-info").data("flag-id");
            var flagListItem = $(this).parents(".flag-info").parent();
            if ( !commentId || !flagListItem.length )
               return;

            FlagFilter.tools.dismissAllCommentFlags(commentId, flagId)
               .done(function() { flagListItem.hide('medium'); });
         })

         // Make individual flag dismissal work
         .on("click", ".mod-tools .mod-tools-post .flag-dismiss", function()
         {
            var post = $(this).parents(".question, .answer");
            var postId = post.data("questionid") || post.data("answerid");
            var flagIds = $(this).parents(".flag-info").data("flag-ids");
            var flagListItem = $(this).parents(".flag-info").parent();
            if ( !postId || !flagIds || !flagListItem.length )
               return;

            FlagFilter.tools.flagDismissUI(flagListItem).then(function(dismissal)
            {
               FlagFilter.tools.dismissFlag(postId, flagIds, dismissal.helpful, dismissal.declineId, dismissal.comment)
                  .done(function(){ flagListItem.hide('medium') });
            });
         })

         // Make "dismiss all" work
         .on("click", ".mod-tools .flag-dismiss-all", function()
         {
            var post = $(this).parents(".question, .answer");
            var postId = post.data("questionid") || post.data("answerid");

            FlagFilter.tools.flagDismissUI($(this).parent()).then(function(dismissal)
            {
               FlagFilter.tools.dismissAllFlags(postId, dismissal.helpful, dismissal.declineId, dismissal.comment)
                  .done(function(){ post.find('.mod-tools').hide('medium') });
            });
         })

         // historical flag expansion
         .on("click", "a.show-all-flags", function()
         {
            var postContainer = $(this)
               .closest(".question,.answer");
            var postId = $(this)
               .data('postid');
            LoadAllFlags(postId)
               .then(flags => ShowFlags(postContainer, flags));
         });         
   });
   
   $(document)
      .ajaxSuccess(function(event, XMLHttpRequest, ajaxOptions)
      {
         if (ajaxOptions.url.indexOf("/admin/posts/issues/") == 0)
         {
            setTimeout(() =>loaded.resolve(), 1);
         }
         else if (/\/posts\/\d+\/comments/.test(ajaxOptions.url))
         {
            var postId = +ajaxOptions.url.match(/\/posts\/(\d+)\/comments/)[1];
            setTimeout(() => ShowCommentFlags(postId), 1);
         }
      });

   
   return loaded.promise();

   function initFlags()
   {
      var posts = $(".question, .answer");

      posts.each(function()
      {
         var postContainer = $(this),
            postId = postContainer.data('questionid') || postContainer.data('answerid'),
            issues = postContainer.find(".post-issue-display"),
            flagsLink = issues.find("a[href='/admin/posts/" + postId + "/show-flags']"),
            commentsLink = issues.find("a[href='/admin/posts/" + postId + "/comments']"),
            flags = flagCache[postId],
            totalFlags = flagsLink.length ? flagsLink.text().match(/\d+/)[0] : 0;

         if (!flagsLink.length) return;

         var tools = $(`<tr class="mod-tools" data-totalflags="${totalFlags}">
<td colspan="2">
<div class="mod-tools-post">
    <h3 class='flag-summary'><a class='show-all-flags' data-postid='${postId}'>${totalFlags} resolved flags</a></h3>
    <ul class="flags">
    </ul>
    <div class="mod-actions">
    </div>
</div>
</td>
</tr>`)
            .insertAfter(postContainer.find(">table tr:first"));

         if (flags)
            ShowFlags(postContainer, flags);
      });

   }

   function ShowFlags(postContainer, postFlags)
   {
      var tools = postContainer.find("tr.mod-tools");
      var modActions = tools.find(".mod-actions")
         .empty();

      var flagContainer = tools.find("ul.flags")
         .empty();
      var activeCount = 0;
      for (let flag of postFlags.flags)
      {
         if (flag.active) activeCount++;

         if (flag.description === "spam" || flag.description === "rude or abusive")
         {
            if (!tools.find(".flag-dispute-spam")
               .length)
               $("<input class='flag-dispute-spam' type='button' value='Clear spam/offensive' title='Deletes all rude or abusive and spam flags on this post, as well as any automatic Community downvotes. If this post reached the flag limit, it will be undeleted and unlocked, and the owner will have their rep restored.'>")
               .appendTo(modActions);
         }
         
         predictMigrationDest(flag.description)
            .done(function(site)
            {
               if (modActions.find(".migration-link").length) return;
               if (!site.name) return;
               $("<input class='migration-link' type='button' title='migrate this question to a site chosen by the magic 8-ball'>")
                  .val("belongs on " + site.name + "?")
                  .click(function()
                  {
                     var questionId = location.pathname.match(/\/questions\/(\d+)/)[1];
                     if ( confirm("Really migrate this question to " + site.name + "?") )
                        FlagFilter.tools.migrateTo(questionId, site.baseHostAddress)
                           .done(function() { location.reload() })
                           .fail(function() { alert("something went wrong") });
                  })
                  .appendTo(modActions);
            })
         

         let flagItem = RenderFlagItem(flag);
         flagContainer.append(flagItem);
      }

      if (activeCount > 0)
      {
         modActions.prepend(`
<input class="flag-dismiss-all" type="button" value="no further action…" title="dismiss any moderator / spam / rude / abusive flags on this post">
<input class="flag-delete-with-comment" type="button" value="delete with comment…" title="deletes this post with a comment the owner will see, as well as marking all flags as helpful">
`);
      }

      var totalFlags = tools.data("totalflags");
      if (postFlags.flags.length)
      {
         let flagSummaryText = [];
         if (activeCount > 0) flagSummaryText.push(activeCount + " active flags");
         if (activeCount < postFlags.flags.length) flagSummaryText.push((postFlags.flags.length - activeCount) + " resolved flags");
         tools.find("h3.flag-summary")
            .text(flagSummaryText.join("; "));
      }
      else if (totalFlags == postFlags.commentFlags.length)
         tools.hide();

      if (postFlags.commentFlags.length)
      {
         let issues = postContainer.find(".post-issue-display"),
            moreCommentsLink = $("#comments-link-" + postFlags.postId + " a:last:visible"),
            deletedCommentsLink = issues.find("a[href='/admin/posts/" + postFlags.postId + "/comments']"),
            inactiveCommentFlags = !postFlags.commentFlags.every(f => f.active);

         // load comments to trigger flag display
         if (inactiveCommentFlags && deletedCommentsLink.length)
            deletedCommentsLink.click();
         else if (moreCommentsLink.length)
            moreCommentsLink.click();
         else
            ShowCommentFlags(postFlags.postId);
      }

   }

   function ShowCommentFlags(postId)
   {
      var commentContainer = $("#comments-" + postId);
      var postContainer = commentContainer.closest(".question, .answer");
      var tools = postContainer.find("tr.mod-tools");
      var postFlags = flagCache[postId];

      if (!postFlags || !postFlags.commentFlags.length || !commentContainer.length) return;

      if (!commentContainer.find(".mod-tools-comment")
         .length)
      {
         commentContainer
            .addClass("mod-tools")
            .find(">table>tbody")
            .prepend(`<tr class="comment mod-tools-comment">
<td></td>
<td class="comment-text">
<h3 class="comment-flag-summary"></h3>
</td>
</tr>`);
      }

      var activeCount = 0;
      for (let flag of postFlags.commentFlags)
      {
         let comment = commentContainer.find("#comment-" + flag.commentId);
         let container = comment.find(".comment-text .flags");
         if (!container.length)
            container = $('<div><ul class="flags"></ul></div>')
            .appendTo(comment.find(".comment-text"))
            .find(".flags");

         comment.addClass("mod-tools-comment");

         if (flag.active) activeCount++;

         let flagItem = RenderFlagItem(flag);
         container.append(flagItem);
      }

      var totalFlags = tools.data("totalflags");
      var flagSummaryText = [];
      if (activeCount > 0) flagSummaryText.push(activeCount + " active comment flags");
      if (activeCount < postFlags.commentFlags.length)
         flagSummaryText.push((postFlags.commentFlags.length - activeCount) + " resolved comment flags");
      else if (postFlags.flags.length && activeCount + postFlags.flags.length < totalFlags)
         flagSummaryText.push("");
      commentContainer.find("h3.comment-flag-summary")
         .text(flagSummaryText.join("; "));

      // ensure resolved comment flags can be loaded even when there are active flags
      if (activeCount == postFlags.commentFlags.length && postFlags.flags.length && activeCount + postFlags.flags.length < totalFlags)
         commentContainer.find("h3.comment-flag-summary")
         .append(`<a class='show-all-flags' data-postid='${postFlags.postId}'>${totalFlags - (activeCount + postFlags.flags.length)} resolved comment flags</a>`);
   }

   function RenderFlagItem(flag)
   {
      let flagItem = $(`<li>
             <span class="flag-text revision-comment ${flag.active ? 'active-flag' : 'blur'}">${flag.description}</span>
             <span class="flag-info" data-flag-id="${flag.flagId||''}" data-flag-ids="${flag.flagIds ? flag.flagIds.join(';') : ''}">
                 –
                <span class="flaggers"></span>
                 <a class="flag-dismiss delete-tag" title="dismiss this flag"></a>
             </span>
         </li>`);

      if (flag.result)
      {
         $("<div class='flag-outcome'><i></i></div>")
               .find("i").text(flag.result + " – ").end()
            .append(flag.resultUser ? `<a href="/users/${flag.resultUser.userId}" class="flag-creation-user comment-user">${flag.resultUser.name}</a>` : '')
            .append(`<span class="flag-creation-date comment-date" dir="ltr"> <span title="${flag.resultDate.toISOString()}" class="relativetime-clean">${flag.resultDate.toLocaleDateString(undefined, {year: "2-digit", month: "short", day: "numeric", hour: "numeric", minute: "numeric", hour12: false, timeZone: "UTC"})}</span></span>`)
            .appendTo(flagItem);
      }

      if (!flag.active)
      {
         flagItem.find(".flag-dismiss")
            .remove();
      }

      if (flag.flaggers)
      {
         let flaggerNames = [];
         for (let user of flag.flaggers)
         {
            flaggerNames.push(`<a href="/users/${user.userId}" class="flag-creation-user comment-user">${user.name}</a>
               <span class="flag-creation-date comment-date" dir="ltr"><span title="${user.flagCreationDate.toISOString()}" class="relativetime-clean">${user.flagCreationDate.toLocaleDateString(undefined, {year: "2-digit", month: "short", day: "numeric", hour: "numeric", minute: "numeric", hour12: false, timeZone: "UTC"})}</span></span>`);
         }
         
         flagItem.find(".flaggers").append(flaggerNames.join(", "));
      }
      return flagItem;
   }

   function LoadAllFlags(postId)
   {
      return $.get("/admin/posts/timeline/" + postId)
         .then(function(r)
         {
            var ret = {
               postId: postId,
               flags: [],
               commentFlags: []
            };
            var flagList = $($.parseHTML(r))
               .find(".post-timeline .event-rows tr");
            flagList.has("td.event-type .flag")
               .each(function()
               {
                  var row = $(this);
                  var id = row.data("eventid");
                  var deleteRow = flagList.filter(".deleted-event-details[data-eventid=" + id + "]");
                  var created = row.find(">td.creation-date span.relativetime");
                  var eventType = row.find(">td.event-type>span.event-type");
                  var flagType = row.find(">td.event-verb>span");
                  var flagger = row.find(">td>span.created-by>a");
                  var description = row.find(">td.event-comment>span");
                  var deleted = deleteRow.find(">td.creation-date span.relativetime");
                  var mod = deleteRow.find(">td>span.created-by>a");
                  var result = deleteRow.find(">td.event-comment>span");

                  if ($.trim(eventType.text()) === "comment flag")
                  {
                     var comment = flagList.has("td.event-type>.comment")
                        .has("td.event-comment .toggle-comment-flags-container a[data-flag-ids*=" + id + "]");

                     ret.commentFlags.push(
                     {
                        flagId: id,
                        commentId: comment.data("eventid"),
                        description: $.trim(description.html()) || $.trim(flagType.text()),
                        active: !deleted.length,
                        result: $.trim(result.text()),
                        resultDate: deleted.length ? new Date(deleted.attr("title")) : null,
                        resultUser:
                        {
                           userId: mod.length ? +mod.attr("href")
                              .match(/\/users\/([-\d]+)/)[1] : -1,
                           name: mod.text()
                        },
                        flaggers: [
                        {
                           userId: flagger.length ? +flagger.attr("href")
                              .match(/\/users\/([-\d]+)/)[1] : -1,
                           name: flagger.text(),
                           flagCreationDate: new Date(created.attr("title"))
                        }]
                     });
                  }
                  else
                  {
                     ret.flags.push(
                     {
                        flagIds: [id],
                        description: $.trim(description.html()) || $.trim(flagType.text()),
                        active: !deleted.length,
                        result: $.trim(result.text()),
                        resultDate: deleted.length ? new Date(deleted.attr("title")) : null,
                        resultUser:
                        {
                           userId: mod.length ? +mod.attr("href")
                              .match(/\/users\/([-\d]+)/)[1] : -1,
                           name: mod.text()
                        },
                        flaggers: [
                        {
                           userId: flagger.length ? +flagger.attr("href")
                              .match(/\/users\/([-\d]+)/)[1] : -1,
                           name: flagger.text(),
                           flagCreationDate: new Date(created.attr("title"))
                        }]
                     });

                  }
               });

            flagCache[postId] = ret;

            return ret;
         });
   }


   function GetFlagInfoFromWaffleBar()
   {
      flagCache = flagCache||{};
      return $(".flagged-post-row")
         .map(function()
         {
            var fp = $(this);
            var ret = {
               postId: fp.data("post-id"),

               flags: fp.find(".flag-row")
                  .map(function()
                  {
                     var flag = $(this);
                     var ids = flag.data("flag-ids");
                     ids = ids.split ? ids.split(';')
                        .map(id => +id) : [ids];
                     return {
                        flagIds: ids,
                        description: $.trim(flag.find(".revision-comment")
                           .html()),
                        active: flag.find(".active-flag")
                           .length > 0,
                        flaggers: flag.find(">td>a[href*='/users/']")
                           .map(function()
                           {
                              var userId = this.href.match(/\/users\/([-\d]+)/);
                              return {
                                 id: userId && userId.length > 0 ? +userId[1] : null,
                                 name: this.textContent,
                                 flagCreationDate: new Date($(this)
                                    .next(".relativetime")
                                    .attr('title') || Date.now())
                              };
                           })
                           .toArray()
                     };
                  })
                  .toArray(),

               commentFlags: fp.find("table.comments tr")
                  .map(function()
                  {
                     var flag = $(this);
                     var commentId = flag.attr("class")
                        .match(/comment-flagged-(\d+)/);
                     if (!commentId || commentId.length < 2) return;
                     return {
                        commentId: +commentId[1],
                        active: true,
                        description: $.trim(flag.find(".revision-comment")
                           .html())
                     };
                  })
                  .toArray()
            };
            flagCache[ret.postId] = ret;
            return ret;
         })
         .toArray();
   }

   

}


function initKeyboard()
{
   if ( StackExchange.keyboardShortcuts )
      return false;
    
    function run () {
    
        var updateMessage;
    
        if (!(window.StackExchange && StackExchange.helpers && StackExchange.helpers.DelayedReaction))
            return;
    
        var TOP_BAR = StackExchange.options.user.canSeeNewHeaderDesign ? $("body > .js-so-header") : $("body > .topbar");
        function TOP_BAR_IS_STICKY() {
            return StackExchange.options.user.canSeeNewHeaderDesign && TOP_BAR.css("position") === "fixed";
        }
        
        
        function setting(name, val) {
            var prefix = "se-keyboard-shortcuts.settings.";
            if (arguments.length < 2) {
                try {
                    val = localStorage.getItem(prefix + name) ;
                    return val === "true" ? true : val === "false" ? false : val;
                } catch (e) {
                    return;
                }
            } else {
                try {
                    return localStorage.setItem(prefix + name, val);
                } catch (e) {
                    return;
                }
            }
        }
        
        var style = ".keyboard-console { background-color: black; background-color: rgba(0, 0, 0, .8); position: fixed; left: 100px; bottom: 100px;" +
                        "padding: 10px; text-align: left; border-radius: 6px; z-index: 1000 }" + // the global inbox has z-index 999
                    ".keyboard-console pre { background-color: transparent; color: #ccc; width: auto; height: auto; padding: 0; margin: 0; overflow: visible; line-height:1.5; border: none;}" +
                    ".keyboard-console pre b, .keyboard-console pre a { color: white !important; }" +
                    ".keyboard-console pre kbd { display: inline-block; font-family: monospace; }" +
                    ".keyboard-selected { box-shadow: 15px 15px 50px rgba(0, 0, 0, .2) inset; }"
        $("<style type='text/css' />").text(style).appendTo("head");
    
        function showConsole(text) {
            var cons = $(".keyboard-console pre");
            if (!text.length) {
                cons.parent().hide();
                return;
            }
            
            if (!cons.length) {
                cons = $("<div class='keyboard-console'><pre /></div>").appendTo("body").find("pre");
            }
            text = text.replace(/^!(.*)$/mg, "<b>$1</b>");
            cons.html(text).parent().show();        
        }
        
        function Shortcuts() {
            this.order = []
            this.actions = {}
        }
        
        Shortcuts.prototype.add = function (key, name, action)  {
            if (this.actions[key])
                StackExchange.debug.log("duplicate shortcut " + key);
            this.order.push(key);
            this.actions[key] = action;
            action.name = $("<span />").text(name).html();
        }

        function truncate(s) {
            s = $.trim(s.replace(/[\r\n ]+/g, " "));
            if (s.length > 40)
                s = s.substr(0, 37) + "...";
            return s;
        }

        function sequentialKeyForIndex(index) {
            if (index < 10)
                return "" + index;
            else if (index == 10)
                return "0";
            else
                return String.fromCharCode(54 + index); // A, B, ...
        }

        var sortOrderShortcuts = {};
        sortOrderShortcuts["featured"] = "B";
        sortOrderShortcuts["bugs"] = "G";

        function getOrderShortcuts(selector, actionName, innerSelector, userNumbersIfNoFixedShortcut) {
            var result = new Shortcuts();
            actionName = actionName || 'clickOrLink';
            var index = 1;
            $(selector + (innerSelector || " > a")).each(function (i, elem) {
                var text = $(elem).text().replace(/^\s*-?[\d*]*\s*|\s*$/g, ""),
                    s = $(elem).data("shortcut") || (userNumbersIfNoFixedShortcut && sequentialKeyForIndex(index++)) || sortOrderShortcuts[text]; // TODO: This check needs to be made earlier, before looping. Otherwise, you may get double entries.

                if (!s) {
                    s = text.replace(/[^a-z]/ig, "").toUpperCase();
                    if (!s) {
                        var match = /[\?&](answertab|tab|sort)=(\w+)/i.exec($(elem).attr('href')) || [];
                        s = (match[2] || '').toUpperCase();
                    }
                    
                    while (s.length && result.actions[s.charAt(0)])
                        s = s.substr(1);
                    
                    if (!s.length) {
                        StackExchange.debug.log("no suitable shortcut for sort order " + text);
                        return;
                    }
                }
                var action = {};
                action[actionName] = elem;
                result.add(s.charAt(0), text, action);
            });
            return result;
        }
    
        var popupMode = {
            name: "Popup...",
            isApplicable: function () { return $(".popup").length },
            getShortcuts: function () {
                var pane = $(".popup-active-pane"),
                    result = new Shortcuts(),
                    i = 1, j = 65,
                    animated = [];
                    
                var tabs = $(".popup .subheader [id='tabs']"); // multiple #tabs divs may be in the page :(
                if (tabs.find("> a").length > 1)
                    result.add("T", "switch tab", { next: getOrderShortcuts(".popup .subheader [id='tabs']")});
                    
                // Top level actions get the key 1...9, 0. If there are more then 10,
                // we continue with A, B,...
                // Second level options (e.g. under post -> lock) get A,B,... unless we're already using letters for top-level.
                // In that case, we start with the first free letter. "T" is used for switching tabs, but hopefully we'll never
                // reach that letter through popup options.
                    
                if (!pane.length)
                    pane = $(".popup");
                var topLevelActions = pane.find(
                    ".action-list > li > label > input[type='radio']:visible, " +
                    ".action-list > li > a[href]:visible, " +
                    ".action-list > li > .migration-targets input[type='radio']:visible");
                if (topLevelActions.length > 10)
                    j += topLevelActions.length - 10;
                topLevelActions.each(function () {
                    var radio = $(this),
                        li = radio.closest("li"),
                        label = li.add(li.find('> .migration-targets td:not(.target-icon)')).find("> label .action-name"),
                        subform = li.find(".action-subform");

                    var key = sequentialKeyForIndex(i);

                    if (radio.is("a")) {
                        result.add(key, truncate(radio.text()), { link: radio });
                        i++;
                        return;
                    }
                    
                    
                    result.add(key, truncate(label.text()) || "unknown action", { func: function () { radio.focus().click(); } });
                    
                    if (subform.length) {
                    
                        subform.find("input[type='radio']:visible").each(function () {
                            var jThis = $(this),
                                sublabel = jThis.parent().find(".action-name");
                            if (!sublabel.length)
                                sublabel = jThis.parent();
                            result.add(String.fromCharCode(j), truncate(sublabel.text() || "other"), { func: function () { jThis.focus().click(); }, indent: true });
                            j++;
                        });
                        animated.push(subform);                    
                    }
                    i++;
                });
                if (animated.length) {
                    result.animated = $(animated);
                }
                
              // shog-patch: make sure enter submits the form
              // (some pop-ups (dismiss flag, close) have text fields and a single button for submission, but 
              // the button ISN'T a submit-type button and thus won't be triggered by enter, requiring 
              // either tabbing or mouse.
              if ( !pane.find("button[type=submit], input[type=submit]").length && pane.find("button, input[type=button]").length==1)
              {
                 pane.keyup(function(ev)
                 {
                     if (ev.which!=13) return;

                     pane.find("button, input[type=button]").click();
                 });
              }
              // !shog-patch
              
                return result;
            }
        }
        
   // shog-patch: this is for the quick'n'dirty inline dismiss, NOT the actual pop-up
   // TODO: trigger pop-up mode for this, removing the necessity of a patch
    var dismissMode = {
        name: "Dismiss flags...",
        isApplicable: function () { return $(".dismiss-flags-popup").length },
        getShortcuts: function () {
            var result = new Shortcuts();

            result.add("H", "helpful", {click: ".keyboard-selected input[value='helpful']"});
            result.add("1", "decline: technical", {click: ".keyboard-selected input[value='decline: technical']"});
            result.add("2", "decline: no evidence", {click: ".keyboard-selected input[value='decline: no evidence']"});
            result.add("3", "decline: no mods needed", {click: ".keyboard-selected input[value='decline: no mods needed']"});
            result.add("4", "decline: use standard flags", {click: ".keyboard-selected input[value='decline: standard flags']"});
                return result;
            }
        }
   // !shog-patch
        
        function getTopBarDialogMode(name, diaSelector, itemSelector) {
            return {
                name: name,
                isApplicable: function () { return TOP_BAR.find(diaSelector).length; },
                getShortcuts: function () {
                    var choices = TOP_BAR.find(diaSelector + " " + itemSelector),
                        i, text, url, choice, result,
                        count = Math.min(choices.length, 10);
                    result = new Shortcuts();
                    for (i = 0; i < count; i++) {
                        choice = choices.eq(i);
                        var li = choice.closest("li");
                        text = truncate(li.find(".item-summary").text());
                        if (!text.length)
                            text = truncate(li.find(".item-location").text());
                        if (!text.length)
                            text = truncate(li.text());
                        url = choice.attr("href");
                        var key = i < 9 ? "" + (i + 1) : "0";
                        result.add(key, text, { url: url });
                    }
                    return result;
                }
            }
        }
        
        function getTopBarDialogShortcut(buttonSelector, name, diaSelector, itemSelector) {
            return {
                onlyIf: StackExchange.options.user.canSeeNewHeaderDesign ? ".js-so-header " + buttonSelector : ".topbar " + buttonSelector,
                func: function () { TOP_BAR.find(buttonSelector).click(); if (!TOP_BAR_IS_STICKY()){ animateScrollTo(0); } },
                initiatesMode: getTopBarDialogMode(name, diaSelector, itemSelector)
            };
        }
        
        var currentMode;
        function getCurrentMode() {
            if (!currentMode)
                return;
            if (!currentMode.isApplicable())
                return;
            return currentMode;
        }
        
        function init(forceSelectable) {
            var currentSelectabubble, // can't use the right name for this or it auto-enables the built-in keyboard script - ONLY an issue when this is all bundled up in a userscript
                shortcuts = new Shortcuts(),
                currentLevel = shortcuts,
                info = {},
                selectables = {
                    questionPage: {
                        name: "post", selector: ".question, .answer",
                        firstText: "select question", nextText: "select next post", prevText: "select prev post"
                    },
                    questionListing: { name: "question",
                        selector: "#questions .question-summary:visible, #question-mini-list .question-summary:visible, .user-questions .question-summary, "
                                  + "#questions-table .question-summary, .fav-post .question-summary, #bounties-table .question-summary",
                        firstText: "select first question", nextText: "select next question", prevText: "select prev question", gotoText: "go to selected question"
                    },
                    answerListing: {
                        name: "answer", selector: "#answers-table .answer-summary .answer-link, .user-answers .answer-summary",
                        firstText: "select first answer", nextText: "select next answer", prevText: "select prev answer", gotoText: "go to selected answer"
                    },
                    tagListing: {
                        name: "tag", selector: "#tags-browser .tag-cell",
                        firstText: "select first tag", nextText: "select next tag", prevText: "select prev tag", gotoText: "go to selected tag"
                    },
                    userListing: {
                        name: "user", selector: "#user-browser .user-info",
                        firstText: "select first user", nextText: "select next user", prevText: "select prev user", gotoText: "go to selected user"
                    },
                    badgeListing: {
                        name: "badge", selector: "body.badges-page tr td:nth-child(2)",
                        firstText: "select first badge", nextText: "select next badge", prevText: "select prev badge", gotoText: "go to selected badge"
                    },
                    userSiteListing: {
                        name: "site", selector: "#content .module .account-container",
                        firstText: "select first site", nextText: "select next site", prevText: "select prev site", gotoText: "go to selected site"
                    },
                    activityListing: {
                        name: "activity", selector: "table.history-table tr:has(div.date) td:last-child",
                        firstText: "select first activity", nextText: "select next activity", prevText: "select prev activity", gotoText: "go to selected activity"
                    },
                    reputationListing: {
                        name: "rep", selector: "table.rep-table > tbody > tr.rep-table-row > td:last-child",
                        firstText: "select first rep", nextText: "select next rep", prevText: "select prev rep", gotoText: "go to selected rep"
                    },
                    flagListing: {
                        name: "flag", selector: "table.flagged-posts.moderator > tbody > tr > td div.mod-post-header", hrefOnly: true,
                        firstText: "select first flagged post", nextText: "select next flagged post", prevText: "select prev flagged post", gotoText: "go to selected flag"
                    }
                    // shog-patch: navigating only flags on question w/ flags
                   ,flaggedQuestion: { 
                      name: "flagged post", 
                      selector: ".question:has('.mod-tools .flag-dismiss'), .answer:has('.mod-tools .flag-dismiss')",
                      firstText: "select first flag", nextText: "select next flag", prevText: "select prev flag", gotoText: "go to selected flag"
                   }
                   // !shog-patch
                };

            if (/^\/questions\/\d+/i.test(location.pathname)) {
                info.isQuestionPage = true;
                currentSelectabubble = selectables.questionPage;
            } else if (/^\/users(\/(edit|preferences|apps|mylogins|hidecommunities|account\-info))?\/(\d)+/i.test(location.pathname)) {
                info.isProfilePage = true;
            } else if (/^\/tags\/[^\/]+\/info$/i.test(location.pathname)) {
                info.isTagInfoPage = true;
            }

            if ($(selectables.answerListing.selector).length) {
                info.isAnswerListing = true;
                currentSelectabubble = selectables.answerListing;
            }

            if ($(selectables.questionListing.selector).length) {
                info.isQuestionListing = true;
                currentSelectabubble = selectables.questionListing;
            } else {
                for (var key in selectables) {
                    if (!selectables.hasOwnProperty(key) || /(?:question|answer)Listing/.test(key))
                        continue;
                    
                    if ($(selectables[key].selector).length) {
                        currentSelectabubble = selectables[key];
                        info["is" + key.charAt(0).toUpperCase() + key.substr(1)] = true;
                        break;
                    }
                }
            }

           // shog-patch: override question-page navigation when there are flags
           if ($(selectables.flaggedQuestion.selector).length) {
               info.isQuestionPage = true;
               currentSelectabubble = selectables.flaggedQuestion;
           }
           // !shog-patch
            
            info.isNewNav = $('.newnav').length;
    
            if (forceSelectable) {
                currentSelectabubble = forceSelectable;
            }
            
            if (currentSelectabubble)
                currentSelectabubble.elements = $(currentSelectabubble.selector);
    
            /* If the current site is a meta, then removing the "meta." is sufficient to find the address of
             * the main site. If the current site is not a meta, then we check the last link in the footer
             * (above the site list). If removing "meta." from that link gives us the current site, then
             * we know we have found the "feedback" link pointing to the site's meta. Note that the feedback
             * link may not exist at all (on child metas; in this case the link we find is the "contact"
             * link), or it may point to a site that is not the current site's meta (as is the case on stackapps).
             * Either case is handled fine here.
             *
             * *.meta.stackexchange.com does not exist at this time (see http://nickcraver.com/blog/2013/04/23/stackoverflow-com-the-road-to-ssl/
             * for why it may come), but the script is future-proof by already handling it. */
            var host = location.hostname;
            if (/^meta\./.test(host) || /\.meta\.stackexchange\.com$/.test(host)) {
                info.mainSiteLink = "//" + host.replace(/(^|\.)meta./, "$1");
            } else {
                var lastFooterLink = $("#footer-menu .top-footer-links a:last").attr("href");
                if (lastFooterLink && lastFooterLink.replace(/^.*\/\//, "").replace(/(^|\.)meta./, "$1") == host)
                    info.metaSiteLink = lastFooterLink;
            }
            
            function toggleAutoHelp() {
                var name = "disableAutoHelp",
                    current = setting(name);
                setting(name, !current);
                current = setting(name);
                shortcuts.actions.H.name = current ? "enable auto help" : "disable auto help";
                resetDelayed = StackExchange.helpers.DelayedReaction(reset, current ? 2000 : 5000, { sliding: true });
            }
            
            function buildShortcuts() {
                var G = new Shortcuts();
                
                shortcuts.add("G", "go to", { next: G });
                if (currentSelectabubble) {
                    shortcuts.add("U", currentSelectabubble.firstText, {
                        func: function () { select(0, false, false, false, true); }                    
                    });
                    shortcuts.add("J", currentSelectabubble.nextText, { func: function () { select(1, false); } });
                    shortcuts.add("K", currentSelectabubble.prevText, { func: function () { select(-1, false); } });
                    if (!info.isQuestionPage) {
                        shortcuts.add("Enter", currentSelectabubble.gotoText, { clickOrLink: ".keyboard-selected a" + (currentSelectabubble.hrefOnly ? "[href]" : "") });
                    }
                }
                
                G.add("H", "home page", { url: "/"});
                G.add("Q", "questions", { url: "/questions"});
                G.add("T", "tags", { url: "/tags" });
                G.add("U", "users", { url: "/users" });
                G.add("B", "badges", { url: "/badges" });
                G.add("N", "unanswered", { url: "/unanswered" });
                G.add("A", "ask question", { link: "#nav-askquestion[href]" }); // it's not a real link on the ask page itself, so don't offer the shortcut there
                G.add("P", "my profile", { link: ".profile-link,.profile-me" });
                if (info.mainSiteLink)
                    G.add("M", "main site", { url: info.mainSiteLink });
                else if (info.metaSiteLink)
                    G.add("M", "meta site", { url: info.metaSiteLink });
                G.add("C", "chat", { link: "#footer-menu a:contains('chat')" });
                
                var special = new Shortcuts();
                special.add("R", "review", { link: ".topbar-menu-links a[href='/review/']" });
                special.add("F", "flags", { link: ".topbar .mod-only .icon-flag" });
                G.add("S", "special pages", { next: special });
                G.add("E", "help center", { url: "/help" });

                var inPageNav = new Shortcuts();

                if (info.isNewNav) {
                    var actionName = 'click'; // force a click action since the click handlers are delegated, and not picked up by the clickOrLink checks
                    shortcuts.add('T', "tabs", { next: getOrderShortcuts(".tabs-list .intellitab", actionName, " a .tab-name", true) });
                }
                else if (info.isQuestionPage)
                    buildQuestionPageShortcuts();
                else if (info.isProfilePage) {

                    inPageNav.add("T", "tab", { next: getOrderShortcuts("#tabs") });
                    inPageNav.add("U", "user", { next: getOrderShortcuts(".reloaded > .tabs")});
                    inPageNav.add("S", "settings", { next: getOrderShortcuts("#profile-side #side-menu li") });

                    if (info.isQuestionListing && info.isAnswerListing) {
                        inPageNav.add("Q", "questions", { func: function() {
                            switchSelectable("questionListing");
                        } });
                        inPageNav.add("A", "answers", { func: function() {
                            switchSelectable("answerListing");
                        } });
                    }

                    var usermod = new Shortcuts();
                    usermod.add("M", "moderation tools", { click: ".user-moderator-link", initiatesMode: popupMode });
                    usermod.add("A", "annotations", {link: ".mod-flag-indicator[href^='/users/history']"});
                    usermod.add("F", "flagged posts", {link: ".mod-flag-indicator[href^='/users/flagged-posts']"});
                    shortcuts.add("M", "moderate", {next: usermod});
                }
                else if (info.isQuestionListing || info.isTagInfoPage) {
                    shortcuts.add("O", "order questions by", { next: getOrderShortcuts("#tabs") });
                }

                shortcuts.add("N", "in-page navigation", { next: inPageNav });

                G.add("F", "faq", { url: "/faq" });
    
                shortcuts.add("I", "inbox",
                    getTopBarDialogShortcut(".js-inbox-button", "Inbox item...", ".inbox-dialog", "li.inbox-item a")
                );
                shortcuts.add("R", "recent achievements",
                    getTopBarDialogShortcut(".js-achievements-button", "Achievement...", ".achievements-dialog", "ul.js-items li a")
                );
                shortcuts.add("Q", "mod messages",
                    getTopBarDialogShortcut(".js-mod-inbox-button", "Mod message...", ".modInbox-dialog", "li.inbox-item a")
                );
                shortcuts.add("F", "show freshly updated data", { click: ".new-post-activity, #new-answer-activity", reinit: true });
                shortcuts.add("S", "search", { func: function () { $("#search input").focus(); } });
                
                var P = getPagerShortcuts();
                shortcuts.add("P", "page", { next: P });
                shortcuts.add("?", "help", {
                    func: function () {
                        if ($(".keyboard-console").is(":visible")) {
                            reset();
                            return;
                        }
                        var s = "Keyboard shortcuts:";
                        if (updateMessage)
                            s = updateMessage + "\n" + s;
                        showHelp(s);
                    },
                    noReset: true,
                    unimportant: true
                });
                shortcuts.add("H", setting("disableAutoHelp") ? "enable auto help" : "disable auto help", { func: toggleAutoHelp, unimportant: true });
            }
            
            function getPagerShortcuts() {
                
                var pagerSelector;
                if (info.isQuestionPage) {
                    pagerSelector = ".pager-answers"
                } else {
                    pagerSelector = "";
                    if (info.isQuestionListing && info.isAnswerListing)
                        pagerSelector = { "question": "#questions-table ", "answer": "#answers-table " }[currentSelectabubble.name] || "";
                    pagerSelector += ".pager:first"
                }
                
                var result = new Shortcuts();
                result.add("F", "first page", { clickOrLink: pagerSelector + " a[title='go to page 1']" });
                result.add("P", "previous page", { clickOrLink: pagerSelector + " a[rel='prev']" });
                result.add("N", "next page", { clickOrLink: pagerSelector + " a[rel='next']" });
                result.add("L", "last page", { clickOrLink: pagerSelector + " .current ~ a:not([rel='next']):last" });
                return result;
            }
        
            function switchSelectable(key) {
                var newSelectable = selectables[key];
                if (newSelectable === currentSelectabubble)
                    return;
                currentSelectabubble = newSelectable;
                newSelectable.elements = $(newSelectable.selector);
                $(".keyboard-selected").removeClass("keyboard-selected");
                shortcuts.actions.P.next = getPagerShortcuts();                
                animateScrollTo(newSelectable.elements.first().offset().top - 100);
            }
            
            function selectedPostId() {
                var post = $(".keyboard-selected");
                if (post.is(".question")) {
                    return parseInt(location.pathname.replace(/^\/questions\/(\d+)\/.*$/, "$1"));
                } else if (post.is(".answer")) {
                    return parseInt(post.attr("id").replace("answer-", ""));
                } else {
                    return null;
                }
            }
            
            function buildQuestionPageShortcuts() {
                var V = new Shortcuts();
                shortcuts.add("V", "vote", { next: V, autoSelect: true });
                V.add("U", "up", { click: ".keyboard-selected .vote-up-off" });
                V.add("D", "down", { click: ".keyboard-selected .vote-down-off" });
                shortcuts.add("A", "answer", {
                    func: function () {
                        var input = $("#wmd-input:visible");
                        if (input.length)
                            input.focus();
                        else {
                            $("#show-editor-button input").click();
                            setTimeout(function () { $("#wmd-input:visible").focus(); }, 0); // if the user clicked "Ok" in the confirmation dialog, focus the input
                        }
                    },
                    onlyIf: "#wmd-input"
                });
                
                if ($(".edit-post").length) // inline editing
                    shortcuts.add("E", "edit", { click: ".keyboard-selected .edit-post", autoSelect: true });
                else
                    shortcuts.add("E", "edit", { link: ".keyboard-selected .post-menu a[href$='/edit']", autoSelect: true });
                    
                if ($("#edit-tags").length) // inline retagging
                    shortcuts.add("T", "retag", { click: "#edit-tags" });
                else
                    shortcuts.add("T", "retag", { link: ".question .post-menu a[href$='?tagsonly=true']" });
                    
                shortcuts.add("C", "add/show comments", { click: ".keyboard-selected .comments-link", autoSelect: true });
                shortcuts.add("L", "link", { click: ".keyboard-selected .post-menu a[id^='link-post-']", autoSelect: true });
                
               // shog-patch: again, fake inline dismiss 
               shortcuts.add("D", "dismiss flags", { click: ".keyboard-selected .flag-dismiss-all", initiatesMode: dismissMode, autoSelect: true });
               // !shog-patch
                
                var M = new Shortcuts();
                shortcuts.add("M", "moderate", { next: M, autoSelect: true });
                M.add("F", "flag", { click: ".keyboard-selected a[id^='flag-post-'], .keyboard-selected .flag-post-link", initiatesMode: popupMode });
                M.add("C", "close", { click: ".keyboard-selected a[id^='close-question-'], .keyboard-selected .close-question-link", initiatesMode: popupMode });
                M.add("D", "delete", { click: ".keyboard-selected a[id^='delete-post-']" });
                M.add("E", "suggested edit", { click: ".keyboard-selected a[id^='edit-pending-']" });
                M.add("M", "moderation tools", { click: ".keyboard-selected a.post-moderator-link", initiatesMode: popupMode });
                M.add("I", "post issues", { getNext: function () { return getOrderShortcuts(".keyboard-selected .post-issue-display"); }, onlyIf: ".keyboard-selected .post-issue-display" }); // the onlyIf isn't strictly necessary; just an optimization
                shortcuts.actions.G.next.add("O", "post owner's profile", { link: ".keyboard-selected .post-signature:last .user-details a[href^='/users/']" });
                shortcuts.actions.G.next.add("R", "post revisions", {
                    func: function (evt) { goToPage("/posts/" + selectedPostId() + "/revisions", evt.shiftKey); },
                    onlyIf: ".keyboard-selected"
                });
                shortcuts.add("O", "order answers by", { next: getOrderShortcuts("#tabs") });
            }
            
            function actionIsAvailable(action) {
        
                var onlyIf, o;
                
                if (action.hasOwnProperty("onlyIf")) {
                    onlyIf = action.onlyIf;
                } else {
                    if (action.autoSelect && !$(".keyboard-selected").length) {
                        select(1, false, true, true); //TODO: an options object may be in order...
                        setTimeout(function () { $(".keyboard-selected").removeClass("keyboard-selected"); }, 0);
                    }
                    if (action.clickOrLink)
                        onlyIf = function () { return $(action.clickOrLink).length; };
                    else
                        onlyIf = action.link || action.click
                }
                    
                if (onlyIf) {    
                    o = onlyIf;
                    if (typeof onlyIf === "string")
                        onlyIf = function () { return $(o).length };
                    else if (typeof onlyIf !== "function")
                        onlyIf = function () { return o; };
                }
                
                if (onlyIf && !onlyIf())
                    return false;
                
                var next;
                if (action.getNext)
                    next = action.getNext();
                else if (action.next)
                    next = action.next;
                
                if (next) {
                    for (var i = 0; i < next.order.length; i++) {
                        if (actionIsAvailable(next.actions[next.order[i]])) {
                            return true;
                        }
                    }
                    return false;
                }
                
                return true;       
            }
                    
            function select(delta, visibleOnly, onlyIfNothingYet, tempOnly, absolute) {
                if (!currentSelectabubble)
                    return;
                    
                if (!currentSelectabubble.elements) {
                    currentSelectabubble.elements = $(currentSelectabubble.selector);
                }
                
                if (!currentSelectabubble.elements.length)
                    return;
        
                var jWin = $(window),
                    windowTop = jWin.scrollTop(),
                    windowHeight = jWin.height(),
                    windowBottom = windowTop + windowHeight,
                    visibleChoices, choices,
                    currentIndex, nextIndex,
                    selected = $(".keyboard-selected"),
                    newSelected,
                    above, below, spaceFactor,
                    cycling = visibleOnly,
                    newTop, newHeight, newScroll;
    
                if (selected.length && onlyIfNothingYet)
                    return;
                
         // shog-patch: override navigation to navigate to next flag (optional)
           // if on the first/last flagged post here, move to the next one in the filtered list
           if ( (delta > 0 && $(currentSelectabubble.selector).last().is(".keyboard-selected"))
            || (delta < 0 && $(currentSelectabubble.selector).first().is(".keyboard-selected")) )
           {
              goToFilteredFlag(delta);
              return;
           }
         // !shog-patch
           
                if (visibleOnly || (!selected.length && !absolute)) {
                    visibleChoices = currentSelectabubble.elements.filter(function () {
                        var jThis = $(this),
                            thisTop = jThis.offset().top,
                            thisHeight = jThis.height(),
                            thisBottom = thisTop + thisHeight,
                            intersection = Math.max(0, Math.min(thisBottom, windowBottom) - Math.max(thisTop, windowTop));
                        
                        if (intersection >= 50)
                            return true;
    
                        if (intersection / thisHeight >= .5) // more than half of this is visible
                            return true;
                        
                        // Note that at this point, we've deemed the element invisble.
                        // Remember the closest selectable item above and below, in case we need them.
                        if (thisTop < windowTop)
                            above = jThis;
                        else if (thisBottom > windowBottom && !below)
                            below = jThis;
                        return false;
                    });
                }
    
                choices = visibleOnly ? visibleChoices : currentSelectabubble.elements;
                if (absolute) {
                    newSelected = choices.eq(delta);
                } else if (selected.length) {
                    currentIndex = choices.index(selected);
                    if (currentIndex === -1 && delta < 0)
                        currentIndex = 0;
                    if (cycling)
                        nextIndex = (currentIndex + delta + choices.length) % choices.length;
                    else
                        nextIndex = Math.max(0, Math.min(currentIndex + delta, choices.length - 1));
                    newSelected = choices.eq(nextIndex);
                } else {
                    if (visibleChoices.length)
                        newSelected = delta < 0 ? visibleChoices.last() : visibleChoices.first();
                    else if (!visibleOnly) // forcibly pick one if we're not in visibleOnly mode
                        newSelected = delta < 0 ? above || below : below || above;
                }
    
                if (!(newSelected && newSelected.length))
                    return;
                
                selected.removeClass("keyboard-selected");
                newSelected.addClass("keyboard-selected")
                
                // adjust scrolling position
                if (!tempOnly && !visibleOnly) {
                   // shog-patch: for questions, make sure the title is shown - always at the top, so no need to worry about height
                     var selectEl = newSelected;
                     if ( selectEl.is("#question") )
                        selectEl = $("#question-header");

                      newTop = selectEl.offset().top;
                      newHeight = selectEl.height();
                   // !shog-patch
                    
                    if (newTop >= windowTop && newTop + newHeight < windowBottom) // fully visible -- all is well
                        return;
                    
                    if (newHeight > windowHeight) { // too large to fit the screen -- show as much as possible
                        animateScrollTo(newTop);
                        return;
                    }
                    
                    spaceFactor = Math.max(.9, newHeight / windowHeight);
                    
                    if (delta < 0) // going upwards; put the bottom at 10% from the window bottom
                        newScroll = newTop + newHeight - spaceFactor * windowHeight;
                    else // going downwards; put the top at 15% from the window top
                        newScroll = newTop - (1 - spaceFactor) * windowHeight;
                    
                    animateScrollTo(newScroll);
                }
                
            }
            
            function showHelp(title) {
                var s = title + "\n",
                    anyAutoSel = false,
                    hasSel = $(".keyboard-selected").length,
                    key, action;
                for (var i = 0; i < currentLevel.order.length; i++) {
                    key = currentLevel.order[i];
                    action = currentLevel.actions[key];
                    if (!actionIsAvailable(action))
                        continue;
                    
                    s += (action.unimportant ? "" : "!") + (action.indent ? "    " : "") + "<kbd>" + key + "</kbd> " + action.name;
                    
                    if (!hasSel && action.autoSelect) {
                        s += "*";
                        anyAutoSel = true;
                    }
                    if (action.next)
                        s += "...";
                    s += "\n";
                }
                if (!currentLevel.order.length)
                    s += "(no shortcuts available)";
                if (anyAutoSel)
                    s += "*auto-selects if nothing is selected";
                showConsole(s)
            }
            
            function checkAnimation(jElem) {
                jElem.each(function () {
                    var jThis = $(this),
                        queue = jThis.queue("fx");
                    if (queue && queue.length)
                    jThis.queue("fx", function (next) {
                        setTimeout(reset, 0);
                        next();
                    });
                });
            }
            
            function resetMode() {
                currentMode = null;
            }
            
            function resetModeIfNotApplicable() {
                if (currentMode && ! currentMode.isApplicable())
                    resetMode();
            }
            
            function resetToDefault() {
                currentLevel = shortcuts;
                showConsole("");
                resetDelayed.cancel();
            }
            
            function reset() {
                var mode = getCurrentMode();
                if (!mode) {
                    resetToDefault();
                    return;
                }
                currentLevel = mode.getShortcuts();
                if (!setting("disableAutoHelp"))
                    showHelp(mode.name);
                resetDelayed.cancel();
                if (currentLevel.animated)
                    checkAnimation(currentLevel.animated);
            }
            
            var resetDelayed = StackExchange.helpers.DelayedReaction(reset, setting("disableAutoHelp") ? 2000 : 5000, { sliding: true });
        
            function keyDescription(code) {
                if (code === 13)
                    return "Enter";
                
                return String.fromCharCode(code).toUpperCase();
            }
            
            var handleResults = {
                notHandled: 0,
                handled: 1,
                handledNoReset: 2,
                handledResetNow: 3,
                handledReinitNow: 4
            }
            
            function goToPage(url, newTab) {
                if (newTab)
                    window.open(url);
                else
                    location.href = url;
            }
            
            function handleKey(evt) {
                if (evt.ctrlKey || evt.altKey || evt.metaKey)
                    return handleResults.notHandled;
                
                if ($(evt.target).is("textarea, input[type='text'], input[type='url'], input[type='email'], input[type='password'], input:not([type])")) // default type is text, so if no type is set, it's a textbox as well
                    return handleResults.notHandled;

                var action = currentLevel.actions[keyDescription(evt.which)],
                    onlyIf;
        
                if (!action) {
                    return handleResults.notHandled;
                }
                
                var handled =
                        action.reinit ? handleResults.handledReinitNow :
                        action.noReset ? handleResults.handledNoReset :
                        (action.next || action.getNext) ? handleResults.handled :
                        handleResults.handledResetNow;
                
                if (action.autoSelect)
                    select(1, true, true);
        
                if (!actionIsAvailable(action)) {
                    return handleResults.notHandled;
                }
                
                if (action.initiatesMode) {
                    currentMode = action.initiatesMode;
                }
                
                var link = action.url || $(action.link).attr("href");
                
                if (link) {
                    goToPage(link, evt.shiftKey)
                    return handled;
                }
                
                if (action.click) {
                    $(action.click).click();
                    return handled;
                }
                
                if (action.clickOrLink) {
                    var jElem = $(action.clickOrLink);
                    var evData = jElem.length ? $._data(jElem[0], "events") : null;
                    var doClick = false;
                    if (evData && evData.click && evData.click.length) // click handler bound?
                        doClick = true;
                    else {
                        evData = $._data(document, "events"); // live handler bound? (note that the generic delegate case is *not* checked)                
                        if (evData && evData.click) {
                            for (var i = 0; i < evData.click.length; i++) {
                                var sel = evData.click[i].selector;
                                if (sel && jElem.is(sel)) {
                                    doClick = true;
                                    break;
                                }
                            }
                        }
                    }
                    if (doClick)
                        jElem.click();
                    else
                        goToPage(jElem.attr("href"), evt.shiftKey)
                    return handled;
                }
                var next;
                if (action.getNext)
                    next = action.getNext();
                else
                    next = action.next;
                if (next) {
                    var title = action.name + "...";
                    currentLevel = next;
                    if (!setting("disableAutoHelp"))
                        showHelp(title);
                    
                    return handled;
                }
                
                if (action.func) {
                    action.func(evt);
                    return handled;
                }
                
                StackExchange.debug.log("action found, but nothing to do")
            }
            
            var keyHappening = false;
            
            var keydown = function () { keyHappening = true; };
            
            var keyup = function (e) {
                if (e.which === 27) {
                    resetMode();
                    resetToDefault();
                }
                else if (keyHappening) // didn't generate a keypress event
                    reset();
                keyHappening = false;
            };
            
            var keypress = function (evt) {
                keyHappening = false;
                var result = handleKey(evt);
                switch(result) {
                    case handleResults.notHandled:
                        resetModeIfNotApplicable();
                        reset();
                        return true;
                    case handleResults.handled:
                        resetDelayed.trigger();
                        return false;
                    case handleResults.handledResetNow:
                        reset();
                        return false;
                    case handleResults.handledNoReset:
                        resetDelayed.cancel();
                        return false;
                    case handleResults.handledReinitNow:
                        reinit();
                        return false;
                }
            };
    
            var click = function (evt) {
                if (typeof evt.which === "undefined") // not a real click;
                    return;
                resetMode();
                reset();
            }
            
            $(document).keydown(keydown);
            $(document).keyup(keyup);
            $(document).keypress(keypress);
            $(document).click(click);
            
            buildShortcuts();
        
            reset();
            
        // shog-patch: select first flagged post
        if ( $(".question:has('.mod-tools .flag-dismiss'), .answer:has('.mod-tools .flag-dismiss')").length )
         select(0, false, true, false, true);            
         // !shog-patch
        
            return {
                getSelectable: function() { return currentSelectabubble; },
                cancel: function () {
                    $(document).unbind("keydown", keydown);
                    $(document).unbind("keyup", keyup)
                    $(document).unbind("keypress", keypress)
                    $(document).unbind("click", click)
                },
                reset: reset
            };
        }
    
        var scroller = {};
        function animateScrollTo(target) {
            var jWin = $(window);
            scroller.pos = jWin.scrollTop();
            $(scroller).stop().animate({pos: target}, {
                duration: 200,
                step: function () { jWin.scrollTop(this.pos) },
                complete: function () { jWin.scrollTop(target); }
            });
        }
        
        var expected = [];
        
        function expectAjax(urlRe, crossDomain) {
            var result = $.Deferred();
            var data = { re: urlRe, deferred: result, crossDomain: crossDomain };
            if (crossDomain) {
                // hack: jQuery doesn't fire ajaxComplete on crossdomain requests, so we gotta cheat
                var prevScripts = $("head > script");
                setTimeout(function () {
                    var nowScripts = $("head > script");
                    if (nowScripts.length !== prevScripts.length + 1) { // currently this is fine, since our only use case only loads one
                        StackExchange.debug.log("I'm confused: " + nowScripts.length + "!=" + prevScripts.length +"+1" );
                        return;
                    }
                    var script = nowScripts.eq(0); // jQuery uses insertBefore
                    if (!urlRe.test(script.attr("src"))) {
                        StackExchange.debug.log("I'm even more confused");
                        return;
                    }
                    script.load(function () { result.resolve(); });
                },0)
            } else {
                expected.push(data);
            }
            return result.promise();
        }
        function checkExpected(url) {
            var newExpected = [],
                i, result = false;
            for (i = 0; i < expected.length; i++) {
                var exp = expected[i];
                if (exp.re.test(url)) {
                    exp.deferred.resolve();
                    result = true;
                } else {
                    newExpected.push(exp);
                }
            }
            expected = newExpected;
            return result;
        }
        
        function ajaxNeedsReinit(url) {
            return /users\/stats\/(questions|answers)|posts\/\d+\/ajax-load-mini|posts\/ajax-load-realtime/.test(url)
                || ($('.newnav').length && !ajaxNeedsNoReset(url));
        }
        function ajaxNeedsNoReset(url) {
            return /mini-profiler-results|users\/login\/global|\.js/.test(url)
        }
    
        var state = init();
        $(document).ajaxComplete(function (evt, xhr, settings) {
            if (!checkExpected(settings.url)) {
                if (ajaxNeedsReinit(settings.url))
                    reinit();
                else if (!ajaxNeedsNoReset(settings.url))
                    state.reset();
            }
        })
        
        $(document).on("click", ".new-post-activity", reinit);
        
        function reinit() {
            state.cancel();
            state = init(state.getSelectable());
        }
    
    }
        

   run();
    
   return true;
}

});
   
});
