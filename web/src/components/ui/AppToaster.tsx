import { Toaster } from 'sileo';
import { useDomTheme } from '../../hooks/useDomTheme';

export function AppToaster() {
  const theme = useDomTheme();
  return (
    <Toaster
      theme={theme === 'dark' ? 'light' : 'dark'}
      position="top-right"
      offset={{ top: '4rem' }}
    />
  );
}
