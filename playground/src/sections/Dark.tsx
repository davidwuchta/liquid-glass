import { Draggable } from "@/components/Draggable";
import { LiquidGlass } from "@davidwuchta/liquid-glass";

export const Dark = () => {
  return (
    <section className="relative bg-black w-full h-screen flex">
      <div className="flex flex-2">
        <div className="w-25 bg-white/60"></div>
        <div className="w-25 bg-white/50"></div>
        <div className="w-25 bg-white/40"></div>
        <div className="w-25 bg-white/30"></div>
        <div className="w-25 bg-white/20"></div>
        <div className="w-25 bg-white/10"></div>
      </div>
      <div className="flex-1 bg-black"></div>
      <div className="absolute top-0 left-0 w-full h-full flex flex-col gap-14 justify-center px-10 py-18">
        <div className="flex gap-5">
          <Draggable>
            <LiquidGlass
              theme="dark"
              variant="clear"
              radius={1000}
              className="w-20 h-12"
            />
          </Draggable>
          <Draggable>
            <LiquidGlass
              theme="dark"
              variant="clear"
              radius={1000}
              className="w-20 h-12"
            />
          </Draggable>
          <Draggable>
            <LiquidGlass
              theme="dark"
              variant="clear"
              radius={1000}
              className="w-20 h-12"
            />
          </Draggable>
          <Draggable>
            <LiquidGlass
              theme="dark"
              variant="clear"
              radius={1000}
              className="w-20 h-12"
            />
          </Draggable>
          <Draggable>
            <LiquidGlass
              theme="dark"
              variant="clear"
              radius={1000}
              className="w-20 h-12"
            />
          </Draggable>
          <Draggable>
            <LiquidGlass
              theme="dark"
              variant="clear"
              radius={1000}
              className="w-20 h-12"
            />
          </Draggable>
        </div>
        <div className="flex gap-5">
          <Draggable>
            <LiquidGlass
              theme="dark"
              variant="tinted"
              tint="green"
              radius={1000}
              className="w-20 h-12"
            />
          </Draggable>
          <Draggable>
            <LiquidGlass
              theme="dark"
              variant="tinted"
              tint="yellow"
              radius={1000}
              className="w-20 h-12"
            />
          </Draggable>
          <Draggable>
            <LiquidGlass
              theme="dark"
              variant="tinted"
              tint="orange"
              radius={1000}
              className="w-20 h-12"
            />
          </Draggable>
          <Draggable>
            <LiquidGlass
              theme="dark"
              variant="tinted"
              tint="red"
              radius={1000}
              className="w-20 h-12"
            />
          </Draggable>
          <Draggable>
            <LiquidGlass
              theme="dark"
              variant="tinted"
              tint="purple"
              radius={1000}
              className="w-20 h-12"
            />
          </Draggable>
          <Draggable>
            <LiquidGlass
              theme="dark"
              variant="tinted"
              tint="blue"
              radius={1000}
              className="w-20 h-12"
            />
          </Draggable>
        </div>
        <Draggable>
          <LiquidGlass
            theme="dark"
            variant="opaque"
            radius={34}
            className="w-146.25 h-45"
          />
        </Draggable>
        <Draggable>
          <LiquidGlass
            theme="dark"
            variant="opaque"
            radius={34}
            className="w-146.25 h-75"
          />
        </Draggable>
      </div>
    </section>
  );
};
