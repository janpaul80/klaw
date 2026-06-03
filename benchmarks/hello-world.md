# Hello World Benchmark

## Purpose
Basic verification that providers can generate simple, runnable code.

## Prompt
"Create a hello world node script"

## Expected Behavior
- All providers return a valid non-empty string response
- Output contains runnable JavaScript
- Response length > 20 characters

## Validation Criteria
- No exceptions thrown
- Output is a string
- Output length > 20 chars

## Notes
- This is a minimal smoke test
- More complex benchmarks (Next.js, Express, React, CLI) will extend this pattern
- Benchmark quality will become part of the release process in v0.3