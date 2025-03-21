import { useState } from "react";
import "./App.css";
import { useAuth } from "./utils/auth";
import { useStronghold } from "./utils/store";

function App() {
  const { user, token, login } = useAuth();
  const { getRecord, editRecord } = useStronghold();
  const [error, setError] = useState<string>("");

  return (
    <div>
      hi, {user?.username ?? "world"}!

      {token}

      {error}

      <button
        onClick={async () => {
          setError("");
          try {
            const token = await getRecord("token");
            const refreshToken = await getRecord("refreshToken");
            console.log("bruh", token, refreshToken, typeof token, typeof refreshToken);
          } catch (err) {
            setError("Failed to get token");
            console.error(err);
          }
        }}
      >
        Get Token
      </button>

      <button
        onClick={async () => {
          setError("");
          try {
            await editRecord("token", "newToken");
            await editRecord("refreshToken", "newRefreshToken");
          } catch (err) {
            setError("Failed to edit token");
            console.error(err);
          }
        }}
      >
        Edit Token
      </button>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          const formData = new FormData(e.currentTarget);
          const email = formData.get("email") as string;
          const password = formData.get("password") as string;
          try {
            await login({ email, password });
          } catch (err) {
            setError("Login failed");
          }
        }}
      >
        <input type="email" name="email" placeholder="email" />
        <input type="password" name="password" placeholder="password" />
        <button type="submit">Login</button>
      </form>
    </div>
  );
}

export default App;
