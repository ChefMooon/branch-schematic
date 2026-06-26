import { useEffect, useState } from 'react';

type OperatingSystem = 'macos' | 'windows' | 'linux' | 'unknown';

function detectOS(): OperatingSystem {
  if (typeof navigator === 'undefined') return 'unknown';

  const agentDataPlatform = (navigator as Navigator & {
    userAgentData?: { platform?: string };
  }).userAgentData?.platform;
  const source = `${agentDataPlatform ?? ''} ${navigator.platform ?? ''} ${navigator.userAgent ?? ''}`
    .toLowerCase();

  if (source.includes('mac')) return 'macos';
  if (source.includes('win')) return 'windows';
  if (source.includes('linux')) return 'linux';

  return 'unknown';
}

export function useOS() {
  const [os, setOS] = useState<OperatingSystem>('unknown');

  useEffect(() => {
    setOS(detectOS());
  }, []);

  return {
    os,
    isMac: os === 'macos',
  };
}
