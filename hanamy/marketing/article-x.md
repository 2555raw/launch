# A chat that forgets you on purpose

Every assistant worth using has spent the last two years learning to remember. It keeps
the thread. It builds a profile. It reads back what was said in March so that the answer
in September lands better. That is a real feature and plenty of people want it.

Hanamy is built on the opposite bet, and it is not a subtraction. It is the product.

## One question, one answer, and then nothing

Ask it anything. Attach a spreadsheet, a screenshot, a paragraph that needs rewriting. It
answers once. Send a second message and the first exchange is gone: not archived, not
minimised into a sidebar, not sitting in a database with a delete button nobody trusts.
The model is never told there was an earlier turn, because as far as the request is
concerned there was not one.

That changes what people are willing to type. A question asked without a record behind it
is asked more plainly. The medical worry, the resignation letter, the contract clause that
looks wrong, the thing somebody is embarrassed not to know already: none of it needs to
become part of a permanent file in order to get an answer.

## Showing, instead of promising

Any product can print the sentence "we do not store your messages". The sentence costs
nothing and proves nothing, so Hanamy does two things instead.

The request body is built once and used twice: once to send and once to print. Underneath
the panel sits the exact JSON that left the browser, and the `messages` array in it has a
single entry. Not a description of what gets sent. The same object.

And a section of the site reads the browser's own storage and lists what is actually
there. Two items, on that device only: which of the three colour modes was picked, and
which endpoint it was pointed at. A conversation is never among them. If an unexpected key
ever appeared, it would show up in that list rather than get left out of a reassuring
paragraph. One button clears the lot.

## The limit, said out loud

Here is the part most privacy pages leave out.

Hanamy keeps nothing. What the AI provider does with a request after it arrives is that
provider's business, and no web page can promise otherwise. Most of them log requests for
some period. The guarantee stops at the edge of the browser, and anybody claiming their
front end extends it further is selling something.

Stating that plainly costs a line of marketing and buys the only thing that matters in a
product like this, which is that the rest of the claims can be checked.

## Where the name comes from

Hanami is the Japanese custom of going out to look at the cherry blossom. The blossom
lasts about a week. Everybody knows it lasts about a week. That is not a defect in the
tradition, it is the tradition: the looking is worth doing because the thing does not
last.

The site is built the same way. Type a line into the photograph on the front page and it
comes apart into blossom and blows away, sampled pixel by pixel from what was written so
the petals start in the exact shape of the words. The demonstration is the argument.

## What it costs

Nothing, if the provider is chosen well. Hanamy is the interface, not the model, so a key
has to come from somewhere. Groq, Google AI Studio, OpenRouter's free tier and Cerebras
all speak the same format and all give keys without a card. A deployment can hold one key
on the server, in which case visitors are asked for nothing and the key never reaches any
browser. A visitor who would rather use their own can override it, and that setting stays
in their browser.

## Who it is for

Not for the person building an agent that needs to recall last Tuesday. For the person who
wants to ask something, get a useful answer, and leave no trace of having asked. That is a
smaller product and a clearer one.

The blossom lasts a week. Go and look at it.

**hanamy.xyz**
