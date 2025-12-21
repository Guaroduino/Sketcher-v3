export default {
    content: [
        "./index.html",
        "./*.{js,ts,jsx,tsx}",
        "./src/**/*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./hooks/**/*.{js,ts,jsx,tsx}"
    ],
    theme: {
        extend: {
            colors: {
                'theme-bg-primary': 'rgb(var(--bg-primary) / <alpha-value>)',
                'theme-bg-secondary': 'rgb(var(--bg-secondary) / <alpha-value>)',
                'theme-bg-tertiary': 'rgb(var(--bg-tertiary) / <alpha-value>)',
                'theme-bg-hover': 'rgb(var(--bg-hover) / <alpha-value>)',
                'theme-text-primary': 'rgb(var(--text-primary) / <alpha-value>)',
                'theme-text-secondary': 'rgb(var(--text-secondary) / <alpha-value>)',
                'theme-text-tertiary': 'rgb(var(--text-tertiary) / <alpha-value>)',
                'theme-accent-primary': 'rgb(var(--accent-primary) / <alpha-value>)',
                'theme-accent-hover': 'rgb(var(--accent-hover) / <alpha-value>)',
            }
        },
    },
    plugins: [],
}
