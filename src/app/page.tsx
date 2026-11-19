import { Light } from "@/sections/Light";
import { Dark } from "@/sections/Dark";
import Button from "@/components/Button";

export default function Home() {
  return (
    <div className="relative flex">
      <Light />
      <Dark />
      <Button href="/test-02">Switch Page</Button>
    </div>
  );
}
