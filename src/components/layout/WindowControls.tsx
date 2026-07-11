import { MinusIcon, SquareIcon, XIcon } from '@phosphor-icons/react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useOS } from '../../hooks/useOS';
import { Button } from '../button/Button';
import './titlebar.css';

const appWindow = getCurrentWindow();

export function WindowControls() {
  const { isMac } = useOS();

  if (isMac) return null;

  return (
    <div style={styles.container}>
      <Button
        type="button"
        variant="basic"
        style={styles.button}
        title="Minimize"
        onClick={async () => {
          try {
            await appWindow.minimize();
          } catch (error) {
            console.error('Failed to minimize window', error);
          }
        }}
      >
        <MinusIcon size={14} weight="bold" color="var(--app-text)" style={{ display: 'block' }} />
      </Button>

      <Button
        type="button"
        variant="basic"
        style={styles.button}
        title="Maximize or restore"
        onClick={async () => {
          try {
            await appWindow.toggleMaximize();
          } catch (error) {
            console.error('Failed to toggle maximize', error);
          }
        }}
      >
        <SquareIcon size={12} weight="bold" color="var(--app-text)" style={{ display: 'block' }} />
      </Button>

      <Button
        type="button"
        variant="close"
        style={styles.button}
        title="Close"
        onClick={async () => {
          try {
            await appWindow.close();
          } catch (error) {
            console.error('Failed to close window', error);
          }
        }}
      >
        <XIcon size={14} weight="bold" color="var(--app-text)" style={{ display: 'block' }} />
      </Button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    marginLeft: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
  },
  button: {
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0,
  },
};
