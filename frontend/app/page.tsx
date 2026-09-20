"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [message, setMessage] = useState("Connecting to backend...");

  useEffect(() => {
    fetch("http://127.0.0.1:8000/")
      .then((response) => response.json())
      .then((data) => {
        setMessage(data.message);
      })
      .catch(() => {
        setMessage("Could not connect to backend.");
      });
  }, []);

  return (
    <main>
      <h1>Lost Ark Tracker</h1>
      <p>{message}</p>
    </main>
  );
}