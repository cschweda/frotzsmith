export default defineAppConfig({
  ui: {
    // Amber is the brand ("frotz-glow" / the forge); green & red are reserved
    // for compile status so they always read as success / failure.
    colors: {
      primary: 'amber',
      secondary: 'orange',
      success: 'green',
      info: 'sky',
      warning: 'yellow',
      error: 'red',
      neutral: 'slate',
    },
  },
})
