'use strict';
const fetch = require('node-fetch');
const cheerio = require('cheerio');

/* CONFIGURATION STARTS HERE */

/* Step 1: enter your domain name like fruitionsite.com */
const MY_DOMAIN = process.env.DOMAIN_NAME;

/*
 * Step 2: enter your URL slug to page ID mapping
 * The key on the left is the slug (without the slash)
 * The value on the right is the Notion page ID
 */
const SLUG_TO_PAGE = {
  '': 'ee367a564e5a49a58a5ce89503d21ccd',
};

/* Step 3: enter your page title and description for SEO purposes */
const PAGE_TITLE = 'X-Tech';
const PAGE_DESCRIPTION = 'We build software to help business grow.';

/* Step 4: enter a Google Font name, you can choose from https://fonts.google.com */
// const GOOGLE_FONT = "Rubik";
const GOOGLE_FONT = '';

/* Step 5: enter any custom scripts you'd like */
const CUSTOM_SCRIPT = ``;

/* CONFIGURATION ENDS HERE */

const PAGE_TO_SLUG = {};
const slugs = [];
const pages = [];
Object.keys(SLUG_TO_PAGE).forEach(slug => {
  const page = SLUG_TO_PAGE[slug];
  slugs.push(slug);
  pages.push(page);
  PAGE_TO_SLUG[page] = slug;
});

function headersFromResponse(response) {
  const headers = {};
  response.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  delete headers['content-encoding'];
  delete headers['content-security-policy'];
  delete headers['x-content-security-policy'];
  return headers;
}

function generateSitemap() {
  let sitemap = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
  slugs.forEach(
    (slug) =>
      (sitemap +=
        "<url><loc>https://" + MY_DOMAIN + "/" + slug + "</loc></url>")
  );
  sitemap += "</urlset>";
  return sitemap;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function handleOptions(request) {
  if (
    request.headers["Origin"] &&
    request.headers["Access-Control-Request-Method"] &&
    request.headers["Access-Control-Request-Headers"]
  ) {
    // Handle CORS pre-flight request.
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: null,
      isBase64Encoded: false,
    };
  } else {
    // Handle standard OPTIONS request.
    return {
      statusCode: 200,
      headers: {
        Allow: "GET, HEAD, POST, PUT, OPTIONS"
      },
      body: null,
      isBase64Encoded: false,
    };
  }
}

async function fetchAndApply(request) {
  Object.keys(request.headers).forEach((key) => {
    if (key.startsWith('CloudFront') || key.startsWith('X-')) {
      delete request.headers[key];
    }
  });

  delete request.headers.Host;
  delete request.headers.Via;

  if (request.httpMethod === "OPTIONS") {
    return handleOptions(request);
  }

  if (request.path === "/robots.txt") {
    console.log('return robots.txt');
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/plain',
      },
      isBase64Encoded: false,
      body: "Sitemap: https://" + MY_DOMAIN + "/sitemap.xml",
    };
  }

  if (request.path === "/sitemap.xml") {
    console.log('return sitemap.xml');
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/xml',
      },
      isBase64Encoded: false,
      body: generateSitemap(),
    };
  }

  const notionUrl = "https://www.notion.so" + request.path;
  let response;

  if (request.path.startsWith("/app") && request.path.endsWith("js")) {
    console.log('return script');
    response = await fetch(notionUrl);
    let body = await response.text();
    body = body
      .replace(/www.notion.so/g, MY_DOMAIN)
      .replace(/notion.so/g, MY_DOMAIN);
    return {
      statusCode: 200,
      headers: Object.assign(headersFromResponse(response), {
        'Content-Type': 'application/x-javascript',
      }),
      isBase64Encoded: false,
      body,
    };
  }

  if (request.path.startsWith("/api")) {
    console.log('proxy api call');
    // Forward API
    response = await fetch(notionUrl, {
      // TODO: if body is base64-encoded, decode here
      body: request.body,
      headers: {
        "content-type": "application/json;charset=UTF-8",
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.163 Safari/537.36"
      },
      method: request.httpMethod,
    });

    const body = await response.text();

    return {
      statusCode: 200,
      headers: Object.assign(headersFromResponse(response), {
        'Access-Control-Allow-Origin': '*',
      }),
      isBase64Encoded: false,
      body,
    };
  }

  if (slugs.indexOf(request.path.slice(1)) > -1) {
    const pageId = SLUG_TO_PAGE[request.path.slice(1)];
    return {
      statusCode: 301,
      headers: {
        Location: "https://" + MY_DOMAIN + "/" + pageId,
      },
    };
  }

  response = await fetch(notionUrl, {
    // TODO: if body is base64-encoded, decode here
    body: request.body,
    headers: request.headers,
    method: request.httpMethod
  });

  let body;
  const headers = headersFromResponse(response);

  if (headers['content-type'].indexOf('text') < 0 && headers['content-type'].indexOf('application') < 0) {
    // non-text type use base64
    body = await response.buffer();
    body = body.toString('base64');

    return {
      statusCode: 200,
      headers,
      isBase64Encoded: true,
      body,
    };
  }

  body = await response.text();
  if (headers['content-type'].indexOf('text/html') > -1) {
    body = appendJavascript(body);
  }

  return {
    statusCode: 200,
    headers,
    isBase64Encoded: false,
    body,
  };
}

