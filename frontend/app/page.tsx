"use client";

import { FormEvent, useEffect, useState } from "react";

type Character = {
  id: number;
  name: string;
  class_name: string;
};

export default function Home() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [name, setName] = useState("");
  const [className, setClassName] = useState("");

  useEffect(() => {
    fetchCharacters();
  }, []);

  function fetchCharacters() {
    fetch("http://127.0.0.1:8000/characters")
      .then((response) => response.json())
      .then((data) => {
        setCharacters(data);
      });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    fetch("http://127.0.0.1:8000/characters", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: name,
        class_name: className,
      }),
    })
      .then((response) => response.json())
      .then(() => {
        setName("");
        setClassName("");
        fetchCharacters();
      });
  }

  return (
    <main className="p-8">
      <h1 className="mb-8 text-3xl font-bold">Lost Ark Tracker</h1>

      <form onSubmit={handleSubmit} className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">Add Character</h2>

        <div className="mb-4">
          <input
            type="text"
            placeholder="Character name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="border p-2"
          />
        </div>

        <div className="mb-4">
          <input
            type="text"
            placeholder="Class"
            value={className}
            onChange={(event) => setClassName(event.target.value)}
            className="border p-2"
          />
        </div>

        <button
          type="submit"
          className="border px-4 py-2"
        >
          Add Character
        </button>
      </form>

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