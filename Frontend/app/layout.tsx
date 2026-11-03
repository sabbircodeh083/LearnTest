import type { Metadata } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/components/ui";
import { DialogProvider } from "@/components/AlertDialog";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });

export const metadata: Metadata = {
  title: { default: "LearnTest — Learn, test, and grow", template: "%s · LearnTest" },
  description: "Discover questions, learn from videos, take exams, and track your results on LearnTest.",
};

const themeScript = `try{var t=localStorage.getItem('learntest-theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${jakarta.variable} ${fraunces.variable}`}>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>
        <AuthProvider>
          <DialogProvider>
            <ToastProvider>{children}</ToastProvider>
          </DialogProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
