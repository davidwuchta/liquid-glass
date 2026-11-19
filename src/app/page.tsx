import { Light } from "@/sections/Light";
import { Dark } from "@/sections/Dark";

export default function Home() {
  return (
    <div className="flex">
      <Light />
      <Dark />
    </div>
  );
}
