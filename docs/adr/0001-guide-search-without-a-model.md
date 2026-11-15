# Guide search uses BM25 and a synonym list, not a language model

Crew search the Guide by typing what they feel ("headache", "can't sleep"). We considered a local LLM and retrieval-augmented generation, and chose BM25 keyword ranking over hand-written Guide entries with a curated synonym list and prefix matching. A model can produce health sentences no NASA source said, the product rule is no AI model and no AI-written text in what the app tells crew, and a model in the browser would add hundreds of MB to an app that must work offline. Every word a search can show is a sentence a person has checked.

## Consequences

- A symptom the synonym list does not know finds nothing useful until someone adds the word; the fix is a list edit, not retraining.
- Results are ranked the same way every time, so a test can pin "headache" to its expected entries.