function appendJavascript(body) {
  const $ = cheerio.load(body);

  // meta rewrite
  if (PAGE_TITLE !== '') {
    $('meta[property="og:title"]').attr('content', PAGE_TITLE);
    $('meta[name="twitter:title"]').attr('content', PAGE_TITLE);
    $('title').text(PAGE_TITLE);
  }

  if (PAGE_DESCRIPTION !== '') {
    $('meta[name="description"]').attr('content', PAGE_DESCRIPTION);
    $('meta[property="og:description"]').attr('content', PAGE_DESCRIPTION);
    $('meta[name="twitter:description"]').attr('content', PAGE_DESCRIPTION);
  }

  $('meta[property="og:url"]').attr('content', MY_DOMAIN);
  $('meta[name="twitter:url"]').attr('content', MY_DOMAIN);
  $('meta[name="apple-itunes-app"]').remove();

  // head rewrite
  if (GOOGLE_FONT !== '') {
    $('head').append(`<link href='https://fonts.googleapis.com/css?family=${GOOGLE_FONT.replace(' ', '+')}:Regular,Bold,Italic&display=swap' rel='stylesheet'><style>* { font-family: "${GOOGLE_FONT}" !important; }</style>`);
  }

  $('head').append(`
  <style>
    div.notion-topbar > div > div:nth-child(3) { display: none !important; }
    div.notion-topbar > div > div:nth-child(4) { display: none !important; }
    div.notion-topbar > div > div:nth-child(5) { display: none !important; }
    div.notion-topbar > div > div:nth-child(6) { display: none !important; }
    div.notion-topbar-mobile > div:nth-child(3) { display: none !important; }
    div.notion-topbar-mobile > div:nth-child(4) { display: none !important; }
  </style>
  `);

  // body rewrite

  $('body').append(`
    <script>
      const SLUG_TO_PAGE = ${JSON.stringify(SLUG_TO_PAGE)};
      const PAGE_TO_SLUG = {};
      const slugs = [];
      const pages = [];
      let redirected = false;
      Object.keys(SLUG_TO_PAGE).forEach(slug => {
        const page = SLUG_TO_PAGE[slug];
        slugs.push(slug);
        pages.push(page);
        PAGE_TO_SLUG[page] = slug;
      });
      function getPage() {
        return location.pathname.slice(-32);
      }
      function getSlug() {
        return location.pathname.slice(1);
      }
      function updateSlug() {
        const slug = PAGE_TO_SLUG[getPage()];
        if (slug != null) {
          history.replaceState(history.state, '', '/' + slug);
        }
      }
      const observer = new MutationObserver(function() {
        if (redirected) return;
        const nav = document.querySelector('.notion-topbar');
        const mobileNav = document.querySelector('.notion-topbar-mobile');
        if (nav && nav.firstChild && nav.firstChild.firstChild
          || mobileNav && mobileNav.firstChild) {
          redirected = true;
          updateSlug();
          const onpopstate = window.onpopstate;
          window.onpopstate = function() {
            if (slugs.includes(getSlug())) {
              const page = SLUG_TO_PAGE[getSlug()];
              if (page) {
                history.replaceState(history.state, 'bypass', '/' + page);
              }
            }
            onpopstate.apply(this, [].slice.call(arguments));
            updateSlug();
          };
        }
      });
      observer.observe(document.querySelector('#notion-app'), {
        childList: true,
        subtree: true,
      });
      const replaceState = window.history.replaceState;
      window.history.replaceState = function(state) {
        if (arguments[1] !== 'bypass' && slugs.includes(getSlug())) return;
        return replaceState.apply(window.history, arguments);
      };
      const pushState = window.history.pushState;
      window.history.pushState = function(state) {
        const dest = new URL(location.protocol + location.host + arguments[2]);
        const id = dest.pathname.slice(-32);
        if (pages.includes(id)) {
          arguments[2] = '/' + PAGE_TO_SLUG[id];
        }
        return pushState.apply(window.history, arguments);
      };
      const open = window.XMLHttpRequest.prototype.open;
      window.XMLHttpRequest.prototype.open = function() {
        arguments[1] = arguments[1].replace('${MY_DOMAIN}', 'www.notion.so');
        return open.apply(this, [].slice.call(arguments));
      };
    </script>
    ${CUSTOM_SCRIPT}
  `);

  return $.root().html();
}

exports.handler = (event, context, callback) => {
  console.log(JSON.stringify(event));
  fetchAndApply(event)
    .then((response) => {
      console.log(JSON.stringify(response));
      callback(null, response);
    })
    .catch((err) => {
      console.error(err);
      callback(err, {
        statusCode: 500,
        isBase64Encoded: false,
        body: JSON.stringify({
          message: 'Internal Service Error. Please check logs',
        }),
      });
    });
};
