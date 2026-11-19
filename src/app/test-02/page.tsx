import { ImageBG } from "@/sections/ImageBG";
import { Button } from "@/components/Button";

export default function Home() {
  return (
    <div className="relative flex">
      <ImageBG />
      <Button href="/" className="absolute top-5 left-5" theme="dark">
        Test 01
      </Button>
    </div>
  );
}
