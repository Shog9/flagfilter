# Flag Filter - Monica's Table-of-Contents Version

Flag Filter is a Stack Exchange moderator userscript designed to simplify the moderation process (particularly in the case of high-volume flag sites) by moving flags to sit inline on the posts and comments they relate to on the page rather than being restricted to the bottom-locked flag overlay (The "Waffle Bar").

## Table-of-Contents

- [Getting Started](#getting-started)
- [Overview](#overview)
  - [Compatable Moderator Userscripts](#compatable-scripts) 
- [The new Waffle Bar](#new-waffle)
- [Inline flagging - Active flags](#active-flags)
  - [Post flags](#post-active)
  - [Comment flags](#comment-active)
- [Inline flagging - Resolved flags](#resolved-flags)
  - [Post flags](#post-resolved)
  - [Comment flags](#comment-resolved)
- [Acknowledgements](#acknowledgements)

<a id="getting-started"></a> 
## Getting Started

This script will only work for diamond moderators or staff of the Stack Exchange Network on those sites where they have diamonds. The information below is based on the moderator view. Some details may vary in a minor way for staff users.

To use, have a current version of Chrome or Firefox with a current version of a userscript manager - generally [Tampermonkey](https://tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/get-it/). Install the script by viewing the [raw file](https://github.com/Shog9/flagfilter/raw/master/MonicasFlagToC.user.js) on the GitHub Project page. 

This userscript is also compatable with Firefox for Android if using a script manager and the full site page view.

### Compatable Moderator Userscripts

This is a brief list of Moderator Userscripts that are known to be usable (or not) in conjunction with Flag Filter on the question page. Userscript links below are to RAW install files.

#### Compatable:
- [animuson](https://github.com/animuson)'s [Stack Exchange Moderator Tools Improved (SEMTI)](https://github.com/animuson/se-mod-tools-improved/raw/master/better-mod-tools.user.js).
- [ArtOfCode](https://github.com/ArtOfCode-)'s [Move SE Mod Info](https://github.com/ArtOfCode-/Userscripts/raw/master/stackexchange/mod/move_mod_info.user.js)


#### Incompatable:
- ArtOfCode's [Show Comment Flagger](https://github.com/ArtOfCode-/Userscripts/raw/master/stackexchange/mod/comment_flagger.user.js) userscript is not compatable with Flag Filter, so having it will not reveal who flagged comments on the question page while Flag Filter is active. Flagger usernames can still be viewed on the flags dashboard or by temporarily disabling Flag Filter. Both userscripts can be active simultaneously without causing any errors.

<a id="overview"></a> 
## Overview

Flag Filter works by moving the flag content from the vertically-scrolling Waffle Bar directly onto the page with the Waffle Bar becoming a table-of-contents listing all posts (identified by post type and username) with active flags and type of flag. While the native Waffle Bar is useful on questions with few flags, the more flags that exist on a Q&A thread, the more real estate the bar takes up, and the more searching the moderator has to do to match up the flag with the flagged post or comment and see it in context. 

When it comes to comments, the content is duplicated, as the comment text appears both on the page and in the Waffle Bar. On sites with huge volumes of comment flags, this makes for a lot of scrolling inside the Waffle Bar to review the flags and it's still often necessary (or at least helpful) to see them in context with the rest of the (unflagged) comments.

Compare, these two images are the native view and Flag Filter view of the same post with many flags:

The native view of a question with lots of flags:

[![Native flagging view][10]][10]

This is a huge mess. 

- Over half the page (on this small monitor) is taken up by the Waffle Bar, so little of the actual post is viewable.
- There's no indication of how many flags there are on how many posts, only the really long scroll bar indicating that there are many.
- The comments are still collapsed, so the first comment on the question that's flagged is invisble and lacking context.
- Minimizing the bar to see more of the page hides *all* of the flag information, making it impossible to know which posts and comments have been flagged. When the bar is expanded, in order to get context, each post or comment link goes directly to the flagged post or comment.

The same question with the Flag Filter userscript active, same volume of flags:

[![Flag filter view][11]][11]

- The table-of-contents is a fraction of the size and shows *all* of the 30 flags and flag reasons on five posts simultaneously, starting with the question.
- The question is clearly marked as having been flagged and why. The shaded area with the colorful sidebar draws attention. Each post and comments section lists the number of active and resolved flags.
- Comments are expanded by default and marked similarly to the post. A colorful bar drawing attention to the flagged comment with a shaded area holding the flag reason.
- Comments are deleted by clicking the word "delete" rather than a small x button. This gives a bigger target for clicking and disambiguates between dismissing the flag and deleting the comment (not shown, see [comments section](#comment-active) below).
- The bar can be easily ignored without collapsing and the flags seen by scrolling through the page, if the flags are difficult to find, flag links are anchored to the relevant post or comments section; post flags link to the top of the post, comment flags link to the top of that post's comment section.

<a id="new-waffle"></a> 
## The new Waffle Bar

The improved Waffle Bar has a table-of-contents style view. Instead of listing each flag, it lists flags in a row by post, one box per post. The number of boxes per row varies based on the page width. Boxes in excess of what the page width allows will be pushed to additional rows as needed.

[![Seventeen simultaneously flagged posts in the Waffle Bar][1]][1]

When the heights of the boxes are different, they automatically space themselves to reduce vertical area.

Active flags are noted in colored text (depending on site theme), resolved flags in grey.

As with the native version of the Waffle Bar, the new implementation only appears on pages with active flags or when the last flag was just handled and the page has not yet been refreshed. This allows easy movement between posts with active flags by using the grey arrows on either upper corner of the bar. 

To remove the Waffle Bar, hit the "close" button in the upper right corner or, if there are no remaining active flags, refresh the page.

<a id="active-flags"></a> 
## Inline flagging - Active flags

Inline flagging allows moderators to see the flags directly in context of the post or comment that was flagged. It's no longer necessary to find where on the page the flag is; it's directly below the post or comment.

<a id="post-active"></a> 
### Post flags

Both active and resolved flags appear expanded on posts when there is at least one active flag on the post.

[![flag filter banner with both active and resolved post flags][2]][2]

Active flags are in dark text; resolved flags are greyed out.

If the post only has one active flag (or if the same resolution can be used for all active flags), the primary "Helpful..." or "Decline..." buttons can be used to handle the flag. 

- "Helpful..." results in an optional feedback text field and a button that reads "mark helpful".  
[!["Helpful..." flagging menu][4]][4]

- "Decline..." results in the four standard decline reason options in click boxes or the option of entering custom text. Flag Filter will save the last-used custom decline reason and add it to the list of options until replaced by another custom reason (in this case, "This is a dumb autoflag. Shoo.)"  
[!["Decline..." flag menu.][5]][5]

If the post has multiple active flags and they should not be handled in the same way or they need different feedback, hovering over the active flags will reveal a small x bearing the hover text "dismiss this flag as helpful or declined". Clicking on the x for the a flag opens a sub-option of "Helpful..." and "Decline..." that will handle that flag only. Clicking on these reveals the same options as above.

[![flag filter banner showing Sub-options for handling one flag at a time][3]][3]

<a id="comment-active"></a> 
### Comment flags

When viewing a post with comment flags, the entire comments section on the post will be expanded, revealing all of the non-deleted flags. There is a banner at the top of the comments section with a summary of the number of active and resolved flags.

[![Active comments banner with active and resolved flags][6]][6]

Clicking the colored text (in the image above "2 active comment flags") will reveal all deleted comments and the resolved comment flags. Viewing deleted comments by clicking "[n] deleted" will not reveal which deleted comments bear resolved flags.

Comments with active flags will be marked with a red bar on the left side of the comment, while comments with resolved flags will be marked with a grey bar (resolved flags will only show when viewing full flag info [see below](#comment-resolved) for more information about resolved comment flags).

Each flaged comment will have a grey bar beneath it with the flag reason. On hover, the options will appear to "dismiss flags" (far left) or "delete" the comment (far right). The latter will automatically mark the flag as "helpful". If the comment should be deleted but the flag reason is incorrect, it's recommended to dismiss the flag before deleting the comment.

[![Three flagged comments, one showing options revealed on hover][7]][7]

If a comment has more than one type of flag, each flag will appear in a separate row. As with the existing view, it's not possible to dismiss a single flag reason on a comment. It's necessary to either dismiss all flags or mark all as helpful.

[![Comment with multiple flags, one no longer needed, one custom][8]][8]

Unlike post flags, comment flags will not name who flagged the comment unless it is a custom comment flag. They will, however, indicate how many flags there are in a subtle way - a comma will appear for each flag in excess of one.

[![Comment flagged multiple times][9]][9]

<a id="resolved-flags"></a> 
## Inline flagging - Resolved flags

When all flags on a post have been resolved, viewing the page natively (rather than through the active flags page), will not show the Waffle Bar and viewing inactive flags will not cause it to appear.

<a id="post-resolved"></a> 
### Post flags

<a id="comment-resolved"></a> 
### Comment flags

<a id="acknowledgements"></a> 
## Acknowledgements

This project is possible due to the work and ideas of others.

The inline flag prototype was a never-completed project conceived and designed by [Jin](https://meta.stackexchange.com/users/147574/jin) and [Jarrod](https://meta.stackexchange.com/users/3/jarrod-dixon) in 2014. It was great as-is but it needed a solution for the difficulty of actually *finding* the flags on a very long page of full answers.

The idea of converting the Waffle Bar (which had been originally designed by [waffles](https://meta.stackoverflow.com/users/17174/sam-saffron)) into the table-of-contents view came from [Monica Cellio](https://meta.stackexchange.com/users/162102/monica-cellio) when discussing improving the moderator post interface in early 2018.

The combination of the two was a perfect match.


  [10]: https://i.stack.imgur.com/9mKkg.png
  [11]: https://i.stack.imgur.com/r8wAR.png
  [1]: https://i.stack.imgur.com/JU4tv.png
  [2]: https://i.stack.imgur.com/m29bL.png
  [3]: https://i.stack.imgur.com/Mappa.png
  [4]: https://i.stack.imgur.com/uge2Q.png
  [5]: https://i.stack.imgur.com/k5nMl.png
  [6]: https://i.stack.imgur.com/wAkFJ.png
  [7]: https://i.stack.imgur.com/GbKtH.png
  [8]: https://i.stack.imgur.com/P73gk.png
  [9]: https://i.stack.imgur.com/bB920.png
