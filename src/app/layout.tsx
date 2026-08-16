import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Atlantic Archive",
    template: "%s · Atlantic Archive",
  },
  description: "Internal document archive portal",
};

// Applied before hydration so the first paint is already in the right theme.
// Modes: dark (default) | light | system; resolved value lands on
// <html data-theme>, which the palette overrides in globals.css key off.
const themeInit = `
try {
  var m = localStorage.getItem("aap-theme");
  if (m !== "dark" && m !== "light" && m !== "system") m = "dark";
  var t = m === "system"
    ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : m;
  document.documentElement.dataset.theme = t;
} catch (e) { document.documentElement.dataset.theme = "dark"; }
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body
        className={`${inter.variable} ${geistMono.variable} min-h-screen text-sm antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
