# Production tooling dependency check

Checked on 7 November 2026. Root and server dependency audits report no vulnerabilities. The client production dependency audit (`npm audit --omit=dev`) also reports none.

The client build/test dependency tree was updated to patched `glob` 14.0.4, `minimatch` 11.0.5 (modern callers only), `js-yaml` 5.4.3, `fast-uri` 3.1.9 and `serialize-javascript` 7.1.4. Legacy minimatch 3 callers retain their compatible version. The complete client and build-tool suites passed after these updates.

The full client audit still reports five low-severity entries from one unpatched transitive dependency: `deepmerge` 4.3.1, used by Jest configuration. [The upstream advisory](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) lists no patched release. The other four entries represent the Jest dependency chain, not four additional vulnerable implementations. This dependency is test tooling and is absent from the shipped player runtime; its inputs here are repository-controlled test configuration. Do not process untrusted configuration through it. Recheck when an upstream fix is released.

Do not use `npm audit fix --force` to remove the report: its proposed Jest downgrade is not a verified remediation. This remaining finding is recorded rather than suppressed. Dependency audits describe the installed tree at the check date; they do not certify the application's authorization or persistence behavior, which have separate tests.
