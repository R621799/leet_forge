import "./login.css"
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
export default function Credentials() {
  const [username, usernamesetter] = useState("");
  const [api_id, api_idsetter] = useState("");
  const [error, setError] = useState("");
  const [mode, modesetter] = useState(true);
  const modestate = mode ? "dark" : "light";
  const navigate = useNavigate();
  return (
    <div className={mode ? "light-window" : "dark-window"}>
      <button onClick={() => toggle(mode, modesetter)} className="togglebutton">{modestate}</button>
      <h1 className={mode ? "light-title" : "dark-title"}>Leet Forge</h1>

      <div className={mode ? "light-label-input" : "dark-label-input"}>
        <label htmlFor="username" className="w-[200px] h-[50px]">Leetcode ID</label>
        <input placeholder="Enter your username" type="text" value={username}
          className="bg-[rgb(199,136,74)] ml-[40px]" onChange={(e) => usernamesetter(e.target.value)} />
      </div>

      <div className={mode ? "light-label-input" : "dark-label-input"}>
        <label htmlFor="password" className="w-[200px] h-[50px]">
          API Key
        </label>
        <input placeholder="Enter your API key" type="password" value={api_id}
          className="bg-[rgb(199,136,74)] ml-[40px]" onChange={(e) => api_idsetter(e.target.value)} />
      </div>
      <button onClick={(e) => { submit_credentials(e, username, api_id, navigate, setError) }} className={mode ? "light-submit" : "dark-submit"}>Submit</button>
      {error && <p className="login-error">{error}</p>}
    </div>
  )
}
function toggle(mode, modesetter) {
  modesetter(!mode);
}
function submit_credentials(event, username, api_id, navigate, setError) {
  event.preventDefault();
  setError("");
  if (!username.trim()) {
    setError("Username is required.");
    return;
  }
  if (!api_id.trim()) {
    setError("API key is required.");
    return;
  }
  localStorage.setItem("username", username.trim());
  localStorage.setItem("api_id", api_id.trim());
  navigate("/quiz");
};