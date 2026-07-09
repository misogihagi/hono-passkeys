import type { Passkey, PasskeyStore, PasskeyUser, ChallengeStore } from "./types.js";
import type { Base64URLString } from "@simplewebauthn/server";

// ─── InMemoryPasskeyStore ────────────────────────────────────────────────────

/**
 * In-memory passkey store for development and testing.
 *
 * **Not suitable for production** – data is lost when the process exits.
 */
export class InMemoryPasskeyStore implements PasskeyStore {
  private users = new Map<string, PasskeyUser>();
  private usernameIndex = new Map<string, string>(); // username → userId
  private passkeys = new Map<
    Base64URLString,
    Passkey & { userId: string }
  >();

  async getUserByUsername(username: string): Promise<PasskeyUser | null> {
    const userId = this.usernameIndex.get(username);
    if (!userId) return null;
    return this.users.get(userId) ?? null;
  }

  async getUserById(userId: string): Promise<PasskeyUser | null> {
    return this.users.get(userId) ?? null;
  }

  async createUser(user: PasskeyUser): Promise<void> {
    this.users.set(user.id, user);
    this.usernameIndex.set(user.username, user.id);
  }

  async getPasskeysByUser(userId: string): Promise<Passkey[]> {
    const result: Passkey[] = [];
    for (const entry of this.passkeys.values()) {
      if (entry.userId === userId) {
        // Strip the `userId` field – callers only expect `Passkey`.
        const { userId: _, ...passkey } = entry;
        result.push(passkey);
      }
    }
    return result;
  }

  async getPasskeyById(
    credentialId: Base64URLString,
  ): Promise<(Passkey & { userId: string }) | null> {
    return this.passkeys.get(credentialId) ?? null;
  }

  async savePasskey(userId: string, passkey: Passkey): Promise<void> {
    this.passkeys.set(passkey.id, { ...passkey, userId });
  }

  async updatePasskeyCounter(
    credentialId: Base64URLString,
    newCounter: number,
  ): Promise<void> {
    const entry = this.passkeys.get(credentialId);
    if (entry) {
      entry.counter = newCounter;
    }
  }
}

// ─── InMemoryChallengeStore ──────────────────────────────────────────────────

/**
 * In-memory challenge store for development and testing.
 *
 * Automatically expires entries based on the supplied TTL.
 */
export class InMemoryChallengeStore implements ChallengeStore {
  private challenges = new Map<
    string,
    { value: string; expiresAt: number }
  >();

  async set(key: string, challenge: string, ttlMs = 60_000): Promise<void> {
    this.challenges.set(key, {
      value: challenge,
      expiresAt: Date.now() + ttlMs,
    });
  }

  async get(key: string): Promise<string | null> {
    const entry = this.challenges.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.challenges.delete(key);
      return null;
    }
    // Consume the challenge (one-time use).
    this.challenges.delete(key);
    return entry.value;
  }

  async delete(key: string): Promise<void> {
    this.challenges.delete(key);
  }
}
