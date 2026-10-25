import type { Metadata } from "next";
export const metadata:Metadata={title:"The Zero Gravity - Web",description:"Explore the Solar System and beyond."};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
