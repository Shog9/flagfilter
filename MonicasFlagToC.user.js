// ==UserScript==
// @name          Monica's Flag ToC
// @description   Implement https://meta.stackexchange.com/questions/305984/suggestions-for-improving-the-moderator-flag-overlay-view/305987#305987
// @author        Shog9
// @namespace     https://github.com/Shog9/flagfilter/
// @version       0.3
// @include       http*://stackoverflow.com/questions/*
// @include       http*://*.stackoverflow.com/questions/*
// @include       http*://dev.stackoverflow.com/questions/*
// @include       http*://askubuntu.com/questions/*
// @include       http*://superuser.com/questions/*
// @include       http*://serverfault.com/questions/*
// @include       http*://mathoverflow.net/questions/*
// @include       http*://*.stackexchange.com/questions/*
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
  script.textContent = "if (window.jQuery) (" + f.toString() + ")(window.jQuery)" + "\n\n//# sourceURL=MonicasFlagToc.userscript";
  document.body.appendChild(script);
}


with_jquery(function()
{
   FlagFilter = {};

   initStyles();
   initTools();
   initQuestionPage();


function initStyles()
{

   var flagStyles = document.createElement("style");
   flagStyles.textContent = `
   #postflag-bar 
   { 
      display: none; 
      background-color: rgba( 239,240,241, 0.75);
      opacity: 1;
   }
   
   .flagToC
   {
      list-style-type: none;
      margin: 0px;
      padding: 0px;
      margin-left: 40px;
      margin-right: 40px;
   }
   
   .flagToC>li
   {
      padding: 4px;
      width:15em;
      float:left;
      box-shadow: 0 0 8px rgba(214,217,220,.7);
      margin: 4px;
      border-radius: 4px;
      background-color: #fff;
   }
   
   .flagToC>li ul 
   {
      margin: 0px;
      padding: 0px;      
   }
   .flagToC>li ul>li::before
   {
      content: attr(data-count);
      color: #6A7E7C;
      padding-right: 1em;
   }
   .flagToC>li ul>li 
   {
      text-overflow: ellipsis;
      white-space: nowrap;
      overflow: hidden;
   }
   
   .flagToC>li ul>li.inactive
   {
      color: #6A7E7C;
   }
      
   /* this used to live in moderator.less... Then balpha killed it. But at least there was poetry.
      (just in case you were curious about the presence of K&R braces) */
   .mod-tools .mod-tools-post, .mod-tools .mod-tools-comment > td:first-child {
     border-left: 8px solid #DB5D5D;
   }

   .mod-tools .mod-tools-post {
     padding: 10px 10px 10px 30px;
     margin-bottom: 20px;
     background-color: #EFF0F1;
   }

   .mod-tools ul.flags li {
         margin:5px;
         padding: 5px;
         line-height:17px;
         background-color: #EFF0F1;
         list-style:none;
   }

   .mod-tools ul.flags:hover .flag-dismiss {
           visibility: visible;
   }

   .mod-tools ul.flags .flag-info {
       white-space: nowrap;
   }
   `;

   document.head.appendChild(flagStyles);
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

      dismissAllCommentFlags: function(commentId, flagIds)
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
      },
      
      predictMigrationDest: function(flagText)
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

   };
}

