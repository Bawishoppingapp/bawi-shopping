import Image from "next/image"
import { LoginForm } from "@/features/auth/components/login-form"

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(360px,42%)_1fr]">
      <div className="flex flex-col justify-between bg-[#151210] px-8 py-9 text-white sm:px-14 sm:py-12">
        <div className="flex items-center gap-4"><Image src="/brand/logo-source.png" alt="Bawi Shopping" width={86} height={86} loading="eager" className="rounded-lg bg-white" /><span className="text-xs font-semibold tracking-[.2em] text-[#C79A54]">ADMIN STUDIO</span></div>
        <div className="hidden max-w-md lg:block"><p className="mb-5 text-xs font-semibold uppercase tracking-[.2em] text-[#C79A54]">Marketplace workspace</p><h2 className="font-serif text-5xl leading-tight">A clearer way to run what matters.</h2><p className="mt-6 text-sm leading-7 text-[#B8AE9E]">Review sellers and products, keep orders moving, and manage your business from one calm place.</p></div>
        <p className="hidden text-xs text-[#8C8175] lg:block">Bawi Shopping · Admin Studio</p>
      </div>
      <div className="flex items-center justify-center px-5 py-14 sm:px-10">
        <div className="w-full max-w-md rounded-2xl border border-[#E3DCD1] bg-white p-7 shadow-[0_14px_50px_#312B260c] sm:p-10">
          <div className="mb-8"><p className="mb-2 text-xs font-semibold uppercase tracking-[.16em] text-[#B8863B]">Welcome back</p><h1 className="font-serif text-3xl text-[#312B26]">Sign in to Bawi</h1><p className="mt-2 text-sm text-neutral-500">Use your admin account to continue.</p></div>
          <LoginForm />
        </div>
      </div>
    </main>
  )
}
