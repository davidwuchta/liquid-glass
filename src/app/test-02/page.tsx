import { ImageBG } from "@/sections/ImageBG";
import Button from "@/components/Button";

export default function Home() {
  return (
    <div className="relative flex">
      <ImageBG />
      <Button href="/">Switch Page</Button>
    </div>
  );
}
