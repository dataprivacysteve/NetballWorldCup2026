# Nation flags

Drop one flag image per participating nation here, named by the **lowercase
country code** used in the data:

```
jam.svg  tto.svg  brb.svg  lca.svg  guy.svg  arg.svg  usa.svg  can.svg
```

- **SVG preferred** (crisp at any size, tiny). PNG works too — keep the name,
  e.g. `jam.png`, and update `flagSrc()` in `app/lib/config.ts` if you switch
  the extension.
- They serve at `/flags/<code>.svg` and are picked up automatically by the
  `Crest` component. If a file is missing the site falls back to the config
  emoji / ISO monogram — nothing breaks.
- Adding a new nation = drop `<code>.svg` here and add the code to the
  `nations` map in `app/lib/config.ts`.
