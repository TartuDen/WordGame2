import { pool } from "./pgTables.js";

async function getUser(email) {
  try {
    const client = await pool.connect();
    const query = "SELECT * FROM users WHERE email = $1";
    const result = await client.query(query, [email]);
    client.release(); // Release the client back to the pool

    if (result.rows.length === 0) {
      return null; // User not found, return null instead of using `res`
    }
    return result.rows[0];
  } catch (error) {
    console.error("Error fetching user:", error);
    throw new Error("Internal server error"); // Throw an error to be caught by the calling function
  }
  // Remove the pool.end() call here
}

async function regUser(user) {
  const { user_name, email, ava } = user;

  try {
    const client = await pool.connect();
    const query = `
      INSERT INTO users (user_name, email, ava)
      VALUES ($1, $2, $3)
      RETURNING *`;
    const values = [user_name, email, ava];
    const result = await client.query(query, values);
    client.release(); // Release the client back to the pool

    return result.rows[0]; // Return the newly registered user object
  } catch (error) {
    console.error("Error registering user:", error);
    if (error.code === "23505") {
      throw new Error("Email already exists"); // Handle unique constraint violation
    } else {
      throw new Error("Internal server error");
    }
  }
  // Remove the pool.end() call here
}

export { getUser, regUser };
