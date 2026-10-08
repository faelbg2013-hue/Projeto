import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

// The suite compiles route modules while assertions wait. One second is not
// enough for that work on this machine; the condition itself stays the same.
configure({ asyncUtilTimeout: 4000 });

afterEach(() => {
  cleanup();
});
