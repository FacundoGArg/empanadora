import Image from "next/image"

export const Topbar = async function() {

  return (
    <header className="sticky top-0 z-50 bg-[#fffaf0] w-full border-b px-4 md:px-6">
      <div className="flex h-16 items-center justify-between gap-4">        

        <div className="flex flex-1 items-center justify-start gap-4">
            
          <Image
            src="/logo.svg"
            alt="Empanadora Logo"
            width={160}
            height={40}
            priority
          />
          
        </div>
      </div>
    </header>
  )
}
