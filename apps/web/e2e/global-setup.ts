import { e2eApiOrigin } from './target';

export default async function globalSetup(): Promise<void> {
  const forbidden = ['43111', '43110', 'ravion_barber', 'ravion_homolog'];
  if (forbidden.some((value) => e2eApiOrigin.includes(value))) {
    throw new Error('Playwright recusou o destino porque ele não é a stack E2E.');
  }

  const response = await fetch(`${e2eApiOrigin}/api/v1/health`);
  if (!response.ok || response.headers.get('x-ravion-stack') !== 'ravion_e2e') {
    throw new Error(
      'Playwright interrompido: a API exclusiva não se identificou como ravion_e2e. Nenhum dado foi alterado.',
    );
  }
}
