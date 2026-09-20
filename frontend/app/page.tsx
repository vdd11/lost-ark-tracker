"use client";

import { useEffect, useState } from "react";

type Character = {
  id: number;
  name: string;
  class_name: string;
};

export default function Home() {
  const [characters, setCharacters] = useState<Character[]>([]);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/characters")
      .then((response) => response.json())
      .then((data) => {
        setCharacters(data);
      });
  }, []);

  return (
    <main className="p-8">
      <h1 className="mb-8 text-3xl font-bold">Lost Ark Tracker</h1>

      <h2 className="mb-6 text-2xl font-semibold">Roster</h2>

      {characters.map((character) => (
        <div key={character.id} className="mb-6">
          <p className="font-semibold">{character.name}</p>
          <p>{character.class_name}</p>
        </div>
    ))}
  </main>
);
}