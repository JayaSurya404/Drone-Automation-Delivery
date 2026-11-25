import { HttpException, HttpStatus, type ArgumentsHost } from "@nestjs/common";
import { AllExceptionsFilter } from "./all-exceptions.filter";

function createHost(url = "/api/v1/example") {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const response = { status };
  const request = { url, method: "GET" };

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;

  return { host, status, json };
}

describe("AllExceptionsFilter", () => {
  it("formats an HttpException into the standard error envelope", () => {
    const filter = new AllExceptionsFilter();
    const { host, status, json } = createHost();

    filter.catch(new HttpException("Not found", HttpStatus.NOT_FOUND), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          statusCode: HttpStatus.NOT_FOUND,
          message: "Not found",
          path: "/api/v1/example",
        }),
      }),
    );
  });

  it("falls back to 500 and a generic message for an unknown error", () => {
    const filter = new AllExceptionsFilter();
    const { host, status, json } = createHost();

    filter.catch(new Error("boom"), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: "Internal server error",
        }),
      }),
    );
  });
});
