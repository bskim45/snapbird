(function (window, document, undefined) {

/**
 * Utilities
 */

function escapeTags(s) {
  return (s||'').replace(/[<>]/g, function (m) { return {'<':'&lt;'}[m]||'&gt;'; });
}

function two(s) {
  return (s+'').length == 1 ? '0' + s : s;
}

function updateRequestStatus() {
  $.getJSON('http://twitter.com/account/rate_limit_status.json?callback=?', function (data) {
    var date = new Date(Date.parse(data.reset_time));
    if (! $('#status p.rate').length) $('#status').append('<p class="rate" />');
    $('#status p.rate').html('Requests left: ' + data.remaining_hits + '<br />Next reset: ' + two(date.getHours()) + ':' + two(date.getMinutes()));
  });
}

function getQuery(s) {
  var query = {};

  s.replace(/\b([^&=]*)=([^&=]*)\b/g, function (m, a, d) {
    if (typeof query[a] != 'undefined') {
      query[a] += ',' + d;
    } else {
      query[a] = d;
    }
  });

  return query;
}

/**
 * Twitterlib setup
 * This happens after login becuase we have to have the user's token to
 * authenticate them with the proxy.
 */

var setupTwitterlib = (function () {
  twitterlib.cache(true);
  var base = 'http://twoxy.leftlogic.com/1.1';
  return function (data) {
    // Setup twitterlib
    var defaults = {
      token: data.token,
      token_secret: data.token_secret,
      proxy_client_id: data.proxy_client_id
    };
    // twitterlib.custom('search', base + '/search/tweets.json?q=%search%&rpp=%limit|100%&since_id=%since|remove%&result_type=recent&include_entities=true&token=%token%&token_secret=%token_secret%&proxy_client_id=%proxy_client_id%', defaults);
    twitterlib.custom('timeline', base + '/statuses/user_timeline.json?screen_name=%user%&count=%limit|200%&page=%page|1%&since_id=%since|remove%include_rts=%rts|false%&include_entities=true&token=%token%&token_secret=%token_secret%&proxy_client_id=%proxy_client_id%', defaults);
    twitterlib.custom('list', base + '/lists/statuses.json?slug=%list%&screen_name=%user%&count=%limit|200%&page=%page|1%&since_id=%since|remove%include_rts=%rts|false%&include_entities=true&token=%token%&token_secret=%token_secret%&proxy_client_id=%proxy_client_id%', defaults);
    twitterlib.custom('favs', base + '/favorites/list.json?screen_name=%user%&count=%limit|200%&include_entities=true&skip_status=true&page=%page|1%&since_id=%since|remove%&token=%token%&token_secret=%token_secret%&proxy_client_id=%proxy_client_id%', defaults);
    // twitterlib.custom('retweets', base + '/favorites/list.json?screen_name=%user%&include_entities=true&skip_status=true&page=%page|1%&since_id=%since|remove%');
    twitterlib.custom('withfriends', base + '/statuses/home_timeline.json?screen_name=%user%&count=%limit|200%&page=%page|1%&since_id=%since|remove%include_rts=%rts|false%&include_entities=true&token=%token%&token_secret=%token_secret%&proxy_client_id=%proxy_client_id%', defaults);
    twitterlib.custom('dm', base + '/direct_messages.json?count=%limit|200%&page=%page|1%&since_id=%since|remove&include_entities=true&token=%token%&token_secret=%token_secret%&proxy_client_id=%proxy_client_id%', defaults);
    twitterlib.custom('dm_sent', base + '/direct_messages/sent.json?count=%limit|200%&page=%page|1%&since_id=%since|remove%include_rts=%rts|false%&include_entities=true&token=%token%&token_secret=%token_secret%&proxy_client_id=%proxy_client_id%', defaults);
    twitterlib.custom('mentions', base + '/statuses/mentions_timeline.json?count=%limit|200%&page=%page|1%&since_id=%since|remove%include_rts=%rts|false%&include_entities=true&token=%token%&token_secret=%token_secret%&proxy_client_id=%proxy_client_id%', defaults);
  };
}());

/**
 * Snapbird
 */

var user = {},
    loggedInUser = {};

// very hacky code - sorry!
var $tweets = $('#tweets ul'),
    $body = $('body'),
    screen_name = url = state = '',
    page = 1,
    limit = 100, // performs better and avoids 502!
    pageMax = null,
    total_tweets = 0,
    total_searched = 0,
    timer = null,
    statusTop = null,
    type_string = {
      timeline : 'tweets',
      favs: 'favourites',
      withfriends: 'friends&rsquo; tweets',
      mentions: 'mentions',
      list: 'member tweets',
      dm: 'received direct messages',
      dm_sent: 'sent direct messages'
    };

$body.keyup(function (event) {
  // esc
  if (event.which == 27) {
    clearTimeout(timer);
    $body.removeClass('loading');
    twitterlib.cancel();
  }
});

$('#more a').on('click', function () {
  pageMax = 5;
  $('form').submit();
  return false;
});

$(function () {
  var msie6 = $.browser == 'msie' && $.browser.version < 7;
  if (!msie6) {
    $(window).scroll(function (event) {
      var y;
      // what the y position of the scroll is
      if (statusTop != null) {
        y = $(this).scrollTop();

        // whether that's below the form
        if (y >= statusTop) {
          // if so, ad the fixed class
          $('#tweets aside').addClass('fixed');
        } else {
          // otherwise remove it
          $('#tweets aside').removeClass('fixed');
        }
      }
    });
  }
});

/**
 * Login & authentication
 * The session contains the user's Twitter tokens (token and token_secret) as
 * well as the proxy client id (proxy_client_id). It's held server side - the
 * client side accesses it by hitting the /api/user URL.
 */

var isLoggedIn = function (cb) {
  return $body.hasClass('logged-in');
};

var getSession = function (cb) {
  $.get('/api/user', function (data) {
    cb(!!data.token, data);
  });
};

var requestLogin = function (cb) {
  getSession(function (loggedIn, data) {
    if (!loggedIn) return $body.addClass('auth');
    $body.addClass('logged-in').removeClass('logged-out auth');
    cb && cb(data);
  });
};

/**
 * Snapbird
 */

var $status = $('#tweets aside p');
function setStatus(matched, searched, oldest) {
  var date = new Date(Date.parse(oldest)),
      hour = date.getHours(),
      niceSearched = (searched+'').replace(/([0-9]+)([0-9]{3})/, "$1,$2");

  $status.eq(0).text(matched + (matched == 1 ? ' tweet' : ' tweets'));
  // cheap thousand separator
  $status.eq(1).text(niceSearched + ' searched');

  if (oldest != undefined) {
    $status.eq(2).text(twitterlib.time.date(date));

    if (hour > 6 && hour < 12) {
      $('#time').text('morning');
    } else if (hour < 18) {
      $('#time').text('afternoon');
    } else if (hour < 22) {
      $('#time').text('evening');
    } else {
      $('#time').text('night');
    }
  }

  $('#more p.searched').text(niceSearched + ' tweets searched.');
}

function updateLoading(type, currentTotal) {
  var inc = limit;
  if (type == 'favs') inc = 20;
  $('#loading .num').text(total_searched + '-' + (total_searched+inc));
}

/**
 * Search form submitted
 */
$('form').submit(function (e) {
  e.preventDefault();
  if (!isLoggedIn()) return requestLogin();

  var newstate = $(this).serialize(),
      type = $(this).find('#type').val(),
      search = $('#search').val(),
      filter = twitterlib.filter.format(search);

  updateLoading(type);
  screen_name = $('#screen_name').val() || user.screen_name;

  $('body').removeClass('intro').addClass('results loading');

  if (state === newstate) {
    clearTimeout(timer);
    timer = setTimeout(function () { twitterlib.cancel().next(); }, 250);
    return;
  }

  state = newstate;
  store.set('screen_name', screen_name);

  if (screen_name.match(/\//)) {
    type = 'list';
  }

  total_tweets = 0;
  total_searched = 0;
  $tweets.empty();

  var permalink = '/' + screen_name + '/' + type + '/' + encodeURIComponent(search);
  $('#permalink').attr('href', permalink);
  _gaq.push(['_trackPageview', permalink]);


  $tweets.append('<li class="searchterm">Searching <em><strong>' + escapeTags(screen_name) + '</strong>&rsquo;s ' + type_string[type] + '</em> for <strong>' + escapeTags(search) + '</strong></li>');
  $('body').addClass('results');

  // cancel any outstanding request, and kick off a new one
  twitterlib.cancel()[type](screen_name, { filter: search, rts: true, limit: limit }, function (data, options) {
    total_searched += options.originalTweets.length;

    setStatus(total_tweets + data.length, total_searched, options.originalTweets.length ? options.originalTweets[options.originalTweets.length - 1].created_at : null);

    // if there's no matched results, but there are raw Tweets, do another call - and keep going until we hit something
    if (data.length == 0 && total_tweets == 0 && options.originalTweets.length > 0) {
      // check if we're doing a page max
      updateLoading(type);
      clearTimeout(timer);
      timer = setTimeout(function () {
        twitterlib.next();
      }, 500);
      return;
    } else if (total_tweets > 0 && data.length == 0 && options.originalTweets.length > 0 && pageMax > 0) {
      pageMax--;
      updateLoading(type);
      clearTimeout(timer);
      timer = setTimeout(function () {
        twitterlib.next();
      }, 500);
      return;
    }

    if (total_tweets) {
      $tweets.find('li:last').addClass('more'); // hard split line
    }

    var i = 0, j = 0, t, r, scrollPos = null, searches = filter.and.concat(filter.or).join('|');

    for (i = 0; i < data.length; i++) {
      t = twitterlib.render(data[i], i);
      $tweets.append(t);

      if (total_tweets == 0 && i == 0) {
        $tweets.find('li:first').addClass('first');
      }

      // really tricky code here, we're finding *this* and all nested text nodes
      // then replacing them with our new <strong>text</strong> elements
      $tweets.find('.entry-content:last, .entry-content:last *').contents().filter(function () {
        return this.nodeName == '#text';
      }).each(function () {
        // ignore blank lines
        // make matches bold
        var change = '';
        if (/[^\s]/.test(this.nodeValue)) {
          // encoding of entities happens here, so we need to reverse back out
          change = this.nodeValue.replace(/[<>&]/g, function (m) {
            var r = '&amp;';
            if (m == '<') {
              r = '&lt;';
            } else if (m == '>') {
              r = '&gt;';
            }
            return r;
          }).replace(new RegExp('(' + searches + ')', "gi"), "<strong>$1</strong>");
          // need to convert this textNode to tags and text
          $(this).replaceWith(change);
        }
      });
    }

    scrollPos = $tweets.find('li:last').offset().top;
    if (scrollPos != null) {
      setTimeout(function () {
        $('html,body').animate({ scrollTop: scrollPos }, 500, function () {
        });
      }, 100);
    }

    total_tweets += data.length;
    pageMax = null;

    $('body').removeClass('loading');

    if (statusTop == null) {
      statusTop = $('#tweets aside').offset().top - parseFloat($('#tweets aside').css('margin-top').replace(/auto/, 0));
    }

  });

});

$('input[type=reset]').click(function () {
  $tweets.empty();
});

// check location.search to see if we need to prepopulate
if (window.location.search) {
  var query = getQuery(window.location.search.substr(1));
  if (query.screen_name) {
    $('#screen_name').val(decodeURIComponent(query.screen_name));
  }
  if (query.search) {
    $('#search').val(decodeURIComponent(query.search));
  }
  if (query.favs) {
    $('#favs').attr('checked', 'checked');
  }
}

var $ref = $('<div>M</div>').css({
  'visibility' : 'hidden',
  'font-size': '10px',
  'line-height': '10px',
  'margin': 0,
  padding: 0,
  overflow: 'hidden'
}).appendTo('body'), oh = 10;

var timer = setInterval(function () {
  var h = $ref.height();
  if (h != oh && !$('#bang').length) {
    // show exploded page
    $('<div id="bang" />').appendTo('body');
  } else if (h == oh && $('#bang').length) {
    $('#bang').remove();
  }
}, 500);

$('#logout').click(function () {
  store.clear();
});

/**
 * Grab some tweets about snapbird. These are compiled using minstache.
 */
$.getJSON('/snapbird-favs.json', function (tweets) {
  var template = minstache.compile($('#template-tweet').text()),
      $ul = $('#tweets_about_snapbird ul');
  var added = 0;
  $.each(tweets, function (index, tweet) {
    if (added >= 5 || !tweet.user || !tweet.user.profile_image_url) return;
    added += 1;
    // Create a mini profile image url
    tweet.user.mini_profile_image_url = tweet.user.profile_image_url.replace('_normal', '_mini');
    $ul.append(template(tweet));
  });
});

/**
 * Get started by requesting login
 */
var loggedIn = function (data) {
  // set twitterlib token
  $('#screen_name').val(data.profile.username);
  $('.my-username').text(data.profile.username);
  user = data.profile._json;
  setupTwitterlib(data);
};

requestLogin(loggedIn);

}(this, document));