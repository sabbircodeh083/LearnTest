# Plan: Fix eslint no-namespace lint error in middleware.ts

## Problem
`Backend/src/common/middleware.ts:10` declares `namespace Express` inside `declare global`. Lint fails with "module syntax is preferred over namespaces." The existing disable comment is on line 8, which applies to line 9 (`declare global`), not line 10 (`namespace Express`), so it does not suppress the rule.

## Fix
Move the eslint-disable comment to immediately precede the namespace declaration (line 10), or wrap both lines:

```ts
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request { ... }
  }
}
```

Alternatively, replace namespace augmentation with module augmentation:

```ts
import "express";
declare module "express-serve-static-core" {
  interface Request {
    requestId: string;
    user?: import("../auth/guards.js").AuthUser;
  }
}
```

## Validation
- `cd Backend && npm run lint` passes.
- Typecheck still resolves `req.requestId` and `req.user`.

## Open questions
- None.
