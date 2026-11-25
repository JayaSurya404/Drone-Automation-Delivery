import { UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import { ServiceAuthGuard } from "./service-auth.guard";

function createContext(headers: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  } as unknown as ExecutionContext;
}

describe("ServiceAuthGuard", () => {
  const configService = { get: () => "correct-service-key-1234567890" };
  const guard = new ServiceAuthGuard(configService as never);

  it("allows a request with the correct service API key header", () => {
    const context = createContext({ "x-service-api-key": "correct-service-key-1234567890" });
    expect(guard.canActivate(context)).toBe(true);
  });

  it("rejects a request with a wrong key", () => {
    const context = createContext({ "x-service-api-key": "wrong-key" });
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it("rejects a request with no key header at all", () => {
    const context = createContext({});
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it("never accepts a user JWT bearer token in place of the service key", () => {
    const context = createContext({ authorization: "Bearer some.jwt.token" });
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
