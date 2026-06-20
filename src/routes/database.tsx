import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from "react";
import Database from "@tauri-apps/plugin-sql";

type User = {
  id: number;
  name: string;
};

export const Route = createFileRoute('/database')({
  component: DatabasePage,
})

function DatabasePage() {
    const [isLoadingUsers, setIsLoadingUsers] = useState(true);
    const [users, setUsers] = useState<User[]>([]);
    const [name, setName] = useState<string>("");
    const [error, setError] = useState<string>("");

    async function getUsers() {
    try {
        const db = await Database.load("sqlite:branch-schematic.db");
        const dbUsers = await db.select<User[]>("SELECT * FROM users");

        setError("");
        setUsers(dbUsers);
        setIsLoadingUsers(false);
    } catch (error) {
        console.log(error);
        setError("Failed to get users - check console");
    }
    }

    async function setUser(user: Omit<User, "id">) {
    try {
        setIsLoadingUsers(true);
        const db = await Database.load("sqlite:branch-schematic.db");

        await db.execute("INSERT INTO users (name) VALUES ($1)", [
        user.name,
        ]);

        getUsers().then(() => setIsLoadingUsers(false));
    } catch (error) {
        console.log(error);
        setError("Failed to insert user - check console");
    }
    }

    async function clearUsers() {
    try {
        setIsLoadingUsers(true);
        const db = await Database.load("sqlite:branch-schematic.db");
        await db.execute("DELETE FROM users");
        getUsers().then(() => setIsLoadingUsers(false));
    } catch (error) {
        console.log(error);
        setError("Failed to clear users - check console");
    }
    }

    useEffect(() => {
    getUsers();
    }, []);

    return (
    <main className="container">
      <h1>Database Page</h1>

      {isLoadingUsers ? (
        <div>Loading users...</div>
      ) : (
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              setUser({ name });
              getUsers();
            }}>
            <input
              id="name-input"
              onChange={(e) => setName(e.currentTarget.value)}
              placeholder="Enter a name..."
            />
            <button type="submit">Add User</button>
          </form>

          <button className="basic-button" onClick={clearUsers}>Clear Users</button>

          <div
            style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
            <h1>Users</h1>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.id}</td>
                    <td>{user.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}      

      {error && <p>{error}</p>}
    </main>
  );
}