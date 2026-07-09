import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { passkey } from "./index.js";
import { InMemoryPasskeyStore, InMemoryChallengeStore } from "./store.js";

// ─── Test helpers ────────────────────────────────────────────────────────────

function createTestApp() {
  const store = new InMemoryPasskeyStore();
  const challengeStore = new InMemoryChallengeStore();

  const passkeyApp = passkey({
    rpName: "Test App",
    rpID: "localhost",
    origin: "http://localhost:3000",
    store,
    challengeStore,
  });

  const app = new Hono();
  app.route("/", passkeyApp);

  return { app, store, challengeStore };
}

/** Helper to make JSON requests against the Hono test app. */
async function jsonRequest(
  app: Hono,
  path: string,
  body: unknown,
): Promise<Response> {
  return app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ─── InMemoryPasskeyStore ────────────────────────────────────────────────────

describe("InMemoryPasskeyStore", () => {
  let store: InMemoryPasskeyStore;

  beforeEach(() => {
    store = new InMemoryPasskeyStore();
  });

  it("creates and retrieves a user by username", async () => {
    await store.createUser({ id: "u1", username: "alice" });
    const user = await store.getUserByUsername("alice");
    expect(user).toEqual({ id: "u1", username: "alice" });
  });

  it("retrieves a user by id", async () => {
    await store.createUser({ id: "u1", username: "alice" });
    const user = await store.getUserById("u1");
    expect(user).toEqual({ id: "u1", username: "alice" });
  });

  it("returns null for unknown username", async () => {
    const user = await store.getUserByUsername("nobody");
    expect(user).toBeNull();
  });

  it("returns null for unknown user id", async () => {
    const user = await store.getUserById("nope");
    expect(user).toBeNull();
  });

  it("saves and retrieves passkeys", async () => {
    const pk = {
      id: "cred-1" as any,
      publicKey: new Uint8Array([1, 2, 3]),
      webAuthnUserID: "wuid-1" as any,
      counter: 0,
      deviceType: "multiDevice" as const,
      backedUp: true,
    };
    await store.savePasskey("u1", pk);

    const passkeys = await store.getPasskeysByUser("u1");
    expect(passkeys).toHaveLength(1);
    expect(passkeys[0].id).toBe("cred-1");
    // The passkey returned by getPasskeysByUser should NOT contain userId
    expect((passkeys[0] as any).userId).toBeUndefined();
  });

  it("retrieves a passkey by credential id", async () => {
    const pk = {
      id: "cred-1" as any,
      publicKey: new Uint8Array([1, 2, 3]),
      webAuthnUserID: "wuid-1" as any,
      counter: 0,
      deviceType: "multiDevice" as const,
      backedUp: true,
    };
    await store.savePasskey("u1", pk);

    const result = await store.getPasskeyById("cred-1");
    expect(result).not.toBeNull();
    expect(result!.userId).toBe("u1");
  });

  it("returns null for unknown credential id", async () => {
    const result = await store.getPasskeyById("nope");
    expect(result).toBeNull();
  });

  it("updates passkey counter", async () => {
    const pk = {
      id: "cred-1" as any,
      publicKey: new Uint8Array([1, 2, 3]),
      webAuthnUserID: "wuid-1" as any,
      counter: 0,
      deviceType: "multiDevice" as const,
      backedUp: true,
    };
    await store.savePasskey("u1", pk);

    await store.updatePasskeyCounter("cred-1", 42);

    const updated = await store.getPasskeyById("cred-1");
    expect(updated!.counter).toBe(42);
  });
});

// ─── InMemoryChallengeStore ──────────────────────────────────────────────────

describe("InMemoryChallengeStore", () => {
  let challengeStore: InMemoryChallengeStore;

  beforeEach(() => {
    challengeStore = new InMemoryChallengeStore();
  });

  it("stores and retrieves a challenge", async () => {
    await challengeStore.set("key-1", "challenge-value");
    const result = await challengeStore.get("key-1");
    expect(result).toBe("challenge-value");
  });

  it("consumes challenge on read (one-time use)", async () => {
    await challengeStore.set("key-1", "challenge-value");
    await challengeStore.get("key-1");
    const second = await challengeStore.get("key-1");
    expect(second).toBeNull();
  });

  it("returns null for expired challenges", async () => {
    await challengeStore.set("key-1", "challenge-value", 0);
    // Wait a tiny bit to ensure expiration
    await new Promise((r) => setTimeout(r, 5));
    const result = await challengeStore.get("key-1");
    expect(result).toBeNull();
  });

  it("explicitly deletes challenges", async () => {
    await challengeStore.set("key-1", "challenge-value");
    await challengeStore.delete("key-1");
    const result = await challengeStore.get("key-1");
    expect(result).toBeNull();
  });
});

// ─── Passkey middleware endpoints ────────────────────────────────────────────

describe("passkey middleware", () => {
  describe("POST /passkey/register/options", () => {
    it("returns 400 if username is missing", async () => {
      const { app } = createTestApp();
      const res = await jsonRequest(app, "/passkey/register/options", {});
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("username is required");
    });

    it("returns registration options with a challenge", async () => {
      const { app } = createTestApp();
      const res = await jsonRequest(app, "/passkey/register/options", {
        username: "alice",
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.challenge).toBeDefined();
      expect(body.rp).toBeDefined();
      expect(body.rp.name).toBe("Test App");
      expect(body.rp.id).toBe("localhost");
      expect(body.user).toBeDefined();
      expect(body.user.name).toBe("alice");
    });

    it("auto-creates a user if not already registered", async () => {
      const { app, store } = createTestApp();
      await jsonRequest(app, "/passkey/register/options", {
        username: "bob",
      });
      const user = await store.getUserByUsername("bob");
      expect(user).not.toBeNull();
      expect(user!.username).toBe("bob");
    });

    it("reuses existing user", async () => {
      const { app, store } = createTestApp();
      // First call creates the user
      await jsonRequest(app, "/passkey/register/options", {
        username: "alice",
      });
      const user1 = await store.getUserByUsername("alice");

      // Second call should reuse
      await jsonRequest(app, "/passkey/register/options", {
        username: "alice",
      });
      const user2 = await store.getUserByUsername("alice");

      expect(user1!.id).toBe(user2!.id);
    });
  });

  describe("POST /passkey/register/verify", () => {
    it("returns 400 if username is missing", async () => {
      const { app } = createTestApp();
      const res = await jsonRequest(app, "/passkey/register/verify", {});
      expect(res.status).toBe(400);
    });

    it("returns 400 if user is not found", async () => {
      const { app } = createTestApp();
      const res = await jsonRequest(app, "/passkey/register/verify", {
        username: "nobody",
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("user not found");
    });

    it("returns 400 if challenge is expired", async () => {
      const { app, store } = createTestApp();
      // Create a user but don't generate registration options
      await store.createUser({ id: "u1", username: "alice" });
      const res = await jsonRequest(app, "/passkey/register/verify", {
        username: "alice",
        id: "fake-id",
        rawId: "fake-raw-id",
        type: "public-key",
        response: {},
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("challenge expired or not found");
    });
  });

  describe("POST /passkey/authenticate/options", () => {
    it("returns authentication options without username (discoverable)", async () => {
      const { app } = createTestApp();
      const res = await jsonRequest(
        app,
        "/passkey/authenticate/options",
        {},
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.challenge).toBeDefined();
      expect(body.rpId).toBe("localhost");
    });

    it("returns 400 if username is provided but not found", async () => {
      const { app } = createTestApp();
      const res = await jsonRequest(app, "/passkey/authenticate/options", {
        username: "nobody",
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("user not found");
    });
  });

  describe("POST /passkey/authenticate/verify", () => {
    it("returns 400 if challenge is not found", async () => {
      const { app } = createTestApp();
      const res = await jsonRequest(app, "/passkey/authenticate/verify", {
        id: "fake-id",
        rawId: "fake-raw-id",
        type: "public-key",
        response: {},
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("challenge expired or not found");
    });

    it("returns 400 if credential is not found", async () => {
      const { app, challengeStore } = createTestApp();
      // Manually set a challenge so that part passes
      await challengeStore.set("auth:test-challenge", "test-challenge");
      const res = await jsonRequest(app, "/passkey/authenticate/verify", {
        id: "unknown-cred",
        rawId: "unknown-cred",
        type: "public-key",
        challenge: "test-challenge",
        response: {
          authenticatorData: "",
          clientDataJSON: "",
          signature: "",
        },
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("credential not found");
    });
  });

  describe("custom pathPrefix", () => {
    it("mounts endpoints under custom prefix", async () => {
      const store = new InMemoryPasskeyStore();
      const challengeStore = new InMemoryChallengeStore();

      const passkeyApp = passkey({
        rpName: "Test App",
        rpID: "localhost",
        origin: "http://localhost:3000",
        store,
        challengeStore,
        pathPrefix: "/api/auth",
      });

      const app = new Hono();
      app.route("/", passkeyApp);

      const res = await jsonRequest(app, "/api/auth/register/options", {
        username: "alice",
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.challenge).toBeDefined();
    });
  });
});
