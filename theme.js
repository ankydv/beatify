import { DefaultTheme, MD3DarkTheme as PaperDarkTheme } from 'react-native-paper';

// Light Theme
export const LightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: "rgb(0, 110, 45)",
    onPrimary: "rgb(255, 255, 255)",
    primaryContainer: "rgb(114, 254, 143)",
    onPrimaryContainer: "rgb(0, 33, 8)",
    secondary: "rgb(81, 99, 81)",
    onSecondary: "rgb(255, 255, 255)",
    secondaryContainer: "rgb(212, 232, 209)",
    onSecondaryContainer: "rgb(15, 31, 17)",
    tertiary: "rgb(185, 17, 80)",
    onTertiary: "rgb(255, 255, 255)",
    tertiaryContainer: "rgb(255, 217, 222)",
    onTertiaryContainer: "rgb(63, 0, 22)",
    error: "rgb(186, 26, 26)",
    onError: "rgb(255, 255, 255)",
    errorContainer: "rgb(255, 218, 214)",
    onErrorContainer: "rgb(65, 0, 2)",
    background: "rgb(252, 253, 247)",
    onBackground: "rgb(26, 28, 25)",
    surface: "rgb(252, 253, 247)",
    onSurface: "rgb(26, 28, 25)",
    surfaceVariant: "rgb(221, 229, 217)",
    onSurfaceVariant: "rgb(66, 73, 64)",
    outline: "rgb(114, 121, 112)",
    outlineVariant: "rgb(193, 201, 190)",
    shadow: "rgb(0, 0, 0)",
    scrim: "rgb(0, 0, 0)",
    inverseSurface: "rgb(46, 49, 45)",
    inverseOnSurface: "rgb(240, 241, 235)",
    inversePrimary: "rgb(83, 224, 118)",
    elevation: {
      level0: "transparent",
      level1: "rgb(239, 246, 237)",
      level2: "rgb(232, 242, 231)",
      level3: "rgb(224, 237, 225)",
      level4: "rgb(222, 236, 223)",
      level5: "rgb(217, 233, 219)",
    },
    surfaceDisabled: "rgba(26, 28, 25, 0.12)",
    onSurfaceDisabled: "rgba(26, 28, 25, 0.38)",
    backdrop: "rgba(43, 50, 43, 0.4)",
    
    // Previous colors that are not in the new theme
    text: '#212121', // Dark Gray Text
    placeholder: '#757575', // Medium Gray Placeholder
    notification: '#FF6B6B', // Red Notification
    disabled: '#BDBDBD', // Light Gray Disabled
  },
  animation: {
    scale: 1.0,
  },
};

// Dark Theme
export const DarkTheme = {
  ...PaperDarkTheme,
  colors: {
    ...PaperDarkTheme.colors,
    primary: "rgb(83, 224, 118)",
    onPrimary: "rgb(0, 57, 20)",
    primaryContainer: "rgb(0, 83, 32)",
    onPrimaryContainer: "rgb(114, 254, 143)",
    secondary: "rgb(184, 204, 182)",
    onSecondary: "rgb(36, 52, 37)",
    secondaryContainer: "rgb(58, 75, 58)",
    onSecondaryContainer: "rgb(212, 232, 209)",
    tertiary: "rgb(255, 178, 191)",
    onTertiary: "rgb(102, 0, 39)",
    tertiaryContainer: "rgb(144, 0, 59)",
    onTertiaryContainer: "rgb(255, 217, 222)",
    error: "rgb(255, 180, 171)",
    onError: "rgb(105, 0, 5)",
    errorContainer: "rgb(147, 0, 10)",
    onErrorContainer: "rgb(255, 180, 171)",
    background: "rgb(26, 28, 25)",
    onBackground: "rgb(226, 227, 221)",
    surface: "rgb(26, 28, 25)",
    onSurface: "rgb(226, 227, 221)",
    surfaceVariant: "rgb(66, 73, 64)",
    onSurfaceVariant: "rgb(193, 201, 190)",
    outline: "rgb(139, 147, 137)",
    outlineVariant: "rgb(66, 73, 64)",
    shadow: "rgb(0, 0, 0)",
    scrim: "rgb(0, 0, 0)",
    inverseSurface: "rgb(226, 227, 221)",
    inverseOnSurface: "rgb(46, 49, 45)",
    inversePrimary: "rgb(0, 110, 45)",
    elevation: {
      level0: "transparent",
      level1: "rgb(29, 38, 30)",
      level2: "rgb(31, 44, 32)",
      level3: "rgb(32, 50, 35)",
      level4: "rgb(33, 52, 36)",
      level5: "rgb(34, 55, 38)",
    },
    surfaceDisabled: "rgba(226, 227, 221, 0.12)",
    onSurfaceDisabled: "rgba(226, 227, 221, 0.38)",
    backdrop: "rgba(43, 50, 43, 0.4)",

    // Previous colors that are not in the new theme
    text: '#FFFFFF', // White Text
    placeholder: '#BDBDBD', // Light Gray Placeholder
    notification: '#FF6B6B', // Red Notification
    disabled: '#616161', // Dark Gray Disabled
  },
  animation: {
    scale: 1.0,
  },
};
