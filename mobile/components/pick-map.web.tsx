import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { View, type ViewStyle } from "react-native";
import { parseMapMessage, type MapMessage } from "@/lib/map-html";

export type PickMapHandle = { setCenter: (lat: number, lng: number, zoom?: number) => void };

type MapWindow = Window & { setCenter?: (lat: number, lng: number, zoom?: number) => void };

export function PickMap({
  ref,
  html,
  onMessage,
  style,
}: {
  ref?: Ref<PickMapHandle>;
  html: string;
  onMessage: (message: MapMessage) => void;
  style?: ViewStyle;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const handler = useRef(onMessage);

  useEffect(() => {
    handler.current = onMessage;
  }, [onMessage]);

  useImperativeHandle(ref, () => ({
    setCenter(lat, lng, zoom) {
      (frame.current?.contentWindow as MapWindow | null)?.setCenter?.(lat, lng, zoom);
    },
  }));

  useEffect(() => {
    const listen = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return;
      const message = parseMapMessage(event.data);
      if (message) handler.current(message);
    };
    window.addEventListener("message", listen);
    return () => window.removeEventListener("message", listen);
  }, []);

  return (
    <View style={style}>
      <iframe ref={frame} title="Map" srcDoc={html} style={{ border: 0, width: "100%", height: "100%" }} />
    </View>
  );
}
