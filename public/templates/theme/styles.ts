// Vite hoists an eager glob to the top of its module. Kept apart from index.ts, which
// imports this module after the default theme, the theme stylesheets (the extra theme
// included) load after the default ones and override them at equal specificity
import.meta.glob('./**/*.css', { eager: true })
