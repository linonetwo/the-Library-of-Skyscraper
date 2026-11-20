// Empty keeps the existing same-origin proxy and local storage keys.
const activeServerAddress = localStorage.getItem("arena-server-address") || "";
export const serverAddress = () => activeServerAddress;
export function normalizeServerAddress(value: string) {
  if (!value.trim()) return "";
  const url = new URL(value.trim());
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash)
    throw new Error("请输入 HTTP 或 HTTPS 服务器地址，例如 https://server.example");
  return url.origin;
}
export const serverStorageKey = (key: string) => serverAddress() ? `${key}:${serverAddress()}` : key;
export const serverUrl = (path: string) => `${serverAddress()}${path}`;
export function socketUrl(path: string) {
  const url = new URL(serverUrl(path), location.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.href;
}
