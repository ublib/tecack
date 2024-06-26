# What is Tecack?

Tecack is a handwriting recognition engine built with TypeScript.  
This project was developed based on [KanjiCanvas](https://github.com/asdfjkl/kanjicanvas).  
The character candidate inference algorithm was implemented by [KanjiCanvas](https://github.com/asdfjkl/kanjicanvas),  
and this project focuses on setting up the surrounding environment.

✅ TypeScript support  
✅ Installable via npm  
✅ Package segmentation  
✅ Comprehensive documentation  
✅ Rich ancillary tools (such as dataset creation tools)

and more...

# The Excellence of [KanjiCanvas](https://github.com/asdfjkl/kanjicanvas)

👍 Retention of stroke order data  
👍 Inference based on stroke order and number of strokes  
👍 Extensibility of datasets  
👍 Lightweight

# How does it work?

Tecack is broadly divided into frontend and backend.

The frontend generates `TecackStrokes` based on user's stroke information through Canvas.
The backend infers character candidates based on `TecackStrokes`.

The backend can run in any environment that supports JS/TS.
This includes browsers, as well as Node.js, Deno, and Bun.
(You can think of it as a pure function that takes `TecackStrokes` and a dataset, and outputs character candidates.)

![preview](/tecack.gif)

# Next

**[Try it out by cloning (`nr play`)](https://github.com/ublib/tecack) or [Read tutorial](/introduction/getting-started.md) !**
