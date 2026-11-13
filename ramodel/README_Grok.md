# RaModel handoff for Grok

This package contains the current RaModel instructions and course archive for migration to Grok.

## Files

- `ramodel_prompt.py`: canonical current implementation. `RAMODEL_SYSTEM_PROMPT` is the full active system prompt; `build_ra_analysis_prompt(data)` formats the per-stock user prompt.
- `DATA_INPUT_SPEC.md`: required data fields and indicator conventions for supplying the prompt without the original application.
- `course_drafts/`: detailed source notes, exact user-provided slide text, course-specific interpretations, and case records.

## How to use with Grok

1. Set the full contents of `RAMODEL_SYSTEM_PROMPT` in `ramodel_prompt.py` as Grok's system instructions. Do not truncate the numbered rules or JSON schema.
2. Supply a user message containing the fields and history described in `DATA_INPUT_SPEC.md`; the original `build_ra_analysis_prompt` function is included as a reference formatter.
3. Ask Grok to return only the JSON shape defined inside the system prompt.
4. Preserve each episode's scope. A course-specific threshold or invalidation rule applies only to its own named assessment field unless the course explicitly says otherwise.

## Status and precedence

- The active rules are the system prompt in `ramodel_prompt.py`.
- Course drafts document rationale and cases. Completed drafts explain the source and interpretation of active rules.
- Episode 124 is complete and active in the system prompt. Its candlestick-only ranking supersedes the former mixed list that combined K-line patterns with W bottoms. W bottom and other larger structures remain in their dedicated assessments.
- This is a prompt/data contract export. It does not include brokerage credentials, provider API keys, or the unrelated WiModel application.

## Model boundary

RaModel is a technical-structure observation model. Keep its existing prohibition on individualized buy/sell directions, entry instructions, stop levels, price targets, and position sizes.
