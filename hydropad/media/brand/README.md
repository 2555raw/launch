# Banners

Twitter/X header, 1500 × 500, with a 2× beside each for upload.

Built by `scripts/header.js` from the register's own photographs, so the water
on the banner is one of the reserves a coin can actually be paired to. The
caption names it.

The bottom-left corner is left clear: that is where the profile picture sits
over the banner, and anything put there is hidden on half the clients.

    TRR   Laguna Rosa, Torrevieja      pink brine, the most distinctive
    GLC   Perito Moreno, Santa Cruz    glacier and lake
    ORO   Oroville, California         the dam
    MEAD  Lake Mead, Nevada            the bathtub ring

The photographs are the project's own supply and are still credit pending —
settle that before any of these goes out publicly.


# The wide banner

`banner.png` at 2000 × 650 for a post and `banner-header.png` at 1500 × 500 for
the X header, each with a 2x. Built by `scripts/banner.js`: the six reserves
either side of the headline, coins turning between them, over a sky.

The two sizes are laid out separately rather than one cropped from the other —
a crop of the wide one loses the cards at both ends.

The ground is the site's own — forest floor at dusk, `#0b1512` deepening to
`#060f0e` — so the banner and the page look like one thing.

Falling water instead of coins. A drop is a shape with light in it: a highlight
near the top where it comes in, a bright rim where it bends round the edge, and
a small spot low down where it comes back through. Take those away and it is a
blue circle.

The cards turn in space rather than on the page — left-hand ones send their
right edge away, right-hand ones their left — so the set stands around the
headline instead of sitting pasted flat on it.

# Banners with the cards

`header-cards-<shot>.png`, 1500 × 500 with a 2x, built by
`scripts/header-cards.js`: the lockup on ink to the left, three reserve cards
floating over the photograph on the right. Three shots to choose from — mead,
glc, oro.

The cards are kept whole inside the frame. One running off the edge reads as a
crop rather than as depth, and X crops this again on a phone.

The same warning below applies: the line and the percentage on those cards are
generated.

# Cards

The six featured reserves, one card each plus the six together in `cards.png`
(1600 × 900 at 2x). Built by `scripts/cards.js` from `data.js`, so the figures
on them are the register's own and change with it.

The photograph of the place stands in for a flag. The fill level sits on a blue
scale — one hue at three weights, because it is an amount of water; a traffic
light there reads as something being wrong. The change badge keeps green and
red, because that one is a direction.

## The line and the percentage are not measured

Read this before any of these goes out.

The trace and the percentage on each card are **generated**, not observed.
There is no public series of these figures to plot, so the line is a walk
seeded from the ticker — stable across runs, different on every card, and
drawn to lean the same way its badge reads. The percentage sits in the
range one of these would plausibly move in a session.

They are there because the card wants a line, on the same footing as the
seeded drift `data.js` already applies to the spot figures.

What IS the register's own: the spot price, the unit, the fill level, the
name and the photograph.

If any of this goes somewhere it could be read as market data, say so beside
it, or take the line off. A chart nobody labelled is the kind of thing that
gets quoted back at you.

Nothing here is loaded by the site. These are for posts.
