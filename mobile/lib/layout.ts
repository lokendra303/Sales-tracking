import { useWindowDimensions } from "react-native";

export function useLayout() {
  const { width, height } = useWindowDimensions();
  const compact = width < 360;
  const short = height < 700;
  const wide = width >= 720;
  const pagePad = compact ? 14 : 20;
  return { width, height, compact, short, wide, pagePad };
}
