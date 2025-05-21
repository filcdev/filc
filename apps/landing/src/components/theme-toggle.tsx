import { Button } from "@filc/ui/components/button";
import { useTheme } from "@/lib/theme";

export const ThemeToggle = () => {
	const { theme, setTheme } = useTheme();

	return (
		<button
            type="button"
			onClick={() => setTheme(theme === "light" ? "dark" : "light")}
			title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
			className="rounded-full inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-[color,box-shadow] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive"
		>
            <svg
				viewBox="0 0 15 15"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
				width="15"
				height="15"
				className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0"
			>
                <title>Sun</title>
				<path
					d="M7.5 1.5v-1m0 13.99v-.998m6-5.997h1m-13 0h-1m2-4.996l-1-1m12 0l-1 1m-10 9.993l-1 1m12 0l-1-1m-2-4.997a2.999 2.999 0 01-3 2.998 2.999 2.999 0 113-2.998z"
					stroke="currentColor"
					stroke-linecap="square"
				/>
			</svg>
			<svg
				viewBox="0 0 15 15"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
				width="15"
				height="15"
				className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"

			>
                <title>Moon</title>
				<path
					d="M1.66 11.362A6.5 6.5 0 007.693.502a7 7 0 11-6.031 10.86z"
					stroke="currentColor"
					stroke-linejoin="round"
				/>
			</svg>
			<span className="sr-only">Toggle theme</span>
		</button>
	);
}
