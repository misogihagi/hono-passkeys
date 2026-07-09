import { Hono } from "hono";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from "@simplewebauthn/server";
import type { PasskeyMiddlewareOptions } from "./types.js";
import { InMemoryChallengeStore } from "./store.js";

// Re-export public API
export type {
  Passkey,
  PasskeyUser,
  PasskeyStore,
  ChallengeStore,
  PasskeyMiddlewareOptions,
} from "./types.js";
export { InMemoryPasskeyStore, InMemoryChallengeStore } from "./store.js";

/**
 * Create a Hono sub-application that provides passkey (WebAuthn) endpoints.
 *
 * Mount it into your main app via `app.route("/", passkey({ ... }))`.
 *
 * @example
 * ```ts
 * import { Hono } from "hono";
 * import { passkey, InMemoryPasskeyStore, InMemoryChallengeStore } from "hono-passkeys";
 *
 * const app = new Hono();
 *
 * app.route(
 *   "/",
 *   passkey({
 *     rpName: "My App",
 *     rpID: "localhost",
 *     origin: "http://localhost:3000",
 *     store: new InMemoryPasskeyStore(),
 *     challengeStore: new InMemoryChallengeStore(),
 *   }),
 * );
 * ```
 */
export function passkey(options: PasskeyMiddlewareOptions): Hono {
  const {
    rpName,
    rpID,
    origin,
    store,
    challengeStore = new InMemoryChallengeStore(),
    pathPrefix = "/passkey",
  } = options;

  const app = new Hono();

  // ── POST {prefix}/register/options ──────────────────────────────────────
  app.post(`${pathPrefix}/register/options`, async (c) => {
    const body = await c.req.json<{ username: string }>();
    const { username } = body;

    if (!username || typeof username !== "string") {
      return c.json({ error: "username is required" }, 400);
    }

    // Find or create user
    let user = await store.getUserByUsername(username);
    if (!user) {
      user = { id: crypto.randomUUID(), username };
      await store.createUser(user);
    }

    // Retrieve existing credentials to prevent duplicate registrations
    const existingPasskeys = await store.getPasskeysByUser(user.id);

    const registrationOptions: PublicKeyCredentialCreationOptionsJSON =
      await generateRegistrationOptions({
        rpName,
        rpID,
        userName: user.username,
        attestationType: "none",
        excludeCredentials: existingPasskeys.map((pk) => ({
          id: pk.id,
          transports: pk.transports,
        })),
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "preferred",
        },
      });

    // Persist the challenge so we can verify it in the next request.
    // Key by the internal user ID.
    await challengeStore.set(
      `reg:${user.id}`,
      registrationOptions.challenge,
      60_000,
    );

    // We'll need the userId on the verify side – stash it alongside.
    await challengeStore.set(
      `reg-user:${registrationOptions.challenge}`,
      user.id,
      60_000,
    );

    return c.json(registrationOptions);
  });

  // ── POST {prefix}/register/verify ───────────────────────────────────────
  app.post(`${pathPrefix}/register/verify`, async (c) => {
    const body = await c.req.json<
      RegistrationResponseJSON & { username: string }
    >();
    const { username, ...registrationResponse } = body;

    if (!username) {
      return c.json({ error: "username is required" }, 400);
    }

    const user = await store.getUserByUsername(username);
    if (!user) {
      return c.json({ error: "user not found" }, 400);
    }

    const expectedChallenge = await challengeStore.get(`reg:${user.id}`);
    if (!expectedChallenge) {
      return c.json({ error: "challenge expired or not found" }, 400);
    }

    try {
      const verification = await verifyRegistrationResponse({
        response: registrationResponse,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
      });

      const { verified, registrationInfo } = verification;

      if (!verified || !registrationInfo) {
        return c.json({ verified: false }, 400);
      }

      const { credential, credentialDeviceType, credentialBackedUp } =
        registrationInfo;

      // Retrieve the WebAuthn user ID that was generated during options.
      // SimpleWebAuthn encodes it in registrationInfo but we can also
      // read it from registrationOptions.user.id stored earlier – however
      // that requires persisting the full options.  The registrationInfo
      // conveniently provides `credentialID` and `credentialPublicKey`.
      //
      // For the webAuthnUserID we use the challenge→userId mapping.
      const webAuthnUserID =
        (await challengeStore.get(
          `reg-user:${expectedChallenge}`,
        )) ?? user.id;

      await store.savePasskey(user.id, {
        id: credential.id,
        publicKey: credential.publicKey,
        webAuthnUserID: webAuthnUserID as string,
        counter: credential.counter,
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        transports: credential.transports,
      });

      return c.json({ verified: true, userId: user.id });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "verification failed";
      return c.json({ error: message, verified: false }, 400);
    }
  });

  // ── POST {prefix}/authenticate/options ──────────────────────────────────
  app.post(`${pathPrefix}/authenticate/options`, async (c) => {
    const body = await c.req.json<{ username?: string }>().catch(() => ({}));
    const { username } = body as { username?: string };

    let allowCredentials:
      | { id: string; transports?: AuthenticationResponseJSON["response"]["authenticatorData"] extends string ? undefined : undefined }[]
      | undefined;

    // If a username is provided, scope credentials to that user.
    // Otherwise allow discoverable-credential (passkey) flow.
    if (username) {
      const user = await store.getUserByUsername(username);
      if (!user) {
        return c.json({ error: "user not found" }, 400);
      }

      const userPasskeys = await store.getPasskeysByUser(user.id);
      allowCredentials = userPasskeys.map((pk) => ({
        id: pk.id,
        transports: pk.transports,
      })) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    }

    const authenticationOptions: PublicKeyCredentialRequestOptionsJSON =
      await generateAuthenticationOptions({
        rpID,
        allowCredentials,
      });

    // Store the challenge keyed by the challenge value itself so we can
    // verify without needing to identify the user up front (discoverable
    // credentials may not send a username).
    await challengeStore.set(
      `auth:${authenticationOptions.challenge}`,
      authenticationOptions.challenge,
      60_000,
    );

    // If we know the user, also key by userId for convenience.
    if (username) {
      const user = await store.getUserByUsername(username);
      if (user) {
        await challengeStore.set(
          `auth:${user.id}`,
          authenticationOptions.challenge,
          60_000,
        );
      }
    }

    return c.json(authenticationOptions);
  });

  // ── POST {prefix}/authenticate/verify ───────────────────────────────────
  app.post(`${pathPrefix}/authenticate/verify`, async (c) => {
    const body = await c.req.json<
      AuthenticationResponseJSON & { username?: string; challenge?: string }
    >();
    const { username, challenge: providedChallenge, ...authResponse } = body;

    // We need to find the expected challenge.
    // Strategy: if a username is provided, look up by userId.
    // Otherwise, the caller must include the original challenge value.
    let expectedChallenge: string | null = null;

    if (username) {
      const user = await store.getUserByUsername(username);
      if (user) {
        expectedChallenge = await challengeStore.get(`auth:${user.id}`);
      }
    }

    if (!expectedChallenge && providedChallenge) {
      expectedChallenge = await challengeStore.get(
        `auth:${providedChallenge}`,
      );
    }

    if (!expectedChallenge) {
      return c.json({ error: "challenge expired or not found" }, 400);
    }

    // Look up the credential that was used
    const credentialRecord = await store.getPasskeyById(authResponse.id);
    if (!credentialRecord) {
      return c.json({ error: "credential not found" }, 400);
    }

    try {
      const verification = await verifyAuthenticationResponse({
        response: authResponse,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: credentialRecord.id,
          publicKey: new Uint8Array(credentialRecord.publicKey),
          counter: credentialRecord.counter,
          transports: credentialRecord.transports,
        },
      });

      const { verified, authenticationInfo } = verification;

      if (!verified) {
        return c.json({ verified: false }, 400);
      }

      // Update the signature counter
      await store.updatePasskeyCounter(
        credentialRecord.id,
        authenticationInfo.newCounter,
      );

      // Resolve the authenticated user
      const user = await store.getUserById(credentialRecord.userId);

      return c.json({
        verified: true,
        userId: credentialRecord.userId,
        username: user?.username,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "verification failed";
      return c.json({ error: message, verified: false }, 400);
    }
  });

  return app;
}
