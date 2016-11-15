//
// A bunch of quick'n'dirty patches to test faster flag handling UIs on Stack Overflow
// Some or all of these may eventually be "baked in" - IF they prove useful
// Don't expect any of the actual CODE to be used in production though.
// Remember: the goal here is to be QUICK even - especially - if that means DIRTY
// --Josh "Shog9" Heyer, March 2014
//
// WARNING: May break in potentially catestrophic fashion at any time.
// DO NOT release publicly
// DO NOT USE LOCAL COPIES
// If you use a local copy and something breaks, you're responsible for the consequences.
//

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
      initQuestionPage();
      initKeyboard();
   }

   if (/^\/review\/\w+/.test(window.location.pathname))
   {
      // for direct links to a review task
      initReview();
      // for ajax-loaded review tasks
      $(document).ajaxSuccess(function(event, XMLHttpRequest, ajaxOptions)
      {
         if ( ajaxOptions.url.indexOf("/review/next-task")==0 || ajaxOptions.url.indexOf("/review/task-reviewed")==0 )
         {
            setTimeout(function()
            {
               initReview();
            }, 1);
         }
      })
   }

   // this is mostly just to gather information on who can see what, since that's gotten a bit... confusing
   if (/^\/users\/\d+\/[^\/]+$/.test(window.location.pathname))
   {
      $("<a href='#'>Dashboard</a>")
         .wrap("<div style='text-align:center;margin-top:1em;'></div>")
         .parent().appendTo("#large-user-info .gravatar").end()
         .click(function(ev)
         {
            ev.preventDefault();
            renderUserDashboard();
            $(this).parent().remove();
         });

      function renderUserDashboard()
      {
         var userId = window.location.pathname.match(/^\/users\/(\d+)/)[1];
         var accountId = $(".sub-header-links a:contains('network profile')").attr('href').match(/\/users\/(\d+)/)[1];
         var container = $("#user-panel-reputation").parent()
            .empty();
         var loading = $("<h3>TODO: load user info<img src='//sstatic.net/img/progress-dots.gif'></h3>")
            .appendTo(container);

         // load all PII first, so we can access this later on
         var pii = $(".pii:contains('(click to show)')");
         if ( pii.length )
         {
            pii.click();
         }

         // do the other loadings
         var infos = [
                       {url:"/accounts/<accountId>", method: "GET", render: function(html) { return $(html).find("#content");}},
                       {url:"/users/history/<uid>", method: "GET", render: function(html) { return $(html).find("#content");}},
                       {url:"/admin/users/<uid>/moderator-menu",method: "GET", render: function(html) { return $(html);}},
                       {url:"/users/popup/logins/<accountId>", method: "POST", render: function(html) { return $(html);}}
                     ];
         loadInfo(infos);

         function loadInfo(list)
         {
           if (!list.length)
           {
             loading.remove();
             return;
           }

           var info = list.pop();
           $.ajax(info.url.replace('<uid>', userId).replace('<accountId>', accountId),
             {
               type: info.method,
               data: {fkey:StackExchange.options.user.fkey}
             })
             .done(function(html)
             {
               $("<div></div>").append(info.render(html)).appendTo(container)
                 .find(".popup").css({display:'block', position:'inherit'});
               loadInfo(list);
             });
         }
      }
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
               days: days,
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


      dismissFlag: function(postId, flagId, helpful, declineId, comment)
      {
         var ticks = window.renderTimeTicks||(Date.now()*10000+621355968000000000);
         return $.post('/messages/delete-moderator-messages/' + postId + '/'
            + ticks + '?valid=' + helpful + '&flagIdsSemiColonDelimited=' + flagId,
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
      
      makeWait(msecs)
      {
         return function()
         {
            var args = arguments;
            var result = $.Deferred();
            setTimeout(function() { result.resolve.apply(result, args) }, msecs);
            return result.promise();
         }
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
            // TEMP: exclude comment flags from the filter list
            if ( /^Comment/.test(f.flagType) ) return;

            addFilter("Flag types",
               f.flagType=="PostOther" || f.flagType=="CommentOther"
                  ? "Other"
                  : f.description + (f.flagReason ? ' (' + f.flagReason + ')' : ''),
               "fn:type("+f.flagType + (f.flagReason||'') +")");
         });
      });


      // heh...
      addSearchFilter("Shog, look at this", "History purge", "history|password|credential|login");

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
      
      flagDismissUI(parentContainer).then(function(dismissal)
      {
         if (!confirm("ARE YOU SURE you want to dismiss ALL FLAGS on these " + postIdsToDismiss.length + " posts all at once??"))
            return;
         
         DoDismiss(dismissal.helpful, dismissal.declineId, dismissal.comment);
      });

   }
   

   function flagDismissUI(uiParent)
   {
      var result = $.Deferred();
      var dismissTools = $('<div class="dismiss-flags-popup"><input type="text" maxlength="200" style="width:98%" placeholder="optional feedback (visible to the user)"><br><br><input type="button" value="helpful" title="the flags have merit but no further action is required"> &nbsp; &nbsp; <input type="button" value="decline: technical" title="errors are not mod biz"> <input type="button" value="decline: no evidence" title="to support these flags"> <input type="button" value="decline: no mods needed"  title="to handle these flags"></div>');

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
      
      return result.promise();
   }
   
}

