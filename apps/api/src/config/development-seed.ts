export function assertDevelopmentSeedAllowed(nodeEnv: string | undefined): void {
  if (nodeEnv === 'production') {
    throw new Error('Development seed cannot run with NODE_ENV=production.');
  }
}
