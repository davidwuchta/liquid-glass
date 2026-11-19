import Image from "next/image";
import { Draggable } from "@/components/Draggable";
import { LiquidGlass } from "@/components/LiquidGlass";

import ImgHomeBg from "@/assets/images/img-home-bg-06.jpg";

export default function Home() {
  return (
    <main className="relative w-full h-screen flex items-center justify-center text-white text-4xl font-bold overflow-hidden">
      <div className="absolute inset-0">
        <Image
          src={ImgHomeBg}
          alt="Home Background"
          loading="eager"
          fill
          className="object-cover"
        />
      </div>
      <div className="flex gap-8">
        <Draggable>
          <LiquidGlass
            refraction={70}
            depth={30}
            dispersion={20}
            frost={6}
            splay={20}
            lightAngle={0}
            lightOpacity={40}
            radius={1000}
            className="w-32 h-32"
            contentClassName="flex items-center justify-center"
          >
            <p>-4°</p>
          </LiquidGlass>
        </Draggable>
        <Draggable>
          <LiquidGlass
            refraction={70}
            depth={30}
            dispersion={20}
            frost={6}
            splay={20}
            lightAngle={0}
            lightOpacity={40}
            radius={64}
            className="w-64 h-32"
            contentClassName="flex items-center justify-center"
          >
            <p>
              Clouds <span className="text-red-500">1°</span>
            </p>
          </LiquidGlass>
        </Draggable>
        <Draggable>
          <LiquidGlass
            refraction={70}
            depth={30}
            dispersion={20}
            frost={6}
            splay={20}
            lightAngle={0}
            lightOpacity={40}
            radius={64}
            className="w-64 h-32"
            contentClassName="flex items-center justify-center"
          >
            <p>
              Thu <span className="text-red-500">1°</span> Nov
            </p>
          </LiquidGlass>
        </Draggable>
      </div>
    </main>
  );
}