function initQuestionPage()
{
   var loaded = $.Deferred();
   
   var flagCache = {};
   GetFlagInfoFromWaffleBar();
   RenderToCInWaffleBar();
      
   // depending on when this gets injected, these *may* already be loaded
   if ( $(".post-issue-display").length )
      loaded.resolve();
   
   loaded.then(function()
   {
      initFlags();

      // add a migrate options, if appropriate
      $(".mod-message .active-flag")
         .each(function()
         {
            var el = this;
            FlagFilter.tools.predictMigrationDest(this.innerText)
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
            var flagIds = $(this).parents(".flag-info").data("flag-ids");
            var flagListItem = $(this).parents(".flag-info").parent();
            if ( !commentId || !flagListItem.length )
               return;

            FlagFilter.tools.dismissAllCommentFlags(commentId, flagIds)
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
         
         FlagFilter.tools.predictMigrationDest(flag.description)
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
<!-- <input class="flag-delete-with-comment" type="button" value="delete with comment…" title="deletes this post with a comment the owner will see, as well as marking all flags as helpful"> -->
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
             <span class="flag-info" data-flag-ids="${flag.flagIds ? flag.flagIds.join(';') : ''}">
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
   
   function RenderToCInWaffleBar()
   {
      var flagToC = $("<ul class='flagToC'>");
      for (let postId in flagCache) 
      {
         let post = $(".answer[data-answerid='"+postId+"'],.question[data-questionid='"+postId+"']"),
            postType = post.is(".answer") ? "answer" : "question",
            userLink = post.find(".user-details a[href^='/users/']:last,.user-details #history-"+postId),
            authorName = userLink.is('#history-'+postId) ? '(wiki)' : userLink.text(); 
         if ( !post.length ) continue; // TODO: handle flags spanning multiple pages of answers
         let flagSummaries = SummarizeFlags(flagCache[postId], 3).map(function(summary)
         {
            var ret = $(`<li data-count='${summary.count}&times;'>`);
            ret.attr("title", summary.description);
            if ( !summary.active )
               ret.addClass("inactive");
            if ( summary.type == 'comment' )
               $("<a>").attr("href", "#comments-"+postId).text("(comment) " + summary.description).appendTo(ret);
            else
               ret.text(summary.description);
            return ret;
         });
         let entry = $("<li>");
         entry.append($("<a>")
            .attr("href", postType == 'question' ? '#question' : "#" + postId)
            .text(postType + " by " + authorName)
            .append($("<ul>").append(flagSummaries))
         );
         
         flagToC.append(entry);
      }
      $('#postflag-bar .flag-wrapper').replaceWith(flagToC);
      $('#postflag-bar').show();

      function SummarizeFlags(flaggedPost, maxEntries)
      {
         var flags = flaggedPost.flags.concat(Object.values(flaggedPost.commentFlags.filter(cf => cf.active).reduce(function(acc, cf)
            {
               var composite = acc[cf.description] || {commentId: -1, description: cf.description, flaggers: [], active: true};
               composite.flaggers.push.apply(composite.flaggers, cf.flaggers.length ? cf.flaggers : ["unknown"]);
               acc[cf.description] = composite;
               return acc;
            }, {}))
         );
         maxEntries = maxEntries < 0 ? flags.length : maxEntries||3;
         var ordered = flags.sort((a,b) => b.active-a.active || b.flaggers.length-a.flaggers.length || b.description.length-a.description.length);
         var ret = ordered.slice(0,maxEntries-1||1)
            .map(f => ({count: f.flaggers.length||1, description: f.description, active: f.active, type: f.commentId ? 'comment' : 'post'}));
         if ( ordered.length >= maxEntries && maxEntries > 1)
            ret.push({count: ordered.filter(f => f.active).slice(maxEntries-1).reduce((acc, f) => (f.flaggers.length||1) + acc, 0), description: " more...", type: 'more'});
         return ret;
      }
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
                        flagIds: [id],
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
               
            // consolidate identical flags
            ret.flags = Object.values(ret.flags.reduce( function(acc, f)
               {
                  var composite = acc[f.description] || {
                     description: f.description, 
                     active: f.active,
                     result: f.result,
                     resultDate: f.resultDate,
                     resultUser: f.resultUser,
                     flaggers: [], 
                     flagIds: [] };
                  composite.active = composite.active || f.active;
                  composite.flaggers.push.apply(composite.flaggers, f.flaggers.map(u => Object.assign({}, u, {active: f.active})));
                  composite.flagIds.push.apply(composite.flagIds, f.flagIds);
                  acc[f.description] = composite;
                  return acc;
               }, {}) );
               
            // consolidate identical flags on the same comment
            ret.commentFlags = Object.values(ret.commentFlags.reduce( function(acc, f)
               {
                  var composite = acc[f.commentId + f.description] || {
                     commentId: f.commentId,
                     description: f.description, 
                     active: f.active,
                     result: f.result,
                     resultDate: f.resultDate,
                     resultUser: f.resultUser,
                     flaggers: [], 
                     flagIds: [] };
                  composite.active = composite.active || f.active;
                  composite.flaggers.push.apply(composite.flaggers, f.flaggers.map(u => Object.assign({}, u, {active: f.active})));
                  composite.flagIds.push.apply(composite.flagIds, f.flagIds);
                  acc[f.commentId + f.description] = composite;
                  return acc;
               }, {}) );

            flagCache[postId] = ret;

            return ret;
         });
   }


   // 
   // this should be considered incomplete AT BEST
   // The truth is, the flag bar intentionally omits some information (full list of flaggers, comment flaggers) 
   // and is incorrect in regard to some other information (showing active flags as inactive in cases where a flag has been handled)
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
                                 userId: userId && userId.length > 0 ? +userId[1] : null,
                                 name: this.textContent,
                                 flagCreationDate: new Date($(this)
                                    .next(".relativetime")
                                    .attr('title') || new Date())
                              };
                           })
                           .toArray()
                     };
                  })
                  .toArray(),

               commentFlags: fp.find("table.comments tr .flagcount")
                  .map(function()
                  {
                     var flaggedComment = $(this).closest("tr");
                     var commentId = flaggedComment.attr("class")
                        .match(/comment-flagged-(\d+)/);
                     if (!commentId || commentId.length < 2) return;
                     return {
                        commentId: +commentId[1],
                        active: true,
                        description: $.trim($(this).next(".revision-comment")
                           .html()),
                        flaggers: Array(+$(this).text()).fill({userId: null, name: "", flagCreationDate: new Date()})
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
   
});
