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

   var explanation = "Your review on " + location.toString() + " wasn't helpful; please review the history of the post and consider how choosing a different action could've helped achieve that outcome more quickly.\n";

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
   
   var flagCache = {};

   GetFlagInfoFromWaffleBar();
   initFlags(); // this may run too quickly, so...
   $(document)
      .ajaxSuccess(function(event, XMLHttpRequest, ajaxOptions)
      {
         if (ajaxOptions.url.indexOf("/admin/posts/issues/") == 0)
         {
            setTimeout(() => initFlags(), 1);
         }
         else if (/\/posts\/\d+\/comments/.test(ajaxOptions.url))
         {
            var postId = +ajaxOptions.url.match(/\/posts\/(\d+)\/comments/)[1];
            setTimeout(() => ShowCommentFlags(postId), 1);
         }
      });

   $("#content")
      .on("click", "a.show-all-flags", function()
      {
         var postContainer = $(this)
            .closest(".question,.answer");
         var postId = $(this)
            .data('postid');
         LoadAllFlags(postId)
            .then(flags => ShowFlags(postContainer, flags));
      });

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
            flags = flagCache[postId];

         if (!flagsLink.length) return;

         var tools = $(`<tr class="mod-tools" data-totalflags="${flagsLink.length ? flagsLink.text().match(/\d+/)[0] : 0}">
<td colspan="2">
<div class="mod-tools-post">
    <h3 class='flag-summary'><a class='show-all-flags' data-postid='${postId}'>${flagsLink.text()}</a></h3>
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

      $('#postflag-bar')
         .remove();
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
         flagSummaryText.push((postFlags.commentFlags.length - activeCount) + " resolved flags");
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
             <span class="flag-info" data-flag-ids="${flag.flagIds ? flag.flagIds.join(';') : flag.flagId}">
                 –
                <span class="flaggers"></span>
                 <a class="flag-dismiss comment-delete delete-tag" title="dismiss this flag"></a>
             </span>
         </li>`);

      if (flag.result)
      {
         $("<div class='flag-outcome'></div>")
            .text(flag.result + " – ")
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
         for (let user of flag.flaggers)
         {
            flagItem.find(".flaggers")
               .append(
                  `<a href="/users/${user.userId}" class="flag-creation-user comment-user">${user.name}</a>
               <span class="flag-creation-date comment-date" dir="ltr"><span title="${user.flagCreationDate.toISOString()}" class="relativetime-clean">${user.flagCreationDate.toLocaleDateString(undefined, {year: "2-digit", month: "short", day: "numeric", hour: "numeric", minute: "numeric", hour12: false, timeZone: "UTC"})}</span></span>`);
         }
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
                        flaggers: flag.find("a[href*='/users/']")
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


function initKeyboard()
{

}

});
