import { useImperativeHandle, useRef, type Ref } from "react";
import { type ViewStyle } from "react-native";
import { WebView } from "react-native-webview";
import { MAP_BASE_URL, parseMapMessage, type MapMessage } from "@/lib/map-html";

export type PickMapHandle = { setCenter: (lat: number, lng: number, zoom?: number) => void };

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
  const web = useRef<WebView>(null);

  useImperativeHandle(ref, () => ({
    setCenter(lat, lng, zoom) {
      web.current?.injectJavaScript(`window.setCenter && window.setCenter(${lat}, ${lng}, ${zoom ?? 0}); true;`);
    },
  }));

  return (
    <WebView
      ref={web}
      style={style}
      originWhitelist={["*"]}
      source={{ html, baseUrl: MAP_BASE_URL }}
      javaScriptEnabled
      domStorageEnabled
      setSupportMultipleWindows={false}
      overScrollMode="never"
      onMessage={(event) => {
        const message = parseMapMessage(event.nativeEvent.data);
        if (message) onMessage(message);
      }}
      onError={() => onMessage({ type: "error" })}
    />
  );
}
