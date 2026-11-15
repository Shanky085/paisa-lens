import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PaisaLens — Your money, in focus",
  description: "Understand your spending. Predict your balance. Make smarter money decisions.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
