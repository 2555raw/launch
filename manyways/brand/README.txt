The brand header, rendered from the site itself.

render.js opens header.html in a real browser at each size and screenshots
it, so the banner uses the same photograph, palette and type as the page it
advertises and cannot drift away from it. Re-render after any brand change:

    node brand/render.js "file:///path/to/google-fonts.css" brand

(the first argument is only needed where fonts.googleapis.com is blocked;
pass the live URL otherwise.)

  header-x.png       1500x500: X / Twitter profile header
  header-og.png      1200x630: link preview, the standard card size
  header-wide.png    2400x800: a wide banner, for a page or a slide
  header-square.png  1200x1200: Instagram, or anywhere square

media/card.jpg is header-og.png compressed, and is what the pages link to
in their og:image. That tag is a relative path: make it an absolute URL
once the site has a domain, because scrapers do not resolve relative ones.

The photograph is media/grove.webp, which came from the project. Its
licence still needs establishing before any of this is published.
