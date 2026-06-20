import { createFileRoute } from '@tanstack/react-router'
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";


export const Route = createFileRoute('/')({
    component: Index,
})

function Index() {
    const [greetMsg, setGreetMsg] = useState("");
    const [nameGreet, setGreetName] = useState("");

    async function greet() {
        // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
        setGreetMsg(await invoke("greet", { nameGreet }));
    }

    return (
    <main className="container">
      <h1>Welcome to Tauri Basic Template</h1>

      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          greet();
        }}
      >
        <input
          id="greet-input"
          onChange={(e) => setGreetName(e.currentTarget.value)}
          placeholder="Enter a name..."
        />
        <button type="submit">Greet</button>
      </form>
      <p>{greetMsg}</p>
    </main>
  );
}