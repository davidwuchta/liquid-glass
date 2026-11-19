import { Light } from "@/sections/Light";
import { Dark } from "@/sections/Dark";
import { Button } from "@/components/Button";

export default function Home() {
  return (
    <div className="relative flex">
      <Light />
      <Dark />
      <Button href="/test-02" className="absolute top-5 left-5" theme="dark">
        Test 02
      </Button>
    </div>
  );
}