function initReview()
{
   var reviews = $(".review-bar .review-instructions .review-results");
   var actions = reviews.find("b")
      .map(function() { return this.innerText; }).toArray()
      .filter(function(p) { if ( !this[p] ) { this[p]=true; return true;}}, {}); // de-dup

   $(".review-ban-all").remove();
   $(".review-ban").remove();

   var explanation = "You have made too many incorrect reviews. For an example of a task you should have reviewed differently, see: " + location.toString() + "\n";

   actions.forEach(function(act)
   {
      var actionBan = $("<br><a href='/admin/review/bans' class='review-ban-all'>Ban all " + act + " reviewers</a>")
         .click(function(ev)
         {
            ev.preventDefault();

            var days = prompt("How many days do you want to ban " + act + " reviewers from review?")
            if (days)
            {
               reviews.has("b:contains('" + act + "')").each(function()
               {
                  var banLink = $(this).find("a[href='/admin/review/bans']");
                  var userId = $(this).find("a[href*='/users/']").attr('href').match(/\/users\/(\d+)/)[1];
                  FlagFilter.tools.reviewBanUser(userId, days, explanation)
                     .fail(function() { banLink.replaceWith("<b>Ban failed.</b>") })
                     .done(function()
                     {
                        banLink.replaceWith("<i>Banned.</i>")
                     });
               });
            }
         });

      $(".review-bar .review-actions-container").append(actionBan);
   });

   reviews.append(function()
         {
            var banLink = $("<a href='/admin/review/bans' class='review-ban'>Ban</a>")
               .click(function(ev)
               {
                  ev.preventDefault();

                  var days = prompt("How many days do you want to ban "
                     + $(this).parent().find("a[href*='/users/']").text()
                     + " from review?");
                  if (days)
                  {
                     var userId = $(this).parent().find("a[href*='/users/']").attr('href').match(/\/users\/(\d+)/)[1];
                     FlagFilter.tools.reviewBanUser(userId, days, explanation)
                        .fail(function() { alert("Failed!") })
                        .done(function()
                        {
                           banLink.replaceWith("<i>Banned.</i>")
                        });
                  }
               });
               return banLink;
         });
}

function initQuestionPage()
{
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
}

//
// Adapted slightly from balpha's Keyboard shortcuts for StackExchange userscript
// http://stackapps.com/questions/2567/official-keyboard-shortcuts
//

