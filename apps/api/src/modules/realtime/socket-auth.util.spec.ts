import type { JwtService } from "@nestjs/jwt";
import type { Socket } from "socket.io";
import { authenticateSocket, extractSocketToken } from "./socket-auth.util";

function fakeSocket(handshake: Partial<Socket["handshake"]>): Socket {
  return { handshake } as unknown as Socket;
}

describe("extractSocketToken", () => {
  it("reads the token from handshake.auth.token", () => {
    const socket = fakeSocket({ auth: { token: "abc" }, query: {} });
    expect(extractSocketToken(socket)).toBe("abc");
  });

  it("falls back to handshake.query.token", () => {
    const socket = fakeSocket({ auth: {}, query: { token: "xyz" } });
    expect(extractSocketToken(socket)).toBe("xyz");
  });

  it("returns undefined when neither is present", () => {
    const socket = fakeSocket({ auth: {}, query: {} });
    expect(extractSocketToken(socket)).toBeUndefined();
  });

  it("ignores a non-string query token", () => {
    const socket = fakeSocket({ auth: {}, query: { token: ["a", "b"] } });
    expect(extractSocketToken(socket)).toBeUndefined();
  });
});

describe("authenticateSocket", () => {
  it("returns null when no token is present", async () => {
    const jwtService = { verifyAsync: jest.fn() } as unknown as JwtService;
    const socket = fakeSocket({ auth: {}, query: {} });

    expect(await authenticateSocket(jwtService, socket)).toBeNull();
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it("returns the decoded user for a valid token", async () => {
    const user = { sub: "u1", email: "a@b.com", roles: ["customer"], permissions: [] };
    const jwtService = { verifyAsync: jest.fn().mockResolvedValue(user) } as unknown as JwtService;
    const socket = fakeSocket({ auth: { token: "good" }, query: {} });

    expect(await authenticateSocket(jwtService, socket)).toEqual(user);
    expect(jwtService.verifyAsync).toHaveBeenCalledWith("good");
  });

  it("returns null when the token fails verification (invalid/expired)", async () => {
    const jwtService = { verifyAsync: jest.fn().mockRejectedValue(new Error("bad token")) } as unknown as JwtService;
    const socket = fakeSocket({ auth: { token: "bad" }, query: {} });

    expect(await authenticateSocket(jwtService, socket)).toBeNull();
  });
});
