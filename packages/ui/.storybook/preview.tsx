import type { Decorator, Preview } from '@storybook/react-vite';
import './preview.css';

type ThemeName = 'light' | 'dark';

const withTheme: Decorator = (Story, context) => {
  const theme: ThemeName = context.globals.theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
  return <Story />;
};

const preview: Preview = {
  decorators: [withTheme],
  globalTypes: {
    theme: {
      description: 'Thème',
      toolbar: {
        title: 'Thème',
        icon: 'circlehollow',
        dynamicTitle: true,
        items: [
          { value: 'light', title: 'Clair' },
          { value: 'dark', title: 'Sombre' },
        ],
      },
    },
  },
  initialGlobals: { theme: 'light' },
  parameters: {
    backgrounds: { disabled: true },
    layout: 'padded',
  },
};

export default preview;
