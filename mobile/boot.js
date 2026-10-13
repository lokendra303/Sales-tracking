// A fatal JavaScript error is delivered to Android by throwing on the native
// bridge, and that throw closes the process. Handle it here so the app stays open.
global.RN$handleException = () => true;
