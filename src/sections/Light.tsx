import { Draggable } from "@/components/Draggable";
import { LiquidGlass } from "@/components/LiquidGlass";

export const Light = () => {
  return (
    <section className="bg-white w-full h-screen flex">
      <div className="flex flex-2">
        <div className="w-25 bg-black/60"></div>
        <div className="w-25 bg-black/50"></div>
        <div className="w-25 bg-black/40"></div>
        <div className="w-25 bg-black/30"></div>
        <div className="w-25 bg-black/20"></div>
        <div className="w-25 bg-black/10"></div>
      </div>
      <div className="flex-1 bg-white"></div>
      <div className="absolute top-0 left-0 w-full h-full flex flex-col gap-14 justify-center px-10 py-18">
        <div className="flex gap-5">
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
              className="w-20 h-12"
            />
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
              radius={1000}
              className="w-20 h-12"
            />
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
              radius={1000}
              className="w-20 h-12"
            />
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
              radius={1000}
              className="w-20 h-12"
            />
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
              radius={1000}
              className="w-20 h-12"
            />
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
              radius={1000}
              className="w-20 h-12"
            />
          </Draggable>
        </div>
        <div className="flex gap-5">
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
              className="w-20 h-12"
            />
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
              radius={1000}
              className="w-20 h-12"
            />
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
              radius={1000}
              className="w-20 h-12"
            />
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
              radius={1000}
              className="w-20 h-12"
            />
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
              radius={1000}
              className="w-20 h-12"
            />
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
              radius={1000}
              className="w-20 h-12"
            />
          </Draggable>
        </div>
        <Draggable>
          <LiquidGlass
            refraction={70}
            depth={30}
            dispersion={20}
            frost={6}
            splay={20}
            lightAngle={0}
            lightOpacity={40}
            radius={34}
            className="w-146.25 h-45"
          />
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
            radius={34}
            className="w-146.25 h-75"
          />
        </Draggable>
      </div>
    </section>
  );
};
