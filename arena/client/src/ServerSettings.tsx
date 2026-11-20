import { useState } from "react";
import { normalizeServerAddress, serverAddress } from "./serverConnection";
export default function ServerSettings() {
  const [address, setAddress] = useState(serverAddress);
  const [error, setError] = useState("");
  return <form className="join-form" onSubmit={event => {
    event.preventDefault();
    try {
      const normalized = normalizeServerAddress(address);
      localStorage.setItem("arena-server-address", normalized);
      location.reload();
    } catch { setError("请输入合法的 HTTP 或 HTTPS 服务器地址（留空使用当前网站）。"); }
  }}><label className="field-label" htmlFor="server-address">服务器地址
    <input id="server-address" value={address} onChange={event => setAddress(event.target.value)} placeholder="留空使用当前网站" autoComplete="url" />
  </label><button type="submit">连接服务器</button>{error && <span role="alert">{error}</span>}</form>;
}
