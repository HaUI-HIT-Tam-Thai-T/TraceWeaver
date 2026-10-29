# AI handoffs

Versioned delivery bundles from AI development belong here so they are included in Git and source archives. Keep original bundle contents unchanged to preserve sender checksums and provenance.

`AI_BE_RUNTIME_V2/` is the complete supplied trained sandbox-v2 bundle: source, dependencies, model, manifest/evaluation,23 HTTP sample pairs and42 feature fixtures. See its [README](AI_BE_RUNTIME_V2/README.md) and [bundle manifest](AI_BE_RUNTIME_V2/bundle-manifest.json).

The integrated runtime is maintained in `ai/app/`, models in `ai/artifacts/`, features in `ai/features/` and tests in `ai/tests/`. A handoff is a preserved delivery snapshot; changes to application behavior belong in those maintained directories. Local credentials, environments, logs and verification output stay outside this versioned folder.
