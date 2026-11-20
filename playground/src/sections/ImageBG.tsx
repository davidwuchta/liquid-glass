import Image from "next/image";
import { Draggable } from "@/components/Draggable";
import { LiquidGlass } from "liquid-glass";

import ImgHomeBg from "@/assets/images/img-home-bg-06.jpg";

export const ImageBG = () => {
  return (
    <section className="bg-white w-full h-screen">
      <main className="relative w-full h-screen flex items-center justify-center text-white text-4xl font-bold overflow-hidden">
        <div className="absolute inset-0 bg-black">
          <Image
            src={ImgHomeBg}
            alt="Home Background"
            loading="eager"
            fill
            className="object-cover"
          />
        </div>
        <div className="flex gap-5">
          <Draggable>
            <LiquidGlass
              theme="dark"
              variant="clear"
              dispersion={0}
              radius={1000}
              className="w-32 h-32"
              contentClassName="flex items-center justify-center"
            >
              <p>-4°</p>
            </LiquidGlass>
          </Draggable>
          <Draggable>
            <LiquidGlass
              theme="light"
              variant="opaque"
              dispersion={0}
              frost={90}
              radius={64}
              className="w-64 h-32"
              contentClassName="flex items-center justify-center"
            >
              <p className="text-black">
                Clouds <span className="text-red-500">1°</span>
              </p>
            </LiquidGlass>
          </Draggable>
          <Draggable>
            <LiquidGlass
              theme="dark"
              variant="opaque"
              dispersion={0}
              frost={90}
              radius={64}
              className="w-64 h-32"
              contentClassName="flex items-center justify-center"
            >
              <p>
                Fri <span className="text-red-500">20</span> Nov
              </p>
            </LiquidGlass>
          </Draggable>
          <Draggable>
            <LiquidGlass
              theme="dark"
              variant="clear"
              dispersion={0}
              frost={90}
              radius={64}
              className="w-64 h-32"
              contentClassName="flex items-center justify-center"
            />
          </Draggable>
        </div>
      </main>
    </section>
  );
};