function initKeyboard()
{
    var updateMessage;

    if (!(window.StackExchange && StackExchange.helpers && StackExchange.helpers.DelayedReaction))
        return;

    var TOP_BAR = $("body > .topbar");
    if (!TOP_BAR.length)
        TOP_BAR = false;

    function setting(name, val) {
        var prefix = "flaaaaags-keyboard-shortcuts.settings.";
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
                ".keyboard-console pre { background-color: transparent; color: #ccc; width: auto; height: auto; padding: 0; margin: 0; overflow: visible; line-height:1.5; }" +
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

    var popupMode = {
        name: "Popup...",
        isApplicable: function () { return $(".popup").length },
        getShortcuts: function () {
            var pane = $(".popup-active-pane"),
                result = new Shortcuts(),
                i = 1, j = 65,
                animated = [];

            if (!pane.length)
                pane = $(".popup");

           // hack: make sure enter submits the form
           if ( !pane.find("button[type=submit], input[type=submit]").length && pane.find("button, input[type=button]").length==1)
           {
              pane.keyup(function(ev)
              {
                  if (ev.which!=13) return;

                  pane.find("button, input[type=button]").click();
              });
           }

            pane.find(".action-list > li input[type='radio']:visible").each(function () {
                var radio = $(this),
                    li = radio.closest("li"),
                    label = li.find("label span:not(action-desc):first"),
                    subform = li.find(".action-subform");

                result.add("" + i, $.trim(label.text()) || "unknown action", { func: function () { radio.focus().attr('checked', 'checked').click(); } }); // make sure it's checked before firing the handler!

                if (subform.length) {

                    subform.find("input[type='radio']:visible").each(function () {
                        var jThis = $(this),
                            sublabel = jThis.closest("li").find("label span:first");
                        result.add(String.fromCharCode(j), truncate(sublabel.text() || "other"), { func: function () { jThis.focus().click(); } });
                        j++;
                    });
                    animated.push(subform);
                }
                i++;
            });
            if (animated.length) {
                result.animated = $(animated);
            }
            return result;
        }
    }

    var dismissMode = {
        name: "Dismiss flags...",
        isApplicable: function () { return $(".no-further-action-popup").length },
        getShortcuts: function () {
            var pane = $(".no-further-action-popup"),
                result = new Shortcuts();

            result.add("H", "helpful", { clickOrLink: ".no-further-action-popup .mark-as-helpful" });
            result.add("D", "decline", { clickOrLink: ".no-further-action-popup .decline-flags", initiatesMode: popupMode });
            return result;
        }
    }

    function getTopBarDialogMode(name, diaSelector, itemSelector) {
        return {
            name: name,
            isApplicable: function () { return TOP_BAR.find(diaSelector).length; },
            getShortcuts: function () {
                var choices = TOP_BAR.find(diaSelector + " " + itemSelector),
                    i, text, url, choice, result
                    count = Math.min(choices.length, 9);i
                result = new Shortcuts();
                for (i = 0; i < count; i++) {
                    choice = choices.eq(i);
                    text = truncate(choice.closest("li").text());
                    url = choice.attr("href");
                    result.add("" + (i + 1), text, { url: url });
                }
                return result;
            }
        }
    }

    function getTopBarDialogShortcut(buttonSelector, name, diaSelector, itemSelector) {
        return {
            onlyIf: ".topbar " + buttonSelector,
            func: function () { TOP_BAR.find(buttonSelector).click(); animateScrollTo(0); },
            initiatesMode: getTopBarDialogMode(name, diaSelector, itemSelector)
        };
    }

    var inboxMode;
    if (!TOP_BAR) {
        inboxMode = {
            name: "Inbox item...",
            isApplicable: function () { return $("#seContainerInbox:visible").length; },
            getShortcuts: function () {
                var choices = $(".topbar .inbox-dialog li.inbox-item a, #seContainerInbox > .itemBox > .siteInfo > p:first-child > a"),
                    i, text, url, choice, result
                    count = Math.min(choices.length, 9);
                result = new Shortcuts();
                for (i = 0; i < count; i++) {
                    choice = choices.eq(i);
                    text = truncate(choice.text());
                    url = choice.attr("href");
                    result.add("" + (i + 1), text, { url: url });
                }
                return result;
            }
        }
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

       // annotate flagged posts to allow them to be selectable
       $("#postflag-bar .m-flag").each(function()
       {
            var selector = this.id.replace("flagged-", '') == location.pathname.match(/\/questions\/(\d+)/)[1]
               ? "#question"
               : this.id.replace("flagged-", "#answer-");
          $(selector).data('flag-bar', this.id);
       });

        var currentSelectable,
            shortcuts = new Shortcuts(),
            currentLevel = shortcuts,
            info = {},
            selectables = {
                questionPage: { name: "post", selector: ".question, .answer" },
                questionListing: { name: "question",
                    selector: "#questions .question-summary:visible, #question-mini-list .question-summary:visible, .user-questions .question-summary, "
                              + "#questions-table .question-summary, .fav-post .question-summary, #bounties-table .question-summary",
                },
                answerListing: { name: "answer", selector: "#answers-table .answer-summary .answer-link, .user-answers .answer-summary" },
                tagListing: { name: "tag", selector: "#tags-browser .tag-cell" },
                userListing: { name: "user", selector: "#user-browser .user-info" },
                badgeListing: { name: "badge", selector: "body.badges-page tr td:nth-child(2)" },
                userSiteListing: { name: "site", selector: "#content .module .account-container" },
                activityListing: { name: "activity", selector: "table.history-table tr:has(div.date) td:last-child" },
                reputationListing: { name: "rep", selector: "table.rep-table > tbody > tr.rep-table-row > td:last-child" },
                flagListing: { name: "flag", selector: "table.flagged-posts.moderator > tbody > tr > td div.mod-post-header", hrefOnly: true },
                // ^^^ did that ever actually work? Should be td.mod-post-header, AFAIK
                flaggedQuestion: { name: "flagged post", selector: ".question:data(flag-bar), .answer:data(flag-bar)" }
            };

        if ($(selectables.flaggedQuestion.selector).length) {
            info.isQuestionPage = true;
            currentSelectable = selectables.flaggedQuestion;
        } else if (/^\/questions\/\d+/i.test(location.pathname)) {
            info.isQuestionPage = true;
            currentSelectable = selectables.questionPage;
        } else if (/^\/users\/\d+/i.test(location.pathname)) {
            info.isProfilePage = true;
        }
        else if ($(selectables.answerListing.selector).length) {
            info.isAnswerListing = true;
            currentSelectable = selectables.answerListing;
        }
        else if ($(selectables.questionListing.selector).length) {
            info.isQuestionListing = true;
            currentSelectable = selectables.questionListing;
        } else {
            for (var key in selectables) {
                if (!selectables.hasOwnProperty(key) || /(?:question|answer)Listing/.test(key))
                    continue;

                if ($(selectables[key].selector).length) {
                    currentSelectable = selectables[key];
                    info["is" + key.charAt(0).toUpperCase() + key.substr(1)] = true;
                    break;
                }
            }
        }

        if (forceSelectable) {
            currentSelectable = forceSelectable;
        }

        if (currentSelectable)
            currentSelectable.elements = $(currentSelectable.selector);

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
            info.mainSiteLink = location.origin.replace(/(\/|\.)meta./, "$1");
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
            shortcuts.actions.H.name = (current ? "en" : "dis") + "able auto help";
            resetDelayed = StackExchange.helpers.DelayedReaction(reset, current ? 2000 : 5000, { sliding: true })
        }

        function buildShortcuts() {
            var G = new Shortcuts();

            shortcuts.add("G", "go to", { next: G });
            if (currentSelectable) {
                shortcuts.add("U", "select " + (info.isQuestionPage ? "question" : "first " + currentSelectable.name), {
                    func: function () { select(0, false, false, false, true); }
                });
                shortcuts.add("J", "select next " + currentSelectable.name, { func: function () { selectFlag(1); } });
                shortcuts.add("K", "select prev " + currentSelectable.name, { func: function () { selectFlag(-1); } });
                if (!info.isQuestionPage) {
                    shortcuts.add("Enter", "go to selected " + currentSelectable.name, { clickOrLink: ".keyboard-selected a" + (currentSelectable.hrefOnly ? "[href]" : "") });
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
            if (TOP_BAR) {
                special.add("R", "review", { link: ".topbar-menu-links a[href='/review/']" });
                special.add("F", "flags", { link: ".topbar .mod-only .icon-flag" });
            } else {
                special.add("E", "suggested edits", { link: "#hlinks a.mod-flag-indicator.hotbg" });
                special.add("F", "flags", { link: "#hlinks a.mod-flag-indicator.supernovabg" });
                special.add("M", "mod", { link: "#hlinks a[href='/admin']" });
                if ($("#hlinks a:contains('tools')").length) {
                    special.add("R", "review", { url: "/review" });
                    special.add("T", "tools", { url: "/tools" });
                } else if ($("#hlinks a[href='/review/']").length) {
                    special.add("R", "review", { url: "/review" });
                }
            }
            G.add("S", "special pages", { next: special });

            var inPageNav = new Shortcuts();

            if (info.isQuestionPage)
                buildQuestionPageShortcuts();
            else if (info.isProfilePage) {
                inPageNav.add("T", "tab", { next: getOrderShortcuts("#tabs") });
                if (info.isQuestionListing && info.isAnswerListing) {
                    inPageNav.add("Q", "questions", { func: function() {
                        switchSelectable("questionListing");
                    } });
                    inPageNav.add("A", "answers", { func: function() {
                        switchSelectable("answerListing");
                    } });
                }
            }
            else if (info.isQuestionListing)
                shortcuts.add("O", "order questions by", { next: getOrderShortcuts("#tabs") });

            shortcuts.add("N", "in-page navigation", { next: inPageNav });

            G.add("F", "faq", { url: "/faq" });

            if (TOP_BAR) {
                shortcuts.add("I", "inbox",
                    getTopBarDialogShortcut(".js-inbox-button", "Inbox item...", ".inbox-dialog", "li.inbox-item a")
                );
            } else {
                shortcuts.add("I", "inbox", { func: beginInbox, noReset: true, initiatesMode: inboxMode });
            }
            if (TOP_BAR) {
                shortcuts.add("R", "recent achievements",
                    getTopBarDialogShortcut(".js-achievements-button", "Achievement...", ".achievements-dialog", "ul.js-items li a")
                );
                shortcuts.add("Q", "mod messages",
                    getTopBarDialogShortcut(".js-mod-inbox-button", "Mod message...", ".modInbox-dialog", "li.inbox-item a")
                );
            } else {
                shortcuts.add("R", "recent activity popup", {
                    onlyIf: "#hlinks-user > .profile-triangle",
                    func: function () { $("#hlinks-user > .profile-triangle").click(); animateScrollTo(0); }
                });
            }
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
                    var s = "MOD TOOLS\nKeyboard shortcuts:";
                    if (updateMessage)
                        s = updateMessage + "\n" + s;
                    showHelp(s);
                },
                noReset: true,
                unimportant: true
            });
            shortcuts.add("H", (setting("disableAutoHelp") ? "en" : "dis") + "able auto help", { func: toggleAutoHelp, unimportant: true } );
        }

        function getPagerShortcuts() {

            var pagerSelector;
            if (info.isQuestionPage) {
                pagerSelector = ".pager-answers"
            } else {
                pagerSelector = "";
                if (info.isQuestionListing && info.isAnswerListing)
                    pagerSelector = { "question": "#questions-table ", "answer": "#answers-table " }[currentSelectable.name] || "";
                pagerSelector += ".pager:first"
            }

            var result = new Shortcuts();
            result.add("F", "first page", { clickOrLink: pagerSelector + " a[title='go to page 1']" });
            result.add("P", "previous page", { clickOrLink: pagerSelector + " a[rel='prev']" });
            result.add("N", "next page", { clickOrLink: pagerSelector + " a[rel='next']" });
            result.add("L", "last page", { clickOrLink: pagerSelector + " .current ~ a:not([rel='next']):last" });
            return result;
        }

        var sortOrderShortcuts = { featured: "B", bugs: "G" };
        function getOrderShortcuts(selector) {
            var result = new Shortcuts();
            $(selector + " > a").each(function (i, elem) {
                var text = $(elem).text().replace(/^\s*[\d*]*\s*|\s*$/g, ""),
                    s = sortOrderShortcuts[text]; // TODO: This check needs to be made earlier, before looping. Otherwise, you may get double entries.

                if (!s) {
                    s = text.replace(/[^a-z]/ig, "").toUpperCase();

                    while (s.length && result.actions[s.charAt(0)])
                        s = s.substr(1);

                    if (!s.length) {
                        StackExchange.debug.log("no suitable shortcut for sort order " + text);
                        return;
                    }
                }
                result.add(s.charAt(0), text, { clickOrLink: elem });
            });
            return result;

        }

        function switchSelectable(name) {
            var newSelectable = selectables[name];
            if (newSelectable === currentSelectable)
                return;
            currentSelectable = newSelectable;
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

        function beginInbox() {
            if (!$("#seWrapper").length) {
                if ($("#portalLink .unreadCount").length)
                    expectAjax(/\/inbox\/genuwine/, false).done(reset); // if there's a red number, the click goes directly to the inbox
                else
                    expectAjax(/stackexchange\.com\/genuwine/, true).done(assertInbox)

                $("#portalLink a.genu").click();
            } else {
                if (!$("#seWrapper").is(":visible"))
                    $("#portalLink a.genu").click();
                assertInbox();
            }
            animateScrollTo(0);
        }

        function assertInbox() {
            var def;
            if (!$("#seContainerInbox").length)
                def = expectAjax(/\/inbox\/genuwine/);
            else
                def = $.Deferred().resolve().promise();
            $("#seTabInbox").click(); // Make sure it's the active tab. This is a no-op if it already is.
            def.done(reset); // will detect inbox mode
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

            var dismissAct = { click: "",
                  autoSelect: true,
                  initiatesMode: dismissMode
            };
            dismissAct.onlyIf = function()
            {
               var selector = "#" + $(".keyboard-selected").data("flag-bar") + " .dismiss-all";
               dismissAct.click = selector;
               return !!$(selector).length;
            };
            shortcuts.add("D", "dismiss flags", dismissAct);

            var M = new Shortcuts();
            shortcuts.add("M", "moderate", { next: M, autoSelect: true });
            M.add("F", "flag", { click: ".keyboard-selected a[id^='flag-post-'], .keyboard-selected .flag-post-link", initiatesMode: popupMode });
            M.add("C", "close", { click: ".keyboard-selected a[id^='close-question-'], .keyboard-selected .close-question-link", initiatesMode: popupMode });
            M.add("B", "belongs on... (migrate)", { click: "#postflag-bar .migration-link" });
            M.add("D", "delete", { click: ".keyboard-selected a[id^='delete-post-']" });
            M.add("E", "suggested edit", { click: ".keyboard-selected a[id^='edit-pending-']" });
            M.add("M", "moderation tools", { click: ".keyboard-selected a.post-moderator-link", initiatesMode: popupMode });
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

            if (action.next) {
                for (var i = 0; i < action.next.order.length; i++) {
                    if (actionIsAvailable(action.next.actions[action.next.order[i]])) {
                        return true;
                    }
                }
                return false;
            }

            return true;
        }

        function selectFlag(delta)
        {
           // if on the first/last flagged post here, move to the next one in the filtered list
           if ( (delta > 0 && $(currentSelectable.selector).last().is(".keyboard-selected"))
            || (delta < 0 && $(currentSelectable.selector).first().is(".keyboard-selected")) )
           {
              goToFilteredFlag(delta);
              return;
           }

           select(delta, false);
        }

        function select(delta, visibleOnly, onlyIfNothingYet, tempOnly, absolute) {
            if (!currentSelectable)
                return;

            if (!currentSelectable.elements) {
                currentSelectable.elements = $(currentSelectable.selector);
            }

            if (!currentSelectable.elements.length)
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

            if (visibleOnly || (!selected.length && !absolute)) {
                visibleChoices = currentSelectable.elements.filter(function () {
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

            choices = visibleOnly ? visibleChoices : currentSelectable.elements;
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
               var selectEl = newSelected;
               // for questions, make sure the title is shown - always at the top, so no need to worry about height
               if ( selectEl.is("#question") )
                  selectEl = $("#question-header");

                newTop = selectEl.offset().top;
                newHeight = selectEl.height();

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

                s += (action.unimportant ? "" : "!") + "<kbd>" + key + "</kbd> " + action.name;

                if (!hasSel && action.autoSelect) {
                    s += "*";
                    anyAutoSel = true;
                }
                if (action.next)
                    s += "...";
                s += "\n";
            }
            if (!currentLevel.order.length)
                s += "(no shortcuts available)"
            if (anyAutoSel)
                s += "*auto-selects if nothing is selected"
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
                    action.next ? handleResults.handled :
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
                var jElem = $(action.clickOrLink),
                    evData = $._data(jElem.get(0), "events"),
                    doClick = false;
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

            if (action.next) {
                var title = action.name + "...";
                currentLevel = action.next;
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

        // select first flagged post
        if ( $(".question:data(flag-bar), .answer:data(flag-bar)").length )
         select(0, false, true, false, true);

        return {
            getSelectable: function() { return currentSelectable; },
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
                script.on("load", function () { result.resolve(); });
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
        return /users\/stats\/(questions|answers)|posts\/\d+\/ajax-load-mini|posts\/ajax-load-realtime/.test(url);
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

});
